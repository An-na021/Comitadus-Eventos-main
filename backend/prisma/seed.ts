import { db } from '../src/db.js';
import bcrypt from 'bcryptjs';
async function main() {
  if (!process.argv.includes('--demo')) {
    console.log(
      'Nenhum dado de demonstração foi criado. Para carregar exemplos explicitamente, use npm run db:seed:demo.'
    );
    return;
  }
  const passwordHash = await bcrypt.hash('DemoEventos2026!', 12);
  const users = [];
  for (const [email, name, role] of [
    ['admin@demo.test', 'Helena Martins', 'ADMIN'],
    ['ana@demo.test', 'Ana Silva', 'SOLICITANTE'],
    ['bruno@demo.test', 'Bruno Costa', 'SOLICITANTE'],
  ] as const)
    users.push(
      await db.user.upsert({
        where: { email },
        update: {},
        create: { email, name, role, passwordHash },
      })
    );
  const courses = [];
  for (const [i, name] of [
    'Engenharia de Software',
    'Administração',
    'Coordenação de Extensão',
  ].entries()) {
    const center = await db.costCenter.upsert({
      where: { code: `CC-00${i + 1}` },
      update: {},
      create: { code: `CC-00${i + 1}`, name: `Centro ${name}` },
    });
    courses.push(
      await db.course.upsert({
        where: { name },
        update: {},
        create: { name, costCenterId: center.id },
      })
    );
  }
  const resources = [];
  for (const name of [
    'Projetor',
    'Microfone',
    'Sistema de som',
    'Computadores',
    'Quadro branco',
    'Transmissão',
  ])
    resources.push(await db.resource.upsert({ where: { name }, update: {}, create: { name } }));
  const themes = [];
  for (const name of [
    'Tecnologia e inovação',
    'Cultura e comunidade',
    'Pesquisa e ciência',
    'Carreiras e futuro',
  ])
    themes.push(await db.theme.upsert({ where: { name }, update: {}, create: { name } }));
  const environments = [];
  for (const [i, name] of [
    'Auditório principal',
    'Sala de inovação',
    'Laboratório de informática',
    'Espaço de convivência',
  ].entries()) {
    const env = await db.environment.upsert({
      where: { name },
      update: {},
      create: {
        name,
        location: `Bloco ${String.fromCharCode(65 + i)} · Campus São Bento do Sul`,
        capacity: [180, 45, 30, 100][i],
      },
    });
    environments.push(env);
    for (const r of resources.slice(i === 2 ? 2 : 0, i === 2 ? 6 : 3))
      await db.environmentResource.upsert({
        where: { environmentId_resourceId: { environmentId: env.id, resourceId: r.id } },
        update: {},
        create: { environmentId: env.id, resourceId: r.id },
      });
  }
  if ((await db.eventRequest.count()) === 0) {
    const now = new Date(),
      baseDay = Math.min(now.getDate() + 1, 28);
    const samples = [
      ['Inteligência artificial e os novos caminhos', 'APROVADO', 0],
      ['Encontro de extensão e comunidade', 'APROVADO', 1],
      ['Pesquisa que transforma o futuro', 'APROVADO', 2],
      ['Carreiras em movimento', 'PENDENTE', 0],
      ['Conexões do conhecimento', 'REJEITADO', 1],
      ['Oficina de ideias', 'RASCUNHO', 0],
      ['Encontro encerrado', 'CANCELADO', 0],
      ['Conflito: outro encontro no auditório', 'PENDENTE', 0],
    ] as const;
    for (const [i, [title, status, month]] of samples.entries()) {
      const idx = i === 7 ? 0 : i % 4;
      const day = new Date(Date.UTC(now.getFullYear(), now.getMonth() + month, baseDay));
      const c = courses[i % 3];
      const author = users[i === 4 ? 2 : 1];
      const event = await db.eventRequest.create({
        data: {
          title,
          status,
          authorUserId: author.id,
          requesterName: 'Equipe de organização acadêmica',
          description:
            'Uma oportunidade para compartilhar experiências, ampliar perspectivas e construir novas conexões na comunidade universitária.',
          speaker: 'Marina Almeida (personagem fictícia)',
          targetAudience: 'Comunidade acadêmica e público interessado',
          justification: 'Promover a troca de conhecimento e experiências.',
          objective: 'Conectar estudantes, docentes e comunidade.',
          ceremonial: false,
          registration: true,
          declarations: true,
          eventDate: day,
          startTime: '19:00',
          endTime: '21:00',
          courseId: c.id,
          costCenterId: c.costCenterId,
          themeId: themes[idx].id,
          environmentId: environments[idx].id,
          ...(status === 'REJEITADO'
            ? {
                rejectionReason: 'Detalhe o objetivo e a programação antes de reenviar.',
                reviewedBy: users[0].id,
                reviewedAt: new Date(),
              }
            : status === 'APROVADO'
              ? { reviewedBy: users[0].id, reviewedAt: new Date() }
              : {}),
        },
      });
      await db.requestHistory.create({
        data: {
          requestId: event.id,
          actorUserId: author.id,
          action: 'Registro fictício de demonstração criado',
          newStatus: status,
        },
      });
    }
  }
  console.log('Seed pronto: admin@demo.test, ana@demo.test, bruno@demo.test / DemoEventos2026!');
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
