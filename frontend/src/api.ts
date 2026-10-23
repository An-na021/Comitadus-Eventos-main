export async function api<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'same-origin',
  });
  const body = await res.json().catch(() => ({ message: 'Resposta inválida do servidor.' }));
  if (!res.ok) throw new Error(body.message || 'Não foi possível concluir a operação.');
  return body;
}
export const send = (method: string, body?: unknown) => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});
export const statuses: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  PENDENTE: 'Aguardando aprovação',
  APROVADO: 'Aprovado',
  REJEITADO: 'Rejeitado',
  CANCELADO: 'Cancelado',
};
export const date = (v?: string) =>
  v ? new Date(v.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
