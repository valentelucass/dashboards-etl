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
  const coberturaCustos = dadosCustos !== undefined && dadosCustos.diasSolicitados > 0 &&
    dadosCustos.diasCobertos === dadosCustos.diasSolicitados;
  const custosCompletos = coberturaCustos ? dadosCustos : undefined;
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
  const resumo = useMemo(() => resumirRede(desempenho.data ?? [], operacao.data, custosCompletos, selecionados),
    [desempenho.data, operacao.data, custosCompletos, selecionados]);
  const { total, taxas } = resumo;
  const valores = valoresFinanceiros(custosCompletos?.totais);
  const financeiro = custosCompletos?.totais;
  const participacao = financeiro && financeiro.semCobrado === 0
    ? percentual(financeiro.cobradoVinculadoCentavos, financeiro.freteVinculadoCentavos) : null;
  const infoDesempenho = fonte(desempenho, 'Performance');
  const infoOperacao = fonte(operacao, 'Coletas e comprovantes');
  const infoCustos = fonte(custos, 'Consolidação') || (dadosCustos && !coberturaCustos
    ? `Cobertura de ${dadosCustos.diasCobertos} de ${dadosCustos.diasSolicitados} dias` : '');
  const coberturaArquivos = operacao.data?.coberturaArquivos;
  const infoArquivos = infoOperacao || (coberturaArquivos && !coberturaArquivos.completa
    ? `Cobertura de ${coberturaArquivos.diasCobertos} de ${coberturaArquivos.diasSolicitados} dias` : '');

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
          helperText={infoOperacao || fracao(total.coletasNoPrazo, total.coletas, 'coletas finalizadas')} />
        <Indicador tipo="anexados" valor={exibirTaxa(taxas.anexado)} icone={<FileCheck2 size={17} />}
          helperText={infoOperacao || fracao(total.anexadas, total.entregas, 'entregas finalizadas')} />
        <Indicador tipo="arquivados" valor={exibirTaxa(taxas.arquivado)} icone={<Archive size={17} />}
          helperText={infoArquivos || (total.semContagemArquivos ? 'Arquivamento pendente de conferência' : fracao(total.arquivadas, total.entregas, 'entregas finalizadas'))} />
        <Indicador tipo="participacao" valor={exibirTaxa(participacao)} icone={<Percent size={17} />}
          helperText={infoCustos || (participacao === null ? 'Sem base de comparação' : `Sobre ${formatarNumero(financeiro?.fretesVinculados ?? 0)} fretes vinculados, com impostos`)} />
        <Indicador tipo="cobrado" valor={exibirMoeda(valores.cobrado)} icone={<CircleDollarSign size={17} />}
          helperText={infoCustos || (financeiro?.semCobrado ? 'Existem cobranças sem valor informado' : `${formatarNumero(financeiro?.consolidacoes ?? 0)} consolidações`)} />
        <Indicador tipo="calculado" valor={exibirMoeda(valores.calculado)} icone={<Calculator size={17} />}
          helperText={infoCustos || (financeiro?.semCalculado ? 'Existem cálculos sem valor informado' : `${formatarNumero(financeiro?.calculadoZero ?? 0)} consolidações com cálculo de R$ 0,00`)} />
        <Indicador tipo="diferenca" valor={exibirMoeda(valores.diferenca)} icone={<Scale size={17} />}
          helperText={infoCustos || 'Cobrado menos calculado pelo sistema'} />
      </section>
      <p className="rede-previa">Prévia para conferência. OTIF e EFD medem a filial que registrou a ocorrência. Coletas e comprovantes usam o responsável pela região. A participação compara a cobrança ao valor final dos fretes vinculados. Os critérios de bônus e ônus aguardam validação.</p>
      <PaineisRede resumo={resumo} carregandoDesempenho={desempenho.isLoading}
        erroDesempenho={desempenho.isError ? infoDesempenho : undefined} carregandoCustos={custos.isLoading}
        erroCustos={custos.isLoading ? undefined : infoCustos || undefined}
        carregandoTabela={desempenho.isLoading && operacao.isLoading && custos.isLoading} />
    </div>
  </div>;
}
