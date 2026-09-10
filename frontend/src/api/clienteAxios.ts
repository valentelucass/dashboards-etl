import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_REQUEST_TIMEOUT_MS, AUTH_REQUEST_TIMEOUT_MS } from '../config/api';
import type { LoginResponse } from '../types/auth';
import { limparSessao, obterAccessToken, salvarSessaoDoLogin } from '../utils/gerenciadorSessao';
import { SessaoExpiradaError, normalizarErroSessao } from '../utils/authSession';
import { DATABASE_TIMEOUT_MESSAGE, SERVER_INSTABILITY_MESSAGE } from '../utils/apiError';
import { createDashboardRequestAdapter } from './dashboardRequestQueue';

export interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const API_STATUS_ALERT_EVENT = 'dashboard:api-status-alert';

export interface ApiStatusAlertDetail {
  status?: number;
  mensagem: string;
  tipo: 'timeout' | 'indisponivel';
}

const clienteAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_REQUEST_TIMEOUT_MS,
  withCredentials: true,
});
clienteAxios.defaults.adapter = createDashboardRequestAdapter(axios.getAdapter(clienteAxios.defaults.adapter));

let refreshEmAndamento: Promise<LoginResponse> | null = null;
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: unknown) => void }> = [];
let ultimoAlertaInfraestrutura: { chave: string; timestamp: number } | null = null;
const API_STATUS_ALERT_COOLDOWN_MS = 5000;
const DASHBOARD_ROUTE_HEADER_MAX_LENGTH = 100;

function obterRotaPainelAtual(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const pathname = window.location.pathname?.trim() || '/';
  return pathname.length > DASHBOARD_ROUTE_HEADER_MAX_LENGTH
    ? pathname.slice(0, DASHBOARD_ROUTE_HEADER_MAX_LENGTH)
    : pathname;
}

clienteAxios.interceptors.request.use((config) => {
  const accessToken = obterAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
    const rotaAtual = obterRotaPainelAtual();
    if (rotaAtual) {
      config.headers['X-Dashboard-Route'] = rotaAtual;
    }
  }
  return config;
});

async function renovarSessaoSilenciosamente(): Promise<LoginResponse> {
  try {
    const { data } = await axios.post<LoginResponse>(
      `${API_BASE_URL}/api/auth/refresh`,
      {},
      {
        withCredentials: true,
        timeout: AUTH_REQUEST_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    salvarSessaoDoLogin(data);
    return data;
  } catch (error) {
    throw normalizarErroSessao(error);
  }
}

export async function renovarSessao(): Promise<LoginResponse> {
  if (!refreshEmAndamento) {
    refreshEmAndamento = renovarSessaoSilenciosamente().finally(() => {
      refreshEmAndamento = null;
    });
  }

  return refreshEmAndamento;
}

function processQueue(error: Error | null, token: string | null = null): void {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
      return;
    }

    resolve(token);
  });
  failedQueue = [];
}

interface TratamentoErroRespostaDeps {
  limparSessao: () => void;
  revogarSessaoRemota?: () => Promise<void>;
  renovarSessao?: () => Promise<LoginResponse>;
  reexecutarRequisicao?: (config: RetryableRequestConfig) => Promise<unknown>;
}

function obterUrlRequisicao(config?: RetryableRequestConfig): string {
  return String(config?.url ?? '');
}

function ehEndpointAuth(url: string): boolean {
  return url.includes('/api/auth/login') || url.includes('/api/auth/refresh') || url.includes('/api/auth/logout');
}

function ehEndpointSessaoAtual(url: string): boolean {
  return url.includes('/api/auth/me');
}

function encerrarSessaoLocal(deps: Pick<TratamentoErroRespostaDeps, 'limparSessao'>, error?: unknown): SessaoExpiradaError {
  deps.limparSessao();
  return new SessaoExpiradaError(error);
}

