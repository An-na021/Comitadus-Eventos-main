import { describe, it, expect } from 'vitest';
import { overlaps, csvCell, eventSchema, validateComplete, today } from '../src/domain.js';
describe('Regras de domínio', () => {
  it('detecta sobreposição parcial e total', () => {
    expect(overlaps('09:00', '11:00', '08:00', '10:00')).toBe(true);
    expect(overlaps('07:00', '12:00', '08:00', '10:00')).toBe(true);
  });
  it('permite intervalos consecutivos', () =>
    expect(overlaps('10:00', '12:00', '08:00', '10:00')).toBe(false));
  it('escapa aspas, separadores, quebras e fórmulas no CSV', () => {
    expect(csvCell('a";b')).toBe('"a"";b"');
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
  });
  it('aceita rascunho vazio mas não envio vazio', () => {
    expect(eventSchema.parse({})).toEqual({});
    expect(() => validateComplete({})).toThrow();
  });
  it('rejeita horários e datas inexistentes', () => {
    expect(eventSchema.safeParse({ startTime: '24:00' }).success).toBe(false);
    expect(eventSchema.safeParse({ eventDate: '2026-02-30' }).success).toBe(false);
  });
  it('bloqueia atribuição de autor, status e centro de custo pelo cliente', () => {
    for (const key of ['authorUserId', 'status', 'costCenterId'])
      expect(eventSchema.safeParse({ [key]: 'injetado' }).success).toBe(false);
  });
  it('valida término e datas passadas', () => {
    const e: any = {
      title: 'x',
      requesterName: 'x',
      speaker: 'x',
      targetAudience: 'x',
      justification: 'x',
      objective: 'x',
      courseId: 'x',
      themeId: 'x',
      environmentId: 'x',
      ceremonial: false,
      registration: false,
      declarations: false,
      eventDate: today(),
      startTime: '12:00',
      endTime: '11:00',
    };
    expect(() => validateComplete(e)).toThrow('término');
    e.endTime = '13:00';
    expect(() => validateComplete(e)).not.toThrow();
    e.eventDate = '2000-01-01';
    expect(() => validateComplete(e)).toThrow('data');
  });
});
