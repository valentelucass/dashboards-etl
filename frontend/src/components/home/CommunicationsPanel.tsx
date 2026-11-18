import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { Banner } from '@astryxdesign/core/Banner';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Dialog } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Archive, ChevronDown, Heart, Megaphone, MessageCircle, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useLerHomeComunicado } from '../../hooks/queries/useHomeComunicados';
import type { HomeCommunicationTab, HomeNotice, HomeNoticeComment, HomeNoticeFormState, HomeNoticeTag } from '../../types/home';
import { FormTextField } from '../shared/FormTextField';
import CommunicationsBell from './CommunicationsBell';

const TABS = [
  { value: 'avisos', label: 'Avisos' },
  { value: 'atualizacoes', label: 'Atualizações', tag: 'NOVO' },
  { value: 'pendencias', label: 'Pendências', tag: 'ATENCAO' },
] as const;
const NOTICE_TYPES = [
  { value: 'ATENCAO', label: 'Atenção' },
  { value: 'NOVO', label: 'Novo' },
  { value: 'FIXADO', label: 'Fixado' },
];
const PRIORITY = {
  ATENCAO: { label: 'Alta', variant: 'error' },
  FIXADO: { label: 'Média', variant: 'warning' },
  NOVO: { label: 'Baixa', variant: 'success' },
} as const;

interface CommunicationsPanelProps {
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
}

function NoticeEditor({
  form, editingNoticeId, saving, error, onFormChange, onCancelForm, onSubmit,
}: Pick<CommunicationsPanelProps, 'form' | 'editingNoticeId' | 'saving' | 'error' | 'onFormChange' | 'onCancelForm' | 'onSubmit'>) {
  const headingId = useId();

  return (
    <Dialog isOpen purpose="form" aria-labelledby={headingId} width={520}
      onOpenChange={open => { if (!open) onCancelForm(); }}>
      <form onSubmit={onSubmit} className="home-fields">
        <Heading level={2} id={headingId}>{editingNoticeId ? 'Editar comunicado' : 'Novo comunicado'}</Heading>
        {error && <Banner status="error" title={error} />}
        <FormTextField label="Título" value={form.title} onChange={title => onFormChange({ ...form, title })}
          maxLength={140} required />
        <div className="home-form-columns">
          <Selector label="Tipo" value={form.tag} options={NOTICE_TYPES}
            onChange={tag => onFormChange({ ...form, tag: tag as HomeNoticeTag })} />
          <FormTextField label="Público" value={form.audience}
            onChange={audience => onFormChange({ ...form, audience })} maxLength={140} required />
        </div>
        <TextArea label="Mensagem" value={form.body}
          onChange={body => onFormChange({ ...form, body })} maxLength={700}
          {...{ required: true }} isRequired rows={5} width="100%" />
        <div className="home-actions justify-end">
          <Button label="Cancelar" onClick={onCancelForm} />
          <Button type="submit" variant="primary" label={editingNoticeId ? 'Salvar' : 'Publicar'} isDisabled={saving} />
        </div>
      </form>
    </Dialog>
  );
}

function NoticeComments({
  notice, comments, commentsLoading, commenting, onSubmitComment, onDeleteComment, deletingCommentId,
}: Pick<CommunicationsPanelProps, 'comments' | 'commentsLoading' | 'commenting' | 'onSubmitComment' | 'onDeleteComment' | 'deletingCommentId'> & {
  notice: HomeNotice;
}) {
  const [body, setBody] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body.trim()) {
      onSubmitComment(notice.id, body).then(() => setBody('')).catch(() => undefined);
    }
  }

  return (
    <section className="home-fields home-notice-comments" aria-label={'Comentários de ' + notice.title}>
      {commentsLoading && <Spinner size="sm" label="Carregando comentários" />}
      {!commentsLoading && comments.length === 0 && (
        <Text as="p" size="xsm" color="secondary">Seja a primeira pessoa a comentar.</Text>
      )}
      {comments.map(comment => (
        <Card key={comment.id} padding={2} variant="muted" className="min-w-0">
          <div className="home-comment-heading">
            <Text weight="semibold" size="sm">{comment.authorName}</Text>
            {comment.canDelete && (
              <Button label={'Excluir comentário de ' + comment.authorName} tooltip="Excluir comentário"
                variant="ghost" size="sm" isIconOnly icon={<Trash2 size={14} />} isDisabled={deletingCommentId === comment.id}
                onClick={() => { void onDeleteComment(notice.id, comment.id).catch(() => undefined); }} />
            )}
          </div>
          <Text as="p" size="sm" className="home-notice-copy">{comment.body}</Text>
        </Card>
      ))}
      <form className="home-fields" onSubmit={submit}>
        <TextArea label="Escreva um comentário" isLabelHidden value={body} onChange={setBody}
          placeholder="Escreva um comentário" maxLength={700} width="100%" rows={2} />
        <Button label="Enviar" icon={<Send size={14} />} type="submit" variant="primary" size="sm"
          className="justify-self-start" isDisabled={commenting || !body.trim()} />
      </form>
    </section>
  );
}

