export async function api<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api' + url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      credentials: 'same-origin',
    });
  } catch {
    throw new Error(
      'Não foi possível conectar ao servidor. Verifique se a aplicação está em execução.'
    );
  }
  const body = await res.json().catch(() => null);
  if (res.status === 429)
    throw new Error(
      'Muitas tentativas de acesso. Aguarde alguns minutos antes de tentar novamente.'
    );
  if (!body || typeof body !== 'object') {
    if (res.status >= 500)
      throw new Error('API indisponível. Verifique se o backend está em execução com npm run dev.');
    throw new Error(
      'O servidor retornou uma resposta inesperada. Atualize a página e tente novamente.'
    );
  }
  if (!res.ok) throw new Error(body.message || 'Não foi possível concluir a operação.');
  return body as T;
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
