import { useId, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { chartDictionary, type ChartDictionaryKey } from '../../constants/chartDictionary';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';

interface ChartCardProps {
  titulo: string;
  children: ReactNode;
  actions?: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  erro?: string | null;
  className?: string;
  contentClassName?: string;
  chartKey?: ChartDictionaryKey;
}

function ChartSkeleton() {
  return (
    <div className="flex h-full min-h-[350px] flex-col justify-end gap-3" aria-hidden="true">
      <div className="flex h-44 items-end gap-3">
        {[52, 88, 64, 112, 76, 132, 96].map((height, index) => (
          <div key={index} className="flex-1 rounded-t-md bg-slate-200/80" style={{ height }} />
        ))}
      </div>
      <div className="h-3 w-full rounded bg-slate-100" />
      <div className="flex gap-2">
        <div className="h-2 w-24 rounded bg-slate-200/80" />
        <div className="h-2 w-20 rounded bg-slate-100" />
        <div className="h-2 w-28 rounded bg-slate-100" />
      </div>
    </div>
  );
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
  const tooltipId = useId();
  const definition = chartKey ? chartDictionary[chartKey] : undefined;
  const open = Boolean(definition) && (isHovered || isIconFocused || isPinned);

  if (!definition) {
    return (
      <h3 className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
        {titulo}
      </h3>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setIsHovered(false);
          setIsIconFocused(false);
          setIsPinned(false);
        }
      }}
    >
      <PopoverAnchor asChild>
        <div
          className="flex min-w-0 flex-1 cursor-help items-center gap-1.5 rounded-md"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {titulo}
          </h3>
          <button
            type="button"
            aria-describedby={open ? tooltipId : undefined}
            aria-expanded={isPinned}
            aria-label={`Fixar detalhes do gráfico ${titulo}`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
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
          >
            <Info size={14} aria-hidden="true" />
          </button>
        </div>
      </PopoverAnchor>

      <PopoverContent
        id={tooltipId}
        role="tooltip"
        side="bottom"
        align="start"
        sideOffset={8}
        avoidCollisions={false}
        collisionPadding={12}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="pointer-events-none w-[550px] max-w-2xl p-4"
        style={{
          width: 'min(550px, calc(100vw - 1.5rem))',
          color: 'var(--color-text)',
        }}
      >
        <p className="text-base font-bold leading-snug">{titulo}</p>

        <div className="mt-4 grid grid-cols-[132px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm leading-relaxed">
          <span className="font-bold" style={{ color: 'var(--color-primary)' }}>O que mede:</span>
          <span className="min-w-0 break-words" style={{ color: 'var(--color-text-subtle)' }}>{definition.descricao}</span>

          <span className="font-bold" style={{ color: 'var(--color-primary)' }}>Origem:</span>
          <span className="min-w-0 break-words font-mono text-xs" style={{ color: 'var(--color-text)' }}>{definition.tabelasOrigem}</span>

          <span className="font-bold" style={{ color: 'var(--color-primary)' }}>Cruzamentos:</span>
          <span className="min-w-0 break-words" style={{ color: 'var(--color-text-subtle)' }}>{definition.cruzamentos}</span>

          <span className="font-bold" style={{ color: 'var(--color-primary)' }}>Regra SQL:</span>
          <span className="min-w-0 break-words font-mono text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{definition.calculoTecnico}</span>

          <span className="font-bold" style={{ color: 'var(--color-primary)' }}>Como é calculado:</span>
          <span className="min-w-0 break-words" style={{ color: 'var(--color-text-subtle)' }}>{definition.calculoNegocio}</span>

          <span className="font-bold" style={{ color: 'var(--color-primary)' }}>Agrupado por:</span>
          <span className="min-w-0 break-words font-mono text-xs" style={{ color: 'var(--color-text)' }}>{definition.agrupamento}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ChartCard({
  titulo,
  children,
  actions,
  isLoading,
  isEmpty,
  emptyMessage,
  erro,
  className = '',
  contentClassName = '',
  chartKey,
}: ChartCardProps) {
  return (
    <div
      data-dashboard-chart={chartKey}
      className={`flex h-full min-h-0 flex-col rounded-[20px] border p-4 shadow-sm ${className}`}
      style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
        <ChartTitle titulo={titulo} chartKey={chartKey} />
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      <div className={`min-h-0 flex-1 overflow-hidden ${contentClassName}`}>
        {isLoading ? (
          <div className="h-full animate-pulse">
            <ChartSkeleton />
          </div>
        ) : erro ? (
          <div className="flex h-full min-h-[350px] items-center justify-center rounded-xl border border-dashed px-6 text-center text-sm" style={{ borderColor: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.08)', color: '#dc2626' }}>
            {erro}
          </div>
        ) : (!isLoading && isEmpty) ? (
          <div className="flex h-full min-h-[350px] items-center justify-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {emptyMessage ?? 'Nenhum dado disponivel para o periodo selecionado.'}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
