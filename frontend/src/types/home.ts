import type { ComponentType } from 'react';
import type { NavItem } from '../utils/accessControl';

export type HomeDashboardCategory = 'Operação' | 'Financeiro' | 'Comercial' | 'Executivo' | 'TI/ETL';
export type HomeDashboardFilter = HomeDashboardCategory | 'Todos' | 'Favoritos';
export type HomeNoticeTag = 'NOVO' | 'ATENCAO' | 'FIXADO';
export type HomeCommunicationTab = 'avisos' | 'atualizacoes' | 'pendencias';
export type HomeCommunicationPriority = 'Alta' | 'Média' | 'Baixa';

export interface HomeDashboardMeta {
  category: HomeDashboardCategory;
  description: string;
  keywords: string[];
  Icon: ComponentType<{ size?: number; className?: string }>;
  accent: string;
  priority: number;
}

export interface HomeDashboardItem extends Omit<NavItem, 'description'>, HomeDashboardMeta {
  isAccessible: boolean;
}

export interface HomeNotice {
  id: string;
  title: string;
  body: string;
  tag: HomeNoticeTag;
  audience: string;
  date: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  unread?: boolean;
  updatedBy?: string | null;
  likeCount: number;
  commentCount: number;
  likedBy: string[];
  likedByCurrentUser: boolean;
}

export interface HomeNoticeApi {
  id: string;
  titulo: string;
  corpo: string;
  tag: HomeNoticeTag;
  publicoAlvo: string;
  publicadoEm: string;
  atualizadoEm?: string | null;
  naoLido?: boolean;
  atualizadoPor?: string | null;
  totalCurtidas?: number;
  totalComentarios?: number;
  curtidoPor?: string[];
  curtidoPeloUsuarioAtual?: boolean;
}

export interface HomeNoticeComment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  canDelete: boolean;
}

export interface HomeNoticeCommentApi {
  id: string;
  autorNome: string;
  corpo: string;
  criadoEm: string;
  podeExcluir: boolean;
}

export interface HomeNoticePayload {
  titulo: string;
  corpo: string;
  tag: HomeNoticeTag;
  publicoAlvo: string;
}

export interface HomeNoticeFormState {
  title: string;
  body: string;
  tag: HomeNoticeTag;
  audience: string;
}

export interface HomeMetric {
  id: string;
  label: string;
  value: string;
  helper: string;
}

export type HomeRequestType = 'MELHORIA' | 'AUTOMACAO' | 'DASHBOARD' | 'CORRECAO' | 'OUTRO';
export type HomeRequestStatus = 'ABERTA' | 'CONCLUIDA' | 'ARQUIVADA';

export interface HomeRequestFormState {
  type: HomeRequestType;
  title: string;
  description: string;
  expectedResult: string;
  applicationLocation: string;
  attachments: File[];
}

export interface HomeRequestPayload {
  tipo: HomeRequestType;
  titulo: string;
  descricao: string;
  resultadoEsperado: string;
  localAplicacao: string;
}

export interface HomeRequestApi {
  id: string;
  tipo: HomeRequestType;
  titulo: string;
  descricao: string;
  resultadoEsperado?: string | null;
  localAplicacao?: string | null;
  status: HomeRequestStatus;
  solicitanteNome: string;
  solicitanteEmail: string;
  criadoEm: string;
  concluidoEm?: string | null;
  arquivadoEm?: string | null;
  atualizadoPor?: string | null;
  anexos?: HomeRequestAttachmentApi[];
}

export interface HomeRequestAttachmentApi {
  id: number;
  nomeOriginal: string;
  tipoConteudo: string;
  tamanhoBytes: number;
}

export interface HomeRequestAttachment extends Omit<HomeRequestAttachmentApi, 'id'> {
  id: string;
}

export interface HomeRequest extends Omit<HomeRequestApi, 'resultadoEsperado' | 'localAplicacao' | 'concluidoEm' | 'arquivadoEm' | 'anexos'> {
  expectedResult: string;
  applicationLocation: string;
  completedAt?: string | null;
  archivedAt?: string | null;
  attachments: HomeRequestAttachment[];
}
