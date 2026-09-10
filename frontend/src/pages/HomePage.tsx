import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { noticeToForm, noticeToPayload } from '../api/endpoints/homeComunicadosServico';
import CommunicationsPanel from '../components/home/CommunicationsPanel';
import DashboardCatalog from '../components/home/DashboardCatalog';
import HomeHero from '../components/home/HomeHero';
import HomeRequestPanel from '../components/home/HomeRequestPanel';
import HomeRequestsAdminPanel from '../components/home/HomeRequestsAdminPanel';
import HomeSearch from '../components/home/HomeSearch';
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
import { usePermissions } from '../hooks/usePermissions';
import type { HomeDashboardFilter, HomeDashboardItem, HomeMetric, HomeNotice, HomeNoticeFormState, HomeRequestAttachment, HomeRequestFormState } from '../types/home';
import { baixarHomeSolicitacaoAnexo } from '../api/endpoints/homeSolicitacoesServico';
import { getApiErrorMessage } from '../utils/apiError';
import { canManageCommunications } from '../utils/accessControl';
import {
  buildFavoriteKey,
  CATEGORY_ORDER,
  EMPTY_NOTICE_FORM,
  FALLBACK_HOME_NOTICES,
  formatRoleName,
  getAllHomeDashboards,
  normalizeText,
  readFavoritePaths,
  writeFavoritePaths,
} from '../utils/homeDashboardCatalog';

function isPersistedNoticeId(id: string | null): id is string {
  return Boolean(id && /^\d+$/.test(id));
}

