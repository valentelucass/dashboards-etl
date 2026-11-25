import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { ChevronLeft } from 'lucide-react';
import type { Indicadores, Relacao } from '../../../api/endpoints/ocorrenciasSinistros';
import { formatarNumero, formatarPorcentagem } from '../../../utils/formatadores';
import { buildBaseLineOption } from '../../../utils/echartsBuilders';
import ChartCard from '../../shared/ChartCard';
import AstryxDashboardChart from '../../charts/AstryxDashboardChart';
import AstryxRadialPlot from '../../charts/AstryxRadialPlot';
import { useEchartsTheme } from '../../charts/useEchartsTheme';

const cores = [
  '#1776db',
  '#22a581',
  '#f4932f',
  '#7362b8',
  '#8496a6',
  '#47a6cc',
  '#d26079',
  '#b3953a',
  '#498c64',
  '#6078cf',
  '#ba784d',
  '#818995',
];
interface Categoria {
  chave: string;
  nome: string;
  notas: number;
  quantidade: number;
}

function RoscaNotas({
  itens,
  unicas,
  onGrupo,
}: {
  itens: Categoria[];
  unicas: number;
  onGrupo?: (nome: string) => void;
}) {
  const participacoes = itens.reduce((soma, item) => soma + item.notas, 0);
  const option: EChartsOption = {
    legend: { show: false },
    title: { text: formatarNumero(unicas), subtext: 'notas únicas' },
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        name: 'Notas',
        radius: ['62%', '94%'],
        label: { show: false },
        data: itens.map((item, i) => ({
          name: item.nome,
          value: item.notas,
          itemStyle: { color: cores[i % cores.length] },
        })),
      },
    ],
  };
  return (
    <div className="os-rosca" aria-label="Percentual e quantidade de notas">
      <div className="os-anel">
        <AstryxRadialPlot
          option={option}
          height={174}
          label="Notas por grupo ou ocorrência"
          onEvents={
            onGrupo
              ? {
                  click: (ponto) => {
                    const nome = (ponto as { name: string }).name;
                    onGrupo(nome);
                  },
                }
              : undefined
          }
        />
      </div>
      <div className="os-legenda-notas" aria-label="Legenda de notas">
        {itens.map((item, i) => {
          const descricao =
            item.nome +
            ' · ' +
            formatarNumero(item.notas) +
            ' notas · ' +
            formatarPorcentagem(unicas ? (100 * item.notas) / unicas : 0, 1) +
            ' das notas únicas';
          const legenda = (
            <>
              <i aria-hidden="true" style={{ backgroundColor: cores[i % cores.length] }} />
              <span className="os-legenda-nome">{item.nome}</span>
              <span>{formatarPorcentagem((100 * item.notas) / participacoes, 1)}</span>
              <strong>{formatarNumero(item.notas)}</strong>
            </>
          );
          return onGrupo ? (
            <button
              type="button"
              key={item.chave}
              onClick={() => onGrupo(item.nome)}
              className="os-item-notas"
              aria-label={'Detalhar ' + item.nome}
              title={descricao}
            >
              {legenda}
            </button>
          ) : (
            <div className="os-item-notas" key={item.chave} title={descricao}>
              {legenda}
            </div>
          );
        })}
      </div>
      <small className="os-percentual-notas">
        A fatia mostra a participação entre as classificações. Uma nota pode ter mais de uma.
      </small>
    </div>
  );
}

function ColunasOcorrencias({ itens, onGrupo }: { itens: Categoria[]; onGrupo?: (nome: string) => void }) {
  const option: EChartsOption = {
    legend: { show: true, selectedMode: false },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: itens.map((item) => item.nome),
      axisLabel: { formatter: (v: string) => (v.length > 11 ? v.slice(0, 10) + '…' : v) },
    },
    yAxis: { type: 'value', min: 0 },
    series: [
      {
        name: 'Ocorrências',
        type: 'bar',
        itemStyle: { color: '#1673cd' },
        label: { show: true, position: 'top' },
        data: itens.map((item) => item.quantidade),
      },
      { name: 'Notas', type: 'bar', itemStyle: { color: '#9ccaf3' }, data: itens.map((item) => item.notas) },
    ],
  };
  return (
    <div aria-label="Quantidade de ocorrências">
      <AstryxDashboardChart
        key={itens.map((i) => i.chave).join('/')}
        label="Ocorrências e notas em colunas verticais"
        option={option}
        style={{ height: 210 }}
        minCategoryWidth={76}
        onEvents={onGrupo ? { click: (ponto) => onGrupo((ponto as { name: string }).name) } : undefined}
      />
    </div>
  );
}

