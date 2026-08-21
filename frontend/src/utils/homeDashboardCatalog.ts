import {
  Activity,
  BarChart3,
  ClipboardList,
  CreditCard,
  HeartPulse,
  LayoutDashboard,
  MapPinned,
  Truck,
  Users,
} from 'lucide-react';
import { DASHBOARD_NAV_ITEMS } from './accessControl';
import type { NavItem } from './accessControl';
import type { HomeDashboardCategory, HomeDashboardItem, HomeDashboardMeta, HomeNotice, HomeNoticeFormState } from '../types/home';

export const CATEGORY_ORDER: HomeDashboardCategory[] = ['Operação', 'Financeiro', 'Comercial', 'Executivo', 'TI/ETL'];
export const FAVORITES_STORAGE_PREFIX = 'dashboards-etl.home.favorites';

export const EMPTY_NOTICE_FORM: HomeNoticeFormState = {
  title: '',
  body: '',
  tag: 'NOVO',
  audience: 'Todos',
};

export const FALLBACK_HOME_NOTICES: HomeNotice[] = [
  {
    id: 'gestao-vista',
    title: 'Indicadores de Gestão à Vista disponíveis',
    body: 'Performance de entrega, coletores, cubagem, indenização e horários de corte centralizados no painel operacional.',
    tag: 'NOVO',
    audience: 'Operação, TI e Diretoria',
    date: 'Atualização recente',
    likeCount: 0,
    commentCount: 0,
    likedBy: [],
    likedByCurrentUser: false,
  },
  {
    id: 'governanca',
    title: 'Acesso por setor segue permissões efetivas',
    body: 'A Home mostra somente atalhos liberados para o usuário autenticado, respeitando setor, papel e exceções individuais.',
    tag: 'FIXADO',
    audience: 'Todos',
    date: 'Fixado',
    likeCount: 0,
    commentCount: 0,
    likedBy: [],
    likedByCurrentUser: false,
  },
  {
    id: 'status-etl',
    title: 'Monitoramento do ETL em destaque',
    body: 'Acompanhe execuções, volume processado e erros no painel ETL Saúde quando a permissão estiver liberada.',
    tag: 'ATENCAO',
    audience: 'TI e administradores',
    date: 'Publicado hoje',
    likeCount: 0,
    commentCount: 0,
    likedBy: [],
    likedByCurrentUser: false,
  },
];

