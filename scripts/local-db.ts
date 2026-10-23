import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';
const databaseDir = path.resolve('.postgres');
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'eventos',
  password: 'eventos_local_demo',
  port: 5432,
  persistent: true,
  initdbFlags: ['--locale=C', '--encoding=UTF8'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: console.error,
});
if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
for (const name of ['eventos', 'eventos_test']) {
  const r = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
  if (!r.rows.length) await client.query(`CREATE DATABASE ${name}`);
}
await client.end();
console.log(
  'PostgreSQL local ativo em 127.0.0.1:5432. Dados persistidos em .postgres. Ctrl+C para encerrar.'
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 60000);
