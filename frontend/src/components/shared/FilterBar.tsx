import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronDown, SlidersHorizontal, X } from 'lucide-react';

export interface ActiveFilter {
  label: string;
  count: number;
  valueLabel?: string;
  onRemove: () => void;
}

interface FilterBarProps {
  children?: ReactNode;
  onClear?: () => void;
  activeFilters?: ActiveFilter[];
  actions?: ReactNode;
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
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-all duration-150"
      style={{ backgroundColor: 'rgba(33, 71, 138, 0.14)', color: 'var(--color-primary)' }}
      title={`${label}: ${displayValue}`}
    >
      <span className="inline-block max-w-48 truncate align-bottom">{label}: {displayValue}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="ml-0.5 rounded-full p-0.5 transition-opacity hover:opacity-60 active:scale-95
                   focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        aria-label={`Remover filtro ${label}`}
      >
        <X size={9} />
      </button>
    </span>
  );
}

// ── main component ────────────────────────────────────────────────────
export default function FilterBar({
  children,
  onClear,
  activeFilters,
  actions,
  dataInicio,
  dataFim,
  dateAccessory,
}: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const [isPresentationMode, setIsPresentationMode] = useState(() => document.body.dataset.presentationMode === 'true');
  const panelId = useId();

  useEffect(() => {
    const atualizarModoApresentacao = () => setIsPresentationMode(document.body.dataset.presentationMode === 'true');
    window.addEventListener('dashboard:presentation-mode-change', atualizarModoApresentacao);
    return () => window.removeEventListener('dashboard:presentation-mode-change', atualizarModoApresentacao);
  }, []);

  // Scroll lock quando drawer mobile está aberto
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open, isMobile]);

  const filtersWithValues = activeFilters?.filter((f) => f.count > 0) ?? [];
  const hasActive = filtersWithValues.length > 0;
  const totalActive = filtersWithValues.reduce((s, f) => s + f.count, 0);
  const showDate = dataInicio && dataFim;
  const hasFilterControls = Boolean(children);

  // ── barra recolhida (sempre visível) ──────────────────────────────
  const collapsedBar = (
    <div
      className={`flex items-center border shadow-sm ${isPresentationMode ? 'h-8 gap-1.5 rounded-none border-0 bg-transparent px-0 shadow-none' : 'h-12 gap-3 rounded-[20px] px-4'}`}
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
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg font-medium
                     transition-all duration-150 hover:bg-[var(--color-bg)] active:scale-[0.97]
                     focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${isPresentationMode ? 'px-1.5 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'}`}
          style={{ color: 'var(--color-text)' }}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          Filtros
          {totalActive > 0 && (
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
              style={{ backgroundColor: 'rgba(33, 71, 138, 0.14)', color: 'var(--color-primary)' }}
              aria-label={`${totalActive} filtros ativos`}
            >
              {totalActive}
            </span>
          )}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }} aria-hidden="true">
            <ChevronDown size={13} />
          </motion.span>
        </button>
      )}

      {actions ? (
        <div className={`flex shrink-0 items-center gap-2 overflow-hidden ${isPresentationMode ? 'p-0' : 'p-1'}`}>
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
        <button
          type="button"
          onClick={onClear}
          className="ml-auto shrink-0 cursor-pointer text-xs font-medium transition-opacity hover:opacity-70 active:scale-[0.97]
                     focus:outline-none focus:underline"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Limpar
        </button>
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
            ? 'absolute right-0 top-full z-50 mt-2 w-[min(72rem,calc(100vw-2rem))] overflow-hidden'
            : 'overflow-hidden'}
        >
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="mt-2 rounded-[20px] border p-5 shadow-sm"
            style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
          >
            {/* Filtros agrupados — data + dimensionais lado a lado */}
            <div
              role="group"
              aria-label="Opções de filtro"
              className="flex flex-wrap items-end gap-4"
            >
              {children}
            </div>

            {/* Rodapé: badges de ativos + botão limpar */}
            {(hasActive || onClear) && (
              <div
                className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {filtersWithValues.map((f) => (
                  <FilterBadge key={f.label} {...f} />
                ))}
                {onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="ml-auto cursor-pointer rounded-lg border px-3 py-1 text-xs font-medium
                               transition-all duration-150 hover:opacity-70 active:scale-[0.97]
                               focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── drawer mobile (portal, slide de baixo) ────────────────────────
  const mobileDrawer = typeof document !== 'undefined'
    ? createPortal(
        <AnimatePresence>
          {open && isMobile && hasFilterControls && (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />

              {/* Drawer */}
              <motion.div
                id={panelId}
                role="dialog"
                aria-label="Filtros"
                aria-modal="true"
                className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] border-t shadow-2xl"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
              >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
                  <div className="h-1 w-10 rounded-full" style={{ backgroundColor: 'var(--color-border)' }} />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Filtros
                    {totalActive > 0 && (
                      <span
                        className="ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
                        style={{ backgroundColor: 'rgba(33, 71, 138, 0.14)', color: 'var(--color-primary)' }}
                        aria-label={`${totalActive} filtros ativos`}
                      >
                        {totalActive}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="cursor-pointer rounded-full p-1.5 transition-all hover:bg-[var(--color-bg)] active:scale-[0.97]
                               focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    style={{ color: 'var(--color-text-muted)' }}
                    aria-label="Fechar filtros"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Content */}
                <div className="max-h-[68vh] overflow-y-auto px-5 pb-8">
                  <div
                    role="group"
                    aria-label="Opções de filtro"
                    className="flex flex-col gap-4"
                  >
                    {children}
                  </div>

                  {hasActive && (
                    <div
                      className="mt-4 flex flex-wrap gap-2 border-t pt-4"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      {filtersWithValues.map((f) => (
                        <FilterBadge key={f.label} {...f} />
                      ))}
                    </div>
                  )}

                  {onClear && (
                    <button
                      type="button"
                      onClick={() => { onClear(); setOpen(false); }}
                      className="mt-4 w-full cursor-pointer rounded-xl border py-3 text-sm font-medium
                                 transition-all duration-150 hover:opacity-80 active:scale-[0.98]
                                 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
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
          <div className="relative w-full">
            {collapsedBar}
            {desktopPanel}
          </div>,
          presentationSlot,
        )}
        {mobileDrawer}
      </>
    );
  }

  return (
    <div className={isPresentationMode ? '' : 'mb-3'}>
      {collapsedBar}
      {desktopPanel}
      {mobileDrawer}
    </div>
  );
}
