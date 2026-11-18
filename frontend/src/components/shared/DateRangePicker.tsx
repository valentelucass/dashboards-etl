import { DateInput } from '@astryxdesign/core/DateInput';
import { Button } from '@astryxdesign/core/Button';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { normalizarPeriodo } from '../../utils/dateUtils';
import { formatarData } from '../../utils/formatadores';
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

const formatarDataDoFiltro = (value: ISODateString) => formatarData(`${value}T00:00:00`);

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
      <div className="date-range-inputs flex flex-wrap items-end gap-2">
        <DateInput
          label="De"
          format={formatarDataDoFiltro}
          value={dataInicio ? dataInicio as ISODateString : undefined}
          onChange={(value) => atualizarInicio(value ?? '')}
        />
        <DateInput
          label="Até"
          format={formatarDataDoFiltro}
          value={dataFim ? dataFim as ISODateString : undefined}
          onChange={(value) => atualizarFim(value ?? '')}
        />
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
              <Button
                key={label}
                label={label}
                size="sm"
                variant={ativo ? 'primary' : 'secondary'}
                onClick={() => aplicarPreset(preset)}
                aria-pressed={ativo}
              />
            );
          })}
        </div>
      </div>
    </div>
    </div>
  );
}
