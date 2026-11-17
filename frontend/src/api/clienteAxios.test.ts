import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import clienteAxios, { tratarErroRespostaApi, type RetryableRequestConfig } from './clienteAxios';
import { SessaoExpiradaError, SessaoTemporariamenteIndisponivelError } from '../utils/authSession';
import type { LoginResponse } from '../types/auth';

function criarConfig(url: string): RetryableRequestConfig {
  return {
    url,
    headers: {},
  } as RetryableRequestConfig;
}

function criarErro401(config?: RetryableRequestConfig): {
  response: { status: number };
  config?: RetryableRequestConfig;
} {
  return {
    response: { status: 401 },
    config,
  };
}

function criarLoginResponse(token = 'token-renovado'): LoginResponse {
  return {
    token,
    exigeTrocaSenha: false,
    sessaoExpiraEm: '2026-06-13T18:00:00.000Z',
    usuario: {
      id: 'usuario-1',
      nome: 'Usuario Teste',
      email: 'usuario@teste.local',
      papel: 'USER',
      setor: {
        id: 'setor-1',
        nome: 'Operacao',
      },
      permissoesEfetivas: {} as LoginResponse['usuario']['permissoesEfetivas'],
      filiaisPermitidasEfetivas: [],
      exigeTrocaSenha: false,
    },
  };
}

