import { useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Archive, Bell, ChevronDown, CircleAlert, Heart, Megaphone, MessageCircle, Pencil, Plus, Save, Send, Sparkles, X } from 'lucide-react';
import CommunicationsBell from './CommunicationsBell';
import { useLerHomeComunicado } from '../../hooks/queries/useHomeComunicados';
import type {
  HomeCommunicationPriority,
  HomeCommunicationTab,
  HomeNotice,
  HomeNoticeFormState,
  HomeNoticeTag,
  HomeNoticeComment,
} from '../../types/home';

const focusRingClass =
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]';

const TAB_LABELS: Record<HomeCommunicationTab, string> = {
  avisos: 'Avisos',
  atualizacoes: 'Atualizações',
  pendencias: 'Pendências',
};

const TAB_ICONS = {
  avisos: Bell,
  atualizacoes: Sparkles,
  pendencias: CircleAlert,
} as const;

function tagLabel(tag: HomeNoticeTag): string {
  const labels: Record<HomeNoticeTag, string> = {
    NOVO: 'Novo',
    ATENCAO: 'Atenção',
    FIXADO: 'Fixado',
  };

  return labels[tag];
}

function priorityForNotice(notice: HomeNotice): HomeCommunicationPriority {
  if (notice.tag === 'ATENCAO') return 'Alta';
  if (notice.tag === 'FIXADO') return 'Média';
  return 'Baixa';
}

function priorityStyle(priority: HomeCommunicationPriority) {
  if (priority === 'Alta') {
    return { backgroundColor: 'rgba(220, 38, 38, 0.14)', color: '#dc2626' };
  }

  if (priority === 'Média') {
    return { backgroundColor: 'rgba(249, 115, 22, 0.16)', color: '#ea580c' };
  }

  return { backgroundColor: 'rgba(22, 163, 74, 0.14)', color: '#15803d' };
}

function filterByTab(notices: HomeNotice[], tab: HomeCommunicationTab) {
  if (tab === 'atualizacoes') {
    return notices.filter((notice) => notice.tag === 'NOVO');
  }

  if (tab === 'pendencias') {
    return notices.filter((notice) => notice.tag === 'ATENCAO');
  }

  return notices;
}

