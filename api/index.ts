import { app } from '../backend/src/app.js';

// A Vercel encaminha as requisições pelo proxy antes de executar esta função.
app.set('trust proxy', 1);

export default app;
