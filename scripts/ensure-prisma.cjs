const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let ready = false;
const normalizeSchema = (file) =>
  fs
    .readFileSync(file, 'utf8')
    .replace(/"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|\s+/g, (token) =>
      token.startsWith('"') ? token : ''
    );
try {
  const client = require('@prisma/client');
  ready =
    Boolean(client.Status?.PENDENTE && client.Prisma?.ModelName?.EventRequest) &&
    normalizeSchema(path.join(root, 'backend/prisma/schema.prisma')) ===
      normalizeSchema(path.join(root, 'node_modules/.prisma/client/schema.prisma'));
} catch {}
if (!ready) {
  console.log('Preparando o cliente Prisma para o esquema do projeto...');
  try {
    execFileSync(
      process.execPath,
      [path.join(root, 'node_modules/prisma/build/index.js'), 'generate'],
      {
        cwd: root,
        stdio: 'inherit',
      }
    );
  } catch {
    console.error(
      'Não foi possível gerar o cliente Prisma. Se houver outra API em execução, encerre-a e tente novamente.'
    );
    process.exit(1);
  }
}
