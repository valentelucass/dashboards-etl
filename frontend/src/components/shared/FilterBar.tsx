import { Dialog } from '@astryxdesign/core/Dialog';
import DashboardButton from "./DashboardButton";
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Children, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronDown, SlidersHorizontal, X } from 'lucide-react';

export interface ActiveFilter {
  label: string;
  count: number;
  valueLabel?: string;
  onRemove: () => void;
}

interface FilterBarProps {
  period?: ReactNode;
  children?: ReactNode;
  onClear?: () => void;
  activeFilters?: ActiveFilter[];
  actions?: ReactNode;
  actionsOnMobileRow?: boolean;
  /** Se fornecidos, exibe data compacta na barra recolhida */
  dataInicio?: string;
  dataFim?: string;
  /** Conteúdo exibido imediatamente após o intervalo compacto de datas. */
  dateAccessory?: ReactNode;
}

// ── helpers ───────────────────────────────────────────────────────────
function fmtData(iso: string): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano.slice(2)}`;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

// ── sub-components ────────────────────────────────────────────────────
function FilterBadge({ label, count, valueLabel, onRemove }: ActiveFilter) {
  const displayValue = valueLabel?.trim() ? valueLabel : String(count);

  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <Badge variant="info" label={label + ': ' + displayValue} className="max-w-48 min-w-0" />
      <Button label={'Remover filtro ' + label} variant="ghost" size="sm" isIconOnly icon={<X size={12} />}
        onClick={event => { event.stopPropagation(); onRemove(); }} />
    </span>
  );
}

// ── main component ────────────────────────────────────────────────────
export default function FilterBar({
  period,
  children,
  onClear,
  activeFilters,
  actions,
  actionsOnMobileRow = false,
  dataInicio,
  dataFim,
  dateAccessory,
}: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const [isPresentationMode, setIsPresentationMode] = useState(() => document.body.dataset.presentationMode === 'true');
  const panelId = useId();
  const presentationAnchorRef = useRef<HTMLDivElement>(null);
  const [presentationPanelTop, setPresentationPanelTop] = useState(0);

  useEffect(() => {
    const atualizarModoApresentacao = () => setIsPresentationMode(document.body.dataset.presentationMode === 'true');
    window.addEventListener('dashboard:presentation-mode-change', atualizarModoApresentacao);
    return () => window.removeEventListener('dashboard:presentation-mode-change', atualizarModoApresentacao);
  }, []);

  useEffect(() => {
    if (!isPresentationMode || !open || isMobile) return;

    const atualizarPosicao = () => {
      const base = presentationAnchorRef.current?.getBoundingClientRect().bottom;
      if (base !== undefined) setPresentationPanelTop(base);
    };

    atualizarPosicao();
    window.addEventListener('resize', atualizarPosicao);
    return () => window.removeEventListener('resize', atualizarPosicao);
  }, [isMobile, isPresentationMode, open]);

  // Scroll lock quando drawer mobile está aberto
  useEffect(() => {
    if (open && isMobile) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = originalOverflow; };
    }
  }, [open, isMobile]);

  const filtersWithValues = activeFilters?.filter((f) => f.count > 0) ?? [];
  const hasActive = filtersWithValues.length > 0;
  const totalActive = filtersWithValues.reduce((s, f) => s + f.count, 0);
  const showDate = dataInicio && dataFim;
  const dimensionCount = Children.toArray(children).length;
  const hasFilterControls = Boolean(period || dimensionCount);

  // ── barra recolhida (sempre visível) ──────────────────────────────
  const collapsedBar = (
    <div
      className={`dashboard-filter-card flex items-center border ${isPresentationMode ? 'h-8 gap-1.5 rounded-none border-0 bg-transparent px-0 shadow-none' : actionsOnMobileRow ? 'min-h-12 flex-wrap gap-x-3 gap-y-1 rounded-[20px] px-4 py-1.5 md:h-12 md:flex-nowrap md:py-0' : 'h-12 gap-3 rounded-[20px] px-4'}`}
      style={{ backgroundColor: isPresentationMode ? 'transparent' : 'var(--color-card)', borderColor: 'var(--color-border)' }}
    >
      {/* Data compacta */}
      {showDate && (
        <>
          <div className="hidden items-center gap-1.5 text-xs sm:flex" style={{ color: 'var(--color-text-muted)' }}>
            <Calendar size={13} className="shrink-0" aria-hidden="true" />
            <span className="font-medium tabular-nums" style={{ color: 'var(--color-text)' }}>{fmtData(dataInicio)}</span>
            <span aria-hidden="true">→</span>
            <span className="font-medium tabular-nums" style={{ color: 'var(--color-text)' }}>{fmtData(dataFim)}</span>
            {dateAccessory ? (
              <>
                <span className="mx-1 h-4 w-px" style={{ backgroundColor: 'var(--color-border)' }} aria-hidden="true" />
                {dateAccessory}
              </>
            ) : null}
          </div>
          <div className="hidden h-5 w-px shrink-0 sm:block" style={{ backgroundColor: 'var(--color-border)' }} aria-hidden="true" />
        </>
      )}

      {/* Botão Filtros */}
      {hasFilterControls && (
        <Button
          label="Filtros"
          variant={isPresentationMode ? 'ghost' : 'secondary'}
          size={isPresentationMode ? 'sm' : 'md'}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          data-dashboard-filters-open={open ? 'true' : undefined}
          aria-controls={panelId}
        >
          <span className="dashboard-code-button-content">
            <SlidersHorizontal size={14} aria-hidden="true" />
            Filtros
            {totalActive > 0 && (
              <span aria-label={String(totalActive) + ' filtros ativos'}><Badge label={totalActive} /></span>
            )}
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }} aria-hidden="true">
              <ChevronDown size={13} />
            </motion.span>
          </span>
        </Button>
      )}

      {actions ? (
        <div className={`flex items-center gap-2 ${actionsOnMobileRow && !isPresentationMode ? 'min-w-0 basis-full md:basis-auto md:shrink-0' : 'shrink-0 overflow-hidden'} ${isPresentationMode ? 'p-0' : 'p-1'}`}>
          {actions}
        </div>
      ) : null}

      {/* Chips de filtros ativos — somente desktop */}
      {hasActive && (
          <div className={`min-w-0 flex-1 items-center gap-1.5 overflow-hidden ${isPresentationMode ? 'hidden' : 'hidden md:flex'}`} aria-label="Filtros ativos">
          {filtersWithValues.slice(0, 3).map((f) => (
            <FilterBadge key={f.label} {...f} />
          ))}
          {filtersWithValues.length > 3 && (
            <span className="shrink-0 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              +{filtersWithValues.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Limpar */}
      {hasActive && onClear && (
        <DashboardButton
          type="button"
          onClick={onClear}
          className="ml-auto shrink-0 cursor-pointer text-xs font-medium transition-opacity hover:opacity-70 active:scale-[0.97]
                     focus:outline-none focus:underline"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Limpar
        </DashboardButton>
      )}
    </div>
  );

  // ── painel desktop (expande inline) ──────────────────────────────
  const desktopPanel = (
    <AnimatePresence initial={false}>
      {open && !isMobile && hasFilterControls && (
        <motion.div
          id={panelId}
          key="desktop-panel"
          role="region"
          aria-label="Painel de filtros"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className={isPresentationMode
            ? 'fixed inset-x-4 z-50 mt-2 overflow-hidden'
            : 'overflow-hidden'}
          style={isPresentationMode ? { top: presentationPanelTop } : undefined}
        >
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="mt-2 rounded-[20px] border p-4 shadow-sm"
            style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
          >
            {/* Período e dimensões quebram como grupos completos, sem campos isolados. */}
            <div
              role="group"
              aria-label="Opções de filtro"
              className="dashboard-filter-options flex flex-wrap items-end gap-3"
            >
              {period && <div className="dashboard-filter-period">{period}</div>}
              {(dimensionCount > 0 || onClear) && (
                <div
                  className="dashboard-filter-dimensions"
                  style={{
                    flexGrow: dimensionCount,
                    flexBasis: dimensionCount * 150 + Math.max(0, dimensionCount - 1) * 12 + (onClear ? 120 : 0),
                  }}
                >
                  {dimensionCount > 0 && (
                    <div className="dashboard-filter-fields" style={{ '--filter-count': dimensionCount } as CSSProperties}>
                      {children}
                    </div>
                  )}
                  {onClear && (
                    <DashboardButton
                      type="button"
                      onClick={onClear}
                      className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    >
                      <X size={13} aria-hidden="true" />
                      Limpar filtros
                    </DashboardButton>
                  )}
                </div>
              )}
            </div>

            {/* A faixa adicional só ocupa espaço quando há seleções a mostrar. */}
            {hasActive && (
              <div
                className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {filtersWithValues.map((f) => (
                  <FilterBadge key={f.label} {...f} />
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const mobileDrawer = open && isMobile && hasFilterControls ? (
    <Dialog isOpen purpose="info" id={panelId} aria-label="Filtros" position={{ bottom: 0 }}
      width="100%" maxHeight="min(48rem,85dvh)" onOpenChange={next => { if (!next) setOpen(false); }}>
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Filtros</span>
            {totalActive > 0 && <Badge label={totalActive} variant="info" aria-label={totalActive + ' filtros ativos'} />}
          </div>
          <Button label="Fechar filtros" isIconOnly icon={<X size={16} />} variant="ghost" onClick={() => setOpen(false)} />
        </div>
        <div role="group" aria-label="Opções de filtro" className="flex min-w-0 flex-col gap-4">
          {period}
          {children}
        </div>
        {hasActive && <div className="flex flex-wrap gap-2">{filtersWithValues.map(item => <FilterBadge key={item.label} {...item} />)}</div>}
        {onClear && <Button label="Limpar filtros" onClick={() => { onClear(); setOpen(false); }} />}
      </div>
    </Dialog>
  ) : null;

  const presentationBackdrop = isPresentationMode && open && !isMobile && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />,
        document.body,
      )
    : null;

  const presentationSlot = typeof document !== 'undefined'
    ? document.getElementById('presentation-filter-slot')
    : null;

  if (isPresentationMode && presentationSlot) {
    return (
      <>
        {createPortal(
          <div ref={presentationAnchorRef} className="relative w-full">
            {collapsedBar}
            {desktopPanel}
          </div>,
          presentationSlot,
        )}
        {presentationBackdrop}
        {mobileDrawer}
      </>
    );
  }

  return (
    <div className={isPresentationMode ? '' : 'mb-3'}>
      {collapsedBar}
      {desktopPanel}
      {presentationBackdrop}
      {mobileDrawer}
    </div>
  );
}