export default function CommunicationsPanel({
  notices,
  isLoading,
  error,
  isAdmin,
  form,
  showForm,
  editingNoticeId,
  saving,
  onFormChange,
  onStartCreate,
  onStartEdit,
  onCancelForm,
  onSubmit,
  onArchive,
  onToggleLike,
  likingNoticeId,
  commentsNoticeId,
  comments,
  commentsLoading,
  commenting,
  onOpenComments,
  onSubmitComment,
  onDeleteComment,
  deletingCommentId,
  className = '',
}: {
  notices: HomeNotice[];
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  form: HomeNoticeFormState;
  showForm: boolean;
  editingNoticeId: string | null;
  saving: boolean;
  onFormChange: (form: HomeNoticeFormState) => void;
  onStartCreate: () => void;
  onStartEdit: (notice: HomeNotice) => void;
  onCancelForm: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onArchive: (id: string) => void;
  onToggleLike: (id: string) => void;
  likingNoticeId: string | null;
  commentsNoticeId: string | null;
  comments: HomeNoticeComment[];
  commentsLoading: boolean;
  commenting: boolean;
  onOpenComments: (id: string | null) => void;
  onSubmitComment: (id: string, body: string) => Promise<void>;
  onDeleteComment: (noticeId: string, commentId: string) => Promise<void>;
  deletingCommentId: string | null;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState<HomeCommunicationTab>('avisos');
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [burstNoticeId, setBurstNoticeId] = useState<string | null>(null);
  const leitura = useLerHomeComunicado();

  const filteredNotices = useMemo(() => filterByTab(notices, activeTab), [activeTab, notices]);
  const visibleNotices = filteredNotices;

  function handleTabChange(tab: HomeCommunicationTab) {
    setActiveTab(tab);
    setSelectedNoticeId(null);
  }

  function handleLike(id: string, alreadyLiked: boolean) {
    if (!alreadyLiked) {
      setBurstNoticeId(id);
      window.setTimeout(() => setBurstNoticeId((current) => current === id ? null : current), 850);
    }
    onToggleLike(id);
  }

  return (
    <aside
      className={`flex ${className}`}
      aria-label="Comunicações"
    >
      <section
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border shadow-[0_16px_34px_rgba(33,71,138,0.13)]"
        style={{
          backgroundColor: 'var(--color-card)',
          borderColor: 'rgba(33, 71, 138, 0.38)',
        }}
      >
        <div
          className="sticky top-0 z-10 border-b px-4 py-4"
          style={{
            backgroundColor: 'var(--color-card)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#1d4ed8' }}>
                Command Center
              </p>
              <h2 className="mt-1 text-lg font-extrabold" style={{ color: 'var(--color-text)' }}>
                Comunicações
              </h2>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-subtle)' }}>
                Avisos, atualizações e pendências internas.
              </p>
            </div>
            <CommunicationsBell className="h-10 w-10 rounded-2xl border border-[var(--color-primary)]" />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {(Object.keys(TAB_LABELS) as HomeCommunicationTab[]).map((tab) => {
              const active = activeTab === tab;
              const TabIcon = TAB_ICONS[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border text-[10px] font-bold transition-all duration-200 ${focusRingClass}`}
                  style={{
                    backgroundColor: active ? 'var(--color-primary)' : 'rgba(33, 71, 138, 0.05)',
                    borderColor: active ? 'var(--color-primary)' : 'rgba(33, 71, 138, 0.16)',
                    color: active ? '#FFFFFF' : 'var(--color-text)',
                  }}
                  aria-pressed={active}
                >
                  <TabIcon size={13} />
                  {TAB_LABELS[tab]}
                </button>
              );
            })}
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={onStartCreate}
            className={`mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95 ${focusRingClass}`}
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Plus size={14} />
              Novo comunicado
            </button>
          )}
        </div>

        <div
          className="communications-scroll max-h-[39rem] flex-1 overflow-y-auto px-4 py-4 lg:max-h-none"
        >
          {showForm && isAdmin && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) onCancelForm();
              }}
            >
            <form
              onSubmit={onSubmit}
              className="max-h-[calc(100vh-2rem)] w-full max-w-xl space-y-3 overflow-y-auto rounded-[22px] border p-5 shadow-2xl"
              style={{
                backgroundColor: 'var(--color-card)',
                borderColor: 'var(--color-border)',
              }}
            >
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>Título</span>
                <input
                  value={form.title}
                  onChange={(event) => onFormChange({ ...form, title: event.target.value })}
                  className={`h-10 w-full rounded-xl border px-3 text-sm ${focusRingClass}`}
                  style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  maxLength={140}
                  required
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-[1fr_1.25fr]">
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>Tipo</span>
                  <select
                    value={form.tag}
                    onChange={(event) => onFormChange({ ...form, tag: event.target.value as HomeNoticeTag })}
                    className={`h-10 w-full rounded-xl border px-3 text-sm ${focusRingClass}`}
                    style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    <option value="ATENCAO">Atenção</option>
                    <option value="NOVO">Novo</option>
                    <option value="FIXADO">Fixado</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>Público</span>
                  <input
                    value={form.audience}
                    onChange={(event) => onFormChange({ ...form, audience: event.target.value })}
                    className={`h-10 w-full rounded-xl border px-3 text-sm ${focusRingClass}`}
                    style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    maxLength={140}
                    required
                  />
                </label>
              </div>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>Mensagem</span>
                <textarea
                  value={form.body}
                  onChange={(event) => onFormChange({ ...form, body: event.target.value })}
                  className={`min-h-24 w-full resize-none rounded-xl border px-3 py-2 text-sm ${focusRingClass}`}
                  style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  maxLength={700}
                  required
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Save size={14} />
                  {editingNoticeId ? 'Salvar' : 'Publicar'}
                </button>
                <button
                  type="button"
                  onClick={onCancelForm}
                  className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors hover:bg-[var(--color-bg)] ${focusRingClass}`}
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  <X size={14} />
                  Cancelar
                </button>
              </div>
            </form>
            </div>
          )}

          {error && (
            <p
              className="mb-4 rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: 'rgba(239, 68, 68, 0.35)',
                color: '#dc2626',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
              }}
            >
              {error}
            </p>
          )}

          <div className="space-y-3" role="list">
            {leitura.isError && <p role="alert" className="text-xs text-negative">Não foi possível registrar a leitura. Abra o comunicado novamente para tentar.</p>}
            {visibleNotices.map((notice, noticeIndex) => {
              const priority = priorityForNotice(notice);
              const selected = selectedNoticeId === notice.id;
              const isNew = notice.unread;
              const isExpanded = selected;
              const likedNames = notice.likedBy.join(', ');
              const commentsOpen = commentsNoticeId === notice.id;

              return (
                <article key={notice.id} role="listitem">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNoticeId(selected ? null : notice.id);
                      if (!selected && notice.unread) leitura.mutate(notice);
                    }}
                    className={`group w-full rounded-[20px] border p-4 text-left shadow-sm transition-all duration-200 hover:shadow-md ${focusRingClass}`}
                    style={{
                      backgroundColor: selected
                        ? 'var(--color-bg)'
                        : 'var(--color-card)',
                      borderColor: selected ? 'var(--color-primary)' : 'var(--color-border)',
                    }}
                    aria-expanded={selected}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {isNew && (
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} aria-label="Não lido" />
                        )}
                        <span className="truncate text-[11px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>
                          {tagLabel(notice.tag)}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase" style={priorityStyle(priority)}>
                        {priority}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold leading-snug" style={{ color: 'var(--color-text)' }}>
                      {notice.title}
                    </h3>
                    <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--color-primary)' }}>
                      <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      {isExpanded ? 'Recolher texto' : 'Ver mais'}
                    </span>
                    <p className={`mt-2 text-sm leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`} style={{ color: 'var(--color-text-subtle)' }}>
                      {notice.body}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                      <span>{notice.date}</span>
                      <span aria-hidden="true">|</span>
                      <span>{notice.audience}</span>
                    </div>
                  </button>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                    <div className="group/likes relative">
                      <button
                        type="button"
                        onClick={() => handleLike(notice.id, notice.likedByCurrentUser)}
                        disabled={likingNoticeId === notice.id || !/^\d+$/.test(notice.id)}
                        aria-pressed={notice.likedByCurrentUser}
                        aria-label={notice.likedByCurrentUser ? 'Remover curtida' : 'Curtir comunicado'}
                        className={`notice-like-button group/like-cue relative inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${!notice.likedByCurrentUser ? 'notice-like-button--idle' : ''} ${focusRingClass}`}
                        style={{
                          borderColor: notice.likedByCurrentUser ? 'rgba(225, 29, 72, 0.45)' : 'var(--color-border)',
                          color: notice.likedByCurrentUser ? '#e11d48' : 'var(--color-text-muted)',
                          backgroundColor: notice.likedByCurrentUser ? 'rgba(225, 29, 72, 0.08)' : 'transparent',
                          '--like-delay': `${-1 - noticeIndex * 2.35}s`,
                          '--like-duration': `${12 + (noticeIndex % 3) * 1.8}s`,
                        } as CSSProperties}
                      >
                        <Heart size={14} fill={notice.likedByCurrentUser ? 'currentColor' : 'none'} />
                        {notice.likeCount > 0 ? notice.likeCount : 'Curtir'}
                        {burstNoticeId === notice.id && (
                          <span className="notice-like-burst" aria-hidden="true">
                            <Heart className="notice-like-burst__heart notice-like-burst__heart--one" size={13} fill="currentColor" />
                            <Heart className="notice-like-burst__heart notice-like-burst__heart--two" size={10} fill="currentColor" />
                            <Heart className="notice-like-burst__heart notice-like-burst__heart--three" size={12} fill="currentColor" />
                            <Heart className="notice-like-burst__heart notice-like-burst__heart--four" size={9} fill="currentColor" />
                          </span>
                        )}
                        <span className="notice-action-cue notice-action-cue--heart" aria-hidden="true">
                          <Heart className="notice-action-cue__item notice-action-cue__item--one" size={11} fill="currentColor" />
                          <Heart className="notice-action-cue__item notice-action-cue__item--two" size={9} fill="currentColor" />
                          <Heart className="notice-action-cue__item notice-action-cue__item--three" size={12} fill="currentColor" />
                        </span>
                      </button>
                      {notice.likeCount > 0 && (
                        <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-56 rounded-xl border p-3 text-xs opacity-0 shadow-xl transition-opacity group-hover/likes:opacity-100 group-focus-within/likes:opacity-100" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                          <p className="font-bold">Curtido por {notice.likeCount} pessoa{notice.likeCount === 1 ? '' : 's'}</p>
                          <p className="mt-1 leading-relaxed" style={{ color: 'var(--color-text-subtle)' }}>{likedNames || 'Carregando nomes...'}</p>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!/^\d+$/.test(notice.id)}
                      onClick={() => {
                        onOpenComments(commentsOpen ? null : notice.id);
                        setCommentBody('');
                      }}
                      aria-expanded={commentsOpen}
                      className={`group/comment-cue relative inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
                      style={{ borderColor: commentsOpen ? 'var(--color-primary)' : 'var(--color-border)', color: commentsOpen ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                    >
                      <MessageCircle size={14} />
                      {notice.commentCount > 0 ? notice.commentCount : 'Comentar'}
                      <span className="notice-comment-typing" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    </button>
                    </div>

                  {selected && isAdmin && (
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onStartEdit(notice)}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors hover:bg-[var(--color-bg)] ${focusRingClass}`}
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                      >
                        <Pencil size={13} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onArchive(notice.id)}
                        disabled={saving}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950/30 ${focusRingClass}`}
                        style={{ borderColor: 'rgba(239, 68, 68, 0.35)' }}
                      >
                        <Archive size={13} />
                        Arquivar
                      </button>
                    </div>
                  )}
                  </div>
                  {commentsOpen && (
                    <section className="mt-3 rounded-2xl border p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }} aria-label={`Comentários de ${notice.title}`}>
                      <div className="max-h-48 space-y-3 overflow-y-auto pr-1">
                        {commentsLoading && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Carregando comentários...</p>}
                        {!commentsLoading && comments.length === 0 && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Seja a primeira pessoa a comentar.</p>}
                        {comments.map((comment) => (
                          <div key={comment.id} className="rounded-xl border p-2.5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>{comment.authorName}</p>
                              {comment.canDelete && (
                                <button type="button" onClick={() => onDeleteComment(notice.id, comment.id).catch(() => undefined)} disabled={deletingCommentId === comment.id} aria-label={`Excluir comentário de ${comment.authorName}`} title="Excluir comentário" className={`-mr-1 -mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30 ${focusRingClass}`} style={{ color: 'var(--color-text-muted)' }}>×</button>
                              )}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-subtle)' }}>{comment.body}</p>
                          </div>
                        ))}
                      </div>
                      <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!commentBody.trim()) return; onSubmitComment(notice.id, commentBody).then(() => setCommentBody('')).catch(() => undefined); }}>
                        <input value={commentBody} onChange={(event) => setCommentBody(event.target.value)} maxLength={700} placeholder="Escreva um comentário" className={`h-9 min-w-0 flex-1 rounded-lg border px-3 text-xs ${focusRingClass}`} style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                        <button type="submit" disabled={commenting || !commentBody.trim()} className={`inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold text-white disabled:opacity-60 ${focusRingClass}`} style={{ backgroundColor: 'var(--color-primary)' }}><Send size={13} /> Enviar</button>
                      </form>
                    </section>
                  )}
                </article>
              );
            })}

            {visibleNotices.length === 0 && !isLoading && (
              <div className="rounded-[20px] border px-5 py-8 text-center" style={{ borderColor: 'var(--color-border)' }}>
                <Megaphone className="mx-auto mb-3" size={22} style={{ color: 'var(--color-text-muted)' }} />
                <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Nenhum item nesta visão</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-subtle)' }}>Troque de aba ou publique um comunicado.</p>
              </div>
            )}

            {isLoading && (
              <div className="rounded-[20px] border px-5 py-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-subtle)' }}>
                Carregando comunicações...
              </div>
            )}
          </div>
        </div>

      </section>
    </aside>
  );
}
