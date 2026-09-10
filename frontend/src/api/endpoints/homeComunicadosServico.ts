import clienteAxios from '../clienteAxios';
import type { HomeNotice, HomeNoticeApi, HomeNoticeComment, HomeNoticeCommentApi, HomeNoticeFormState, HomeNoticePayload } from '../../types/home';

const HOME_COMUNICADOS_ENDPOINT = '/api/painel/home/comunicados';

export function formatNoticeDate(value?: string | null): string {
  if (!value) return 'Atualização recente';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Atualização recente';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function mapNoticeFromApi(notice: HomeNoticeApi): HomeNotice {
  return {
    id: notice.id,
    title: notice.titulo,
    body: notice.corpo,
    tag: notice.tag,
    audience: notice.publicoAlvo,
    date: formatNoticeDate(notice.publicadoEm),
    publishedAt: notice.publicadoEm,
    updatedAt: notice.atualizadoEm,
    unread: notice.naoLido ?? false,
    updatedBy: notice.atualizadoPor,
    likeCount: notice.totalCurtidas ?? 0,
    commentCount: notice.totalComentarios ?? 0,
    likedBy: notice.curtidoPor ?? [],
    likedByCurrentUser: notice.curtidoPeloUsuarioAtual ?? false,
  };
}

export function noticeToPayload(form: HomeNoticeFormState): HomeNoticePayload {
  return {
    titulo: form.title.trim(),
    corpo: form.body.trim(),
    tag: form.tag,
    publicoAlvo: form.audience.trim() || 'Todos',
  };
}

export function noticeToForm(notice: HomeNotice): HomeNoticeFormState {
  return {
    title: notice.title,
    body: notice.body,
    tag: notice.tag,
    audience: notice.audience,
  };
}

export async function buscarHomeComunicados({ signal }: { signal?: AbortSignal } = {}): Promise<HomeNotice[]> {
  const { data } = await clienteAxios.get<HomeNoticeApi[]>(HOME_COMUNICADOS_ENDPOINT, { signal });
  return data.map(mapNoticeFromApi);
}

export async function registrarLeituraHomeComunicado(notice: HomeNotice): Promise<void> {
  const versao = notice.updatedAt ?? notice.publishedAt;
  if (!versao) throw new Error('Atualize a lista para registrar a leitura deste comunicado.');
  await clienteAxios.put(`${HOME_COMUNICADOS_ENDPOINT}/${notice.id}/leitura`, { versao });
}

export async function criarHomeComunicado(payload: HomeNoticePayload): Promise<HomeNotice> {
  const { data } = await clienteAxios.post<HomeNoticeApi>(HOME_COMUNICADOS_ENDPOINT, payload);
  return mapNoticeFromApi(data);
}

export async function atualizarHomeComunicado(id: string, payload: HomeNoticePayload): Promise<HomeNotice> {
  const { data } = await clienteAxios.put<HomeNoticeApi>(`${HOME_COMUNICADOS_ENDPOINT}/${id}`, payload);
  return mapNoticeFromApi(data);
}

export async function arquivarHomeComunicado(id: string): Promise<void> {
  await clienteAxios.delete(`${HOME_COMUNICADOS_ENDPOINT}/${id}`);
}

export async function alternarCurtidaHomeComunicado(id: string): Promise<HomeNotice> {
  const { data } = await clienteAxios.post<HomeNoticeApi>(`${HOME_COMUNICADOS_ENDPOINT}/${id}/curtidas`);
  return mapNoticeFromApi(data);
}

function mapCommentFromApi(comment: HomeNoticeCommentApi): HomeNoticeComment {
  return { id: comment.id, authorName: comment.autorNome, body: comment.corpo, createdAt: comment.criadoEm, canDelete: comment.podeExcluir };
}

export async function buscarComentariosHomeComunicado(id: string): Promise<HomeNoticeComment[]> {
  const { data } = await clienteAxios.get<HomeNoticeCommentApi[]>(`${HOME_COMUNICADOS_ENDPOINT}/${id}/comentarios`);
  return data.map(mapCommentFromApi);
}

export async function criarComentarioHomeComunicado(id: string, body: string): Promise<HomeNoticeComment> {
  const { data } = await clienteAxios.post<HomeNoticeCommentApi>(`${HOME_COMUNICADOS_ENDPOINT}/${id}/comentarios`, { corpo: body.trim() });
  return mapCommentFromApi(data);
}

export async function excluirComentarioHomeComunicado(id: string, commentId: string): Promise<void> {
  await clienteAxios.delete(`${HOME_COMUNICADOS_ENDPOINT}/${id}/comentarios/${commentId}`);
}