async function revogarSessaoRemota(): Promise<void> {
  const logoutUrl = `${API_BASE_URL}/api/auth/logout`;

  try {
    if (typeof fetch === 'function') {
      await fetch(logoutUrl, {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
      });
      return;
    }

    await axios.post(
      logoutUrl,
      {},
      {
        withCredentials: true,
        timeout: AUTH_REQUEST_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch {
    // A sessao local ja foi encerrada; falha remota nao deve impedir a limpeza do contexto.
  }
}

function obterAlertaInfraestrutura(status?: number): ApiStatusAlertDetail | null {
  if (status === 503) {
    return { status, mensagem: SERVER_INSTABILITY_MESSAGE, tipo: 'indisponivel' };
  }

  if (status === 504) {
    return { status, mensagem: DATABASE_TIMEOUT_MESSAGE, tipo: 'timeout' };
  }

  return null;
}

function notificarErroInfraestrutura(status?: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  const alerta = obterAlertaInfraestrutura(status);
  if (!alerta) {
    return;
  }

  const agora = Date.now();
  const chave = `${alerta.status}:${alerta.mensagem}`;
  if (
    ultimoAlertaInfraestrutura?.chave === chave
    && agora - ultimoAlertaInfraestrutura.timestamp < API_STATUS_ALERT_COOLDOWN_MS
  ) {
    return;
  }

  ultimoAlertaInfraestrutura = { chave, timestamp: agora };
  window.dispatchEvent(new CustomEvent<ApiStatusAlertDetail>(API_STATUS_ALERT_EVENT, { detail: alerta }));
}

function aplicarAccessToken(config: RetryableRequestConfig, token: string | null): void {
  if (!token) {
    return;
  }

  config.headers.Authorization = `Bearer ${token}`;
}

function pausarRequisicaoDuranteRefresh(originalRequest: RetryableRequestConfig, deps: TratamentoErroRespostaDeps): Promise<unknown> {
  return new Promise((resolve, reject) => {
    failedQueue.push({ resolve, reject });
  }).then((token) => {
    aplicarAccessToken(originalRequest, typeof token === 'string' ? token : null);
    return (deps.reexecutarRequisicao ?? clienteAxios)(originalRequest);
  });
}

async function retentarAposRenovarSessao(
  originalRequest: RetryableRequestConfig,
  deps: TratamentoErroRespostaDeps,
): Promise<unknown> {
  originalRequest._retry = true;

  if (isRefreshing) {
    return pausarRequisicaoDuranteRefresh(originalRequest, deps);
  }

  isRefreshing = true;

  try {
    const sessaoRenovada = await (deps.renovarSessao ?? renovarSessao)();
    processQueue(null, sessaoRenovada.token);
    aplicarAccessToken(originalRequest, sessaoRenovada.token);
    return (deps.reexecutarRequisicao ?? clienteAxios)(originalRequest);
  } catch (refreshError) {
    const erroSessao = normalizarErroSessao(refreshError);
    processQueue(erroSessao);
    void deps.revogarSessaoRemota?.();
    deps.limparSessao();
    return Promise.reject(erroSessao);
  } finally {
    isRefreshing = false;
  }
}

export async function tratarErroRespostaApi(
  error: unknown,
  deps: TratamentoErroRespostaDeps,
): Promise<unknown> {
  const resposta = error as {
    response?: { status?: number };
    config?: RetryableRequestConfig;
  };
  const status = resposta.response?.status;
  const originalRequest = resposta.config;
  const url = obterUrlRequisicao(originalRequest);

  notificarErroInfraestrutura(status);

  if (status === 401 && ehEndpointAuth(url)) {
    return Promise.reject(error);
  }

  if (status === 401 && ehEndpointSessaoAtual(url)) {
    void deps.revogarSessaoRemota?.();
    return Promise.reject(encerrarSessaoLocal(deps, error));
  }

  if (status === 401) {
    if (!originalRequest || originalRequest._retry) {
      void deps.revogarSessaoRemota?.();
      return Promise.reject(encerrarSessaoLocal(deps, error));
    }

    return retentarAposRenovarSessao(originalRequest, deps);
  }

  return Promise.reject(error);
}

clienteAxios.interceptors.response.use(
  (response) => response,
  (error) => tratarErroRespostaApi(error, {
    limparSessao,
    revogarSessaoRemota,
  }),
);

export default clienteAxios;
