import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import {
  buscarExecucoesWorkSftpClientes,
  buscarStatusWorkSftpClientes,
  type WorkSftpClienteStatus,
} from '../../../api/endpoints/integracoesServico';
import { KpiDictionary, type KpiDefinition } from '../../../constants/kpiDictionary';
import { useTabelaPaginadaState } from '../../../hooks/useTabelaPaginadaState';
import { getApiErrorMessage } from '../../../utils/apiError';
import { formatarDataHora, formatarNumero } from '../../../utils/formatadores';
import { OPERATIONAL_QUERY_POLLING_OPTIONS } from '../../../utils/pollingUtils';
import TooltipKpi from '../../shared/TooltipKpi';
import StatusBadge from '../../shared/StatusBadge';

const definitions = KpiDictionary.integracoes;
const surface = { backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' };
const muted = { color: 'var(--color-text-muted)' };
const selectStyle = { ...surface, color: 'var(--color-text)' };
const empty: WorkSftpClienteStatus[] = [];

function dataHora(value: string | null) {
  return value ? formatarDataHora(value) : 'Não informado';
}

function quantidade(value: number, singular: string, plural: string) {
  return `${formatarNumero(value)} ${value === 1 ? singular : plural}`;
}

function Explicacao({ definition, children }: { definition: KpiDefinition; children: ReactNode }) {
  return (
    <TooltipKpi definition={definition} className="cursor-help !rounded-md" style={{ flex: '0 1 auto', minWidth: 0 }}>
      <div className="min-w-0 w-full">{children}</div>
    </TooltipKpi>
  );
}

function TituloMetrica({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={muted}>{children}<Info size={13} aria-hidden="true" /></span>;
}

function Origem({ ciclo, rotulo = false }: { ciclo: WorkSftpClienteStatus; rotulo?: boolean }) {
  const label = ciclo.origemComprovantes === 'SFTP' ? 'SFTP'
    : ciclo.origemComprovantes === 'API_ESL' ? 'API ESL' : 'Não informada';
  return (
    <Explicacao definition={definitions.origemComprovantesCiclo}>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold" style={surface}>
        {rotulo && <span className="font-normal" style={muted}>Origem:</span>}{label}<Info size={12} aria-hidden="true" />
      </span>
    </Explicacao>
  );
}

function Metricas({ ciclo, grupo, titulo = false }: { ciclo: WorkSftpClienteStatus; grupo: 'arquivos' | 'processamento' | 'fila'; titulo?: boolean }) {
  const definition = grupo === 'arquivos' ? definitions.arquivosOrigemCiclo
    : grupo === 'processamento' ? definitions.processamentoComprovantesCiclo : definitions.filaComprovantesCiclo;
  const label = grupo === 'arquivos' ? 'Arquivos na origem' : grupo === 'processamento' ? 'Neste ciclo' : 'Pendências ao final';
  const apurado = ciclo.statusCiclo === 'CONCLUIDO' || [
    ciclo.arquivosValidos, ciclo.arquivosRejeitados, ciclo.selecionados, ciclo.enviados,
    ciclo.pendentes, ciclo.saldo, ciclo.bloqueios, ciclo.timeoutsAmbiguos,
  ].some((value) => value > 0);
  return (
    <Explicacao definition={definition}>
      <div className="space-y-1 text-sm tabular-nums">
        {titulo && <TituloMetrica>{label}</TituloMetrica>}
        {!apurado ? <p style={muted}>Contagens não disponíveis nesta execução.</p> : grupo === 'arquivos' ? <>
          <p className="font-semibold">{quantidade(ciclo.arquivosValidos, 'arquivo reconhecido', 'arquivos reconhecidos')}</p>
          <p className="text-xs" style={muted}>{quantidade(ciclo.arquivosRejeitados, 'arquivo rejeitado', 'arquivos rejeitados')}</p>
        </> : grupo === 'processamento' ? <>
          <p className="font-semibold">{quantidade(ciclo.selecionados, 'NF-e avaliada', 'NF-es avaliadas')}</p>
          <div className={titulo ? 'flex flex-wrap gap-x-3 gap-y-1' : 'space-y-1'}>
            <p className={`text-xs ${ciclo.enviados > 0 ? 'text-positive' : ''}`} style={ciclo.enviados === 0 ? muted : undefined}>{quantidade(ciclo.enviados, 'comprovante enviado', 'comprovantes enviados')}</p>
            <p className="text-xs" style={muted}>{quantidade(ciclo.pendentes, 'NF-e pendente', 'NF-es pendentes')}</p>
          </div>
        </> : <>
          <p className="font-semibold">{quantidade(ciclo.saldo, 'NF-e na fila normal', 'NF-es na fila normal')}</p>
          <div className={titulo ? 'flex flex-wrap gap-x-3 gap-y-1' : 'space-y-1'}>
            <p className="text-xs" style={muted}>{quantidade(ciclo.bloqueios, 'registro bloqueado', 'registros bloqueados')}</p>
            <p className="text-xs" style={muted}>{quantidade(ciclo.timeoutsAmbiguos, 'envio sem confirmação', 'envios sem confirmação')} (timeout)</p>
          </div>
        </>}
      </div>
    </Explicacao>
  );
}

function Resultado({ ciclo, compacto = false }: { ciclo: WorkSftpClienteStatus; compacto?: boolean }) {
  const duration = Number.isFinite(ciclo.duracaoMs) ? `${formatarNumero(Math.round(ciclo.duracaoMs / 1000))} s` : 'Não informada';
  return <div className={compacto ? 'flex flex-wrap items-center gap-x-2 gap-y-1' : 'space-y-1'}><StatusBadge status={ciclo.statusCiclo} /><p className="text-xs" style={muted}>Conexão {ciclo.conexao} · {duration}</p></div>;
}

export default function CiclosIntegracaoPanel({ dataInicio, dataFim }: { dataInicio: string; dataFim: string }) {
  const [cliente, setCliente] = useState('');
  const [status, setStatus] = useState('');
  const [origem, setOrigem] = useState('');
  const paginacao = useTabelaPaginadaState(`ciclos:${dataInicio}:${dataFim}:${cliente}:${status}:${origem}`);
  const recentes = useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['integracoes', 'vedacit-sftp', 'clientes'], queryFn: ({ signal }) => buscarStatusWorkSftpClientes(signal),
    staleTime: 60_000, retry: 1,
  });
  const historico = useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['integracoes', 'vedacit-sftp', 'execucoes', dataInicio, dataFim, cliente, status, origem, paginacao.pagina, paginacao.tamanhoPagina],
    queryFn: ({ signal }) => buscarExecucoesWorkSftpClientes(paginacao.pagina, paginacao.tamanhoPagina, dataInicio, dataFim, cliente || undefined, status || undefined, origem || undefined, signal),
    staleTime: 60_000, retry: 1,
  });
  const todosRecentes = recentes.data ?? empty;
  const cards = todosRecentes.filter((item) => (!cliente || item.cliente === cliente) && (!origem || item.origemComprovantes === origem));
  const ciclos = historico.data?.itens ?? empty;
  // Não apresentar uma página filtrada artificialmente quando uma API antiga ignorar o filtro.
  const origemNaoAplicada = Boolean(origem && ciclos.some((item) => item.origemComprovantes !== origem));
  const erroHistorico = historico.isError ? getApiErrorMessage(historico.error, 'Não foi possível carregar o histórico.')
    : origemNaoAplicada ? origem === 'API_ESL'
      ? 'O servidor não disponibilizou o histórico da API ESL nesta consulta. As linhas de outra origem foram ocultadas; isso não significa ausência de consumo da API.'
      : 'A origem não está disponível neste histórico. Não foi possível aplicar o filtro.' : null;

  return (
    <section className="mb-4 min-w-0 space-y-3" aria-labelledby="ciclos-comprovantes-titulo">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ciclos-comprovantes-titulo" className="text-base font-bold">Ciclos de busca de comprovantes</h2>
          <p className="mt-1 text-xs" style={muted}>Acompanhe a origem, o resultado e as pendências. Os indicadores têm explicações ao passar o mouse ou focar pelo teclado.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold" style={muted}>Cliente
            <select aria-label="Cliente dos ciclos" className="h-9 min-w-32 rounded-lg border px-2 text-sm" value={cliente} onChange={(event) => setCliente(event.target.value)} style={selectStyle}>
              <option value="">Todos</option>{todosRecentes.map((item) => <option key={item.cliente} value={item.cliente}>{item.cliente}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={muted}>Origem dos comprovantes
            <select className="h-9 min-w-36 rounded-lg border px-2 text-sm" value={origem} onChange={(event) => setOrigem(event.target.value)} style={selectStyle}>
              <option value="">Todas</option><option value="SFTP">SFTP</option><option value="API_ESL">API ESL</option>
            </select>
          </label>
        </div>
      </div>
      {recentes.isError && <p role="alert" className="text-sm text-negative">{getApiErrorMessage(recentes.error, 'Não foi possível carregar a última execução.')}</p>}
      {recentes.isLoading && <p role="status" className="text-sm" style={muted}>Carregando última execução…</p>}
      {cards.map((ciclo) => (
        <article key={ciclo.cliente} className="rounded-xl border" style={surface} aria-label={`Último ciclo de ${ciclo.cliente}`}>
          <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-4 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <strong className="text-sm">{ciclo.cliente}</strong>
              <Origem ciclo={ciclo} rotulo />
              <Resultado ciclo={ciclo} compacto />
            </div>
            <Explicacao definition={definitions.agendaComprovantesCiclo}>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs tabular-nums">
                <p className="flex flex-wrap items-center gap-x-2"><span style={muted}>Última execução</span><time dateTime={ciclo.fimUltimoCiclo ?? undefined} className="font-medium">{dataHora(ciclo.fimUltimoCiclo)}</time></p>
                <p className="flex flex-wrap items-center gap-x-2"><span style={muted}>Próximo ciclo estimado</span><time dateTime={ciclo.proximaExecucaoEstimada ?? undefined} className="font-medium">{dataHora(ciclo.proximaExecucaoEstimada)}</time><Info size={12} aria-hidden="true" /></p>
              </div>
            </Explicacao>
          </header>
          <div className="grid grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0" style={{ borderColor: 'var(--color-border)' }}>
            {(['arquivos', 'processamento', 'fila'] as const).map((grupo) => (
              <div key={grupo} className="min-w-0 px-4 py-2.5" style={{ borderColor: 'var(--color-border)' }}><Metricas ciclo={ciclo} grupo={grupo} titulo /></div>
            ))}
          </div>
        </article>
      ))}
      {!recentes.isLoading && !recentes.isError && cards.length === 0 && <p className="text-sm" style={muted}>Nenhum último ciclo disponível para o cliente e a origem selecionados.</p>}
      <div className="overflow-hidden rounded-xl border" style={surface}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2" style={{ borderColor: 'var(--color-border)' }}>
          <div><h3 className="text-sm font-bold">Histórico de execuções</h3><p className="mt-1 text-xs" style={muted}>Cada linha é um ciclo. O período usa a data de finalização; as pendências mostram a situação naquele momento.</p></div>
          <label className="flex flex-wrap items-center gap-2 text-xs font-semibold" style={muted}>Resultado da execução
            <select className="h-9 min-w-32 rounded-lg border px-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)} style={selectStyle}>
              <option value="">Todos</option><option value="CONCLUIDO">Concluído</option><option value="FALHA">Falha</option>
            </select>
          </label>
        </div>
        {erroHistorico ? <p role="alert" className="px-4 py-3 text-sm text-negative">{erroHistorico}</p>
          : historico.isLoading ? <p role="status" className="px-4 py-3 text-sm" style={muted}>Carregando histórico…</p>
            : ciclos.length === 0 ? <p className="px-4 py-4 text-center text-sm" style={muted}>{origem === 'API_ESL' ? 'Nenhum ciclo da API ESL disponível para estes filtros. Este histórico atualmente audita o processo SFTP; isso não significa ausência de consumo da API em outros processos.' : 'Nenhuma execução encontrada para o período e filtros selecionados.'}</p>
              : <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1120px] text-left text-sm">
                    <thead className="border-b text-xs" style={{ ...muted, borderColor: 'var(--color-border)' }}><tr>
                      <th scope="col" className="px-4 py-3">Cliente</th><th scope="col" className="px-3 py-3">Finalizado</th><th scope="col" className="px-3 py-3">Execução</th>
                      <th scope="col" className="px-3 py-3"><Explicacao definition={definitions.origemComprovantesCiclo}><TituloMetrica>Origem dos comprovantes</TituloMetrica></Explicacao></th>
                      <th scope="col" className="px-3 py-3"><Explicacao definition={definitions.arquivosOrigemCiclo}><TituloMetrica>Arquivos na origem</TituloMetrica></Explicacao></th>
                      <th scope="col" className="px-3 py-3"><Explicacao definition={definitions.processamentoComprovantesCiclo}><TituloMetrica>Neste ciclo</TituloMetrica></Explicacao></th>
                      <th scope="col" className="px-4 py-3"><Explicacao definition={definitions.filaComprovantesCiclo}><TituloMetrica>Pendências ao final</TituloMetrica></Explicacao></th>
                    </tr></thead>
                    <tbody>{ciclos.map((ciclo) => <tr key={`${ciclo.cliente}:${ciclo.inicioUltimoCiclo}:${ciclo.fimUltimoCiclo}`} className="border-b align-top last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-4 py-3 font-semibold">{ciclo.cliente}</td><td className="whitespace-nowrap px-3 py-3">{dataHora(ciclo.fimUltimoCiclo)}</td><td className="px-3 py-3"><Resultado ciclo={ciclo} /></td>
                      <td className="px-3 py-3"><Origem ciclo={ciclo} /></td><td className="px-3 py-3"><Metricas ciclo={ciclo} grupo="arquivos" /></td><td className="px-3 py-3"><Metricas ciclo={ciclo} grupo="processamento" /></td><td className="px-4 py-3"><Metricas ciclo={ciclo} grupo="fila" /></td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                  <span style={muted}>{formatarNumero(historico.data?.paginacao.totalElementos ?? 0)} execuções · {paginacao.tamanhoPagina} por página</span>
                  <div className="flex items-center gap-3"><button type="button" className="rounded-lg border px-3 py-1.5 disabled:opacity-50" style={surface} disabled={paginacao.pagina <= 1} onClick={() => paginacao.setPagina(paginacao.pagina - 1)}>Anterior</button><span style={muted}>Página {paginacao.pagina} de {historico.data?.paginacao.totalPaginas}</span><button type="button" className="rounded-lg border px-3 py-1.5 disabled:opacity-50" style={surface} disabled={historico.data?.paginacao.ultimaPagina ?? true} onClick={() => paginacao.setPagina(paginacao.pagina + 1)}>Próxima</button></div>
                </div>
              </>}
      </div>
    </section>
  );
}
