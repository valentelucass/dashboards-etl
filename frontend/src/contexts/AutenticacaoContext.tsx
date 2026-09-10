/* eslint-disable react-refresh/only-export-components */
import { createContext, Fragment, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  alterarSenha as alterarSenhaServico,
  buscarSessaoAtual,
  concluirTrocaSenhaObrigatoria,
  loginUsuario,
  logoutUsuario,
  restaurarSessao,
} from '../api/endpoints/authServico';
import type {
  AlterarSenhaRequest,
  IUsuarioSessao,
  LoginRequest,
  LoginResponse,
  NovaSenhaObrigatoriaRequest,
} from '../types/auth';
import {
  deveTentarRestaurarSessao,
  limparSessao,
  EVENTO_SESSAO_ATUALIZADA,
  montarSessaoPersistida,
  obterAccessToken,
  obterSessao,
  salvarSessao,
  salvarSessaoDoLogin,
  sessaoExpirada,
} from '../utils/gerenciadorSessao';
import { resolverAcaoBootstrapSessao } from '../utils/authSession';
import { sessionScope } from '../utils/sessionScope';

interface AutenticacaoContexto {
  usuario: IUsuarioSessao | null;
  carregandoSessao: boolean;
  login: (credenciais: LoginRequest) => Promise<LoginResponse>;
  alterarSenha: (payload: AlterarSenhaRequest) => Promise<void>;
  concluirTrocaSenhaObrigatoria: (payload: NovaSenhaObrigatoriaRequest) => Promise<LoginResponse>;
  logout: () => Promise<void>;
}

const AutenticacaoContext = createContext<AutenticacaoContexto | null>(null);
const ANTECEDENCIA_REFRESH_MS = 60 * 1000;
const INTERVALO_RETRY_REFRESH_MS = 60 * 1000;

function extrairExpJwtMs(token: string): number | null {
  const [, payloadBase64] = token.split('.');
  if (!payloadBase64) return null;

  try {
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function calcularDelayRefresh(sessao: IUsuarioSessao, accessToken: string | null): number {
  const sessaoExpiraEmMs = Date.parse(sessao.sessaoExpiraEm);
  const tokenExpiraEmMs = accessToken ? extrairExpJwtMs(accessToken) : null;
  const agora = Date.now();

  if (!Number.isFinite(sessaoExpiraEmMs)) {
    return 0;
  }

  if (tokenExpiraEmMs == null) {
    return Math.max(0, Math.min(INTERVALO_RETRY_REFRESH_MS, sessaoExpiraEmMs - agora));
  }

  return Math.max(0, Math.min(tokenExpiraEmMs - ANTECEDENCIA_REFRESH_MS, sessaoExpiraEmMs) - agora);
}

export function AutenticacaoProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [usuario, setUsuario] = useState<IUsuarioSessao | null>(() => obterSessao());
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const escopoCache = useRef(sessionScope(usuario));

  useEffect(() => {
    function sincronizarSessaoAtual() {
      const proxima = obterSessao();
      const proximoEscopo = sessionScope(proxima);
      if (escopoCache.current !== proximoEscopo) {
        // clear também cancela queries em voo, impedindo respostas antigas de repovoar o cache.
        queryClient.clear();
        escopoCache.current = proximoEscopo;
      }
      setUsuario(proxima);
    }

    window.addEventListener(EVENTO_SESSAO_ATUALIZADA, sincronizarSessaoAtual);
    return () => {
      window.removeEventListener(EVENTO_SESSAO_ATUALIZADA, sincronizarSessaoAtual);
    };
  }, [queryClient]);

  useEffect(() => {
    let ativo = true;

    async function bootstrapSessao() {
      const sessao = obterSessao();
      if (!sessao || !obterAccessToken()) {
        if (!deveTentarRestaurarSessao()) {
          if (ativo) {
            setUsuario(null);
            setCarregandoSessao(false);
          }
          return;
        }

        try {
          const restaurada = salvarSessaoDoLogin(await restaurarSessao());
          if (!ativo) return;

          setUsuario(restaurada);
        } catch {
          if (!ativo) return;

          limparSessao();
          setUsuario(null);
        } finally {
          if (ativo) setCarregandoSessao(false);
        }
        return;
      }

      try {
        const dados = await buscarSessaoAtual();
        if (!ativo) return;

        const sessaoAtualizada = obterSessao();
        const sessaoBase = sessaoAtualizada ?? sessao;
        const atualizada = montarSessaoPersistida(dados, sessaoBase.exigeTrocaSenha, sessaoBase.sessaoExpiraEm);
        salvarSessao(atualizada);
        setUsuario(atualizada);
      } catch (error) {
        if (!ativo) return;

        if (resolverAcaoBootstrapSessao(error) === 'encerrar_sessao') {
          limparSessao();
          setUsuario(null);
        } else {
          setUsuario(sessao);
        }
      } finally {
        if (ativo) setCarregandoSessao(false);
      }
    }

    void bootstrapSessao();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!usuario) return undefined;

    let cancelado = false;
    const accessToken = obterAccessToken();
    if (!accessToken) return undefined;

    const timeoutId = window.setTimeout(() => {
      async function executarRefreshProgramado() {
        const sessaoAtual = obterSessao();
        if (!sessaoAtual || cancelado) return;

        if (sessaoExpirada(sessaoAtual)) {
          limparSessao();
          setUsuario(null);
          setCarregandoSessao(false);
          return;
        }

        try {
          const renovada = salvarSessaoDoLogin(await restaurarSessao());
          if (cancelado) return;
          setUsuario(renovada);
        } catch (error) {
          if (cancelado) return;
          if (resolverAcaoBootstrapSessao(error) === 'encerrar_sessao') {
            limparSessao();
            setUsuario(null);
          }
        }
      }

      void executarRefreshProgramado();
    }, calcularDelayRefresh(usuario, accessToken));

    return () => {
      cancelado = true;
      window.clearTimeout(timeoutId);
    };
  }, [usuario]);

  const login = useCallback(async (credenciais: LoginRequest): Promise<LoginResponse> => {
    const data = await loginUsuario(credenciais);
    const sessao = salvarSessaoDoLogin(data);
    setUsuario(sessao);
    setCarregandoSessao(false);
    return data;
  }, []);

  const alterarSenha = useCallback(async (payload: AlterarSenhaRequest) => {
    await alterarSenhaServico(payload);

    setUsuario((atual) => {
      if (!atual) return atual;
      const proximaSessao = { ...atual, exigeTrocaSenha: false };
      salvarSessao(proximaSessao);
      return proximaSessao;
    });
  }, []);

  const concluirTrocaSenha = useCallback(async (payload: NovaSenhaObrigatoriaRequest): Promise<LoginResponse> => {
    const data = await concluirTrocaSenhaObrigatoria(payload);
    const sessao = salvarSessaoDoLogin(data);
    setUsuario(sessao);
    setCarregandoSessao(false);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUsuario();
    } finally {
      limparSessao();
      setUsuario(null);
      setCarregandoSessao(false);
    }
  }, []);

  return (
    <AutenticacaoContext.Provider value={{
      usuario,
      carregandoSessao,
      login,
      alterarSenha,
      concluirTrocaSenhaObrigatoria: concluirTrocaSenha,
      logout,
    }}>
      <Fragment key={sessionScope(usuario)}>{children}</Fragment>
    </AutenticacaoContext.Provider>
  );
}

export function useAutenticacao(): AutenticacaoContexto {
  const ctx = useContext(AutenticacaoContext);
  if (!ctx) throw new Error('useAutenticacao deve ser usado dentro de AutenticacaoProvider');
  return ctx;
}
