import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import {
  consultarGestaoGlobal,
  dominioSinistros,
  lerIndicadores,
  lerSinistros,
  type Indicadores,
  type Periodo,
  type Relacao,
  type Sinistro,
} from '../api/endpoints/ocorrenciasSinistros';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { usePermissions } from '../hooks/usePermissions';
import DateRangePicker from '../components/shared/DateRangePicker';
import FilterBar from '../components/shared/FilterBar';
import TooltipKpi from '../components/shared/TooltipKpi';
import KpiCard from '../components/shared/KpiCard';
import { KpiDictionary } from '../constants/kpiDictionary';
import { formatarNumero, formatarPorcentagem } from '../utils/formatadores';
import CarregamentoSinistros from '../components/domain/sinistros/CarregamentoSinistros';
import { GraficoGrupo, HistoricoSinistro } from '../components/domain/sinistros/GraficosSinistros';
import { EditarSinistro, GerenciarApolices } from '../components/domain/sinistros/EdicaoSinistros';
import RelacaoSinistros from '../components/domain/sinistros/RelacaoSinistros';
import '../components/domain/sinistros/sinistros.css';

const cache = { staleTime: 3 * 60_000, retry: 1 } as const;
const definicoes = KpiDictionary.ocorrenciasSinistros;
function porcentagem(parte: number, base: number) {
  return base ? formatarPorcentagem((100 * parte) / base, 2) : '—';
}
function Card({ tipo, valor, ajuda }: { tipo: keyof typeof definicoes; valor: string; ajuda?: string }) {
  return (
    <TooltipKpi definition={definicoes[tipo]} className="h-full">
      <KpiCard label={definicoes[tipo].titulo} valor={valor} helperText={ajuda} className="h-full" />
    </TooltipKpi>
  );
}
function IndicadoresDaTela({ op, sin }: { op: Indicadores; sin: Relacao }) {
  const fretes = op.diasFretes > 0,
    eventos = op.diasOcorrencias > 0,
    sinistros = op.diasSinistros > 0;
  const coberturas = [
    ['Fretes', op.diasFretes],
    ['Ocorrências', op.diasOcorrencias],
    ['Sinistros', op.diasSinistros],
  ] as const;
  const parciais = coberturas.filter(([, c]) => c < op.dias);
  return (
    <>
      {parciais.length > 0 && (
        <p className="os-cobertura" role="status">
          Cobertura parcial ·{' '}
          {parciais.map(([nome, dias]) => nome + ' ' + dias + '/' + op.dias + ' dias').join(' · ')}
        </p>
      )}
      <section aria-label="Indicadores de transporte" className="os-kpis os-kpis-principais">
        <Card tipo="minutas" valor={fretes ? formatarNumero(op.minutas) : '—'} />
        <Card tipo="comOcorrencia" valor={fretes && eventos ? formatarNumero(op.comOcorrencia) : '—'} />
        <Card
          tipo="taxaOcorrencias"
          valor={fretes && eventos ? porcentagem(op.comOcorrencia, op.minutas) : '—'}
        />
        <Card tipo="sinistros" valor={sinistros || sin.total > 0 ? formatarNumero(sin.total) : '—'} />
        <Card
          tipo="taxaSinistros"
          valor={fretes && sinistros ? porcentagem(op.minutasComSinistro, op.minutas) : '—'}
          ajuda={
            fretes && sinistros ? formatarNumero(op.minutasComSinistro) + ' minutas afetadas' : undefined
          }
        />
      </section>
      <div className="os-composicao">
        <GraficoGrupo dados={op} porNota />
        <GraficoGrupo dados={op} porNota={false} />
        <section aria-label="Tratativas e resolução" className="os-kpis os-kpis-operacionais">
          <Card
            tipo="media"
            valor={
              eventos && fretes && op.minutas ? formatarNumero(op.eventosDasMinutas / op.minutas, 2) : '—'
            }
          />
          <Card tipo="tratativa" valor={eventos ? formatarNumero(op.emTratativa) : '—'} />
          <Card
            tipo="solucao"
            valor={eventos ? porcentagem(op.noPrazo, op.comPrazo) : '—'}
            ajuda={
              eventos
                ? formatarNumero(op.noPrazo) + ' de ' + formatarNumero(op.comPrazo) + ' com prazo'
                : undefined
            }
          />
          <Card
            tipo="encerrados"
            valor={sinistros || sin.encerrados > 0 ? formatarNumero(sin.encerrados) : '—'}
            ajuda={sin.mediaDias == null ? undefined : formatarNumero(sin.mediaDias, 1) + ' dias em média'}
          />
        </section>
      </div>
    </>
  );
}

