import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../frontend/src/api';

afterEach(() => vi.unstubAllGlobals());
describe('Mensagens de falha da comunicação com a API', () => {
  it('explica quando o proxy retorna erro vazio com backend desligado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(api('/auth/login')).rejects.toThrow('API indisponível');
  });
  it('não confunde limite de tentativas com resposta inválida', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Too many requests', { status: 429 }))
    );
    await expect(api('/auth/login')).rejects.toThrow('Muitas tentativas');
  });
  it('trata falha de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api('/auth/login')).rejects.toThrow('conectar ao servidor');
  });
  it('preserva a mensagem de credenciais incorretas retornada pela API', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: 'E-mail ou senha inválidos.' }, { status: 401 })
        )
    );
    await expect(api('/auth/login')).rejects.toThrow('E-mail ou senha inválidos.');
  });
  it('rejeita HTML mesmo com status 200 em vez de tratá-lo como login válido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Interface</html>')));
    await expect(api('/auth/login')).rejects.toThrow('resposta inesperada');
  });
  it('retorna o JSON de um login bem sucedido', async () => {
    const user = { id: 'test', role: 'SOLICITANTE' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(user)));
    await expect(api('/auth/login')).resolves.toEqual(user);
  });
});
