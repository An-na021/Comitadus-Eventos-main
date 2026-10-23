import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma, Status } from '@prisma/client';
import { z } from 'zod';
import { db } from './db.js';
import { AppError, fail, eventSchema, validateComplete, csvCell } from './domain.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; name: string; email: string; role: string; active: boolean };
    }
  }
}
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '128kb' }));
app.use(cookieParser());
const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => any) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const safeUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;
const include = {
  course: true,
  costCenter: true,
  theme: true,
  environment: true,
  resources: { include: { resource: true } },
};
app.use(
  wrap(async (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && origin !== (process.env.APP_ORIGIN || 'http://127.0.0.1:5173'))
        fail(403, 'Origem não autorizada.');
      if (req.headers['sec-fetch-site'] === 'cross-site')
        fail(403, 'Requisição de outro site não permitida.');
    }
    if (req.cookies.session) {
      const session = await db.session.findUnique({
        where: { id: hash(req.cookies.session) },
        include: { user: { select: safeUser } },
      });
      if (session && session.expiresAt > new Date() && session.user.active) req.user = session.user;
    }
    next();
  })
);
const auth = (req: Request, res: Response, next: NextFunction) =>
  req.user ? next() : next(new AppError(401, 'Entre na sua conta para continuar.'));
const admin = (req: Request, res: Response, next: NextFunction) =>
  req.user?.role === 'ADMIN'
    ? next()
    : next(new AppError(403, 'Acesso exclusivo da administração.'));
