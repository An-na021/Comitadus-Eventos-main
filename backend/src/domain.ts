import { z } from 'zod';
export class AppError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
export const fail = (status: number, message: string): never => {
  throw new AppError(status, message);
};
const text = z.string().trim().max(5000);
export const eventSchema = z
  .object({
    title: text.max(200).optional(),
    requesterName: text.max(200).optional(),
    description: text.optional(),
    speaker: text.max(200).optional(),
    targetAudience: text.optional(),
    justification: text.optional(),
    objective: text.optional(),
    notes: text.optional(),
    ceremonial: z.boolean().nullable().optional(),
    registration: z.boolean().nullable().optional(),
    declarations: z.boolean().nullable().optional(),
    estimatedAttendees: z.number().int().min(0).max(1000000).nullable().optional(),
    eventDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((v) => {
        const d = new Date(v);
        return !isNaN(+d) && d.toISOString().slice(0, 10) === v;
      }, 'Data inválida')
      .nullable()
      .optional(),
    startTime: z
      .string()
      .regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    endTime: z
      .string()
      .regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    courseId: z.string().uuid().nullable().optional(),
    themeId: z.string().uuid().nullable().optional(),
    environmentId: z.string().uuid().nullable().optional(),
    resourceIds: z.array(z.string().uuid()).max(100).optional(),
  })
  .strict();
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}
export function validateComplete(e: any) {
  const required = [
    'title',
    'requesterName',
    'speaker',
    'targetAudience',
    'justification',
    'objective',
    'eventDate',
    'startTime',
    'endTime',
    'courseId',
    'themeId',
    'environmentId',
  ];
  if (
    required.some((k) => !e[k]) ||
    ['ceremonial', 'registration', 'declarations'].some((k) => typeof e[k] !== 'boolean')
  )
    fail(422, 'Preencha todos os campos obrigatórios e as opções Sim/Não.');
  const day = e.eventDate instanceof Date ? e.eventDate.toISOString().slice(0, 10) : e.eventDate;
  if (day < today()) fail(422, 'A data deve ser atual ou futura.');
  if (e.startTime >= e.endTime) fail(422, 'O término deve ser posterior ao início, no mesmo dia.');
}
export function overlaps(a: string, b: string, c: string, d: string) {
  return a < d && b > c;
}
export function csvCell(value: unknown) {
  let s = String(value ?? '');
  if (/^[=+@\-\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
