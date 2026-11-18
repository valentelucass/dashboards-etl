import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { noticeToForm, noticeToPayload } from '../api/endpoints/homeComunicadosServico';
import CommunicationsPanel from '../components/home/CommunicationsPanel';
import HomeHero from '../components/home/HomeHero';
import HomeRequestPanel from '../components/home/HomeRequestPanel';
import HomeRequestsAdminPanel from '../components/home/HomeRequestsAdminPanel';
import { useAutenticacao } from '../contexts/AutenticacaoContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { HOME_COMUNICADOS_API_ENABLED } from '../config/api';
import {
  useArquivarHomeComunicado,
  useAlternarCurtidaHomeComunicado,
  useCriarComentarioHomeComunicado,
  useExcluirComentarioHomeComunicado,
  useHomeComunicadoComentarios,
  useAtualizarHomeComunicado,
  useCriarHomeComunicado,
  useHomeComunicados,
} from '../hooks/queries/useHomeComunicados';
import {
  useArquivarHomeSolicitacao,
  useConcluirHomeSolicitacao,
  useCriarHomeSolicitacao,
  useHomeSolicitacoes,
  useMinhasHomeSolicitacoes,
} from '../hooks/queries/useHomeSolicitacoes';
import type { HomeNotice, HomeNoticeFormState, HomeRequestAttachment, HomeRequestFormState } from '../types/home';
import { baixarHomeSolicitacaoAnexo } from '../api/endpoints/homeSolicitacoesServico';
import { getApiErrorMessage } from '../utils/apiError';
import { canManageCommunications } from '../utils/accessControl';
import { EMPTY_NOTICE_FORM, FALLBACK_HOME_NOTICES } from '../constants/homeNotices';

function isPersistedNoticeId(id: string | null): id is string {
  return Boolean(id && /^\d+$/.test(id));
}

