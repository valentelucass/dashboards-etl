import { useMemo, type ComponentProps } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Archive, Calculator, CircleDollarSign, FileCheck2, MapPin, PackageCheck, Percent, Scale, Truck } from 'lucide-react';
import { buscarCustosRede, buscarDesempenhoRede, buscarOperacaoRede } from '../api/endpoints/redeCredenciadaServico';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import FilterBar from '../components/shared/FilterBar';
import DateRangePicker from '../components/shared/DateRangePicker';
import AsyncMultiSelect from '../components/shared/AsyncMultiSelect';
import KpiCard from '../components/shared/KpiCard';
import TooltipKpi from '../components/shared/TooltipKpi';
import { KpiDictionary } from '../constants/kpiDictionary';
import PaineisRede from '../components/domain/redeCredenciada/PaineisRede';
import { exibirMoeda, exibirTaxa, nomeCurto, percentual, resumirRede, valoresFinanceiros } from '../components/domain/redeCredenciada/indicadoresRede';
import { formatarNumero } from '../utils/formatadores';
import '../components/domain/redeCredenciada/rede-credenciada.css';

const VAZIO: string[] = [];
const CACHE = { staleTime: 5 * 60 * 1000, retry: 1 } as const;

function fonte(situacao: {isLoading: boolean; isError: boolean}, nome: string) {
  if (situacao.isLoading) return 'Carregando…';
  if (situacao.isError) return `Fonte indisponível · ${nome}`;
  return '';
}

function fracao(parte: number, total: number, unidade: string) {
  return total > 0 ? `${formatarNumero(parte)} de ${formatarNumero(total)} ${unidade}` : `Sem ${unidade} no período`;
}

function Indicador({tipo, ...props}: Omit<ComponentProps<typeof KpiCard>, 'label'> & { tipo: keyof typeof KpiDictionary.redeCredenciada }) {
  const definicao = KpiDictionary.redeCredenciada[tipo];
  return <TooltipKpi definition={definicao} className="h-full">
    <KpiCard {...props} label={definicao.titulo} className="h-full" />
  </TooltipKpi>;
}