export default function HomePage() {
  const { usuario } = useAutenticacao();
  const { canAccess, isAdminAcesso, isAdminPlataforma, isDesenvolvedor } = usePermissions();
  const favoriteKey = buildFavoriteKey(usuario?.id);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<HomeDashboardFilter>('Todos');
  const [favoritePaths, setFavoritePaths] = useState(() => readFavoritePaths(favoriteKey));
  const [noticeForm, setNoticeForm] = useState<HomeNoticeFormState>(EMPTY_NOTICE_FORM);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [noticeMutationError, setNoticeMutationError] = useState<string | null>(null);
  const [requestMutationError, setRequestMutationError] = useState<string | null>(null);
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
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
    title: 'Home',
    description: 'Hub de acesso aos dashboards liberados para o seu perfil.',
  });

  useEffect(() => {
    writeFavoritePaths(favoriteKey, favoritePaths);
  }, [favoriteKey, favoritePaths]);

  const allDashboards = useMemo(
    () => getAllHomeDashboards(canAccess),
    [canAccess],
  );

  const accessibleDashboards = useMemo(
    () => allDashboards.filter((item) => item.isAccessible),
    [allDashboards],
  );

  const visibleCategories = useMemo(() => {
    const available = new Set(allDashboards.map((item) => item.category));
    return CATEGORY_ORDER.filter((category) => available.has(category));
  }, [allDashboards]);

  const safeActiveCategory = activeCategory !== 'Todos'
    && activeCategory !== 'Favoritos'
    && !visibleCategories.includes(activeCategory)
    ? 'Todos'
    : activeCategory;

  const favoriteItems = useMemo(
    () =>
      favoritePaths
        .map((path) => allDashboards.find((item) => item.path === path && item.isAccessible))
        .filter((item): item is HomeDashboardItem => Boolean(item)),
    [allDashboards, favoritePaths],
  );
  const favoritePathSet = useMemo(() => new Set(favoriteItems.map((item) => item.path)), [favoriteItems]);

  const normalizedQuery = normalizeText(query.trim());
  const filteredDashboards = useMemo(() => {
    return allDashboards.filter((item) => {
      const matchesCategory = safeActiveCategory === 'Todos'
        || (safeActiveCategory === 'Favoritos' && item.isAccessible && favoritePathSet.has(item.path))
        || item.category === safeActiveCategory;
      const searchable = normalizeText([item.label, item.description, item.category, ...item.keywords].join(' '));
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [allDashboards, favoritePathSet, normalizedQuery, safeActiveCategory]);

  const filiais = usuario?.filiaisPermitidasEfetivas ?? [];
  const roleLabel = isDesenvolvedor
    ? 'Desenvolvedor'
    : isAdminPlataforma
      ? 'Admin Plataforma'
      : isAdminAcesso
        ? 'Admin Acesso'
        : formatRoleName(usuario?.papel);
  const setorLabel = usuario?.setor.nome ?? 'Perfil ativo';
  const filiaisLabel = filiais.length > 0 ? `${filiais.length} filial(is)` : 'Acesso total';
  const categorySummary = visibleCategories.length > 0 ? visibleCategories.join(', ') : 'Sem categorias liberadas';
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

  const metrics: HomeMetric[] = [
    {
      id: 'dashboards',
      label: 'Dashboards liberados',
      value: String(accessibleDashboards.length),
      helper: 'Disponíveis para o seu perfil',
    },
    {
      id: 'areas',
      label: 'Áreas',
      value: String(visibleCategories.length),
      helper: categorySummary,
    },
    {
      id: 'favoritos',
      label: 'Favoritos',
      value: String(favoriteItems.length),
      helper: 'Fixados neste navegador',
    },
    {
      id: 'escopo',
      label: 'Escopo',
      value: filiais.length > 0 ? String(filiais.length) : 'Total',
      helper: filiais.length > 0 ? 'Filiais permitidas' : 'Todas as filiais',
    },
  ];

  function toggleFavorite(path: string) {
    const dashboard = allDashboards.find((item) => item.path === path);
    if (!dashboard?.isAccessible) return;

    setFavoritePaths((current) => {
      const exists = current.includes(path);
      const paths = exists
        ? current.filter((item) => item !== path)
        : [path, ...current].slice(0, 8);

      return paths;
    });
  }

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

    const confirmed = window.confirm('Arquivar este comunicado? Ele deixará de aparecer para todos.');
    if (!confirmed) return;

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
    if (!window.confirm('Arquivar esta solicitação? Ela ficará disponível em Arquivadas por até 60 dias. Os anexos serão removidos imediatamente.')) return;
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
    <div className="min-h-[calc(100vh-4rem)] w-full">
      <div className="flex flex-col gap-6">
        <HomeHero
          nome={usuario?.nome ?? 'usuário'}
          roleLabel={roleLabel}
          setorLabel={setorLabel}
          filiaisLabel={filiaisLabel}
          dashboardsLabel={String(accessibleDashboards.length)}
          metrics={metrics}
          search={<HomeSearch value={query} onChange={setQuery} onClear={() => setQuery('')} compact />}
        />

        <div className="relative flex flex-col gap-5 lg:block">
          <main className="min-w-0 space-y-6 lg:mr-[344px] lg:max-2xl:mr-[384px] 2xl:mr-[404px]">
            <div>
              <HomeRequestPanel
                saving={criarSolicitacao.isPending}
                error={requestMutationError}
                requestCount={openRequestsCount}
                requestsLabel={canManageHomeRequests ? 'Gerenciar solicitações' : 'Ver minhas solicitações'}
                onOpenRequests={() => setRequestsModalOpen(true)}
                onSubmit={handleRequestSubmit}
              />
            </div>

            <div>
              <DashboardCatalog
                dashboards={filteredDashboards}
                favorites={favoritePathSet}
                categories={visibleCategories}
                activeCategory={safeActiveCategory}
                onCategoryChange={setActiveCategory}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          </main>

          <aside className="flex min-h-0 w-full flex-col gap-4 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[320px] lg:max-2xl:w-[360px] 2xl:w-[380px]" aria-label="Apoio e comunicações">
            <CommunicationsPanel
              className="min-h-0 lg:h-full"
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
              onArchive={(id) => void archiveNotice(id)}
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
          </aside>
        </div>
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
          onArchive={canManageHomeRequests ? (id) => void archiveRequest(id) : undefined}
          onDownloadAttachment={(requestId, attachment) => void downloadRequestAttachment(requestId, attachment)}
        />
      )}
    </div>
  );
}
