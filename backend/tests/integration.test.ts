import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
// Always use an isolated database. Never run integration tests in the demo database.
const url = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!);
url.pathname = '/eventos_test';
process.env.DATABASE_URL = url.toString();
const { app } = await import('../src/app.js');
const { db } = await import('../src/db.js');
const admin = request.agent(app),
  owner = request.agent(app),
  other = request.agent(app);
const prefix = 'test-' + Date.now();
let users: any[],
  course: any,
  theme: any,
  env: any,
  env2: any,
  resource: any,
  foreignResource: any,
  base: any;
async function draft(data: any = {}) {
  const r = await owner.post('/api/requests').send(data);
  expect(r.status).toBe(201);
  return r.body;
}
async function pending(data: any = {}) {
  const e = await draft({ ...base, ...data });
  expect((await owner.post(`/api/requests/${e.id}/submit`)).status).toBe(200);
  return e;
}
beforeAll(async () => {
  const passwordHash = await bcrypt.hash('Integration123!', 4);
  users = [];
  for (const [i, role] of ['ADMIN', 'SOLICITANTE', 'SOLICITANTE'].entries())
    users.push(
      await db.user.create({
        data: {
          name: prefix + i,
          email: `${prefix}${i}@test.invalid`,
          passwordHash,
          role: role as any,
        },
      })
    );
  const center = await db.costCenter.create({ data: { name: prefix, code: prefix } });
  course = await db.course.create({ data: { name: prefix, costCenterId: center.id } });
  theme = await db.theme.create({ data: { name: prefix } });
  resource = await db.resource.create({ data: { name: prefix + 'recurso' } });
  foreignResource = await db.resource.create({ data: { name: prefix + 'outro' } });
  env = await db.environment.create({
    data: { name: prefix, resources: { create: { resourceId: resource.id } } },
  });
  env2 = await db.environment.create({ data: { name: prefix + '2' } });
  base = {
    title: prefix + 'Evento',
    requesterName: 'Pessoa livre diferente do autor',
    speaker: 'Palestrante fictício',
    targetAudience: 'Estudantes',
    justification: 'Compartilhar',
    objective: 'Aprender',
    eventDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
    startTime: '10:00',
    endTime: '12:00',
    courseId: course.id,
    themeId: theme.id,
    environmentId: env.id,
    resourceIds: [resource.id],
    ceremonial: false,
    registration: true,
    declarations: false,
  };
  for (const [i, agent] of [admin, owner, other].entries())
    expect(
      (
        await agent
          .post('/api/auth/login')
          .send({ email: users[i].email, password: 'Integration123!' })
      ).status
    ).toBe(200);
}, 30000);
afterAll(async () => {
  if (users) {
    await db.eventRequest.deleteMany({ where: { authorUserId: { in: users.map((u) => u.id) } } });
    await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await db.environmentResource.deleteMany({ where: { environmentId: env?.id } });
    await db.environment.deleteMany({ where: { name: { startsWith: prefix } } });
    await db.course.deleteMany({ where: { name: prefix } });
    await db.costCenter.deleteMany({ where: { code: prefix } });
    await db.resource.deleteMany({ where: { name: { startsWith: prefix } } });
    await db.theme.deleteMany({ where: { name: prefix } });
  }
  await db.$disconnect();
});
describe('Fluxos reais com PostgreSQL', () => {
  it('visitante vê apenas aprovados e não acessa solicitações', async () => {
    expect((await request(app).get('/api/requests')).status).toBe(401);
    expect((await request(app).get('/api/public/events')).status).toBe(200);
  });
  it('cria e edita rascunho incompleto, preservando autor', async () => {
    const e = await draft();
    const r = await owner.patch('/api/requests/' + e.id).send({ title: 'Editado' });
    expect(r.status).toBe(200);
    expect(r.body.authorUserId).toBe(users[1].id);
    expect((await request(app).get('/api/public/events/' + e.id)).status).toBe(404);
  });
  it('impede envio incompleto', async () => {
    const e = await draft();
    expect((await owner.post(`/api/requests/${e.id}/submit`)).status).toBe(422);
  });
  it('envia completo, deriva centro de custo e registra solicitante livre', async () => {
    const e = await pending();
    const r = await owner.get('/api/requests/' + e.id);
    expect(r.body.status).toBe('PENDENTE');
    expect(r.body.costCenterId).toBe(course.costCenterId);
    expect(r.body.requesterName).toBe(base.requesterName);
  });
  it('bloqueia edição pendente', async () => {
    const e = await pending();
    expect((await owner.patch('/api/requests/' + e.id).send({ title: 'x' })).status).toBe(409);
  });
  it('exige perfil administrativo', async () => {
    const e = await pending();
    expect((await owner.post(`/api/requests/${e.id}/approve`)).status).toBe(403);
    expect((await owner.get('/api/admin/users')).status).toBe(403);
  });
  it('exige justificativa na rejeição e permite correção e reenvio', async () => {
    const e = await pending();
    expect((await admin.post(`/api/requests/${e.id}/reject`).send({ reason: ' ' })).status).toBe(
      422
    );
    expect(
      (await admin.post(`/api/requests/${e.id}/reject`).send({ reason: 'Ajuste o objetivo' }))
        .status
    ).toBe(200);
    expect(
      (await owner.patch('/api/requests/' + e.id).send({ objective: 'Objetivo corrigido' })).status
    ).toBe(200);
    expect((await owner.post(`/api/requests/${e.id}/submit`)).status).toBe(200);
  });
  it('cancela pendente e mantém histórico', async () => {
    const e = await pending();
    expect((await owner.post(`/api/requests/${e.id}/cancel`)).body.status).toBe('CANCELADO');
    expect((await owner.get('/api/requests/' + e.id)).body.history.length).toBe(3);
  });
  it('não permite acessar ou alterar registro alheio', async () => {
    const e = await draft();
    expect((await other.get('/api/requests/' + e.id)).status).toBe(404);
    expect((await other.patch('/api/requests/' + e.id).send({ title: 'x' })).status).toBe(404);
    expect((await other.delete('/api/requests/' + e.id)).status).toBe(404);
  });
  it('filtra recursos por ambiente e rejeita recurso externo', async () => {
    const c = await owner.get('/api/catalogs');
    expect(
      c.body.environments.find((v: any) => v.id === env.id).resources.map((r: any) => r.resourceId)
    ).toEqual([resource.id]);
    expect(
      (await owner.post('/api/requests').send({ ...base, resourceIds: [foreignResource.id] }))
        .status
    ).toBe(422);
  });
  it('aprova, publica, impede alteração pelo solicitante, cancela e retira da agenda', async () => {
    const e = await pending();
    expect((await admin.post(`/api/requests/${e.id}/approve`)).status).toBe(200);
    const pub = await request(app).get('/api/public/events/' + e.id);
    expect(pub.status).toBe(200);
    expect(pub.body.justification).toBeUndefined();
    expect((await owner.patch('/api/requests/' + e.id).send({ title: 'x' })).status).toBe(409);
    expect((await owner.post(`/api/requests/${e.id}/cancel`)).status).toBe(409);
    expect((await admin.post(`/api/requests/${e.id}/cancel`)).status).toBe(200);
    expect((await request(app).get('/api/public/events/' + e.id)).status).toBe(404);
  });
  it('impede reserva dupla em aprovações concorrentes e conflito no envio', async () => {
    const a = await pending(),
      b = await pending();
    const results = await Promise.all([
      admin.post(`/api/requests/${a.id}/approve`),
      admin.post(`/api/requests/${b.id}/approve`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const c = await draft(base);
    expect((await owner.post(`/api/requests/${c.id}/submit`)).status).toBe(409);
  });
  it('permite horários consecutivos e outro ambiente', async () => {
    const a = await pending({ startTime: '12:00', endTime: '13:00' });
    expect((await admin.post(`/api/requests/${a.id}/approve`)).status).toBe(200);
    const b = await pending({ environmentId: env2.id, resourceIds: [] });
    expect((await admin.post(`/api/requests/${b.id}/approve`)).status).toBe(200);
  });
  it('revalida conflitos ao editar aprovado e registra alteração', async () => {
    const e = await pending({ startTime: '14:00', endTime: '15:00' });
    await admin.post(`/api/requests/${e.id}/approve`);
    expect((await admin.patch('/api/requests/' + e.id).send({ startTime: '11:00' })).status).toBe(
      409
    );
    expect((await admin.patch('/api/requests/' + e.id).send({ title: 'Novo título' })).status).toBe(
      200
    );
    const r = await admin.get('/api/requests/' + e.id);
    expect(r.body.history.at(-1).details.before.title).toBe(base.title);
  });
  it('exporta mesmos registros filtrados em CSV real', async () => {
    const json = await admin
      .get('/api/admin/reports')
      .query({ courseId: course.id, status: 'APROVADO' });
    const csv = await admin
      .get('/api/admin/reports/export')
      .query({ courseId: course.id, status: 'APROVADO' });
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Centro de custo');
    for (const row of json.body) expect(csv.text).toContain(row.title);
    expect(json.body.length).toBeGreaterThan(0);
  });
  it('preserva dados após desconectar e recriar a conexão', async () => {
    const e = await draft({ title: prefix + 'Persistente' });
    await db.$disconnect();
    const r = await owner.get('/api/requests/' + e.id);
    expect(r.body.title).toBe(prefix + 'Persistente');
  });
  it('impede excluir cadastros vinculados', async () => {
    expect((await admin.delete('/api/admin/courses/' + course.id)).status).toBe(409);
    expect((await admin.delete('/api/admin/environments/' + env.id)).status).toBe(409);
  });
  it('cadastra, edita e exclui tema não utilizado', async () => {
    const r = await admin.post('/api/admin/themes').send({ name: prefix + 'novo' });
    expect(r.status).toBe(201);
    expect(
      (
        await admin
          .patch('/api/admin/themes/' + r.body.id)
          .send({ name: prefix + 'editado', active: false })
      ).status
    ).toBe(200);
    expect((await admin.delete('/api/admin/themes/' + r.body.id)).status).toBe(200);
  });
  it.each(['cost-centers', 'courses', 'resources', 'environments'])(
    'valida CRUD administrativo de %s',
    async (kind) => {
      const payload: any = { name: prefix + 'crud-' + kind, active: true };
      if (kind === 'cost-centers') payload.code = prefix + 'crud';
      if (kind === 'courses') payload.costCenterId = course.costCenterId;
      if (kind === 'environments') {
        payload.location = 'Bloco fictício';
        payload.capacity = 30;
        payload.resourceIds = [resource.id];
      }
      const created = await admin.post('/api/admin/' + kind).send(payload);
      expect(created.status).toBe(201);
      expect(
        (await admin.get('/api/admin/' + kind)).body.some((r: any) => r.id === created.body.id)
      ).toBe(true);
      const edit = {
        ...payload,
        name: payload.name + ' editado',
        active: false,
        ...(kind === 'environments' ? { resourceIds: [] } : {}),
      };
      expect(
        (await admin.patch('/api/admin/' + kind + '/' + created.body.id).send(edit)).status
      ).toBe(200);
      expect((await admin.delete('/api/admin/' + kind + '/' + created.body.id)).status).toBe(200);
    }
  );
  it('gerencia usuários, omite hashes e preserva último administrador', async () => {
    const data = {
      name: prefix + 'Usuário',
      email: prefix + 'novo@test.invalid',
      password: 'NovoUsuario123!',
      role: 'SOLICITANTE',
      active: true,
    };
    const created = await admin.post('/api/admin/users').send(data);
    expect(created.status).toBe(201);
    users.push(created.body);
    expect(created.body.passwordHash).toBeUndefined();
    const { password, ...edit } = data;
    expect(
      (await admin.patch('/api/admin/users/' + created.body.id).send({ ...edit, active: false }))
        .status
    ).toBe(200);
    expect(
      (
        await admin
          .patch('/api/admin/users/' + users[0].id)
          .send({ name: users[0].name, email: users[0].email, role: 'ADMIN', active: false })
      ).status
    ).toBe(409);
  });
  it('restrição do banco bloqueia sobreposição mesmo sem passar pela API', async () => {
    const e = await draft(base);
    await expect(
      db.eventRequest.update({ where: { id: e.id }, data: { status: 'APROVADO' } })
    ).rejects.toThrow();
  });
  it('não publica eventos aprovados fora da janela de três meses', async () => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() + 4);
    const e = await pending({
      eventDate: d.toISOString().slice(0, 10),
      startTime: '08:00',
      endTime: '09:00',
    });
    expect((await admin.post(`/api/requests/${e.id}/approve`)).status).toBe(200);
    expect((await request(app).get('/api/public/events/' + e.id)).status).toBe(404);
  });
  it('bloqueia usuário inativo inclusive sessão existente', async () => {
    await db.user.update({ where: { id: users[2].id }, data: { active: false } });
    expect((await other.get('/api/requests')).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: users[2].email, password: 'Integration123!' })
      ).status
    ).toBe(401);
  });
  it('bloqueia CSRF de origem externa e faz logout', async () => {
    expect(
      (await owner.post('/api/requests').set('Origin', 'https://external.invalid').send({})).status
    ).toBe(403);
    expect((await owner.post('/api/auth/logout')).status).toBe(200);
    expect((await owner.get('/api/requests')).status).toBe(401);
  });
});
