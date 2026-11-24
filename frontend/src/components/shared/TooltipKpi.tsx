import {
  isValidElement,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { KpiDictionary, type KpiDefinition } from '../../constants/kpiDictionary';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { getKpiFlexBasis } from './kpiCardLayout';

interface TooltipKpiProps {
  definition?: KpiDefinition;
  kpiName?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function isKpiDefinition(value: unknown): value is KpiDefinition {
  return Boolean(
    value
      && typeof value === 'object'
      && 'titulo' in value
      && 'descricao' in value
      && 'calculo' in value,
  );
}

function buscarDefinitionPorNome(kpiName: string | undefined): KpiDefinition | null {
  if (!kpiName) {
    return null;
  }

  const integracoesDefinition = (KpiDictionary.integracoes as Record<string, unknown>)[kpiName];
  if (isKpiDefinition(integracoesDefinition)) {
    return integracoesDefinition;
  }

  const definition = kpiName.split('.').reduce<unknown>((atual, segmento) => {
    if (!atual || typeof atual !== 'object') {
      return null;
    }

    return (atual as Record<string, unknown>)[segmento] ?? null;
  }, KpiDictionary);

  return isKpiDefinition(definition) ? definition : null;
}

export default function TooltipKpi({
  definition,
  kpiName,
  children,
  className = '',
  style,
}: TooltipKpiProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const open = isHovered || isFocused;
  const cardValue = isValidElement<{ valor?: unknown }>(children)
    ? children.props.valor
    : undefined;
  const flexBasis = typeof cardValue === 'string'
    ? getKpiFlexBasis(cardValue)
    : 160;
  const resolvedDefinition = definition ?? buscarDefinitionPorNome(kpiName);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsFocused(false);
    }
  };

  if (!resolvedDefinition) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={anchorRef}
        className={`flex min-w-0 rounded-[20px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${className}`}
        onBlur={handleBlur}
        onFocus={() => setIsFocused(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsHovered(false);
            setIsFocused(false);
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: `${flexBasis}px`,
          ...style,
        }}
        tabIndex={0}
      >
        {children}
      </div>
      {open && anchorRef.current && createPortal(
        <Tooltip anchorRef={anchorRef} isOpen placement="above"
          alignment="center" hasHoverIndication={false}
          onOpenChange={next => { if (!next) { setIsHovered(false); setIsFocused(false); } }}
          content={
            <div className="dashboard-info-tooltip dashboard-info-tooltip-rich space-y-3">
                <div>
                  <p className="text-base font-bold leading-snug">{resolvedDefinition.titulo}</p>
                  <p
                    className="mt-1.5 text-sm leading-relaxed"
                    style={{ color: 'var(--color-text-subtle)' }}
                  >
                    {resolvedDefinition.descricao}
                  </p>
                </div>

                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    Cálculo
                  </p>
                  <p className="mt-1.5 text-sm font-semibold leading-relaxed">
                    {resolvedDefinition.calculo.replaceAll('÷', '/')}
                  </p>
                </div>

                {resolvedDefinition.observacao && (
                  <div
                    className="rounded-xl border px-3 py-2.5"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-bg)',
                    }}
                  >
                    <p
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-subtle)' }}
                    >
                      Observação
                    </p>
                    <p
                      className="mt-1.5 text-[13px] leading-relaxed"
                      style={{ color: 'var(--color-text-subtle)' }}
                    >
                      {resolvedDefinition.observacao}
                    </p>
                  </div>
                )}
            </div>
          } />,
        anchorRef.current.ownerDocument.fullscreenElement ?? anchorRef.current.ownerDocument.body,
      )}
    </>
  );
}