export default function HomePage() {
  const { usuario } = useAutenticacao();
  const [noticeForm, setNoticeForm] = useState<HomeNoticeFormState>(EMPTY_NOTICE_FORM);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [noticeMutationError, setNoticeMutationError] = useState<string | null>(null);
  const [requestMutationError, setRequestMutationError] = useState<string | null>(null);
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [archivePending, setArchivePending] = useState<{ kind: 'notice' | 'request'; id: string } | null>(null);
  const [commentsNoticeId, setCommentsNoticeId] = useState<string | null>(null);

  const comunicadosQuery = useHomeComunicados();
  const criarComunicado = useCriarHomeComunicado();
  const atualizarComunicado = useAtualizarHomeComunicado();
  const arquivarComunicado = useArquivarHomeComunicado();
  const alternarCurtidaComunicado = useAlternarCurtidaHomeComunicado();
  const comentariosComunicado = useHomeComunicadoComentarios(commentsNoticeId);
  const criarComentarioComunicado = useCriarComentarioHomeComunicado();
  const excluirComentarioComunicado = useExcluirComentarioHomeComunicado();
  const criarSolicitacao = useCriarHomeSolicitacao();
  const concluirSolicitacao = useConcluirHomeSolicitacao();
  const arquivarSolicitacao = useArquivarHomeSolicitacao();

  usePageHeader({
    title: 'Início',
    description: 'Comunicados da equipe e solicitações de melhoria.',
  });

  const hasHomeComunicadosApiData = HOME_COMUNICADOS_API_ENABLED && comunicadosQuery.isSuccess;
  const notices = hasHomeComunicadosApiData
    ? comunicadosQuery.data ?? []
    : FALLBACK_HOME_NOTICES;
  const noticeError = noticeMutationError;
  const noticeSaving = criarComunicado.isPending || atualizarComunicado.isPending || arquivarComunicado.isPending;
  const canManageHomeComunicados = HOME_COMUNICADOS_API_ENABLED && hasHomeComunicadosApiData && canManageCommunications(usuario);
  const canManageHomeRequests = canManageCommunications(usuario);
  const solicitacoesQuery = useHomeSolicitacoes(canManageHomeRequests);
  const minhasSolicitacoesQuery = useMinhasHomeSolicitacoes();
  const requestsForCurrentUser = canManageHomeRequests
    ? solicitacoesQuery.data ?? []
    : minhasSolicitacoesQuery.data ?? [];
  const openRequestsCount = requestsForCurrentUser.filter((request) => request.status === 'ABERTA').length;

  function startCreateNotice() {
    setEditingNoticeId(null);
    setNoticeForm(EMPTY_NOTICE_FORM);
    setNoticeMutationError(null);
    setShowNoticeForm(true);
  }

  function startEditNotice(notice: HomeNotice) {
    if (!isPersistedNoticeId(notice.id)) {
      setNoticeMutationError('Este comunicado é temporário e não pode ser editado enquanto a API de comunicações está indisponível.');
      return;
    }

    setEditingNoticeId(notice.id);
    setNoticeForm(noticeToForm(notice));
    setNoticeMutationError(null);
    setShowNoticeForm(true);
  }

  function cancelNoticeForm() {
    setEditingNoticeId(null);
    setNoticeForm(EMPTY_NOTICE_FORM);
    setShowNoticeForm(false);
  }

  async function handleNoticeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNoticeMutationError(null);

    try {
      const payload = noticeToPayload(noticeForm);
      if (editingNoticeId) {
        if (!isPersistedNoticeId(editingNoticeId)) {
          setNoticeMutationError('Este comunicado é temporário e não pode ser editado enquanto a API de comunicações está indisponível.');
          return;
        }

        await atualizarComunicado.mutateAsync({ id: editingNoticeId, payload });
      } else {
        await criarComunicado.mutateAsync(payload);
      }
      cancelNoticeForm();
    } catch (error) {
      setNoticeMutationError(getApiErrorMessage(error, 'Não foi possível salvar o comunicado.'));
    }
  }

  async function archiveNotice(id: string) {
    if (!isPersistedNoticeId(id)) {
      setNoticeMutationError('Este comunicado é temporário e não pode ser arquivado enquanto a API de comunicações está indisponível.');
      return;
    }

    setNoticeMutationError(null);

    try {
      await arquivarComunicado.mutateAsync(id);
    } catch (error) {
      setNoticeMutationError(getApiErrorMessage(error, 'Não foi possível arquivar o comunicado.'));
    }
  }

  async function toggleNoticeLike(id: string) {
    if (!isPersistedNoticeId(id)) return;
    setNoticeMutationError(null);
    try {
      await alternarCurtidaComunicado.mutateAsync(id);
    } catch (error) {
      setNoticeMutationError(getApiErrorMessage(error, 'Não foi possível registrar sua curtida.'));
    }
  }

  async function createNoticeComment(id: string, body: string) {
    setNoticeMutationError(null);
    try {
      await criarComentarioComunicado.mutateAsync({ id, body });
    } catch (error) {
      setNoticeMutationError(getApiErrorMessage(error, 'Não foi possível publicar o comentário.'));
      throw error;
    }
  }

  async function deleteNoticeComment(id: string, commentId: string) {
    setNoticeMutationError(null);
    try {
      await excluirComentarioComunicado.mutateAsync({ id, commentId });
    } catch (error) {
      setNoticeMutationError(getApiErrorMessage(error, 'Não foi possível excluir o comentário.'));
      throw error;
    }
  }

  async function handleRequestSubmit(form: HomeRequestFormState) {
    setRequestMutationError(null);
    try {
      await criarSolicitacao.mutateAsync(form);
    } catch (error) {
      setRequestMutationError(getApiErrorMessage(error, 'Não foi possível enviar a solicitação.'));
      throw error;
    }
  }

  async function completeRequest(id: string) {
    setRequestMutationError(null);
    try {
      await concluirSolicitacao.mutateAsync(id);
    } catch (error) {
      setRequestMutationError(getApiErrorMessage(error, 'Não foi possível concluir a solicitação.'));
    }
  }

  async function archiveRequest(id: string) {
    setRequestMutationError(null);
    try {
      await arquivarSolicitacao.mutateAsync(id);
    } catch (error) {
      setRequestMutationError(getApiErrorMessage(error, 'Não foi possível arquivar a solicitação.'));
    }
  }

  async function downloadRequestAttachment(requestId: string, attachment: HomeRequestAttachment) {
    setRequestMutationError(null);
    try {
      await baixarHomeSolicitacaoAnexo(requestId, attachment);
    } catch (error) {
      setRequestMutationError(getApiErrorMessage(error, 'Não foi possível baixar o anexo.'));
    }
  }

  return (
    <div className="home-page w-full">
      <HomeHero nome={usuario?.nome ?? 'usuário'} />
      <div className="home-layout">
        <HomeRequestPanel
          saving={criarSolicitacao.isPending}
          error={requestMutationError}
          requestCount={openRequestsCount}
          requestsLabel={canManageHomeRequests ? 'Gerenciar solicitações' : 'Ver minhas solicitações'}
          onOpenRequests={() => setRequestsModalOpen(true)}
          onSubmit={handleRequestSubmit}
        />
        <CommunicationsPanel
          notices={notices}
          isLoading={comunicadosQuery.isLoading}
          error={noticeError}
          isAdmin={canManageHomeComunicados}
          form={noticeForm}
          showForm={showNoticeForm}
          editingNoticeId={editingNoticeId}
          saving={noticeSaving}
          likingNoticeId={alternarCurtidaComunicado.isPending ? alternarCurtidaComunicado.variables ?? null : null}
          onFormChange={setNoticeForm}
          onStartCreate={startCreateNotice}
          onStartEdit={startEditNotice}
          onCancelForm={cancelNoticeForm}
          onSubmit={(event) => void handleNoticeSubmit(event)}
          onArchive={id => setArchivePending({ kind: 'notice', id })}
          onToggleLike={(id) => void toggleNoticeLike(id)}
          commentsNoticeId={commentsNoticeId}
          comments={commentsNoticeId ? comentariosComunicado.data ?? [] : []}
          commentsLoading={comentariosComunicado.isLoading}
          commenting={criarComentarioComunicado.isPending}
          deletingCommentId={excluirComentarioComunicado.isPending ? excluirComentarioComunicado.variables?.commentId ?? null : null}
          onOpenComments={setCommentsNoticeId}
          onSubmitComment={(id, body) => createNoticeComment(id, body)}
          onDeleteComment={(id, commentId) => deleteNoticeComment(id, commentId)}
        />
      </div>
      {requestsModalOpen && (
        <HomeRequestsAdminPanel
          open={requestsModalOpen}
          onClose={() => setRequestsModalOpen(false)}
          requests={requestsForCurrentUser}
          isLoading={canManageHomeRequests ? solicitacoesQuery.isLoading : minhasSolicitacoesQuery.isLoading}
          saving={concluirSolicitacao.isPending || arquivarSolicitacao.isPending}
          error={requestMutationError}
          isAdmin={canManageHomeRequests}
          onComplete={canManageHomeRequests ? (id) => void completeRequest(id) : undefined}
          onArchive={canManageHomeRequests ? id => setArchivePending({ kind: 'request', id }) : undefined}
          onDownloadAttachment={(requestId, attachment) => void downloadRequestAttachment(requestId, attachment)}
        />
      )}
      {archivePending && (
        <AlertDialog isOpen title={archivePending.kind === 'notice' ? 'Arquivar comunicado?' : 'Arquivar solicitação?'}
          description={archivePending.kind === 'notice'
            ? 'O comunicado deixará de aparecer para todos.'
            : 'A solicitação ficará em Arquivadas por até 60 dias. Os anexos serão removidos imediatamente.'}
          actionLabel="Arquivar" onOpenChange={open => { if (!open) setArchivePending(null); }}
          onAction={() => {
            setArchivePending(null);
            void (archivePending.kind === 'notice' ? archiveNotice(archivePending.id) : archiveRequest(archivePending.id));
          }} />
      )}
    </div>
  );
}
