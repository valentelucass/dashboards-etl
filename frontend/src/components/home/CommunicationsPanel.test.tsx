// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { HomeNotice } from '../../types/home';
import CommunicationsPanel from './CommunicationsPanel';

const { markRead } = vi.hoisted(() => ({ markRead: vi.fn() }));
vi.mock('../../hooks/queries/useHomeComunicados', () => ({
  useLerHomeComunicado: () => ({ isError: false, mutate: markRead }),
}));
vi.mock('./CommunicationsBell', () => ({ default: () => null }));
afterEach(() => { cleanup(); markRead.mockClear(); });

const notice: HomeNotice = {
  id: '1', title: 'Acesso por setor segue permissões efetivas', body: 'Conteúdo do comunicado.',
  audience: 'Todos', date: '17 nov. 2026', tag: 'FIXADO', publishedAt: '2026-11-17',
  unread: true, likeCount: 0, commentCount: 0, likedBy: [], likedByCurrentUser: false,
};

it.each([false, true])('expande pelo cartão e mostra as ações conforme a permissão administrativa (%s)', (isAdmin) => {
  const onToggleLike = vi.fn();
  const onOpenComments = vi.fn();
  const noop = () => undefined;
  render(
    <CommunicationsPanel notices={[notice]} isLoading={false} error={null} isAdmin={isAdmin}
      editingNoticeId={null} form={{ title: '', audience: '', body: '', tag: 'NOVO' }} showForm={false}
      saving={false} onFormChange={noop} onStartCreate={noop} onStartEdit={noop}
      onCancelForm={noop} onSubmit={noop} onArchive={noop} onToggleLike={onToggleLike}
      likingNoticeId={null} commentsNoticeId={null} comments={[]} commentsLoading={false}
      commenting={false} onOpenComments={onOpenComments} onSubmitComment={async () => undefined}
      onDeleteComment={async () => undefined} deletingCommentId={null} />,
  );

  const article = screen.getByRole('article', { name: notice.title });
  const title = within(article).getByRole('heading', { name: notice.title });
  expect(Boolean(within(article).queryByRole('button', { name: 'Editar' }))).toBe(isAdmin);
  expect(Boolean(within(article).queryByRole('button', { name: 'Arquivar' }))).toBe(isAdmin);
  expect(title.closest('button')).toBeNull();
  expect(within(article).queryByText('Ver mais')).toBeNull();
  fireEvent.click(title);
  expect(within(article).getByRole('button', { name: 'Recolher ' + notice.title })).toBeTruthy();
  expect(markRead).toHaveBeenCalledExactlyOnceWith(notice);

  const like = within(article).getByRole('button', { name: 'Curtir comunicado' });
  fireEvent.click(like);
  expect(onToggleLike).toHaveBeenCalledExactlyOnceWith('1');
  expect(like.querySelector('svg.notice-like-icon')?.getAttribute('data-pulsing')).toBe('true');
  const comment = within(article).getByRole('button', { name: 'Comentar' });
  expect(comment.querySelectorAll('svg.notice-comment-icon circle')).toHaveLength(3);
  fireEvent.click(comment);
  expect(onOpenComments).toHaveBeenCalledExactlyOnceWith('1');
  expect(within(article).getByRole('button', { name: 'Recolher ' + notice.title })).toBeTruthy();
  expect(markRead).toHaveBeenCalledTimes(1);
});
