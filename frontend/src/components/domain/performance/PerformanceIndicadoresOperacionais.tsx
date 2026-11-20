import { Badge } from '@astryxdesign/core/Badge';
import { usePerformanceEficienciaFiliais, usePerformanceEntregasAtencao, usePerformanceOcorrenciasAtraso } from '../../../hooks/queries/usePerformance';
import { useTabelaPaginadaState } from '../../../hooks/useTabelaPaginadaState';
import type { PerformanceEntregaAtencao, PerformanceFiltro } from '../../../types/performance';
import { getApiErrorMessage } from '../../../utils/apiError';
import { formatarData, formatarNumero, formatarPorcentagem } from '../../../utils/formatadores';
import ChartCard from '../../shared/ChartCard';
import DashboardButton from '../../shared/DashboardButton';

const tabela = 'w-full border-collapse text-left text-sm';
const cabecalho = 'sticky top-0 z-10 bg-[var(--color-card)] text-xs text-[var(--color-text-muted)]';
const linha = 'border-b border-[var(--color-border)]';
const coluna = 'px-2 py-2.5';
const numero = `${coluna} whitespace-nowrap text-right tabular-nums`;
const rolagem = 'h-full min-h-0 overflow-auto overscroll-contain';

function OcorrenciasAtraso({ filtro }: { filtro: PerformanceFiltro }) {
  const consulta = usePerformanceOcorrenciasAtraso(filtro);
  const linhas = consulta.data ?? [];
  const maximo = linhas.reduce((maior, item) => Math.max(maior, item.notas), 1);
  return (
    <ChartCard chartKey="performanceOcorrenciasAtraso" titulo="Última Ocorrência de Mercadorias em Atraso"
      isLoading={consulta.isLoading} isEmpty={!linhas.length}
      erro={consulta.isError ? getApiErrorMessage(consulta.error, 'Erro ao carregar as ocorrências.') : null}
      emptyMessage="Nenhuma nota pendente com previsão vencida no período.">
      <div className={rolagem} tabIndex={0} role="region" aria-label="Notas em atraso por última ocorrência">
        <ol className="space-y-3 pr-2">
          {linhas.map(item => (
            <li key={item.ocorrencia}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="break-words">{item.ocorrencia}</span>
                <span className="shrink-0 font-semibold tabular-nums">{formatarNumero(item.notas)}<span className="sr-only"> notas</span></span>
              </div>
              <div aria-hidden="true" className="mt-1.5 h-2 rounded-full bg-[var(--color-border)]">
                <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${100 * item.notas / maximo}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </ChartCard>
  );
}

function alertaDaMinuta(item: PerformanceEntregaAtencao) {
  if (!item.alerta || item.alerta.toLocaleLowerCase('pt-BR') === item.status.toLocaleLowerCase('pt-BR')) return null;
  return <Badge label={item.alerta} variant={item.alerta === 'Vencida' ? 'error' : 'warning'} />;
}

function EntregasAtencao({ filtro }: { filtro: PerformanceFiltro }) {
  const { pagina, setPagina, tamanhoPagina } = useTabelaPaginadaState(JSON.stringify(filtro));
  const consulta = usePerformanceEntregasAtencao(filtro, pagina, tamanhoPagina);
  const linhas = consulta.data?.conteudo ?? [];
  const paginas = consulta.data?.totalPaginas ?? 0;
  const controles = paginas > 1 || pagina > 1 ? (
    <nav aria-label="Paginação das entregas em atenção" className="flex items-center gap-2 text-xs">
      <DashboardButton aria-label="Página anterior de entregas em atenção" disabled={pagina <= 1 || consulta.isFetching}
        onClick={() => setPagina(pagina - 1)}>Anterior</DashboardButton>
      <span aria-live="polite" className="whitespace-nowrap tabular-nums">{pagina}{paginas > 0 && ` de ${paginas}`}</span>
      <DashboardButton aria-label="Próxima página de entregas em atenção" disabled={pagina >= paginas || consulta.isFetching}
        onClick={() => setPagina(pagina + 1)}>Próxima</DashboardButton>
    </nav>
  ) : null;
  return (
    <ChartCard chartKey="performanceEntregasAtencao" titulo="Entregas em Atenção" actions={controles}
      isLoading={consulta.isLoading} isEmpty={!linhas.length}
      erro={consulta.isError ? getApiErrorMessage(consulta.error, 'Erro ao carregar as entregas em atenção.') : null}
      emptyMessage={pagina > 1 ? 'Nenhuma entrega nesta página.' : 'Nenhuma entrega em atenção para os filtros selecionados.'}>
      <div className={rolagem} tabIndex={0} role="region" aria-label="Entregas em atenção">
        <table aria-label="Entregas em atenção por minuta" className={`${tabela} min-w-[48rem]`}>
          <thead className={cabecalho}><tr className={linha}>
            {['Minuta', 'Cliente', 'Destino', 'Previsão', 'Status', 'Última ocorrência'].map(titulo =>
              <th scope="col" key={titulo} className={coluna}>{titulo}</th>)}
          </tr></thead>
          <tbody>{linhas.map(item => (
            <tr key={item.numeroMinuta} className={linha}>
              <th scope="row" className={`${coluna} font-semibold tabular-nums`}>{item.numeroMinuta}</th>
              <td className={coluna}>{item.cliente ?? '—'}</td>
              <td className={coluna}>{item.destino ?? '—'}</td>
              <td className={`${coluna} whitespace-nowrap tabular-nums`}>{item.previsaoEntrega ? formatarData(item.previsaoEntrega) : '—'}</td>
              <td className={coluna}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {alertaDaMinuta(item)}
                  <Badge label={item.status} variant={item.status.toLocaleLowerCase('pt-BR') === 'em tratativa' ? 'warning' : 'neutral'} />
                </div>
              </td>
              <td className={coluna}>{item.ultimaOcorrencia ?? 'Sem ocorrência'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </ChartCard>
  );
}

function EficienciaFiliais({ filtro }: { filtro: PerformanceFiltro }) {
  const consulta = usePerformanceEficienciaFiliais(filtro);
  const linhas = consulta.data ?? [];
  return (
    <ChartCard chartKey="performanceEficienciaFiliais" titulo="Eficiência das Filiais"
      isLoading={consulta.isLoading} isEmpty={!linhas.length}
      erro={consulta.isError ? getApiErrorMessage(consulta.error, 'Erro ao carregar a eficiência das filiais.') : null}
      emptyMessage="Nenhuma etapa ou entrega para o período selecionado.">
      <div className={rolagem} tabIndex={0} role="region" aria-label="Eficiência por filial">
        <table aria-label="Percentuais de eficiência por filial" className={`${tabela} min-w-[22rem]`}>
          <thead className={cabecalho}><tr className={linha}>
            <th scope="col" className={coluna}>Filial</th>
            {['EFE', 'EFT', 'EFD', 'OTIF'].map(titulo => <th scope="col" key={titulo} className={numero}>{titulo}</th>)}
          </tr></thead>
          <tbody>{linhas.map(item => (
            <tr key={item.filial} className={linha}>
              <th scope="row" className={`${coluna} font-medium`}>
                {item.filial}
                {item.semInformacao > 0 && <span className="block text-xs font-normal text-[var(--color-text-muted)]">
                  {formatarNumero(item.semInformacao)} {item.semInformacao === 1 ? 'etapa' : 'etapas'} sem informação
                </span>}
              </th>
              {(['efe', 'eft', 'efd', 'otif'] as const).map(metrica => (
                <td className={numero} key={metrica}>{item[metrica] == null
                  ? <span aria-label="Sem base para cálculo">—</span>
                  : formatarPorcentagem(item[metrica], 2)}</td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </ChartCard>
  );
}

export default function PerformanceIndicadoresOperacionais({ filtro }: { filtro: PerformanceFiltro }) {
  return (
    <div className="mb-6 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="h-[28rem] min-w-0"><OcorrenciasAtraso filtro={filtro} /></div>
      <div className="h-[28rem] min-w-0"><EficienciaFiliais filtro={filtro} /></div>
      <div className="h-[28rem] min-w-0 lg:col-span-2"><EntregasAtencao filtro={filtro} /></div>
    </div>
  );
}
