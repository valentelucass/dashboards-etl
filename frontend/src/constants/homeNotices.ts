import type { HomeNotice, HomeNoticeFormState } from '../types/home';

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
    body: 'O menu lateral mostra os painéis liberados para o usuário autenticado, conforme o setor, o papel e as exceções individuais.',
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
