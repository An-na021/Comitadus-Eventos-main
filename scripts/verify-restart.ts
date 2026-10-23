import 'dotenv/config';
import { spawn, ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
const url = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!);
url.pathname = '/eventos_test';
process.env.DATABASE_URL = url.toString();
const { db } = await import('../backend/src/db.js');
const port = 3012,
  base = `http://127.0.0.1:${port}/api`;
let server: ChildProcess | undefined, userId: string | undefined;
async function start() {
  server = spawn(process.execPath, ['backend/dist/server.js'], {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test' },
    stdio: 'ignore',
    windowsHide: true,
  });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('A API não iniciou.');
    try {
      if ((await fetch(base + '/health')).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Tempo limite ao iniciar API.');
}
async function stop() {
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
}
try {
  const user = await db.user.create({
    data: {
      name: 'Teste de reinicialização',
      email: `restart-${Date.now()}@test.invalid`,
      passwordHash: await bcrypt.hash('Restart123!', 4),
    },
  });
  userId = user.id;
  await start();
  const login = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: 'Restart123!' }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  const created = await fetch(base + '/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ title: 'Persistência após reiniciar a API' }),
  });
  assert.equal(created.status, 201);
  const event = (await created.json()) as any;
  await stop();
  await db.$disconnect();
  await start();
  const found = await fetch(base + '/requests/' + event.id, { headers: { Cookie: cookie } });
  assert.equal(found.status, 200);
  assert.equal(((await found.json()) as any).title, event.title);
  console.log(
    'PASSOU: registro e sessão preservados após encerrar e iniciar um novo processo da API.'
  );
} finally {
  await stop();
  if (userId) {
    await db.eventRequest.deleteMany({ where: { authorUserId: userId } });
    await db.user.delete({ where: { id: userId } });
  }
  await db.$disconnect();
}
