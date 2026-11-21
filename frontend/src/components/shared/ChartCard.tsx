import ChartLoading from './ChartLoading';
import { Banner } from '@astryxdesign/core/Banner';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { chartDictionary, type ChartDictionaryKey } from '../../constants/chartDictionary';
import { Tooltip } from '@astryxdesign/core/Tooltip';

interface ChartCardProps {
  titulo: string;
  children: ReactNode;
  actions?: ReactNode;
  isLoading?: boolean;
  loadingContent?: ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  erro?: string | null;
  className?: string;
  contentClassName?: string;
  chartKey?: ChartDictionaryKey;
}

function ChartTitle({
  titulo,
  chartKey,
}: {
  titulo: string;
  chartKey?: ChartDictionaryKey;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isIconFocused, setIsIconFocused] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const definition = chartKey ? chartDictionary[chartKey] : undefined;
  const open = Boolean(definition) && (isHovered || isIconFocused || isPinned);

  if (!definition) {
    return (
      <h3 className="min-w-0 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
        {titulo}
      </h3>
    );
  }

  return (
    <>
      <div
        ref={anchorRef}
        className="flex min-w-0 max-w-full cursor-help items-center gap-1.5 rounded-md"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <h3 className="min-w-0 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {titulo}
        </h3>
        <Button
          variant="ghost" size="sm" isIconOnly icon={<Info size={15} />}
          aria-expanded={isPinned}
          label={`Fixar detalhes do gráfico ${titulo}`}
          className="shrink-0"
          onBlur={() => setIsIconFocused(false)}
          onClick={(event) => {
            event.stopPropagation();

            if (isPinned) {
              setIsPinned(false);
              setIsHovered(false);
              setIsIconFocused(false);
              event.currentTarget.blur();
              return;
            }

            setIsPinned(true);
          }}
          onFocus={() => setIsIconFocused(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsHovered(false);
              setIsIconFocused(false);
              setIsPinned(false);
              event.currentTarget.blur();
            }
          }}
          style={{ color: 'var(--color-text-muted)' }}
        />
      </div>
      {open && (
        <Tooltip anchorRef={anchorRef} isOpen placement="below"
          alignment="start" hasHoverIndication={false}
          onOpenChange={next => { if (!next) { setIsHovered(false); setIsIconFocused(false); setIsPinned(false); } }}
          content={
            <div className={isPinned
              ? 'dashboard-info-tooltip dashboard-info-tooltip-rich dashboard-chart-tooltip-pinned'
              : 'dashboard-info-tooltip'}>
              <p className="font-bold leading-snug">{titulo}</p>
              <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>{definition.descricao}</p>
              {isPinned && (
                <dl className="dashboard-chart-tooltip-details">
                  <dt>Como é calculado</dt>
                  <dd>{definition.calculoNegocio}</dd>
                  <dt>Origem</dt>
                  <dd className="font-mono text-xs">{definition.tabelasOrigem}</dd>
                  <dt>Cruzamentos</dt>
                  <dd>{definition.cruzamentos}</dd>
                  <dt>Regra SQL</dt>
                  <dd className="font-mono text-xs">{definition.calculoTecnico}</dd>
                  <dt>Agrupado por</dt>
                  <dd className="font-mono text-xs">{definition.agrupamento}</dd>
                </dl>
              )}
            </div>
          } />
      )}
    </>
  );
}

export default function ChartCard({
  titulo,
  children,
  actions,
  isLoading,
  loadingContent,
  isEmpty,
  emptyMessage,
  erro,
  className = '',
  contentClassName = '',
  chartKey,
}: ChartCardProps) {
  return (
    <Card padding={0}
      data-dashboard-chart={chartKey}
      className={`dashboard-chart-card flex h-full min-h-0 flex-col border p-4 ${className}`}
      style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
    >
      <div className="dashboard-chart-heading mb-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
        <ChartTitle titulo={titulo} chartKey={chartKey} />
        {actions ? <div className="ms-auto min-w-0 max-w-full">{actions}</div> : null}
      </div>

      <div className={`min-h-0 flex-1 overflow-hidden ${contentClassName}`}>
        {isLoading ? (
          <div role="status" aria-label={'Carregando gráfico: ' + titulo} className="h-full min-w-0">
            {loadingContent ?? <div className="h-full min-h-[350px]"><ChartLoading /></div>}
          </div>
        ) : erro ? (
          <div className="flex h-full min-h-[350px] items-center justify-center">
            <Banner status="error" title={erro} />
          </div>
        ) : (!isLoading && isEmpty) ? (
          <div className="flex h-full min-h-[350px] items-center justify-center">
            <EmptyState title={emptyMessage ?? 'Nenhum dado disponível para o período selecionado.'} isCompact />
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}
