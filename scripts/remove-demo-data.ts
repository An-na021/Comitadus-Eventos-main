import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

const target = new URL(process.env.DATABASE_URL!);
assert(
  ['localhost', '127.0.0.1'].includes(target.hostname) && target.pathname === '/eventos',
  'Limpeza limitada ao banco local eventos.'
);
const apply = process.argv.includes('--apply');
const db = new PrismaClient();
const models = [
  'user',
  'session',
  'costCenter',
  'course',
  'theme',
  'environment',
  'resource',
  'environmentResource',
  'eventRequest',
  'eventRequestResource',
  'requestHistory',
] as const;
const courses = ['Engenharia de Software', 'Administração', 'Coordenação de Extensão'];
const themes = [
  'Tecnologia e inovação',
  'Cultura e comunidade',
  'Pesquisa e ciência',
  'Carreiras e futuro',
];
const environments = [
  'Auditório principal',
  'Sala de inovação',
  'Laboratório de informática',
  'Espaço de convivência',
];
const resources = [
  'Projetor',
  'Microfone',
  'Sistema de som',
  'Computadores',
  'Quadro branco',
  'Transmissão',
];
const demoUsers: Record<string, string> = {
  'admin@demo.test': 'Helena Martins',
  'ana@demo.test': 'Ana Silva',
  'bruno@demo.test': 'Bruno Costa',
};
const titles = [
  'Inteligência artificial e os novos caminhos',
  'Encontro de extensão e comunidade',
  'Pesquisa que transforma o futuro',
  'Carreiras em movimento',
  'Conexões do conhecimento',
  'Oficina de ideias',
  'Encontro encerrado',
  'Conflito: outro encontro no auditório',
];
const serialize = (value: unknown) => JSON.stringify(value);

