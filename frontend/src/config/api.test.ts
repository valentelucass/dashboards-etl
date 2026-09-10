import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('endereço da API', () => {
  it.each(['', 'http://127.0.0.1:5011', 'http://localhost:5011/'])('usa a origem da página em DEV com destino válido %s', async (target) => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_API_BASE_URL', target);
    const { API_BASE_URL, API_UNAVAILABLE_MESSAGE } = await import('./api');
    expect(API_BASE_URL).toBe('');
    expect(`${API_BASE_URL}/api/auth/refresh`).toBe('/api/auth/refresh');
    expect(API_UNAVAILABLE_MESSAGE).toContain('máquina do projeto');
  });

  it.each(['http://127.0.0.1:5010', 'https://api-analytics.rodogarcia.com.br', 'http://192.168.1.2:5011', '/api'])('mantém o isolamento DEV para %s', async (target) => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_API_BASE_URL', target);
    await expect(import('./api')).rejects.toThrow('Frontend DEV deve consumir apenas');
  });

  it('preserva o endereço externo configurado em produção', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_API_BASE_URL', 'https://api-analytics.rodogarcia.com.br/');
    const { API_BASE_URL } = await import('./api');
    expect(API_BASE_URL).toBe('https://api-analytics.rodogarcia.com.br');
  });

  it('continua exigindo configuração explícita em produção', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_API_BASE_URL', '');
    await expect(import('./api')).rejects.toThrow('obrigatória para builds de produção');
  });
});
