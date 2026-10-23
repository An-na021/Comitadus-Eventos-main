import path from 'node:path';
import express from 'express';
import { app } from './app.js';
import { db } from './db.js';
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve('dist')));
  app.get('*', (_, res) => res.sendFile(path.resolve('dist/index.html')));
}
const server = app.listen(Number(process.env.PORT) || 3001, '127.0.0.1', () =>
  console.log('API: http://127.0.0.1:3001')
);
async function stop() {
  server.close();
  await db.$disconnect();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