app.get(
  '/api/health',
  wrap(async (_, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  })
);
app.post(
  '/api/auth/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
  wrap(async (req, res) => {
    const data = z
      .object({ email: z.string().email().max(254), password: z.string().min(1).max(100) })
      .parse(req.body);
    const user = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user || !user.active || !(await bcrypt.compare(data.password, user.passwordHash)))
      fail(401, 'E-mail ou senha inválidos.');
    const token = randomBytes(32).toString('hex');
    await db.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          ...(req.cookies.session ? [{ id: hash(req.cookies.session) }] : []),
        ],
      },
    });
    await db.session.create({
      data: {
        id: hash(token),
        userId: user!.id,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
    });
    res.cookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });
    res.json({ id: user!.id, name: user!.name, email: user!.email, role: user!.role });
  })
);
app.post(
  '/api/auth/logout',
  wrap(async (req, res) => {
    if (req.cookies.session)
      await db.session.deleteMany({ where: { id: hash(req.cookies.session) } });
    res.clearCookie('session', { path: '/' });
    res.json({ ok: true });
  })
);
app.get('/api/auth/me', auth, (req, res) => res.json(req.user));
const publicSelect = {
  id: true,
  title: true,
  eventDate: true,
  startTime: true,
  endTime: true,
  description: true,
  speaker: true,
  targetAudience: true,
  registration: true,
  declarations: true,
  theme: { select: { name: true } },
  environment: { select: { name: true, location: true } },
  course: { select: { name: true } },
};
function publicWindow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')!.value),
    m = Number(parts.find((p) => p.type === 'month')!.value) - 1;
  return { gte: new Date(Date.UTC(y, m, 1)), lt: new Date(Date.UTC(y, m + 3, 1)) };
}
app.get(
  '/api/public/events',
  wrap(async (_, res) =>
    res.json(
      await db.eventRequest.findMany({
        where: { status: 'APROVADO', eventDate: publicWindow() },
        select: publicSelect,
        orderBy: [{ eventDate: 'asc' }, { startTime: 'asc' }],
      })
    )
  )
);
app.get(
  '/api/public/events/:id',
  wrap(async (req, res) => {
    const e = await db.eventRequest.findFirst({
      where: { id: req.params.id, status: 'APROVADO', eventDate: publicWindow() },
      select: publicSelect,
    });
    if (!e) fail(404, 'Evento não encontrado.');
    res.json(e);
  })
);
app.use('/api', auth);
app.get(
  '/api/catalogs',
  wrap(async (req, res) => {
    const all = req.user!.role === 'ADMIN';
    const where = all ? {} : { active: true };
    const [courses, costCenters, themes, environments, resources] = await Promise.all([
      db.course.findMany({ where, include: { costCenter: true }, orderBy: { name: 'asc' } }),
      db.costCenter.findMany({ where }),
      db.theme.findMany({ where }),
      db.environment.findMany({ where, include: { resources: { include: { resource: true } } } }),
      db.resource.findMany({ where }),
    ]);
    res.json({ courses, costCenters, themes, environments, resources });
  })
);
function filter(req: Request) {
  const q = z
    .object({
      status: z.nativeEnum(Status).optional(),
      q: z.string().max(200).optional(),
      from: z.string().date().optional(),
      to: z.string().date().optional(),
      courseId: z.string().uuid().optional(),
      environmentId: z.string().uuid().optional(),
      themeId: z.string().uuid().optional(),
    })
    .parse(req.query);
  const w: Prisma.EventRequestWhereInput =
    req.user!.role === 'ADMIN' ? {} : { authorUserId: req.user!.id };
  if (q.status) w.status = q.status;
  if (q.q)
    w.OR = [
      { title: { contains: q.q, mode: 'insensitive' } },
      { requesterName: { contains: q.q, mode: 'insensitive' } },
    ];
  if (q.from || q.to)
    w.eventDate = {
      ...(q.from ? { gte: new Date(q.from) } : {}),
      ...(q.to ? { lte: new Date(q.to) } : {}),
    };
  for (const k of ['courseId', 'environmentId', 'themeId'] as const) if (q[k]) w[k] = q[k];
  return w;
}
app.get(
  '/api/requests',
  wrap(async (req, res) =>
    res.json(
      await db.eventRequest.findMany({
        where: filter(req),
        include,
        orderBy: { createdAt: 'desc' },
      })
    )
  )
);
app.get(
  '/api/requests/:id',
  wrap(async (req, res) => {
    const e = await db.eventRequest.findUnique({
      where: { id: req.params.id },
      include: {
        ...include,
        history: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!e || (req.user!.role !== 'ADMIN' && e.authorUserId !== req.user!.id))
      fail(404, 'Solicitação não encontrada.');
    res.json(e);
  })
);
type Tx = Prisma.TransactionClient;
async function lock(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(928410)`;
}
async function validateLinks(tx: Tx, data: any, complete: boolean) {
  let costCenterId: string | null = null;
  if (data.courseId) {
    const c = await tx.course.findUnique({
      where: { id: data.courseId },
      include: { costCenter: true },
    });
    if (!c || (complete && (!c.active || !c.costCenter.active)))
      fail(422, 'Curso ou centro de custo indisponível.');
    costCenterId = c!.costCenterId;
  }
  if (
    data.themeId &&
    !(await tx.theme.findFirst({
      where: { id: data.themeId, ...(complete ? { active: true } : {}) },
    }))
  )
    fail(422, 'Tema inválido.');
  if (
    data.environmentId &&
    !(await tx.environment.findFirst({
      where: { id: data.environmentId, ...(complete ? { active: true } : {}) },
    }))
  )
    fail(422, 'Ambiente inválido.');
  const ids = data.resourceIds ?? [];
  if (ids.length) {
    const matches = await tx.environmentResource.count({
      where: {
        environmentId: data.environmentId ?? '',
        resourceId: { in: ids },
        resource: { active: true },
      },
    });
    if (matches !== ids.length) fail(422, 'Selecione apenas recursos disponíveis no ambiente.');
  }
  return costCenterId;
}
async function conflict(tx: Tx, data: any, id?: string) {
  const found = await tx.eventRequest.findFirst({
    where: {
      id: { not: id },
      status: 'APROVADO',
      environmentId: data.environmentId,
      eventDate: data.eventDate,
      startTime: { lt: data.endTime },
      endTime: { gt: data.startTime },
    },
  });
  if (found) fail(409, 'Conflito: o ambiente já está reservado nesse intervalo.');
}
async function history(
  tx: Tx,
  id: string,
  actor: string,
  action: string,
  prev: Status | null,
  next: Status,
  details?: any
) {
  await tx.requestHistory.create({
    data: {
      requestId: id,
      actorUserId: actor,
      action,
      previousStatus: prev,
      newStatus: next,
      details,
    },
  });
}
app.post(
  '/api/requests',
  wrap(async (req, res) => {
    const { resourceIds = [], ...data } = eventSchema.parse(req.body);
    const result = await db.$transaction(async (tx) => {
      await lock(tx);
      const costCenterId = await validateLinks(tx, { ...data, resourceIds }, false);
      const e = await tx.eventRequest.create({
        data: {
          ...data,
          eventDate: data.eventDate ? new Date(data.eventDate) : null,
          costCenterId,
          authorUserId: req.user!.id,
          resources: { create: resourceIds.map((resourceId) => ({ resourceId })) },
        },
        include,
      });
      await history(tx, e.id, req.user!.id, 'Rascunho criado', null, 'RASCUNHO');
      return e;
    });
    res.status(201).json(result);
  })
);
app.patch(
  '/api/requests/:id',
  wrap(async (req, res) => {
    const parsed = eventSchema.parse(req.body);
    const result = await db.$transaction(async (tx) => {
      await lock(tx);
      const e = await tx.eventRequest.findUnique({
        where: { id: req.params.id },
        include: { resources: true },
      });
      if (!e || (req.user!.role !== 'ADMIN' && e.authorUserId !== req.user!.id))
        fail(404, 'Solicitação não encontrada.');
      if (
        !['RASCUNHO', 'REJEITADO'].includes(e!.status) &&
        !(e!.status === 'APROVADO' && req.user!.role === 'ADMIN')
      )
        fail(409, 'Este status não permite edição.');
      const merged = {
        ...e,
        ...parsed,
        resourceIds: parsed.resourceIds ?? e!.resources.map((r) => r.resourceId),
      };
      if (merged.eventDate && typeof merged.eventDate === 'string')
        merged.eventDate = new Date(merged.eventDate) as any;
      const complete = e!.status === 'APROVADO';
      if (complete) validateComplete(merged);
      const costCenterId = await validateLinks(tx, merged, complete);
      if (complete) await conflict(tx, merged, e!.id);
      const { resourceIds, ...fields } = parsed;
      const saved = await tx.eventRequest.update({
        where: { id: e!.id },
        data: {
          ...fields,
          eventDate:
            parsed.eventDate === undefined
              ? undefined
              : parsed.eventDate
                ? new Date(parsed.eventDate)
                : null,
          costCenterId,
          resources: resourceIds
            ? { deleteMany: {}, create: resourceIds.map((resourceId) => ({ resourceId })) }
            : undefined,
        },
        include,
      });
      await history(
        tx,
        e!.id,
        req.user!.id,
        'Dados atualizados',
        e!.status,
        e!.status,
        JSON.parse(JSON.stringify({ before: e, after: saved }))
      );
      return saved;
    });
    res.json(result);
  })
);
app.delete(
  '/api/requests/:id',
  wrap(async (req, res) => {
    await db.$transaction(async (tx) => {
      await lock(tx);
      const e = await tx.eventRequest.findUnique({ where: { id: req.params.id } });
      if (!e || e.authorUserId !== req.user!.id) fail(404, 'Solicitação não encontrada.');
      if (e!.status !== 'RASCUNHO') fail(409, 'Somente rascunhos podem ser excluídos.');
      await tx.eventRequest.delete({ where: { id: e!.id } });
    });
    res.json({ ok: true });
  })
);
for (const action of ['submit', 'approve', 'reject', 'cancel'])
  app.post(
    '/api/requests/:id/' + action,
    wrap(async (req, res) => {
      const result = await db.$transaction(async (tx) => {
        await lock(tx);
        const e = await tx.eventRequest.findUnique({
          where: { id: req.params.id },
          include: { resources: true },
        });
        if (!e || (req.user!.role !== 'ADMIN' && e.authorUserId !== req.user!.id))
          fail(404, 'Solicitação não encontrada.');
        let status: Status;
        let reason: string | null = null;
        if (action === 'submit') {
          if (!['RASCUNHO', 'REJEITADO'].includes(e!.status) || e!.authorUserId !== req.user!.id)
            fail(409, 'Envio não permitido.');
          status = 'PENDENTE';
        } else if (action === 'approve' || action === 'reject') {
          if (req.user!.role !== 'ADMIN') fail(403, 'Acesso exclusivo da administração.');
          if (e!.status !== 'PENDENTE') fail(409, 'Apenas pedidos pendentes podem ser analisados.');
          status = action === 'approve' ? 'APROVADO' : 'REJEITADO';
          if (action === 'reject')
            reason = z
              .string()
              .trim()
              .min(1, 'Informe a justificativa.')
              .max(5000)
              .parse(req.body.reason);
        } else {
          if (e!.status !== 'PENDENTE' && !(e!.status === 'APROVADO' && req.user!.role === 'ADMIN'))
            fail(409, 'Cancelamento não permitido.');
          status = 'CANCELADO';
        }
        let costCenterId = e!.costCenterId;
        if (action === 'submit' || action === 'approve') {
          validateComplete(e);
          costCenterId = await validateLinks(
            tx,
            { ...e, resourceIds: e!.resources.map((r) => r.resourceId) },
            true
          );
          await conflict(tx, e, e!.id);
        }
        const reviewed = action === 'approve' || action === 'reject';
        const saved = await tx.eventRequest.update({
          where: { id: e!.id },
          data: {
            status,
            costCenterId,
            rejectionReason: reason,
            ...(reviewed
              ? { reviewedBy: req.user!.id, reviewedAt: new Date() }
              : action === 'submit'
                ? { reviewedBy: null, reviewedAt: null }
                : {}),
          },
          include,
        });
        await history(
          tx,
          e!.id,
          req.user!.id,
          (
            {
              submit: 'Enviada para análise',
              approve: 'Aprovada',
              reject: 'Rejeitada',
              cancel: 'Cancelada',
            } as any
          )[action],
          e!.status,
          status,
          { reason }
        );
        return saved;
      });
      res.json(result);
    })
  );
app.use('/api/admin', admin);
const catalogSchemas: Record<string, z.ZodTypeAny> = {
  'cost-centers': z
    .object({
      name: z.string().trim().min(1).max(200),
      code: z.string().trim().min(1).max(50),
      active: z.boolean().optional(),
    })
    .strict(),
  courses: z
    .object({
      name: z.string().trim().min(1).max(200),
      costCenterId: z.string().uuid(),
      active: z.boolean().optional(),
    })
    .strict(),
  themes: z
    .object({
      name: z.string().trim().min(1).max(200),
      description: z.string().max(5000).optional(),
      active: z.boolean().optional(),
    })
    .strict(),
  resources: z
    .object({
      name: z.string().trim().min(1).max(200),
      description: z.string().max(5000).optional(),
      active: z.boolean().optional(),
    })
    .strict(),
  environments: z
    .object({
      name: z.string().trim().min(1).max(200),
      description: z.string().max(5000).optional(),
      location: z.string().max(200),
      capacity: z.number().int().min(0).max(1000000),
      active: z.boolean().optional(),
      resourceIds: z.array(z.string().uuid()).optional(),
    })
    .strict(),
  users: z
    .object({
      name: z.string().trim().min(1).max(200),
      email: z
        .string()
        .email()
        .max(254)
        .transform((v) => v.toLowerCase()),
      password: z.string().min(8).max(72).optional(),
      role: z.enum(['ADMIN', 'SOLICITANTE']),
      active: z.boolean().optional(),
    })
    .strict(),
};
const models: Record<string, string> = {
  'cost-centers': 'costCenter',
  courses: 'course',
  themes: 'theme',
  resources: 'resource',
  environments: 'environment',
  users: 'user',
};
for (const kind of Object.keys(models)) {
  app.get(
    '/api/admin/' + kind,
    wrap(async (_, res) =>
      res.json(
        await (db as any)[models[kind]].findMany({
          ...(kind === 'users' ? { select: safeUser } : {}),
          orderBy: { name: 'asc' },
        })
      )
    )
  );
  for (const method of ['post', 'patch'] as const)
    app[method](
      '/api/admin/' + kind + (method === 'patch' ? '/:id' : ''),
      wrap(async (req, res) => {
        const data = catalogSchemas[kind].parse(req.body);
        const { password, resourceIds, ...fields } = data;
        if (kind === 'users') {
          if (method === 'post' && !password)
            fail(422, 'Informe uma senha de pelo menos oito caracteres.');
          if (password) fields.passwordHash = await bcrypt.hash(password, 12);
        }
        const saved = await db.$transaction(async (tx) => {
          await lock(tx);
          if (kind === 'users' && method === 'patch') {
            const old = await tx.user.findUnique({ where: { id: req.params.id } });
            if (
              old?.role === 'ADMIN' &&
              old.active &&
              (fields.role !== 'ADMIN' || fields.active === false) &&
              (await tx.user.count({ where: { role: 'ADMIN', active: true } })) <= 1
            )
              fail(409, 'Mantenha pelo menos um administrador ativo.');
          }
          if (kind === 'environments' && resourceIds) {
            const inUse = await tx.eventRequestResource.count({
              where: {
                resourceId: { notIn: resourceIds },
                event: { environmentId: req.params.id },
              },
            });
            if (inUse) fail(409, 'Há eventos vinculados aos recursos removidos.');
            fields.resources = {
              ...(method === 'patch' ? { deleteMany: {} } : {}),
              create: resourceIds.map((resourceId: string) => ({ resourceId })),
            };
          }
          const model = (tx as any)[models[kind]];
          return method === 'post'
            ? model.create({ data: fields, ...(kind === 'users' ? { select: safeUser } : {}) })
            : model.update({
                where: { id: req.params.id },
                data: fields,
                ...(kind === 'users' ? { select: safeUser } : {}),
              });
        });
        res.status(method === 'post' ? 201 : 200).json(saved);
      })
    );
  if (kind !== 'users')
    app.delete(
      '/api/admin/' + kind + '/:id',
      wrap(async (req, res) => {
        await db.$transaction(async (tx) => {
          await lock(tx);
          if (
            kind === 'environments' &&
            (await tx.environmentResource.count({ where: { environmentId: req.params.id } }))
          )
            fail(409, 'Remova os vínculos com recursos antes de excluir o ambiente.');
          await (tx as any)[models[kind]].delete({ where: { id: req.params.id } });
        });
        res.json({ ok: true });
      })
    );
}
for (const exportCsv of [false, true])
  app.get(
    '/api/admin/reports' + (exportCsv ? '/export' : ''),
    wrap(async (req, res) => {
      const rows = await db.eventRequest.findMany({
        where: filter(req),
        include,
        orderBy: [{ eventDate: 'asc' }, { startTime: 'asc' }],
      });
      if (!exportCsv) return res.json(rows);
      const headers = [
        'Evento',
        'Data',
        'Início',
        'Término',
        'Tema',
        'Curso/coordenação',
        'Centro de custo',
        'Local',
        'Solicitante',
        'Status',
      ];
      const lines = rows.map((e) =>
        [
          e.title,
          e.eventDate?.toISOString().slice(0, 10),
          e.startTime,
          e.endTime,
          e.theme?.name,
          e.course?.name,
          e.costCenter?.name,
          e.environment?.name,
          e.requesterName,
          e.status,
        ]
          .map(csvCell)
          .join(';')
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="eventos.csv"');
      res.send('\uFEFF' + headers.map(csvCell).join(';') + '\r\n' + lines.join('\r\n'));
    })
  );
app.use('/api', (_, res) => res.status(404).json({ message: 'Rota não encontrada.' }));
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof z.ZodError)
    return res
      .status(422)
      .json({ message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ') });
  if (err instanceof AppError) return res.status(err.status).json({ message: err.message });
  if (
    err instanceof Prisma.PrismaClientUnknownRequestError &&
    /violates RESTRICT|violates foreign key|exclusion constraint/.test(err.message)
  )
    return res
      .status(409)
      .json({ message: 'Operação bloqueada: existem vínculos ou conflito de reserva no banco.' });
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const messages: Record<string, string> = {
      P2002: 'Já existe um cadastro com esses dados.',
      P2003: 'Este cadastro possui vínculos ou uma referência inválida.',
      P2025: 'Registro não encontrado.',
      P2004: 'Operação viola uma regra do banco.',
      P2010: 'Não foi possível reservar esse horário.',
    };
    return res
      .status(err.code === 'P2025' ? 404 : 409)
      .json({ message: messages[err.code] || 'Não foi possível concluir a operação no banco.' });
  }
  if (err.type === 'entity.parse.failed')
    return res.status(400).json({ message: 'JSON inválido.' });
  console.error(err);
  res
    .status(500)
    .json({ message: 'Erro interno. Verifique a conexão com o banco e tente novamente.' });
});
export { app };
