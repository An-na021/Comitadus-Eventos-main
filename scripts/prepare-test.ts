import 'dotenv/config';
import { execFileSync } from 'node:child_process';
const url = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!);
url.pathname = '/eventos_test';
execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url.toString() },
});
