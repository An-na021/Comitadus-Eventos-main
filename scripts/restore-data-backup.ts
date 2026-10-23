import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const target = new URL(process.env.DATABASE_URL!);
assert(
  ['localhost', '127.0.0.1'].includes(target.hostname) && target.pathname === '/eventos',
  'Restauração limitada ao banco local eventos.'
);
const backupDir = path.resolve('.postgres/backups');
const input = process.argv.find((arg) => arg.endsWith('.json'));
assert(input, 'Informe o arquivo de backup JSON.');
const sourcePath = path.resolve(input);
assert(path.dirname(sourcePath) === backupDir, 'O arquivo deve estar em .postgres/backups.');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
assert(
  source.format === 'comitadus-prisma-snapshot-v1' && source.database === 'eventos',
  'Formato de backup inválido.'
);
const models = [
  'user',
  'costCenter',
  'resource',
  'theme',
  'environment',
  'course',
  'environmentResource',
  'eventRequest',
  'eventRequestResource',
  'requestHistory',
] as const;
const key = (model: string, r: any) =>
  r.id ||
  (model === 'environmentResource'
    ? `${r.environmentId}:${r.resourceId}`
    : `${r.eventRequestId}:${r.resourceId}`);
const canonical = (row: any) => JSON.parse(JSON.stringify(row));
const apply = process.argv.includes('--apply');
const db = new PrismaClient();
try {
  const result = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(928410)`;
      const before: Record<string, any[]> = {};
      const missing: Record<string, any[]> = {};
      for (const model of models) {
        assert(Array.isArray(source.tables[model]), `Tabela ausente no backup: ${model}`);
        before[model] = await (tx as any)[model].findMany();
        const existing = new Set(before[model].map((r) => key(model, r)));
        missing[model] = source.tables[model].filter((r: any) => !existing.has(key(model, r)));
      }
      const counts = Object.fromEntries(models.map((model) => [model, missing[model].length]));
      if (!apply) return { mode: 'preview', restore: counts };
      // Save the current state as well, then insert missing rows without updating any existing row.
      const backup = path.join(backupDir, `antes-restauracao-${Date.now()}.json`);
      const snapshot = JSON.stringify(
        {
          format: source.format,
          database: 'eventos',
          createdAt: new Date().toISOString(),
          tables: { ...before, session: await tx.session.findMany() },
        },
        null,
        2
      );
      await writeFile(backup, snapshot, { flag: 'wx', mode: 0o600 });
      assert.equal(
        await readFile(backup, 'utf8'),
        snapshot,
        'Falha na verificação do backup atual.'
      );
      for (const model of models) {
        if (!missing[model].length) continue;
        const data = missing[model].map((r) =>
          model === 'requestHistory' && r.details === null ? { ...r, details: Prisma.DbNull } : r
        );
        await (tx as any)[model].createMany({ data });
      }
      const totals: Record<string, number> = {};
      for (const model of models) {
        const after = await (tx as any)[model].findMany();
        const map = new Map(after.map((r: any) => [key(model, r), canonical(r)]));
        for (const row of [...before[model], ...missing[model]])
          assert.deepEqual(
            map.get(key(model, row)),
            canonical(row),
            `Divergência ao verificar ${model}.`
          );
        assert.equal(after.length, before[model].length + missing[model].length);
        totals[model] = after.length;
      }
      return {
        mode: 'restored',
        source: sourcePath,
        backup,
        restored: counts,
        totals,
        verified:
          'Registros anteriores preservados e registros restaurados idênticos ao backup. Sessões antigas não foram reativadas.',
      };
    },
    { timeout: 60000 }
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await db.$disconnect();
}
