import { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { salvarBlobComoArquivo } from '../../../api/downloadArquivo';
import type { Periodo, Sinistro } from '../../../api/endpoints/ocorrenciasSinistros';
import { useAnalyticalTableFilters } from '../../../hooks/useAnalyticalTableFilters';
import { useTabelaPaginadaState } from '../../../hooks/useTabelaPaginadaState';
import AnalyticalDataTable, {
  type ColunaTabelaAnalitica,
  type SortDirection,
} from '../../shared/AnalyticalDataTable';
import ExportButton from '../../shared/ExportButton';
import StatusBadge from '../../shared/StatusBadge';
import {
  apresentarCampo,
  camposSinistros,
  filtrarSinistros,
  gerarCsvSinistros,
  ordenarSinistros,
} from './camposSinistros';

interface Props {
  periodo: Periodo;
  linhas: Sinistro[];
  editar?: (sinistro: Sinistro) => void;
}

export default function RelacaoSinistros({ periodo, linhas, editar }: Props) {
  const tabela = useAnalyticalTableFilters();
  const paginacao = useTabelaPaginadaState(tabela.resetKey);
  const [ordem, setOrdem] = useState<{ chave: keyof Sinistro | null; direcao: SortDirection }>({
    chave: null,
    direcao: 'asc',
  });
  const status = useMemo(() => [...new Set(linhas.map((linha) => linha.status).filter(Boolean))], [linhas]);
  const filtrados = useMemo(() => filtrarSinistros(linhas, tabela.filters), [linhas, tabela.filters]);
  const ordenados = useMemo(
    () => ordenarSinistros(filtrados, ordem.chave, ordem.direcao),
    [filtrados, ordem],
  );
  const pagina = Math.min(
    paginacao.pagina,
    Math.max(1, Math.ceil(ordenados.length / paginacao.tamanhoPagina)),
  );
  const inicio = (pagina - 1) * paginacao.tamanhoPagina;

  const colunas = useMemo<ColunaTabelaAnalitica<Sinistro>[]>(
    () =>
      camposSinistros.map((campo) => ({
        ...campo,
        formato: (_, linha) => {
          const texto = apresentarCampo(linha, campo);
          if (campo.chave === 'numero' && editar)
            return (
              <button
                className="os-editar"
                type="button"
                aria-label={'Editar sinistro ' + linha.numero}
                onClick={() => editar(linha)}
              >
                {texto}
                <Pencil size={12} aria-hidden="true" />
              </button>
            );
          if (campo.chave === 'status' || campo.chave === 'statusCorretora')
            return <StatusBadge status={texto} />;
          if (campo.tipo === 'moeda') return <span className="block text-right tabular-nums">{texto}</span>;
          return <span className="block whitespace-normal break-words">{texto}</span>;
        },
      })),
    [editar],
  );

  function exportar() {
    const arquivo = new Blob([gerarCsvSinistros(ordenados)], { type: 'text/csv;charset=utf-8;' });
    salvarBlobComoArquivo(arquivo, 'sinistros-' + periodo.dataInicio + '-' + periodo.dataFim + '.csv');
  }

  return (
    <section className="min-w-0" aria-label="Dados da relação de sinistros">
      <AnalyticalDataTable
        titulo="Relação de sinistros"
        dados={ordenados.slice(inicio, inicio + paginacao.tamanhoPagina)}
        colunas={colunas}
        chaveLinha="numero"
        filtros={tabela.filters}
        hiddenActiveCount={tabela.hiddenActiveCount}
        hasAnyFilter={tabela.hasAnyFilter}
        onTextFilterChange={tabela.setTextFilter}
        onMultiFilterChange={tabela.setMultiFilter}
        onColumnFilterChange={tabela.setColumnFilter}
        onClearFilters={tabela.clearTableFilters}
        statusOptions={status}
        totalRegistros={ordenados.length}
        paginaAtual={pagina}
        tamanhoPagina={paginacao.tamanhoPagina}
        onPaginaChange={paginacao.setPagina}
        onTamanhoPaginaChange={paginacao.setTamanhoPagina}
        sortField={ordem.chave}
        sortDirection={ordem.direcao}
        onSortChange={(chave, direcao) => setOrdem({ chave, direcao })}
        acoesCabecalho={
          <ExportButton nomeArquivo="sinistros" onExport={ordenados.length ? exportar : undefined} />
        }
      />
    </section>
  );
}