export default function CommunicationsPanel(props: CommunicationsPanelProps) {
  const {
    notices, isAdmin, isLoading, error, showForm, saving, onStartCreate, onStartEdit, onArchive,
    onToggleLike, likingNoticeId, commentsNoticeId, onOpenComments,
  } = props;
  const [tab, setTab] = useState<HomeCommunicationTab>('avisos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pulsingNoticeId, setPulsingNoticeId] = useState<string | null>(null);
  const pulseTimer = useRef<number | undefined>(undefined);
  const sectionId = useId();
  const leitura = useLerHomeComunicado();
  const activeTab = TABS.find(item => item.value === tab);
  const visible = activeTab && 'tag' in activeTab ? notices.filter(notice => notice.tag === activeTab.tag) : notices;

  useEffect(() => () => window.clearTimeout(pulseTimer.current), []);

  function toggleLike(notice: HomeNotice) {
    if (!notice.likedByCurrentUser) {
      window.clearTimeout(pulseTimer.current);
      setPulsingNoticeId(notice.id);
      pulseTimer.current = window.setTimeout(() => setPulsingNoticeId(null), 500);
    }
    onToggleLike(notice.id);
  }

  return (
    <aside className="home-communications" aria-labelledby={sectionId + '-title'}>
      <Card padding={4} className="home-communications-card">
        <div className="home-communications-heading">
          <Heading level={2} id={sectionId + '-title'}>Comunicações</Heading>
          <CommunicationsBell />
        </div>
        <TabList role="tablist" aria-label="Tipo de comunicação" size="sm" layout="fill" hasDivider
          className="home-communications-tabs" value={tab}
          onChange={next => { setTab(next as HomeCommunicationTab); setSelectedId(null); }}>
          {TABS.map(item => (
            <Tab key={item.value} id={sectionId + '-' + item.value} value={item.value}
              label={item.label} panelId={sectionId + '-panel'} />
          ))}
        </TabList>
        {isAdmin && <Button label="Novo comunicado" variant="secondary" icon={<Plus size={16} />} onClick={onStartCreate} />}
        {isAdmin && showForm && <NoticeEditor {...props} />}
        <div className="home-fields home-notice-list" role="tabpanel" id={sectionId + '-panel'} aria-labelledby={sectionId + '-' + tab}>
          {error && !showForm && <Banner status="error" title={error} />}
          {leitura.isError && <Banner status="error" title="Não foi possível registrar a leitura. Abra o comunicado novamente para tentar." />}
          {isLoading && <Spinner size="sm" label="Carregando comunicações" />}
          {!isLoading && visible.length === 0 && (
            <EmptyState title="Nenhum comunicado nesta aba" icon={<Megaphone size={24} />} isCompact />
          )}
          {visible.map((notice, index) => {
            const selected = selectedId === notice.id;
            const commentsOpen = commentsNoticeId === notice.id;
            const persisted = /^\d+$/.test(notice.id);
            const likesLabel = notice.likedBy.length ? notice.likedBy.join(', ') : undefined;
            const noticeId = sectionId + '-notice-' + notice.id;

            return (
              <article key={notice.id} aria-labelledby={noticeId + '-title'} className="min-w-0">
                <ClickableCard padding={3} className="home-notice-card" data-expanded={selected}
                  label={(selected ? 'Recolher ' : 'Expandir ') + notice.title}
                  onClick={() => {
                    setSelectedId(selected ? null : notice.id);
                    if (!selected && notice.unread) leitura.mutate(notice);
                  }}>
                  <div className="home-notice-card-top">
                    <div className="home-notice-heading">
                      <Heading level={3} id={noticeId + '-title'} className="home-notice-title">{notice.title}</Heading>
                      <div className="home-actions home-notice-tags">
                        <Badge label={NOTICE_TYPES.find(type => type.value === notice.tag)?.label ?? notice.tag} variant="neutral" />
                        <Badge {...(PRIORITY[notice.tag] ?? PRIORITY.NOVO)} />
                        {notice.unread && <Badge label="Não lido" variant="info" />}
                      </div>
                    </div>
                    <ChevronDown size={16} aria-hidden="true" className="home-notice-chevron" />
                  </div>
                  <div className="home-notice-meta">
                    <Text size="xsm" color="secondary">{notice.date}</Text>
                    <Text size="xsm" color="secondary">{notice.audience}</Text>
                  </div>
                  <Text as="p" id={noticeId + '-body'} size="sm" color="secondary"
                    maxLines={selected ? undefined : 3} className="home-notice-copy">{notice.body}</Text>
                  <div className="home-actions home-notice-actions">
                    <Button label={notice.likeCount > 0 ? String(notice.likeCount) : 'Curtir'} tooltip={likesLabel}
                      aria-label={notice.likedByCurrentUser ? 'Remover curtida' : 'Curtir comunicado'}
                      aria-pressed={notice.likedByCurrentUser} isDisabled={!persisted || likingNoticeId === notice.id}
                      variant={notice.likedByCurrentUser ? 'secondary' : 'ghost'}
                      className={'notice-like-button' + (persisted && !notice.likedByCurrentUser ? ' notice-like-button--idle' : '')}
                      style={{ '--like-delay': (-1 - index * 2.35) + 's', '--like-duration': (12 + (index % 3) * 1.8) + 's' } as CSSProperties}
                      icon={<Heart className="notice-like-icon" size={15} aria-hidden="true"
                        fill={notice.likedByCurrentUser ? 'currentColor' : 'none'}
                        data-pulsing={pulsingNoticeId === notice.id || undefined} />}
                      onClick={() => toggleLike(notice)} />
                    <Button label={notice.commentCount > 0 ? 'Comentários (' + notice.commentCount + ')' : 'Comentar'}
                      aria-expanded={commentsOpen} isDisabled={!persisted} variant="ghost"
                      className="notice-comment-button"
                      icon={<MessageCircle className="notice-comment-icon" size={17} strokeWidth={1.8} aria-hidden="true">
                        <g className="notice-comment-dots" fill="currentColor" stroke="none">
                          <circle cx={7.5} cy={12} r={1.5} />
                          <circle cx={12} cy={12} r={1.5} />
                          <circle cx={16.5} cy={12} r={1.5} />
                        </g>
                      </MessageCircle>}
                      onClick={() => onOpenComments(commentsOpen ? null : notice.id)} />
                    {isAdmin && persisted && <>
                      <Button label="Editar" variant="ghost" icon={
                        <Pencil className="notice-edit-icon" size={16} aria-hidden="true">
                          <path className="notice-pencil-stroke" d="M3 22h15" pathLength={1} strokeWidth={1.6} />
                        </Pencil>}
                        onClick={() => onStartEdit(notice)} />
                      <Button label="Arquivar" variant="ghost" icon={<Archive className="notice-archive-icon" size={16} aria-hidden="true" />}
                        isDisabled={saving} onClick={() => onArchive(notice.id)} />
                    </>}
                  </div>
                  {commentsOpen && <NoticeComments key={notice.id} {...props} notice={notice} />}
                </ClickableCard>
              </article>
            );
          })}
        </div>
      </Card>
    </aside>
  );
}
