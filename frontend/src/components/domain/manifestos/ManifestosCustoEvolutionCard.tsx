import { useMemo } from 'react';
import ReactECharts from '../../charts/DashboardEChart';
import { useEchartsTheme } from '../../charts/useEchartsTheme';
import ChartCard from '../../shared/ChartCard';
import TooltipKpi from '../../shared/TooltipKpi';
import { KpiDictionary, type KpiDefinition } from '../../../constants/kpiDictionary';
import type { ManifestosCustosEvolucao } from '../../../types/manifestos';
import { formatarMoeda, formatarPorcentagem } from '../../../utils/formatadores';
import { getGoalToneStyle, type GoalTone } from '../../../utils/indicadoresGestaoVistaUi';
import {
  buildManifestosCustoEvolutionOption,
  metaCustoDisponivel,
  resolverTomCusto,
} from './manifestosCustoUi';

const ECHARTS_CANVAS_OPTS = { renderer: 'canvas' as const };

interface ManifestosCustoEvolutionCardProps {
  dados?: ManifestosCustosEvolucao;
  isLoading?: boolean;
}

interface CustoInsight {
  definition: KpiDefinition;
  label: string;
  value: string;
  tone: GoalTone;
  helper?: string;
}

function MiniKpiRow({ item, isLast }: { item: CustoInsight; isLast: boolean }) {
  const toneStyle = getGoalToneStyle(item.tone);
  const valueColor = item.tone === 'neutral' ? 'var(--color-text)' : toneStyle.text;

  return (
    <TooltipKpi definition={item.definition} className="w-full rounded-lg" style={{ flexBasis: 'auto' }}>
      <div className={`w-full pb-2 ${isLast ? '' : 'border-b'}`} style={{ borderColor: 'var(--color-border)' }}>
        <p className="truncate text-[11px] font-semibold uppercase" style={{ color: 'var(--color-text-subtle)' }}>
          {item.label}
        </p>
        <p className="mt-1 truncate text-lg font-bold tabular-nums leading-tight" style={{ color: valueColor }}>
          {item.value}
        </p>
        {item.helper ? (
          <p className="mt-1 truncate text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {item.helper}
          </p>
        ) : null}
      </div>
    </TooltipKpi>
  );
}

function SummaryKpi({ item, isLast }: { item: CustoInsight; isLast: boolean }) {
  const toneStyle = getGoalToneStyle(item.tone);
  const valueColor = item.tone === 'neutral' ? 'var(--color-text)' : toneStyle.text;

  return (
    <TooltipKpi definition={item.definition} className="w-full rounded-lg" style={{ flexBasis: 'auto' }}>
      <div className={`w-full py-2 ${isLast ? 'pb-0' : 'border-b'}`} style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--color-text-subtle)' }}>
          {item.label}
        </p>
        <p className="mt-1 break-words text-xl font-bold tabular-nums leading-tight" style={{ color: valueColor }}>
          {item.value}
        </p>
        {item.helper ? (
          <p className="mt-1 text-xs font-medium leading-snug" style={{ color: 'var(--color-text-muted)' }}>
            {item.helper}
          </p>
        ) : null}
      </div>
    </TooltipKpi>
  );
}

function montarContextoGrafico(dados: ManifestosCustosEvolucao): CustoInsight[] {
  const temMeta = metaCustoDisponivel(dados);

  return [
    {
      definition: KpiDictionary.manifestos.custoMedioDiarioReal,
      label: 'Custo Médio Diário Real',
      value: formatarMoeda(dados.custoMedioDiarioReal),
      tone: resolverTomCusto(dados.custoMedioDiarioReal, dados.limiteDiarioDinamico, temMeta),
    },
    {
      definition: KpiDictionary.manifestos.limiteDiarioDinamico,
      label: 'Meta Diária Dinâmica',
      value: temMeta ? formatarMoeda(dados.limiteDiarioDinamico) : '—',
      tone: 'neutral',
      helper: temMeta ? `${dados.diasUteisRestantes} dias úteis restantes` : undefined,
    },
    {
      definition: KpiDictionary.manifestos.saldoOrcamentario,
      label: 'Saldo Orçamentário',
      value: temMeta ? formatarMoeda(dados.saldoOrcamentario) : '—',
      tone: temMeta
        ? dados.saldoOrcamentario >= 0 ? 'positive' : 'negative'
        : 'neutral',
    },
  ];
}

