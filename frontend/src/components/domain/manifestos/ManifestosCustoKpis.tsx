import DashboardLoading from '../../shared/DashboardLoading';
import KpiCard from '../../shared/KpiCard';
import TooltipKpi from '../../shared/TooltipKpi';
import { KpiDictionary, type KpiDefinition } from '../../../constants/kpiDictionary';
import type { ManifestosCustosEvolucao } from '../../../types/manifestos';
import type { GoalTone } from '../../../utils/indicadoresGestaoVistaUi';
import { formatarMoeda, formatarPorcentagem } from '../../../utils/formatadores';
import { resolverTomCusto } from './manifestosCustoUi';

interface ManifestosCustoKpisProps {
  dados?: ManifestosCustosEvolucao;
  isLoading?: boolean;
}

interface CustoCard {
  definition: KpiDefinition;
  label: string;
  valor: string;
  tone: GoalTone;
}

function montarCards(dados: ManifestosCustosEvolucao): CustoCard[] {
  const temOrcamento = dados.orcamentoAplicavel && dados.orcamentoConfigurado;

  return [
    {
      definition: KpiDictionary.manifestos.orcamentoCusto,
      label: 'Orçamento de Custo',
      valor: temOrcamento ? formatarMoeda(dados.orcamentoCusto) : '—',
      tone: 'neutral',
    },
    {
      definition: KpiDictionary.manifestos.custoReal,
      label: 'Custo Real',
      valor: formatarMoeda(dados.custoReal),
      tone: resolverTomCusto(dados.custoReal, dados.orcamentoCusto, temOrcamento),
    },
    {
      definition: KpiDictionary.manifestos.limiteDiarioBase,
      label: 'Limite Diário Base',
      valor: temOrcamento ? formatarMoeda(dados.limiteDiarioBase) : '—',
      tone: 'neutral',
    },
    {
      definition: KpiDictionary.manifestos.custoMedioDiarioReal,
      label: 'Custo Médio Diário',
      valor: formatarMoeda(dados.custoMedioDiarioReal),
      tone: resolverTomCusto(
        dados.custoMedioDiarioReal,
        dados.limiteDiarioDinamico,
        temOrcamento,
      ),
    },
    {
      definition: KpiDictionary.manifestos.saldoOrcamentario,
      label: 'Saldo Orçamentário',
      valor: temOrcamento ? formatarMoeda(dados.saldoOrcamentario) : '—',
      tone: temOrcamento
        ? dados.saldoOrcamentario >= 0 ? 'positive' : 'negative'
        : 'neutral',
    },
    {
      definition: KpiDictionary.manifestos.limiteDiarioDinamico,
      label: 'Meta Diária Dinâmica',
      valor: temOrcamento ? formatarMoeda(dados.limiteDiarioDinamico) : '—',
      tone: 'neutral',
    },
    {
      definition: KpiDictionary.manifestos.tendenciaCusto,
      label: 'Tendência de Custo',
      valor: formatarMoeda(dados.tendenciaCusto),
      tone: resolverTomCusto(dados.tendenciaCusto, dados.orcamentoCusto, temOrcamento),
    },
    {
      definition: KpiDictionary.manifestos.consumoOrcamento,
      label: 'Consumo do Orçamento',
      valor: temOrcamento ? formatarPorcentagem(dados.consumoOrcamento, 1) : '—',
      tone: resolverTomCusto(dados.consumoOrcamento, 100, temOrcamento),
    },
  ];
}

export default function ManifestosCustoKpis({
  dados,
  isLoading,
}: ManifestosCustoKpisProps) {
  const cards = dados ? montarCards(dados) : [];
  const observacao = dados && (!dados.orcamentoAplicavel || !dados.orcamentoConfigurado)
    ? dados.observacao
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {observacao && (
        <div
          className="rounded-xl border px-3 py-2 text-xs font-medium leading-snug"
          role="status"
          style={{
            backgroundColor: 'var(--color-warning-badge-bg)',
            borderColor: 'var(--color-warning-border)',
            color: 'var(--color-warning-text)',
          }}
        >
          {observacao}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2" aria-busy={isLoading}>
        {isLoading
          ? Array.from({ length: 8 }, (_, index) => <DashboardLoading key={index} label="" variant="card" />)
          : cards.map((card) => (
            <TooltipKpi key={card.label} definition={card.definition}>
              <KpiCard
                label={card.label}
                valor={card.valor}
                tone={card.tone}
                valorClassName="truncate text-xl font-bold tabular-nums"
                valorStyle={{
                  color: card.tone === 'positive'
                    ? 'var(--color-positive-text)'
                    : card.tone === 'negative'
                      ? 'var(--color-negative-text)'
                      : 'var(--color-text)',
                }}
              />
            </TooltipKpi>
          ))}
      </div>
    </div>
  );
}
