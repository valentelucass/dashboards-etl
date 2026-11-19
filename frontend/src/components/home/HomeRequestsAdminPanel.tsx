import DashboardLoading from '../shared/DashboardLoading';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import DashboardAdaptiveDialog from '../shared/DashboardAdaptiveDialog';
import { Grid } from '@astryxdesign/core/Grid';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Text } from '@astryxdesign/core/Text';
import { useId, useState } from 'react';
import { Archive, Check, ClipboardList, Download, X } from 'lucide-react';
import type { HomeRequest, HomeRequestAttachment } from '../../types/home';

const TYPE_LABELS = { MELHORIA: 'Melhoria', AUTOMACAO: 'Automação', DASHBOARD: 'Dashboard', CORRECAO: 'Correção', OUTRO: 'Outro' } as const;
const VIEWS = ['ABERTA', 'CONCLUIDA', 'ARQUIVADA'] as const;
type RequestView = typeof VIEWS[number];
const STATUSES = {
  ABERTA: { label: 'Pendentes', variant: 'warning' },
  CONCLUIDA: { label: 'Concluídas', variant: 'success' },
  ARQUIVADA: { label: 'Arquivadas', variant: 'neutral' },
} as const;

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleString('pt-BR', {
    dateStyle: 'short', timeStyle: 'short',
  });
}

export default function HomeRequestsAdminPanel({
  open, onClose, requests, isLoading, saving, error, isAdmin, onComplete, onArchive, onDownloadAttachment,
}: {
  open: boolean;
  onClose: () => void;
  requests: HomeRequest[];
  isLoading: boolean;
  saving: boolean;
  error: string | null;
  isAdmin: boolean;
  onComplete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDownloadAttachment?: (requestId: string, attachment: HomeRequestAttachment) => void;
}) {
  const [view, setView] = useState<RequestView>('ABERTA');
  const sectionId = useId();
  const grouped = {
    ABERTA: requests.filter(request => request.status === 'ABERTA'),
    CONCLUIDA: requests.filter(request => request.status === 'CONCLUIDA'),
    ARQUIVADA: requests.filter(request => request.status === 'ARQUIVADA'),
  };
  const visible = grouped[view] ?? [];
  const largestGroup = Math.max(...VIEWS.map(key => grouped[key].length));
  const preferredWidth = largestGroup < 2 ? '42rem' : largestGroup === 2 ? '67rem' : '96rem';
  const subtitle = view === 'ABERTA'
    ? visible.length + ' pendente(s) para avaliação'
    : 'As solicitações ' + STATUSES[view].label.toLowerCase() + ' ficam disponíveis por até 60 dias.';

  return (
    <DashboardAdaptiveDialog label={isAdmin ? 'Solicitações de melhoria' : 'Minhas solicitações'} isOpen={open} onOpenChange={next => { if (!next) onClose(); }} purpose="info"
      width={preferredWidth} maxHeight="calc(100dvh - 2rem)" className="home-requests-dialog" aria-labelledby={sectionId + '-title'}>
      <div className="home-fields">
        <div className="home-communications-heading">
          <div className="min-w-0">
            <Heading level={2} id={sectionId + '-title'}>{isAdmin ? 'Solicitações de melhoria' : 'Minhas solicitações'}</Heading>
            <Text as="p" color="secondary" size="sm">{subtitle}</Text>
          </div>
          <Button label="Fechar solicitações" isIconOnly size="sm" variant="ghost" icon={<X size={17} />} onClick={onClose} />
        </div>

        <TabList role="tablist" aria-label="Situação da solicitação" size="sm" hasDivider layout="fill"
          value={view} onChange={next => setView(next as RequestView)}>
          {VIEWS.map(key => <Tab key={key} id={sectionId + '-' + key} value={key}
            label={STATUSES[key].label + ' (' + (grouped[key]?.length ?? 0) + ')'} panelId={sectionId + '-panel'} />)}
        </TabList>
        <div className="home-fields" role="tabpanel" id={sectionId + '-panel'} aria-labelledby={sectionId + '-' + view}>
          {error && <Banner status="error" title={error} />}
          {isLoading && <DashboardLoading variant="section" label="Carregando solicitações" />}
          {!isLoading && visible.length === 0 && <EmptyState title="Nenhuma solicitação nesta situação" icon={<ClipboardList size={24} />} isCompact />}
          {visible.length > 0 && <Grid className="home-request-list" columns={{ minWidth: 368, max: 3, repeat: 'fit' }} gap={4} align="start">
            {visible.map(request => (
              <Card key={request.id} padding={4} className="home-request-card home-wrap-text">
                <div className="home-notice-meta">
                  <Badge label={request.status === 'ABERTA' ? TYPE_LABELS[request.tipo] : STATUSES[request.status].label}
                    variant={STATUSES[request.status].variant} />
                  <Text size="sm" color="secondary">Enviada em {formatDate(request.criadoEm)}</Text>
                </div>
                <div>
                  <Heading level={3} className="home-notice-title">{request.titulo}</Heading>
                  <Text as="p" className="home-notice-copy">{request.descricao}</Text>
                </div>
                {request.expectedResult && <Text as="p" size="sm"><strong>Resultado esperado</strong> {request.expectedResult}</Text>}
                {request.applicationLocation && <Text as="p" size="sm"><strong>Onde será aplicado</strong> {request.applicationLocation}</Text>}
                {request.attachments.length > 0 && (
                  <div className="home-actions">
                    {request.attachments.map(attachment => (
                      <Button key={attachment.id} size="sm" variant="secondary" className="home-attachment-download"
                        label={attachment.nomeOriginal} aria-label={'Baixar ' + attachment.nomeOriginal}
                        tooltip={attachment.nomeOriginal} icon={<Download size={14} />}
                        onClick={() => onDownloadAttachment?.(request.id, attachment)} />
                    ))}
                  </div>
                )}
                {isAdmin && <div className="home-notice-meta">
                  <Text size="sm" color="secondary">{request.solicitanteNome}</Text>
                  <Text size="sm" color="secondary">{request.solicitanteEmail}</Text>
                </div>}
                {request.status === 'CONCLUIDA' && request.completedAt && <Text size="sm" color="secondary">Concluída em {formatDate(request.completedAt)}</Text>}
                {request.status === 'ARQUIVADA' && request.archivedAt && <Text size="sm" color="secondary">Arquivada em {formatDate(request.archivedAt)}</Text>}
                {isAdmin && request.status !== 'ARQUIVADA' && (
                  <div className="home-actions home-request-card-actions">
                    {request.status === 'ABERTA' && onComplete && <Button label="Marcar feita" size="sm" icon={<Check size={14} />}
                      isDisabled={saving} onClick={() => onComplete(request.id)} />}
                    {onArchive && <Button label="Arquivar" size="sm" variant="ghost" icon={<Archive size={14} />}
                      isDisabled={saving} onClick={() => onArchive(request.id)} />}
                  </div>
                )}
              </Card>
            ))}
          </Grid>}
        </div>
      </div>
    </DashboardAdaptiveDialog>
  );
}