function montarResumoDireito(dados: ManifestosCustosEvolucao): CustoInsight[] {
  const temMeta = metaCustoDisponivel(dados);

  return [
    {
      definition: KpiDictionary.manifestos.orcamentoCusto,
      label: 'Orçamento Total',
      value: temMeta ? formatarMoeda(dados.orcamentoCusto) : '—',
      tone: 'neutral',
      helper: temMeta ? `Consumo ${formatarPorcentagem(dados.consumoOrcamento, 1)}` : undefined,
    },
    {
      definition: KpiDictionary.manifestos.tendenciaCusto,
      label: 'Tendência',
      value: formatarMoeda(dados.tendenciaCusto),
      tone: resolverTomCusto(dados.tendenciaCusto, dados.orcamentoCusto, temMeta),
      helper: temMeta ? `${dados.diasUteisDecorridos}/${dados.totalDiasUteis} dias úteis decorridos` : undefined,
    },
  ];
}

export default function ManifestosCustoEvolutionCard({
  dados,
  isLoading,
}: ManifestosCustoEvolutionCardProps) {
  const { isDark } = useEchartsTheme();
  const option = useMemo(
    () => dados ? buildManifestosCustoEvolutionOption(dados, isDark) : {},
    [dados, isDark],
  );
  const serieVazia = !dados || dados.serieDiaria.length === 0;
  const metaIndisponivel = dados && !metaCustoDisponivel(dados);
  const contextoGrafico = useMemo(() => dados ? montarContextoGrafico(dados) : [], [dados]);
  const resumoDireito = useMemo(() => dados ? montarResumoDireito(dados) : [], [dados]);

  return (
    <ChartCard
      titulo="Evolução do Custo Real x Meta Diária Base"
      chartKey="manifestosCustoEvolucao"
      actions={metaIndisponivel ? (
        <span
          className="max-w-44 truncate text-xs font-semibold"
          style={{ color: 'var(--color-warning-text)' }}
          title={dados.observacao ?? 'Meta de custo indisponível.'}
        >
          Meta indisponível
        </span>
      ) : undefined}
      isLoading={isLoading}
      isEmpty={serieVazia}
      emptyMessage="Nenhum custo diário disponível para o período selecionado."
      className="h-full"
      contentClassName="overflow-y-auto pr-1 xl:overflow-hidden xl:pr-0"
    >
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[12rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_12rem]">
        <aside className="flex min-h-0 flex-col gap-2 lg:overflow-y-auto lg:pr-1 xl:overflow-visible xl:pr-0" aria-label="Indicadores contextuais do gráfico de custo">
          {contextoGrafico.map((item, index) => (
            <MiniKpiRow key={item.label} item={item} isLast={index === contextoGrafico.length - 1} />
          ))}
        </aside>

        <div className="min-h-[350px] min-w-0 lg:min-h-0">
          <ReactECharts
            option={option}
            style={{ height: '100%', minHeight: 350, width: '100%' }}
            opts={ECHARTS_CANVAS_OPTS}
            notMerge
          />
        </div>

        <aside className="grid min-h-0 gap-2 sm:grid-cols-2 lg:col-span-2 xl:col-span-1 xl:grid-cols-1" aria-label="Resumo de custo operacional">
          {resumoDireito.map((item, index) => (
            <SummaryKpi key={item.label} item={item} isLast={index === resumoDireito.length - 1} />
          ))}
        </aside>
      </div>
    </ChartCard>
  );
}