const HOME_DASHBOARD_META: Record<string, HomeDashboardMeta> = {
  '/coletas': {
    category: 'Operação',
    description: 'Solicitações, finalizações, SLA, lead time e volume de coletas.',
    keywords: ['operacao', 'logistica', 'coletas', 'sla', 'agendamento'],
    Icon: ClipboardList,
    accent: '#2563eb',
    priority: 82,
  },
  '/manifestos': {
    category: 'Operação',
    description: 'Manifestos em trânsito, encerrados, custo, ocupação e KM.',
    keywords: ['manifestos', 'frota', 'custo', 'motorista', 'ocupacao'],
    Icon: LayoutDashboard,
    accent: '#0f766e',
    priority: 78,
  },
  '/faturamento': {
    category: 'Operação',
    description: 'Receita, faturamento realizado, peso taxado, volumes e previsões.',
    keywords: ['faturamento', 'receita', 'cte', 'volumes', 'previsao'],
    Icon: Truck,
    accent: '#16a34a',
    priority: 88,
  },
  '/performance': {
    category: 'Operação',
    description: 'Pontualidade de entregas, atrasos, comprovantes e aging operacional.',
    keywords: ['performance', 'entregas', 'prazo', 'atraso', 'comprovante'],
    Icon: BarChart3,
    accent: '#0f766e',
    priority: 92,
  },
  '/tracking': {
    category: 'Operação',
    description: 'Localização de cargas, status de entrega e previsões vencidas.',
    keywords: ['tracking', 'localizacao', 'cargas', 'entrega', 'carteira'],
    Icon: MapPinned,
    accent: '#0891b2',
    priority: 84,
  },
  '/faturas-por-cliente': {
    category: 'Financeiro',
    description: 'Faturamento por cliente, registros pendentes, atraso e prazo médio.',
    keywords: ['cliente', 'faturamento', 'faturas por cliente', 'prazo', 'atraso'],
    Icon: Users,
    accent: '#9333ea',
    priority: 74,
  },
  '/contas-a-pagar': {
    category: 'Financeiro',
    description: 'Contas a pagar, liquidação, conciliação, saldo e lead time.',
    keywords: ['contas a pagar', 'fornecedor', 'liquidacao', 'conciliacao'],
    Icon: CreditCard,
    accent: '#db2777',
    priority: 86,
  },
  '/cotacoes': {
    category: 'Comercial',
    description: 'Cotações, potencial comercial, conversão e motivos de perda.',
    keywords: ['cotacoes', 'comercial', 'conversao', 'funil', 'cliente'],
    Icon: ClipboardList,
    accent: '#ea580c',
    priority: 70,
  },
  '/indicadores-gestao-a-vista': {
    category: 'Operação',
    description: 'Indicadores oficiais de performance, coletores, cubagem, indenização e corte.',
    keywords: ['gestao a vista', 'performance', 'coletores', 'cubagem', 'indenizacao', 'horarios'],
    Icon: BarChart3,
    accent: '#f97316',
    priority: 94,
  },
  '/executivo': {
    category: 'Executivo',
    description: 'Visão consolidada da operação, financeiro e backlog.',
    keywords: ['executivo', 'diretoria', 'consolidado', 'receita', 'backlog'],
    Icon: Activity,
    accent: '#4f46e5',
    priority: 96,
  },
  '/etl-saude': {
    category: 'TI/ETL',
    description: 'Execuções do ETL, volume processado, erros e tempo médio.',
    keywords: ['etl', 'ti', 'saude', 'execucoes', 'erros', 'monitoramento'],
    Icon: HeartPulse,
    accent: '#dc2626',
    priority: 98,
  },
  '/painel/integracoes': {
    category: 'Operação',
    description: 'Auditoria de integrações e telemetria dos ciclos SFTP Vedacit.',
    keywords: ['integracoes', 'vedacit', 'sftp', 'execucoes', 'ppg', 'selia', 'xml', 'eventos', 'comprovantes', 'auditoria'],
    Icon: Activity,
    accent: '#2563eb',
    priority: 90,
  },
};

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function buildFavoriteKey(usuarioId?: string | null): string | null {
  return usuarioId ? `${FAVORITES_STORAGE_PREFIX}:${usuarioId}` : null;
}

export function readFavoritePaths(key: string | null): string[] {
  if (!key || typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function writeFavoritePaths(key: string | null, paths: string[]) {
  if (!key || typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(paths));
}

export function formatRoleName(role?: string | null): string {
  if (!role) return 'Usuário comum';
  return role
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildHomeItem(item: NavItem): HomeDashboardItem {
  const meta = HOME_DASHBOARD_META[item.path] ?? {
    category: 'Operação' as HomeDashboardCategory,
    description: item.description ?? 'Dashboard disponível para consulta.',
    keywords: [item.label],
    Icon: LayoutDashboard,
    accent: '#21478A',
    priority: 50,
  };

  return { ...item, ...meta, description: meta.description, isAccessible: true };
}

export function getAllHomeDashboards(canAccess: (permission: NonNullable<NavItem['permission']>) => boolean) {
  return DASHBOARD_NAV_ITEMS
    .map(buildHomeItem)
    .map((item) => ({
      ...item,
      isAccessible: item.permission ? canAccess(item.permission) : true,
    }))
    .sort((left, right) => (
      Number(right.isAccessible) - Number(left.isAccessible)
      || right.priority - left.priority
      || left.label.localeCompare(right.label)
    ));
}

export function getAccessibleHomeDashboards(canAccess: (permission: NonNullable<NavItem['permission']>) => boolean) {
  return getAllHomeDashboards(canAccess).filter((item) => item.isAccessible);
}
