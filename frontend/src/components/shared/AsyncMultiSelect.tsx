import DashboardLoading from './DashboardLoading';
import { useId, useMemo, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { FormTextField } from './FormTextField';
import { Popover } from '@astryxdesign/core/Popover';

export interface AsyncMultiSelectOpcao {
  value: string;
  label: string;
  description?: string | null;
}

const OPCOES_POR_PAGINA = 100;

type AsyncMultiSelectOpcaoEntrada = string | AsyncMultiSelectOpcao;

interface AsyncMultiSelectProps {
  label: string;
  opcoes: AsyncMultiSelectOpcaoEntrada[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  placeholder?: string;
  isLoading?: boolean;
  erro?: string | null;
  onSearchChange?: (busca: string) => void;
}

export default function AsyncMultiSelect({
  label,
  opcoes,
  selecionados,
  onChange,
  placeholder = 'Selecionar',
  isLoading,
  erro,
  onSearchChange,
}: AsyncMultiSelectProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(OPCOES_POR_PAGINA);
  const selecao = useMemo(() => new Set(selecionados), [selecionados]);
  const labelId = useId();
  const valueId = useId();

  const opcoesEfetivas = useMemo(() => {
    const porValor = new Map<string, AsyncMultiSelectOpcao>();

    selecionados.forEach((valor) => {
      porValor.set(valor, { value: valor, label: valor });
    });

    opcoes.forEach((opcao) => {
      const normalizada = typeof opcao === 'string'
        ? { value: opcao, label: opcao }
        : opcao;
      porValor.set(normalizada.value, normalizada);
    });

    return Array.from(porValor.values());
  }, [opcoes, selecionados]);

  function limparBusca() {
    if (!busca) return;
    setBusca('');
    onSearchChange?.('');
  }

  function handleOpenChange(next: boolean) {
    setAberto(next);
    if (!next) setLimite(OPCOES_POR_PAGINA);
    if (!next) {
      limparBusca();
    }
  }

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    setLimite(OPCOES_POR_PAGINA);
    onSearchChange?.(valor);
  }

  function limparSelecao() {
    onChange([]);
    limparBusca();
  }

  const opcoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return opcoesEfetivas;
    return opcoesEfetivas.filter((opcao) => (
      opcao.label.toLowerCase().includes(termo)
      || opcao.value.toLowerCase().includes(termo)
      || (opcao.description?.toLowerCase().includes(termo) ?? false)
    ));
  }, [busca, opcoesEfetivas]);

  const valoresDisponiveis = useMemo(() => opcoesFiltradas.map((opcao) => opcao.value), [opcoesFiltradas]);
  const temOpcoesDisponiveis = valoresDisponiveis.length > 0;
  const todasDisponiveisSelecionadas = temOpcoesDisponiveis
    && valoresDisponiveis.every((valor) => selecao.has(valor));

  function selecionarTodosDisponiveis() {
    if (!temOpcoesDisponiveis || todasDisponiveisSelecionadas) return;
    onChange(Array.from(new Set([...selecionados, ...valoresDisponiveis])));
  }

  function alternar(valor: string) {
    const proximos = selecao.has(valor)
      ? selecionados.filter((v) => v !== valor)
      : [...selecionados, valor];

    onChange(proximos);

    if (proximos.length === 0) {
      limparBusca();
    }
  }

  const temSelecao = selecionados.length > 0;

  const selectedLabel = temSelecao ? `${selecionados.length} selecionado(s)` : placeholder;

  return (
    <Popover label={label} isOpen={aberto} onOpenChange={handleOpenChange} alignment="start" width="min(22rem, calc(100vw - 24px))" padding={3}
      content={aberto && <div className="dashboard-filter-select-panel">
        <FormTextField label={`Buscar ${label.toLowerCase()}`} isLabelHidden type="search" hasClear hasAutoFocus
          value={busca} onChange={handleBuscaChange} placeholder={`Buscar ${label.toLowerCase()}…`} />
        <div className="dashboard-filter-select-actions">
          <Button label="Selecionar todos" variant="secondary" size="sm" icon={<Check size={13} />}
            isDisabled={!temOpcoesDisponiveis || todasDisponiveisSelecionadas} onClick={selecionarTodosDisponiveis} />
          <Button label="Desmarcar todos" variant="ghost" size="sm" icon={<X size={13} />}
            isDisabled={!temSelecao} onClick={limparSelecao} />
        </div>

        <div className="max-h-56 space-y-1 overflow-y-auto">
          {opcoesFiltradas.slice(0, limite).map(opcao => (
            <CheckboxInput key={opcao.value} label={opcao.label} description={opcao.description ?? undefined}
              value={selecao.has(opcao.value)} onChange={() => alternar(opcao.value)} />
          ))}
          {opcoesFiltradas.length > limite && (
            <Button label="Mostrar mais opções" variant="ghost" size="sm" onClick={() => setLimite(valor => valor + OPCOES_POR_PAGINA)} />
          )}
          {isLoading && <DashboardLoading label="Carregando…" />}
          {erro && <p role="alert" className="dashboard-form-hint">{erro}</p>}
          {!isLoading && !erro && opcoesFiltradas.length === 0 && <p className="dashboard-form-hint">Nenhuma opção encontrada.</p>}
        </div>
        </div>}>
      {trigger => (
        <div className="dashboard-filter-select">
        <span id={labelId} className="dashboard-filter-select-label">
          {label}
          {temSelecao && <Badge label={String(selecionados.length)} variant="info" />}
        </span>
        <Button {...trigger} label={selectedLabel} variant="secondary" className="dashboard-filter-select-trigger"
            width="100%" aria-labelledby={`${labelId} ${valueId}`}
            endContent={<ChevronDown size={14} aria-hidden="true" />}>
            <span id={valueId} className="truncate">{selectedLabel}</span>
          </Button>
      </div>
      )}
    </Popover>
  );
}