function Relatorio({ periodo, edita }: { periodo: Periodo; edita: boolean }) {
  const [pagina, setPagina] = useState(0);
  const [edicao, setEdicao] = useState<Sinistro>();
  const client = useQueryClient();
  const chave = [dominioSinistros, periodo.dataInicio, periodo.dataFim];
  const op = useQuery({
    ...cache,
    queryKey: [...chave, 'indicadores'],
    queryFn: ({ signal }) => lerIndicadores(periodo, signal),
  });
  const sin = useQuery({
    ...cache,
    queryKey: [...chave, 'relacao', 0],
    queryFn: ({ signal }) => lerSinistros(periodo, 0, signal),
  });
  const outraPagina = useQuery({
    ...cache,
    enabled: pagina > 0,
    queryKey: [...chave, 'relacao', pagina],
    queryFn: ({ signal }) => lerSinistros(periodo, pagina, signal),
  });
  const atual = pagina === 0 ? sin : outraPagina;
  if (op.isError || sin.isError)
    return (
      <div role="alert" className="os-cobertura">
        Não foi possível carregar o relatório.{' '}
        <button
          className="os-botao"
          onClick={() => {
            void op.refetch();
            void sin.refetch();
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  if (!op.data || !sin.data) return <CarregamentoSinistros />;
  return (
    <div className="os-painel">
      <IndicadoresDaTela op={op.data} sin={sin.data} />
      <div className="os-graficos">
        <HistoricoSinistro indicadores={op.data} relacao={sin.data} />
      </div>
      {atual.isError ? (
        <p role="alert">
          Falha ao abrir esta página. <button onClick={() => void atual.refetch()}>Tentar novamente</button>
        </p>
      ) : atual.data ? (
        <RelacaoSinistros
          periodo={periodo}
          relacao={atual.data}
          pagina={pagina}
          setPagina={setPagina}
          editar={edita ? setEdicao : undefined}
        />
      ) : (
        <p role="status">Carregando página da relação…</p>
      )}
      {edicao && (
        <EditarSinistro
          linha={edicao}
          fechar={() => setEdicao(undefined)}
          salvou={() => client.invalidateQueries({ queryKey: [dominioSinistros] })}
        />
      )}
    </div>
  );
}
export default function OcorrenciasSinistrosPage() {
  const { dataInicio, dataFim, setDataRange, setDataInicio, setDataFim, limparFiltros } = useFiltro();
  const { canAccess } = usePermissions();
  const edita = canAccess('gerenciarSinistros');
  const global = useQuery({
    ...cache,
    enabled: edita,
    queryKey: [dominioSinistros, 'gestao-global'],
    queryFn: ({ signal }) => consultarGestaoGlobal(signal),
  });
  const [apolices, setApolices] = useState(false);
  const client = useQueryClient();
  usePageHeader({
    title: 'Ocorrências e Sinistros',
    description: 'Ocorrências do transporte, tratativas e acompanhamento de sinistros.',
  });
  return (
    <div className="w-full">
      <FilterBar
        dataInicio={dataInicio}
        dataFim={dataFim}
        onClear={limparFiltros}
        period={
          <DateRangePicker
            dataInicio={dataInicio}
            dataFim={dataFim}
            onRangeChange={setDataRange}
            onDataInicioChange={setDataInicio}
            onDataFimChange={setDataFim}
          />
        }
        actions={
          edita &&
          global.data && (
            <button className="os-botao" type="button" onClick={() => setApolices(true)}>
              <ShieldCheck size={15} />
              Apólices
            </button>
          )
        }
      />
      <Relatorio key={dataInicio + '/' + dataFim} periodo={{ dataInicio, dataFim }} edita={edita} />
      {apolices && (
        <GerenciarApolices
          fechar={() => setApolices(false)}
          salvou={() => client.invalidateQueries({ queryKey: [dominioSinistros] })}
        />
      )}
    </div>
  );
}