export default function RedeCredenciadaPage() {
  const {dataInicio, dataFim, setDataInicio, setDataFim, setDataRange, filtros, setFiltro, limparFiltros} = useFiltro();
  const selecionados = filtros.parceirosRede ?? VAZIO;
  const situacoes = filtros.situacoesConsolidacao ?? VAZIO;
  const temFiltroFinanceiro = selecionados.length > 0 || situacoes.length > 0;
  const periodo = {dataInicio, dataFim};
  const base = ['rede-credenciada', dataInicio, dataFim];
  const desempenho = useQuery({...CACHE, queryKey: [...base, 'desempenho'],
    queryFn: ({signal}) => buscarDesempenhoRede(periodo, signal)});
  const operacao = useQuery({...CACHE, queryKey: [...base, 'operacional'],
    queryFn: ({signal}) => buscarOperacaoRede(periodo, signal)});
  const custosRede = useQuery({...CACHE, queryKey: [...base, 'custos'],
    queryFn: ({signal}) => buscarCustosRede(periodo, [], [], signal)});
  const custosFiltrados = useQuery({...CACHE, enabled: temFiltroFinanceiro,
    queryKey: [...base, 'custos', [...selecionados].sort(), [...situacoes].sort()],
    queryFn: ({signal}) => buscarCustosRede(periodo, selecionados, situacoes, signal)});
  const custos = temFiltroFinanceiro ? custosFiltrados : custosRede;
  const dadosCustos = custos.data;
  const custosPublicados = dadosCustos && dadosCustos.diasCobertos > 0 ? dadosCustos : undefined;
  const parcialCustos = custosPublicados && custosPublicados.diasCobertos < custosPublicados.diasSolicitados
    ? `Parcial de ${custosPublicados.diasCobertos} de ${custosPublicados.diasSolicitados} dias publicados` : '';
  const opcoesSituacoes = useMemo(() => [...new Set(custosRede.data?.linhas.map(l => l.status))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [custosRede.data]);
  const opcoes = useMemo(() => {
    const nomes = new Set<string>();
    for (const item of desempenho.data ?? []) nomes.add(item.filial);
    for (const item of operacao.data?.entregas ?? []) nomes.add(item.parceiro);
    for (const item of operacao.data?.coletas ?? []) nomes.add(item.parceiro);
    for (const item of custosRede.data?.linhas ?? []) nomes.add(item.parceiro);
    return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(value => ({
      value, label: nomeCurto(value), description: value.split('|')[1]?.trim(),
    }));
  }, [desempenho.data, operacao.data, custosRede.data]);
  const resumo = useMemo(() => resumirRede(desempenho.data ?? [], operacao.data, custosPublicados, selecionados),
    [desempenho.data, operacao.data, custosPublicados, selecionados]);
  const { total, taxas } = resumo;
  const financeiro = custosPublicados?.totais;
  const valores = valoresFinanceiros(financeiro);
  const participacao = financeiro && financeiro.semCobrado === 0
    ? percentual(financeiro.cobradoVinculadoCentavos, financeiro.freteVinculadoCentavos) : null;
  const infoDesempenho = fonte(desempenho, 'Performance');
  const infoOperacao = fonte(operacao, 'Coletas e comprovantes');
  const aguardandoCustos = dadosCustos?.diasCobertos === 0 ? 'Aguardando a publicação dos custos deste período' : '';
  const infoCustos = fonte(custos, 'Consolidação') || aguardandoCustos || parcialCustos;
  const coberturaArquivos = operacao.data?.coberturaArquivos;
  let infoArquivos = infoOperacao;
  if (!infoArquivos && coberturaArquivos && !coberturaArquivos.completa) {
    infoArquivos = coberturaArquivos.diasCobertos > 0
      ? `Parcial de ${coberturaArquivos.diasCobertos} de ${coberturaArquivos.diasSolicitados} dias publicados`
      : 'Aguardando a publicação dos arquivamentos deste período';
  }

  usePageHeader({title: 'Rede Credenciada', description: 'Desempenho, comprovantes e custos dos parceiros logísticos.'});

  return <div className="w-full">
    <FilterBar period={<DateRangePicker dataInicio={dataInicio} dataFim={dataFim} onRangeChange={setDataRange}
      onDataInicioChange={setDataInicio} onDataFimChange={setDataFim} />} dataInicio={dataInicio} dataFim={dataFim}
      onClear={limparFiltros} activeFilters={[
        {label: 'Parceiros', count: selecionados.length, onRemove: () => setFiltro('parceirosRede', [])},
        {label: 'Situação da consolidação', count: situacoes.length, onRemove: () => setFiltro('situacoesConsolidacao', [])},
      ]}>
      <AsyncMultiSelect label="Parceiros" placeholder="Todos os parceiros" opcoes={opcoes} selecionados={selecionados}
        onChange={novos => setFiltro('parceirosRede', novos)} isLoading={desempenho.isLoading && operacao.isLoading && custosRede.isLoading} />
      <AsyncMultiSelect label="Situação da consolidação · custos" placeholder="Todas as situações" opcoes={opcoesSituacoes}
        selecionados={situacoes} onChange={novas => setFiltro('situacoesConsolidacao', novas)} isLoading={custosRede.isLoading} />
    </FilterBar>
    <div className="rede-painel">
      <section className="rede-kpis" aria-label="Desempenho, comprovantes e custos">
        <Indicador tipo="otif" valor={exibirTaxa(taxas.otif)} icone={<PackageCheck size={17} />}
          helperText={infoDesempenho || fracao(total.otifNoPrazo, total.otifTotal, 'entregas finalizadas')} />
        <Indicador tipo="efd" valor={exibirTaxa(taxas.efd)} icone={<MapPin size={17} />}
          helperText={infoDesempenho || fracao(total.efdEficientes, total.efdTotal, 'etapas de destino')} />
        <Indicador tipo="coletas" valor={exibirTaxa(taxas.coleta)} icone={<Truck size={17} />}
          helperText={infoOperacao || (total.coletas ? fracao(total.coletasNoPrazo, total.coletas, 'coletas finalizadas') : 'Sem coletas com parceiro executor identificado')} />
        <Indicador tipo="anexados" valor={exibirTaxa(taxas.anexado)} icone={<FileCheck2 size={17} />}
          helperText={infoOperacao || fracao(total.anexadas, total.entregas, 'entregas finalizadas')} />
        <Indicador tipo="arquivados" valor={exibirTaxa(taxas.arquivado)} icone={<Archive size={17} />}
          helperText={infoArquivos || (total.semContagemArquivos ? 'Arquivamento pendente de conferência' : fracao(total.arquivadas, total.entregas, 'entregas finalizadas'))} />
        <Indicador tipo="participacao" valor={exibirTaxa(participacao)} icone={<Percent size={17} />}
          helperText={infoCustos || (participacao === null ? 'Sem base de comparação' : `Sobre ${formatarNumero(financeiro?.fretesVinculados ?? 0)} fretes vinculados, com impostos`)} />
        <Indicador tipo="cobrado" valor={exibirMoeda(valores.cobrado)} icone={<CircleDollarSign size={17} />}
          helperText={infoCustos || (financeiro?.semCobrado ? 'Existem cobranças sem valor informado' : `${formatarNumero(financeiro?.consolidacoes ?? 0)} consolidações`)} />
        <Indicador tipo="calculado" valor={exibirMoeda(valores.calculado)} icone={<Calculator size={17} />}
          helperText={infoCustos || (financeiro?.semCalculado ? 'Existem cálculos sem valor informado' : 'Consolidações incluídas na análise')} />
        <Indicador tipo="diferenca" valor={exibirMoeda(valores.diferenca)} icone={<Scale size={17} />}
          helperText={infoCustos || 'Cobrado menos calculado pelo sistema'} />
      </section>
      {resumo.conferencia.size > 0 && <section className="rede-conferencia" aria-label="Consolidações em conferência">
        <h2>Consolidações em conferência</h2>
        <div className="rede-tabela"><table><thead><tr>
          <th scope="col">Motivo</th><th scope="col">Consolidações</th><th scope="col">Cobrado</th><th scope="col">Calculado</th>
        </tr></thead><tbody>
          {[...resumo.conferencia.entries()].map(([motivo, grupo]) => <tr key={motivo}>
            <th scope="row">{motivo}</th><td>{formatarNumero(grupo.consolidacoes)}</td>
            <td>{exibirMoeda(valoresFinanceiros(grupo).cobrado)}</td><td>{exibirMoeda(valoresFinanceiros(grupo).calculado)}</td>
          </tr>)}
        </tbody></table></div>
      </section>}
      <PaineisRede resumo={resumo} carregandoDesempenho={desempenho.isLoading}
        erroDesempenho={desempenho.isError ? infoDesempenho : undefined} carregandoCustos={custos.isLoading}
        erroCustos={custos.isError ? infoCustos : undefined} parcialCustos={parcialCustos} aguardandoCustos={aguardandoCustos}
        carregandoTabela={desempenho.isLoading && operacao.isLoading && custos.isLoading} />
    </div>
  </div>;
}