try {
  const report = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(928410)`;
      const before: Record<string, any[]> = {};
      for (const model of models) before[model] = await (tx as any)[model].findMany();
      const markers = before.requestHistory.filter(
        (h) => h.action === 'Registro fictício de demonstração criado'
      );
    const ids = markers.map((h) => h.requestId);
    if (!ids.length) return { mode: 'no-op', message: 'Nenhum registro identificado como demonstração. Nenhum dado foi removido.' };
      const candidates = before.eventRequest.filter(
        (e) => ids.includes(e.id) && titles.includes(e.title)
      );
      assert.equal(
        candidates.length,
        ids.length,
        'Um exemplo foi renomeado: revisar antes de excluir.'
      );
      const keptEvents = before.eventRequest.filter((e) => !ids.includes(e.id));
      if (!apply)
        return {
          mode: 'preview',
          demoEvents: candidates.map((e) => ({ id: e.id, title: e.title })),
          preservedEvents: keptEvents.map((e) => ({ id: e.id, title: e.title })),
        };

      const dir = path.resolve('.postgres/backups');
      await mkdir(dir, { recursive: true });
      const backup = path.join(dir, `antes-limpeza-demonstracao-${Date.now()}.json`);
      const content = JSON.stringify(
        {
          format: 'comitadus-prisma-snapshot-v1',
          createdAt: new Date().toISOString(),
          database: 'eventos',
          tables: before,
        },
        null,
        2
      );
      await writeFile(backup, content, { flag: 'wx', mode: 0o600 });
      const digest = (data: string) => createHash('sha256').update(data).digest('hex');
      assert.equal(
        digest(await readFile(backup, 'utf8')),
        digest(content),
        'Verificação do backup falhou.'
      );
      const removed: Record<string, number> = {};
      removed.events = (await tx.eventRequest.deleteMany({ where: { id: { in: ids } } })).count;
      assert.equal(removed.events, ids.length);

      // Remove only original catalog values without remaining references.
      for (const [i, name] of environments.entries()) {
        const env = before.environment.find(
          (e) =>
            e.name === name &&
            e.active &&
            e.description === '' &&
            e.location === `Bloco ${String.fromCharCode(65 + i)} · Campus São Bento do Sul` &&
            e.capacity === [180, 45, 30, 100][i]
        );
        if (!env || (await tx.eventRequest.count({ where: { environmentId: env.id } }))) continue;
        const links = before.environmentResource.filter((r) => r.environmentId === env.id);
        const expected = resources.slice(i === 2 ? 2 : 0, i === 2 ? 6 : 3);
        if (
          links.length !== expected.length ||
          links.some(
            (r) => !expected.includes(before.resource.find((v) => v.id === r.resourceId)?.name)
          )
        )
          continue;
        await tx.environmentResource.deleteMany({ where: { environmentId: env.id } });
        await tx.environment.delete({ where: { id: env.id } });
        removed.environments = (removed.environments || 0) + 1;
      }
      for (const name of resources) {
        const r = before.resource.find((v) => v.name === name && v.active && v.description === '');
        if (
          !r ||
          (await tx.environmentResource.count({ where: { resourceId: r.id } })) ||
          (await tx.eventRequestResource.count({ where: { resourceId: r.id } }))
        )
          continue;
        await tx.resource.delete({ where: { id: r.id } });
        removed.resources = (removed.resources || 0) + 1;
      }
      for (const name of themes) {
        const r = before.theme.find((v) => v.name === name && v.active && v.description === '');
        if (!r || (await tx.eventRequest.count({ where: { themeId: r.id } }))) continue;
        await tx.theme.delete({ where: { id: r.id } });
        removed.themes = (removed.themes || 0) + 1;
      }
      for (const [i, name] of courses.entries()) {
        const center = before.costCenter.find(
          (v) => v.code === `CC-00${i + 1}` && v.name === `Centro ${name}` && v.active
        );
        const course = before.course.find(
          (v) => v.name === name && v.active && v.costCenterId === center?.id
        );
        if (course && !(await tx.eventRequest.count({ where: { courseId: course.id } }))) {
          await tx.course.delete({ where: { id: course.id } });
          removed.courses = (removed.courses || 0) + 1;
        }
        if (
          center &&
          !(await tx.course.count({ where: { costCenterId: center.id } })) &&
          !(await tx.eventRequest.count({ where: { costCenterId: center.id } }))
        ) {
          await tx.costCenter.delete({ where: { id: center.id } });
          removed.costCenters = (removed.costCenters || 0) + 1;
        }
      }
      for (const user of before.user) {
        if (demoUsers[user.email] !== user.name || +user.updatedAt !== +user.createdAt) continue;
        if (
          (await tx.eventRequest.count({
            where: { OR: [{ authorUserId: user.id }, { reviewedBy: user.id }] },
          })) ||
          (await tx.requestHistory.count({ where: { actorUserId: user.id } }))
        )
          continue;
        if (
          user.role === 'ADMIN' &&
          user.active &&
          (await tx.user.count({ where: { role: 'ADMIN', active: true } })) <= 1
        )
          continue;
        await tx.user.delete({ where: { id: user.id } });
        removed.users = (removed.users || 0) + 1;
      }

      // Every surviving row must be byte-equivalent to the original snapshot.
      const remaining: Record<string, number> = {};
      for (const model of models) {
        const after = await (tx as any)[model].findMany();
        remaining[model] = after.length;
        const key = (r: any) =>
          r.id ||
          (model === 'environmentResource'
            ? `${r.environmentId}:${r.resourceId}`
            : `${r.eventRequestId}:${r.resourceId}`);
        const original = new Map(before[model].map((r) => [key(r), serialize(r)]));
        for (const row of after)
          assert.equal(
            serialize(row),
            original.get(key(row)),
            `Registro alterado indevidamente em ${model}.`
          );
      }
      const afterEvents = await tx.eventRequest.findMany();
      assert.deepEqual(afterEvents.map((e) => e.id).sort(), keptEvents.map((e) => e.id).sort());
      assert(
        (await tx.user.count({ where: { role: 'ADMIN', active: true } })) > 0,
        'Nenhum administrador ativo restante.'
      );
      return {
        mode: 'applied',
        backup,
        removed,
        remaining,
        preservedEvents: keptEvents.map((e) => ({ id: e.id, title: e.title })),
        verified: 'Todos os registros remanescentes foram preservados sem alterações.',
      };
    },
    { timeout: 60000 }
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.$disconnect();
}
