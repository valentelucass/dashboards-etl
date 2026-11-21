import NoticeListLoading from './NoticeListLoading';
import './home.css';
import { Banner } from '@astryxdesign/core/Banner';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { Popover } from '@astryxdesign/core/Popover';
import { Text } from '@astryxdesign/core/Text';
import { useState } from 'react';
import { Bell, ChevronDown, X } from 'lucide-react';
import { useHomeComunicados, useLerHomeComunicado } from '../../hooks/queries/useHomeComunicados';

export default function CommunicationsBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const query = useHomeComunicados();
  const leitura = useLerHomeComunicado();
  const notices = query.data ?? [];
  const unreadCount = notices.filter(notice => notice.unread).length;
  const unreadLabel = unreadCount === 1 ? '1 não lida' : unreadCount + ' não lidas';
  const label = unreadCount ? 'Comunicações: ' + unreadLabel : 'Comunicações';

  return (
    <Popover presentation="adaptive" isOpen={open} onOpenChange={setOpen} label="Comunicados" alignment="end" width="min(25rem, calc(100vw - 24px))"
      content={
        <div className="home-fields min-w-0">
          <div className="home-communications-heading">
            <div className="min-w-0">
              <Heading level={2}>Comunicações</Heading>
              <Text as="p" color="secondary" size="sm">{query.isError ? 'Lista indisponível' : query.isPending ? 'Consultando novidades…' : unreadCount ? unreadLabel : 'Você está em dia'}</Text>
            </div>
            <Button label="Fechar comunicações" isIconOnly variant="ghost" size="sm"
              icon={<X size={16} />} onClick={() => setOpen(false)} />
          </div>
          <div aria-label="Lista de comunicações" className="home-fields max-h-[min(24rem,60dvh)] overflow-y-auto">
            {query.isPending && <NoticeListLoading compact />}
            {query.isError && (
              <Banner role="alert" status="error" title="Não foi possível atualizar as comunicações."
                endContent={<Button label="Tentar novamente" variant="ghost" size="sm" onClick={() => void query.refetch()} />} />
            )}
            {leitura.isError && <Banner role="alert" status="error" title="Não foi possível registrar a leitura. Abra o comunicado novamente para tentar." />}
            {query.isSuccess && notices.length === 0 && <EmptyState title="Nenhum comunicado publicado" isCompact />}
            {notices.map(notice => {
              const expanded = expandedId === notice.id;
              return (
                <ClickableCard key={notice.id} padding={2} className="home-fields home-notice-card" data-expanded={expanded}
                  label={(expanded ? 'Recolher ' : 'Expandir ') + notice.title}
                  onClick={() => {
                    setExpandedId(expanded ? null : notice.id);
                    if (!expanded && notice.unread) leitura.mutate(notice);
                  }}>
                  <div className="home-notice-card-top">
                    <Heading level={3} className="home-notice-title">{notice.title}</Heading>
                    <ChevronDown size={16} aria-hidden="true" className="home-notice-chevron" />
                  </div>
                  <div className="home-notice-meta">
                    {notice.unread && <Badge label="Não lido" variant="info" />}
                    <Text size="xsm" color="secondary">{notice.date}</Text>
                    <Text size="xsm" color="secondary">{notice.audience}</Text>
                  </div>
                  {expanded && <Text as="p" size="sm" className="home-notice-copy">{notice.body}</Text>}
                </ClickableCard>
              );
            })}
          </div>
        </div>
      }>
      {trigger => (
        <Button {...trigger} label={label} tooltip={label} variant="ghost" isIconOnly
          className={'home-communications-bell ' + (className ?? '')}
          icon={<>
            <Bell size={18} aria-hidden="true" />
            {unreadCount > 0 && (
              <Badge label={unreadCount > 99 ? '99+' : unreadCount} variant="error"
                className="home-unread-count" aria-hidden="true" />
            )}
          </>} />
      )}
    </Popover>
  );
}
