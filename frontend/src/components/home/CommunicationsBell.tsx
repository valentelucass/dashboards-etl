import { useState } from 'react';
import { Bell, ChevronDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useHomeComunicados, useLerHomeComunicado } from '../../hooks/queries/useHomeComunicados';

export default function CommunicationsBell({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const query = useHomeComunicados();
  const leitura = useLerHomeComunicado();
  const notices = query.data ?? [];
  const unreadCount = notices.filter((notice) => notice.unread).length;
  const unreadLabel = unreadCount === 1 ? '1 não lida' : `${unreadCount} não lidas`;
  const label = unreadCount > 0 ? `Comunicações: ${unreadLabel}` : 'Comunicações';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} title={label}
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl outline-none hover:bg-[var(--color-bg)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${className}`}
          style={{ color: unreadCount ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
          <Bell size={18} aria-hidden="true" />
          {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} collisionPadding={12} className="z-[120] flex flex-col"
        aria-label="Comunicados do Command Center"
        style={{ width: 'min(400px, calc(100vw - 24px))', minWidth: 0, padding: 0, maxHeight: 'min(480px, calc(100dvh - 24px), var(--radix-popover-content-available-height, 480px))' }}>
        <div className="flex shrink-0 items-center justify-between border-b p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div><h2 className="text-sm font-bold">Comunicações</h2><p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{query.isError ? 'Lista indisponível' : query.isPending ? 'Consultando novidades…' : unreadCount ? unreadLabel : 'Você está em dia'}</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar comunicações" className="rounded-lg p-2 focus-visible:ring-2"><X size={16} /></button>
        </div>
        <div aria-label="Lista de comunicações" className="min-h-0 max-h-[390px] space-y-2 overflow-y-auto overscroll-contain p-3" style={{ scrollbarGutter: 'stable' }}>
          {query.isPending && <p role="status" className="p-2 text-sm">Carregando comunicações…</p>}
          {query.isError && <div role="alert" className="p-2 text-sm">Não foi possível atualizar as comunicações. <button type="button" className="underline" onClick={() => void query.refetch()}>Tentar novamente</button></div>}
          {leitura.isError && <p role="alert" className="p-2 text-xs text-negative">Não foi possível registrar a leitura. Abra o comunicado novamente para tentar.</p>}
          {query.isSuccess && notices.length === 0 && <p className="p-2 text-sm">Nenhum comunicado publicado.</p>}
          {notices.map((notice) => {
            const expanded = expandedId === notice.id;
            return <article key={notice.id} className="rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
              <button type="button" aria-expanded={expanded} className="w-full rounded-xl p-3 text-left focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                onClick={() => {
                  setExpandedId(expanded ? null : notice.id);
                  if (!expanded && notice.unread) leitura.mutate(notice);
                }}>
                <span className="flex items-start gap-2">
                  {notice.unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-label="Não lido" />}
                  <strong className="min-w-0 flex-1 break-words text-sm">{notice.title}</strong>
                  <ChevronDown size={15} className={`shrink-0 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                </span>
                <span className="mt-1 block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{notice.date} · {notice.tag === 'ATENCAO' ? 'Pendência' : notice.tag === 'NOVO' ? 'Atualização' : 'Aviso'} · {notice.audience}</span>
              </button>
              {expanded && <p className="whitespace-pre-wrap break-words px-3 pb-3 text-sm leading-relaxed">{notice.body}</p>}
            </article>;
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
