import { useMediaQuery } from '@astryxdesign/core/hooks';
import './filter-bar.css';
import { BottomSheet } from '@astryxdesign/core/BottomSheet';
import DashboardButton from "./DashboardButton";
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Children, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronDown, type LucideIcon, SlidersHorizontal, X } from 'lucide-react';
import { FilterHeaderContext } from '../../contexts/FilterHeaderContext';
import LastUpdated from './LastUpdated';
import { HeaderPanelOutletContext } from '../../contexts/HeaderPanelOutletContext';

export interface ActiveFilter {
  label: string;
  count: number;
  valueLabel?: string;
  onRemove?: () => void;
}

interface FilterBarProps {
  period?: ReactNode;
  children?: ReactNode;
  onClear?: () => void;
  onOpen?: () => void;
  activeFilters?: ActiveFilter[];
  actions?: ReactNode;
  actionPanel?: { label: string; icon: LucideIcon; open: boolean; onOpenChange: (open: boolean) => void; content: ReactNode };
  /** Se fornecidos, exibe data compacta na barra recolhida */
  dataInicio?: string;
  dataFim?: string;
  /** Conteúdo exibido imediatamente após o intervalo compacto de datas. */
  dateAccessory?: ReactNode;
}

// ── helpers ───────────────────────────────────────────────────────────
function fmtData(iso: string, fullYear: boolean): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${fullYear ? ano : ano.slice(2)}`;
}

const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function compactPeriod(start: string, end: string): string {
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  const last = `${endDay} ${months[endMonth - 1]} ${endYear}`;
  if (start === end) return last;
  let from = String(startDay);
  if (startYear !== endYear || startMonth !== endMonth) from += ' ' + months[startMonth - 1];
  if (startYear !== endYear) from += ' ' + startYear;
  return from + ' a ' + last;
}

// ── sub-components ────────────────────────────────────────────────────
function FilterBadge({ label, count, valueLabel, onRemove }: ActiveFilter) {
  const displayValue = valueLabel?.trim() ? valueLabel : String(count);

  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <Badge variant="info" label={label + ': ' + displayValue} className="max-w-48 min-w-0" />
      {onRemove && <Button label={'Remover filtro ' + label} variant="ghost" size="sm" isIconOnly icon={<X size={12} />}
        onClick={event => { event.stopPropagation(); onRemove(); }} />}
    </span>
  );
}

// ── main component ────────────────────────────────────────────────────
export default function FilterBar({
  period,
  children,
  onClear,
  onOpen,
  activeFilters,
  actions,
  actionPanel,
  dataInicio,
  dataFim,
  dateAccessory,
}: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const header = useContext(FilterHeaderContext);
  const isMobile = useMediaQuery('(width < 48rem)');
  const [isPresentationMode, setIsPresentationMode] = useState(() => document.body.dataset.presentationMode === 'true');
  const panelId = useId();
  const lastTriggerRef = useRef<HTMLButtonElement>(null);
  const [actionOutlet, setActionOutlet] = useState<HTMLDivElement | null>(null);
  const showingAction = Boolean(actionPanel?.open);
  const panelOpen = open || showingAction;
  const panelLabel = showingAction && actionPanel ? actionPanel.label : 'Filtros';
  const presentationAnchorRef = useRef<HTMLDivElement>(null);
  const [presentationPanelTop, setPresentationPanelTop] = useState(0);

  useEffect(() => {
    const atualizarModoApresentacao = () => setIsPresentationMode(document.body.dataset.presentationMode === 'true');
    window.addEventListener('dashboard:presentation-mode-change', atualizarModoApresentacao);
    return () => window.removeEventListener('dashboard:presentation-mode-change', atualizarModoApresentacao);
  }, []);

  useEffect(() => {
    if (!isPresentationMode || !panelOpen || isMobile) return;

    const atualizarPosicao = () => {
      const base = presentationAnchorRef.current?.getBoundingClientRect().bottom;
      if (base !== undefined) setPresentationPanelTop(base);
    };

    atualizarPosicao();
    window.addEventListener('resize', atualizarPosicao);
    return () => window.removeEventListener('resize', atualizarPosicao);
  }, [isMobile, isPresentationMode, panelOpen]);

  const filtersWithValues = activeFilters?.filter((f) => f.count > 0) ?? [];
  const hasActive = filtersWithValues.length > 0;
  const totalActive = filtersWithValues.reduce((s, f) => s + f.count, 0);
  const showDate = dataInicio && dataFim;
  const dimensionCount = Children.toArray(children).length;
  const hasFilterControls = Boolean(period || dimensionCount || hasActive);
  const inHeader = !isPresentationMode && Boolean(header?.toolbar && header.panel);
  const toolbar = inHeader || isPresentationMode;
  const panelSummary = (header?.updatedAt || hasActive) && (
    <div className="dashboard-filter-summary">
      {header?.updatedAt && <LastUpdated dataExtracao={header.updatedAt} />}
      {hasActive && <div role="group" aria-label="Filtros ativos" className="dashboard-filter-badges">
        {filtersWithValues.map(filter => <FilterBadge key={filter.label} {...filter} />)}
      </div>}
    </div>
  );

  function toggleFilters() {
    if (showingAction) actionPanel?.onOpenChange(false);
    if (!open) onOpen?.();
    setOpen(!open);
  }

  function closePanel() {
    if (showingAction) actionPanel?.onOpenChange(false);
    setOpen(false);
  }

  function disclosureButton(kind: 'filters' | 'action') {
    const isAction = kind === 'action';
    const label = isAction && actionPanel ? actionPanel.label : 'Filtros';
    const expanded = isAction ? showingAction : open;
    const Icon = isAction && actionPanel ? actionPanel.icon : SlidersHorizontal;
    return (
      <Button
        label={label} tooltip={label}
        aria-label={!isAction && totalActive ? `Filtros, ${totalActive} selecionado(s)` : label}
        variant={isPresentationMode || inHeader ? 'ghost' : 'secondary'}
        size={isPresentationMode ? 'sm' : 'md'}
        className={toolbar ? `dashboard-header-action dashboard-filter-toggle${isAction ? ' dashboard-panel-toggle' : ''}` : undefined}
        aria-expanded={expanded} aria-controls={panelId}
        data-dashboard-filters-open={!isAction && open ? 'true' : undefined}
        onClick={event => {
          lastTriggerRef.current = event.currentTarget;
          if (isAction) {
            setOpen(false);
            actionPanel?.onOpenChange(!showingAction);
          } else {
            toggleFilters();
          }
        }}
      >
        <span className="dashboard-code-button-content">
          <Icon size={14} aria-hidden="true" />
          <span className="dashboard-action-label">{label}</span>
          {!isAction && totalActive > 0 && <span aria-label={totalActive + ' filtros ativos'}><Badge label={totalActive} /></span>}
          <motion.span className="dashboard-filter-chevron" animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }} aria-hidden="true">
            <ChevronDown size={13} />
          </motion.span>
        </span>
      </Button>
    );
  }

  const pageActions = <>
    {dateAccessory && !isMobile && <div className="dashboard-date-accessory shrink-0 text-xs">{dateAccessory}</div>}
    {(actions || actionPanel) && <div className="dashboard-filter-actions flex min-w-0 max-w-full items-center gap-2">
      {actions}
      {actionPanel && disclosureButton('action')}
    </div>}
  </>;

  // ── barra recolhida (sempre visível) ──────────────────────────────
  const collapsedBar = (
    <div
      className={toolbar ? 'dashboard-header-toolbar' : 'dashboard-filter-card flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 rounded-[20px] border px-4 py-2 md:flex-nowrap md:py-0'}
    >
      {toolbar && pageActions}
      {/* Data compacta */}
      {showDate && (
        <>
          <div className="dashboard-filter-date flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <Calendar size={13} className="shrink-0" aria-hidden="true" />
            {toolbar ? (
              <span className="dashboard-filter-date-values" title={fmtData(dataInicio, true) + ' → ' + fmtData(dataFim, true)}>
                {compactPeriod(dataInicio, dataFim)}
              </span>
            ) : (
              <div className="dashboard-filter-date-values">
                <time dateTime={dataInicio}><span className="sr-only">De </span>{fmtData(dataInicio, false)}</time>
                <span aria-hidden="true"> → </span>
                <time dateTime={dataFim}><span className="sr-only">Até </span>{fmtData(dataFim, false)}</time>
              </div>
            )}
          </div>
          {!toolbar && <div className="hidden h-5 w-px shrink-0 sm:block" style={{ backgroundColor: 'var(--color-border)' }} aria-hidden="true" />}
        </>
      )}

      {hasFilterControls && disclosureButton('filters')}
      {!toolbar && pageActions}

    </div>
  );

  // ── painel desktop (expande inline) ──────────────────────────────
  const desktopPanel = (
    <AnimatePresence initial={false}>
      {panelOpen && !isMobile && (
        <motion.div
          id={panelId}
          key="desktop-panel"
          role="region"
          aria-label={showingAction ? panelLabel : 'Painel de filtros'}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className={isPresentationMode
            ? 'fixed inset-x-4 z-50 mt-2 overflow-y-auto overscroll-contain'
            : 'overflow-hidden'}
          style={isPresentationMode ? { top: presentationPanelTop, maxHeight: `calc(100dvh - ${presentationPanelTop}px - 1rem)` } : undefined}
        >
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.15 }}
            className={showingAction ? 'dashboard-header-panel-content mt-2' : 'mt-2 rounded-[20px] border p-4 shadow-sm'}
            style={showingAction ? undefined : { backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
          >
            {showingAction ? <div ref={setActionOutlet} /> : <>
              {panelSummary}
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
            </>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Below md the filters move out of the content column into a touch sheet.
  const mobileDrawer = isMobile && (hasFilterControls || actionPanel) ? (
    <BottomSheet isOpen={panelOpen} id={panelId} label={panelLabel} height="tall" padding={4}
      finalFocusRef={lastTriggerRef} onOpenChange={next => { if (!next) closePanel(); }}>
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{panelLabel}</span>
            {!showingAction && totalActive > 0 && <Badge label={totalActive} variant="info" aria-label={totalActive + ' filtros ativos'} />}
          </div>
          <Button label={showingAction ? 'Fechar ' + panelLabel : 'Fechar filtros'} isIconOnly icon={<X size={16} />} variant="ghost" onClick={closePanel} />
        </div>
        {showingAction ? <div className="dashboard-header-panel-content" ref={setActionOutlet} /> : <>
          {panelSummary}
          <div role="group" aria-label="Opções de filtro" className="dashboard-mobile-filter-fields grid min-w-0 gap-4">
            {period && <div className="dashboard-filter-period">{period}</div>}
            {dateAccessory && <div className="text-xs">{dateAccessory}</div>}
            {children}
          </div>
          {onClear && <Button label="Limpar filtros" onClick={() => { onClear(); setOpen(false); }} />}
        </>}
      </div>
    </BottomSheet>
  ) : null;

  const presentationBackdrop = isPresentationMode && panelOpen && !isMobile && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-40"
          onClick={closePanel}
          aria-hidden="true"
        />,
        document.body,
      )
    : null;

  const actionEditor = actionPanel && <HeaderPanelOutletContext.Provider value={actionOutlet}>{actionPanel.content}</HeaderPanelOutletContext.Provider>;
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
        {actionEditor}
      </>
    );
  }

  if (inHeader && header?.toolbar && header.panel) {
    return <>
      {createPortal(collapsedBar, header.toolbar)}
      {createPortal(desktopPanel, header.panel)}
      {mobileDrawer}
      {actionEditor}
    </>;
  }

  return (
    <div className={isPresentationMode ? '' : 'mb-3'}>
      {collapsedBar}
      {desktopPanel}
      {presentationBackdrop}
      {mobileDrawer}
      {actionEditor}
    </div>
  );
}