describe('tratarErroRespostaApi', () => {
  it('nao fixa JSON como Content-Type para permitir que FormData defina seu boundary', () => {
    expect(clienteAxios.defaults.headers.common['Content-Type']).toBeUndefined();
  });

  it('renova a sessao e reexecuta endpoint protegido apos 401', async () => {
    const limparSessao = vi.fn();
    const revogarSessaoRemota = vi.fn().mockResolvedValue(undefined);
    const renovarSessao = vi.fn().mockResolvedValue(criarLoginResponse('token-novo'));
    const resultado = { ok: true };
    const reexecutarRequisicao = vi.fn().mockResolvedValue(resultado);
    const config = criarConfig('/api/painel/coletas');

    await expect(tratarErroRespostaApi(criarErro401(config), {
      limparSessao,
      revogarSessaoRemota,
      renovarSessao,
      reexecutarRequisicao,
    })).resolves.toBe(resultado);

    expect(renovarSessao).toHaveBeenCalledTimes(1);
    expect(reexecutarRequisicao).toHaveBeenCalledWith(config);
    expect(config._retry).toBe(true);
    expect(config.headers.Authorization).toBe('Bearer token-novo');
    expect(limparSessao).not.toHaveBeenCalled();
    expect(revogarSessaoRemota).not.toHaveBeenCalled();
  });

  it('enfileira requisicoes 401 enquanto o refresh esta em andamento', async () => {
    const limparSessao = vi.fn();
    const revogarSessaoRemota = vi.fn().mockResolvedValue(undefined);
    let resolverRefresh!: (value: LoginResponse) => void;
    const renovarSessao = vi.fn(() => new Promise<LoginResponse>((resolve) => {
      resolverRefresh = resolve;
    }));
    const reexecutarRequisicao = vi.fn((config: RetryableRequestConfig) => Promise.resolve({
      url: config.url,
    }));
    const primeiraConfig = criarConfig('/api/painel/coletas');
    const segundaConfig = criarConfig('/api/painel/fretes');

    const primeira = tratarErroRespostaApi(criarErro401(primeiraConfig), {
      limparSessao,
      revogarSessaoRemota,
      renovarSessao,
      reexecutarRequisicao,
    });
    const segunda = tratarErroRespostaApi(criarErro401(segundaConfig), {
      limparSessao,
      revogarSessaoRemota,
      renovarSessao,
      reexecutarRequisicao,
    });

    expect(renovarSessao).toHaveBeenCalledTimes(1);

    resolverRefresh(criarLoginResponse('token-fila'));

    await expect(Promise.all([primeira, segunda])).resolves.toEqual([
      { url: '/api/painel/coletas' },
      { url: '/api/painel/fretes' },
    ]);

    expect(reexecutarRequisicao).toHaveBeenCalledTimes(2);
    expect(primeiraConfig.headers.Authorization).toBe('Bearer token-fila');
    expect(segundaConfig.headers.Authorization).toBe('Bearer token-fila');
    expect(limparSessao).not.toHaveBeenCalled();
    expect(revogarSessaoRemota).not.toHaveBeenCalled();
  });

  it.each(['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'])(
    'propaga 401 de %s sem acionar refresh',
    async (url) => {
      const limparSessao = vi.fn();
      const revogarSessaoRemota = vi.fn();
      const renovarSessao = vi.fn();
      const reexecutarRequisicao = vi.fn();
      const erro = criarErro401(criarConfig(url));

      await expect(tratarErroRespostaApi(erro, {
        limparSessao,
        revogarSessaoRemota,
        renovarSessao,
        reexecutarRequisicao,
      })).rejects.toBe(erro);

      expect(renovarSessao).not.toHaveBeenCalled();
      expect(reexecutarRequisicao).not.toHaveBeenCalled();
      expect(limparSessao).not.toHaveBeenCalled();
      expect(revogarSessaoRemota).not.toHaveBeenCalled();
    },
  );

  it('limpa sessao quando /api/auth/me retorna 401 sem tentar refresh', async () => {
    const limparSessao = vi.fn();
    const revogarSessaoRemota = vi.fn();
    const renovarSessao = vi.fn();
    const reexecutarRequisicao = vi.fn();

    await expect(tratarErroRespostaApi(criarErro401(criarConfig('/api/auth/me')), {
      limparSessao,
      revogarSessaoRemota,
      renovarSessao,
      reexecutarRequisicao,
    })).rejects.toBeInstanceOf(SessaoExpiradaError);

    expect(limparSessao).toHaveBeenCalledTimes(1);
    expect(revogarSessaoRemota).toHaveBeenCalledTimes(1);
    expect(renovarSessao).not.toHaveBeenCalled();
    expect(reexecutarRequisicao).not.toHaveBeenCalled();
  });

  it('desloga e rejeita quando o refresh confirma sessao expirada', async () => {
    const limparSessao = vi.fn();
    const revogarSessaoRemota = vi.fn().mockResolvedValue(undefined);
    const erroRefresh = new SessaoExpiradaError();
    const renovarSessao = vi.fn().mockRejectedValue(erroRefresh);
    const reexecutarRequisicao = vi.fn();

    await expect(tratarErroRespostaApi(criarErro401(criarConfig('/api/painel/coletas')), {
      limparSessao,
      revogarSessaoRemota,
      renovarSessao,
      reexecutarRequisicao,
    })).rejects.toBe(erroRefresh);

    expect(limparSessao).toHaveBeenCalledTimes(1);
    expect(revogarSessaoRemota).toHaveBeenCalledTimes(1);
    expect(reexecutarRequisicao).not.toHaveBeenCalled();
  });

  it.each([503, 504, undefined])('preserva a sessao e libera a fila se o refresh falha temporariamente (%s)', async (status) => {
    const limparSessao = vi.fn();
    const revogarSessaoRemota = vi.fn();
    const reexecutarRequisicao = vi.fn();
    const configRefresh = { ...criarConfig('/api/auth/refresh'), headers: new AxiosHeaders() };
    const erroRefresh = new AxiosError('Falha no refresh', status ? undefined : 'ECONNABORTED', configRefresh,
      undefined, status ? { status, statusText: 'Indisponível', headers: {}, config: configRefresh, data: {} } : undefined);
    let rejeitarRefresh!: (error: unknown) => void;
    const renovarSessao = vi.fn(() => new Promise<LoginResponse>((_, reject) => { rejeitarRefresh = reject; }));
    const deps = { limparSessao, revogarSessaoRemota, renovarSessao, reexecutarRequisicao };

    const primeira = tratarErroRespostaApi(criarErro401(criarConfig('/api/painel/coletas')), deps);
    const segunda = tratarErroRespostaApi(criarErro401(criarConfig('/api/painel/coletas/serie')), deps);
    rejeitarRefresh(erroRefresh);

    const resultados = await Promise.allSettled([primeira, segunda]);
    resultados.forEach((resultado) => {
      expect(resultado.status).toBe('rejected');
      if (resultado.status === 'rejected') {
        expect(resultado.reason).toBeInstanceOf(SessaoTemporariamenteIndisponivelError);
        expect(resultado.reason.cause).toBe(erroRefresh);
      }
    });
    expect(renovarSessao).toHaveBeenCalledTimes(1);
    expect(limparSessao).not.toHaveBeenCalled();
    expect(revogarSessaoRemota).not.toHaveBeenCalled();
    expect(reexecutarRequisicao).not.toHaveBeenCalled();
  });

  it('propaga 403 sem limpar sessao', async () => {
    const limparSessao = vi.fn();
    const erro = {
      response: { status: 403 },
      config: criarConfig('/api/painel/coletas'),
    };

    await expect(tratarErroRespostaApi(erro, {
      limparSessao,
    })).rejects.toBe(erro);

    expect(limparSessao).not.toHaveBeenCalled();
  });
});