export function GraficoGrupo({ dados, porNota }: { dados: Indicadores; porNota: boolean }) {
  const [grupo, setGrupo] = useState<string>();
  const selecionado = dados.grupos.find((g) => g.grupo === grupo);
  const campo = porNota ? 'notas' : 'quantidade';
  const serie: Categoria[] = selecionado
    ? dados.tipos
        .filter((t) => t.grupo === selecionado.grupo)
        .map((t) => ({ ...t, chave: String(t.codigo) + '/' + t.descricao, nome: t.descricao }))
    : dados.grupos.map((g) => ({ ...g, chave: g.grupo, nome: g.grupo }));
  const itens = serie
    .filter((item) => item[campo] > 0)
    .sort((a, b) => b[campo] - a[campo] || a.nome.localeCompare(b.nome, 'pt-BR'));
  const onGrupo = selecionado ? undefined : setGrupo;
  const acoes = selecionado ? (
    <button className="os-botao" type="button" onClick={() => setGrupo(undefined)}>
      <ChevronLeft size={13} />
      Grupos
    </button>
  ) : !porNota && itens.length > 0 ? (
    <select
      className="os-seletor-grupo"
      aria-label="Detalhar grupo de ocorrências"
      value=""
      onChange={(e) => setGrupo(e.target.value)}
    >
      <option value="">Por grupo</option>
      {itens.map((item) => (
        <option key={item.chave} value={item.nome}>
          {item.nome}
        </option>
      ))}
    </select>
  ) : undefined;
  return (
    <ChartCard
      titulo={porNota ? 'Notas e quantidade por grupo de ocorrência' : 'Ocorrências por grupo de ocorrência'}
      chartKey={porNota ? 'notasGrupo' : 'eventosGrupo'}
      actions={acoes}
      isEmpty={!itens.length}
      emptyMessage={porNota ? 'Nenhuma nota com ocorrência no período.' : 'Nenhuma ocorrência no período.'}
    >
      {selecionado && <p className="os-grupo-ativo">{selecionado.grupo}</p>}
      {porNota ? (
        <RoscaNotas itens={itens} unicas={selecionado?.notas ?? dados.notas} onGrupo={onGrupo} />
      ) : (
        <ColunasOcorrencias itens={itens} onGrupo={onGrupo} />
      )}
    </ChartCard>
  );
}

export function HistoricoSinistro({ indicadores, relacao }: { indicadores: Indicadores; relacao: Relacao }) {
  const { isDark } = useEchartsTheme();
  const series = useMemo(
    () => [
      {
        titulo: 'Evolução da taxa de sinistro',
        chave: 'taxaSinistroDia' as const,
        unidade: '%',
        cor: '#4b8cdd',
        valores: indicadores.evolucao
          .filter(() => indicadores.diasSinistros > 0)
          .map((d) => ({ dia: d.dia, valor: d.total ? (100 * d.afetadas) / d.total : null })),
      },
      {
        titulo: 'Resolução de sinistros em dias',
        chave: 'diasSinistro' as const,
        unidade: ' dias',
        cor: '#18a88a',
        valores: relacao.prazos.map((d) => ({ dia: d.dia, valor: d.media })),
      },
    ],
    [indicadores, relacao],
  );
  return (
    <>
      {series.map((s) => (
        <ChartCard
          key={s.chave}
          titulo={s.titulo}
          chartKey={s.chave}
          isEmpty={!s.valores.length}
          emptyMessage="Sem base para o indicador no período."
        >
          <AstryxDashboardChart
            label={s.titulo}
            style={{ height: 210 }}
            option={buildBaseLineOption(isDark, {
              color: [s.cor],
              tooltip: {
                trigger: 'axis',
                valueFormatter: (value) =>
                  typeof value === 'number'
                    ? formatarNumero(value, s.unidade === '%' ? 2 : 1) + s.unidade
                    : '—',
              },
              grid: { left: 48, right: 18, top: 25, bottom: 36 },
              xAxis: {
                type: 'category',
                data: s.valores.map((d) => d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7)),
              },
              yAxis: {
                type: 'value',
                min: 0,
                axisLabel: { formatter: s.unidade === '%' ? '{value}%' : '{value}' },
              },
              series: [
                {
                  type: 'line',
                  name: s.titulo,
                  data: s.valores.map((d) => d.valor),
                  symbol: 'circle',
                  symbolSize: 5,
                  lineStyle: { color: s.cor },
                },
              ],
            })}
          />
        </ChartCard>
      ))}
    </>
  );
}
