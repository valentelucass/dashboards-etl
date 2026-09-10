import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { normalizarPeriodo } from '../../utils/dateUtils';
import { DATE_RANGE_PRESETS, resolverPresetAtivo, type DatePreset } from './dateRangePresets';

interface DateRangePickerProps {
  dataInicio: string;
  dataFim: string;
  onDataInicioChange: (valor: string) => void;
  onDataFimChange: (valor: string) => void;
  onRangeChange?: (inicio: string, fim: string) => void;
  label?: string;
  helpText?: string;
}

const inputClass =
  'cursor-pointer rounded-lg border px-3 py-2 text-sm shadow-sm transition-all duration-150 ' +
  'hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] ' +
  'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';

export default function DateRangePicker({
  dataInicio,
  dataFim,
  onDataInicioChange,
  onDataFimChange,
  onRangeChange,
  label,
  helpText,
}: DateRangePickerProps) {
  const [presetPreferido, setPresetPreferido] = useState<string | null>(null);
  const [datasEditadasManualmente, setDatasEditadasManualmente] = useState(false);

  const presetAtivo = useMemo(() => {
    if (datasEditadasManualmente) return null;
    return resolverPresetAtivo(dataInicio, dataFim, presetPreferido);
  }, [dataInicio, dataFim, datasEditadasManualmente, presetPreferido]);

  function aplicarPreset(preset: DatePreset) {
    const range = preset.getRange();
    const p = normalizarPeriodo(range.dataInicio, range.dataFim);
    setDatasEditadasManualmente(false);
    setPresetPreferido(preset.label);
    if (onRangeChange) {
      onRangeChange(p.dataInicio, p.dataFim);
    } else {
      onDataInicioChange(p.dataInicio);
      onDataFimChange(p.dataFim);
    }
  }

  function atualizarInicio(valor: string) {
    setDatasEditadasManualmente(true);
    setPresetPreferido(null);
    if (onRangeChange) {
      onRangeChange(valor, dataFim);
    } else {
      onDataInicioChange(valor);
    }
  }

  function atualizarFim(valor: string) {
    setDatasEditadasManualmente(true);
    setPresetPreferido(null);
    if (onRangeChange) {
      onRangeChange(dataInicio, valor);
    } else {
      onDataFimChange(valor);
    }
  }

  return (
    <div className="date-range-picker flex min-w-0 flex-col gap-1.5">
      {label ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
            {label}
          </span>
          {helpText ? (
            <span className="inline-flex shrink-0" title={helpText} aria-label={helpText}>
              <Info
                size={13}
                style={{ color: 'var(--color-text-muted)' }}
                aria-hidden="true"
              />
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="date-range-controls flex flex-wrap items-end gap-4">
      {/* Bloco: campos De / Até */}
      <div className="date-range-inputs flex items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="date-inicio"
            className="text-xs font-medium leading-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            De
          </label>
          <input
            id="date-inicio"
            type="date"
            value={dataInicio}
            onChange={(e) => atualizarInicio(e.target.value)}
            className={inputClass}
            style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="date-fim"
            className="text-xs font-medium leading-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Até
          </label>
          <input
            id="date-fim"
            type="date"
            value={dataFim}
            onChange={(e) => atualizarFim(e.target.value)}
            className={inputClass}
            style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          />
        </div>
      </div>

      {/* Separador visual */}
      <div
        className="date-range-divider hidden h-9 w-px self-end sm:block"
        style={{ backgroundColor: 'var(--color-border)' }}
        aria-hidden="true"
      />

      {/* Bloco: atalhos de período */}
      <div className="date-range-presets flex flex-col gap-1.5">
        <span
          className="text-xs font-medium leading-4"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Atalho
        </span>
        <div className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap">
          {DATE_RANGE_PRESETS.map((preset) => {
            const { label } = preset;
            const ativo = presetAtivo === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => aplicarPreset(preset)}
                aria-pressed={ativo}
                className="cursor-pointer rounded-lg border px-2.5 py-2 text-xs font-semibold
                           transition-all duration-150 active:scale-[0.97]
                           focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                style={
                  ativo
                    ? {
                        backgroundColor: 'var(--color-primary)',
                        borderColor: 'var(--color-primary)',
                        color: 'white',
                      }
                    : {
                        backgroundColor: 'var(--color-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-muted)',
                      }
                }
                onMouseEnter={(e) => {
                  if (!ativo) {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-text)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!ativo) {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
                  }
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
    </div>
  );
}
