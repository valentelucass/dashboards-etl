import { Card } from '@astryxdesign/core/Card';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTrackingFretes, useTrackingRegioes } from '../../../hooks/queries/useTracking';
import type { TrackingFiltro, TrackingFrete, TrackingMatrizRegiao, TrackingRegiao } from '../../../types/tracking';
import { getApiErrorMessage } from '../../../utils/apiError';
import { formatarMoeda, formatarNumero, formatarPeso } from '../../../utils/formatadores';
import DashboardButton from '../../shared/DashboardButton';
import StatusBadge from '../../shared/StatusBadge';
import { fundosTracking } from './fundosTracking';
import './tracking-matriz.css';

const TAMANHO = 10;

function Paginacao({ pagina, total, rotulo, mudar }: {
  pagina: number; total: number; rotulo: string; mudar: (pagina: number) => void;
}) {
  if (total <= 1) return null;
  return <nav aria-label={`Páginas de ${rotulo}`} className="tracking-paginacao">
    <DashboardButton aria-label={`Página anterior de ${rotulo}`} disabled={pagina <= 1} onClick={() => mudar(pagina - 1)}><ChevronLeft size={16} /></DashboardButton>
    <span aria-live="polite">{pagina} / {total}</span>
    <DashboardButton aria-label={`Próxima página de ${rotulo}`} disabled={pagina >= total} onClick={() => mudar(pagina + 1)}><ChevronRight size={16} /></DashboardButton>
  </nav>;
}

function PainelConsulta({ carregando, erro, vazio, mensagem, tentar, children }: {
  carregando: boolean; erro: unknown; vazio: boolean; mensagem: string; tentar: () => void; children: ReactNode;
}) {
  if (erro) return <div role="alert" className="tracking-aviso">{getApiErrorMessage(erro, 'Não foi possível carregar estes dados.')} <DashboardButton onClick={tentar}>Tentar novamente</DashboardButton></div>;
  if (carregando) return <p role="status" className="tracking-aviso">Carregando…</p>;
  if (vazio) return <p className="tracking-aviso">{mensagem}</p>;
  return children;
}

function LinhaExpansivel({ titulo, nomeAcessivel, aberta, alternar, children, resumo, fundos }: {
  titulo: string; nomeAcessivel: string; aberta: boolean; alternar: () => void; children: ReactNode; resumo: ReactNode; fundos?: CSSProperties;
}) {
  const id = useId();
  return <div className="tracking-linha" style={fundos}>
    <button type="button" className="tracking-resumo tracking-expansor" aria-label={nomeAcessivel} aria-describedby={id + '-totais'} aria-expanded={aberta} aria-controls={id} onClick={alternar}>
      <span className="tracking-identificador">{aberta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}{titulo}</span>
      <span id={id + '-totais'} className="contents">{resumo}</span>
    </button>
    <div id={id} hidden={!aberta} className="tracking-subnivel">{aberta && children}</div>
  </div>;
}

function Metricas({ linha }: { linha: TrackingMatrizRegiao | TrackingRegiao }) {
  return <>
    <span><small>Cargas</small>{formatarNumero(linha.totalCargas)}</span>
    <span><small>Peso taxado</small>{formatarPeso(linha.pesoTaxado)}</span>
    <span><small>Valor do frete</small>{formatarMoeda(linha.valorFrete)}</span>
    <span><small>Valor NF</small>{formatarMoeda(linha.valorNota)}</span>
    <span><small>Volumes</small>{formatarNumero(linha.volumes)}</span>
    <span className={linha.foraDoPrazo > 0 ? 'tracking-atrasadas' : ''}><small>Fora do prazo</small>{formatarNumero(linha.foraDoPrazo)}</span>
  </>;
}

function Notas({ numeros, minuta }: { numeros: string[]; minuta: number }) {
  const [pagina, setPagina] = useState(1);
  const atual = Math.min(pagina, Math.max(1, Math.ceil(numeros.length / TAMANHO)));
  if (!numeros.length) return <p className="tracking-aviso">Sem nota fiscal informada.</p>;
  return <>
    <h5>Notas fiscais</h5>
    <ul className="tracking-notas" aria-label={`Notas fiscais da minuta ${minuta}`}>
      {numeros.slice((atual - 1) * TAMANHO, atual * TAMANHO).map((numero, i) => <li key={`${numero}-${i}`}>{numero}</li>)}
    </ul>
    <Paginacao pagina={atual} total={Math.ceil(numeros.length / TAMANHO)} rotulo={`notas da minuta ${minuta}`} mudar={setPagina} />
  </>;
}

function Fretes({ filtro, sigla, regiao }: { filtro: TrackingFiltro; sigla: string; regiao: string }) {
  const [pagina, setPagina] = useState(1);
  const consulta = useTrackingFretes(filtro, sigla, regiao, pagina, TAMANHO);
  const dados = consulta.data;
  return <>
    <h4>Fretes de {regiao}</h4>
    <PainelConsulta erro={consulta.error} carregando={consulta.isLoading} vazio={!dados?.conteudo.length} mensagem="Nenhum frete nesta região para os filtros selecionados." tentar={() => void consulta.refetch()}>
      {dados?.conteudo.map((frete: TrackingFrete) => <article key={frete.numeroMinuta} className="tracking-linha" aria-label={`Minuta ${frete.numeroMinuta}`}>
        <div className="tracking-resumo"><strong className="tracking-identificador">Minuta {frete.numeroMinuta}</strong>
          <span><small>Status</small><StatusBadge status={frete.statusCarga} /></span>
          <span><small>Peso taxado</small>{formatarPeso(frete.pesoTaxado)}</span>
          <span><small>Valor do frete</small>{formatarMoeda(frete.valorFrete)}</span>
          <span><small>Valor NF</small>{formatarMoeda(frete.valorNota)}</span>
          <span><small>Volumes</small>{formatarNumero(frete.volumes)}</span>
          <span><small>Notas fiscais</small>{formatarNumero(frete.numerosNf.length)}</span>
        </div>
        <div className="tracking-subnivel"><Notas numeros={frete.numerosNf} minuta={frete.numeroMinuta} /></div>
      </article>)}
    </PainelConsulta>
    <Paginacao pagina={pagina} total={dados?.totalPaginas ?? 0} rotulo={`fretes de ${regiao}`} mudar={setPagina} />
  </>;
}

function Regioes({ filtro, sigla }: { filtro: TrackingFiltro; sigla: string }) {
  const [pagina, setPagina] = useState(1);
  const [aberta, setAberta] = useState<string | null>(null);
  const consulta = useTrackingRegioes(filtro, sigla, pagina, TAMANHO);
  const dados = consulta.data;
  return <>
    <h3>Regiões de destino de {sigla}</h3>
    <PainelConsulta erro={consulta.error} carregando={consulta.isLoading} vazio={!dados?.conteudo.length} mensagem="Nenhuma região de destino para os filtros selecionados." tentar={() => void consulta.refetch()}>
      {dados?.conteudo.map(linha => <LinhaExpansivel key={linha.regiaoDestino} titulo={linha.regiaoDestino} nomeAcessivel={`Região de destino ${linha.regiaoDestino}`}
        aberta={aberta === linha.regiaoDestino} alternar={() => setAberta(aberta === linha.regiaoDestino ? null : linha.regiaoDestino)} resumo={<Metricas linha={linha} />}>
        <Fretes filtro={filtro} sigla={sigla} regiao={linha.regiaoDestino} />
      </LinhaExpansivel>)}
    </PainelConsulta>
    <Paginacao pagina={pagina} total={dados?.totalPaginas ?? 0} rotulo={`regiões de ${sigla}`} mudar={setPagina} />
  </>;
}

export default function TrackingMatriz({ linhas, filtro, status, alternarStatus, carregando, erro, tentar }: {
  linhas: TrackingMatrizRegiao[]; filtro: TrackingFiltro; status: string[]; alternarStatus: (status: string) => void;
  carregando: boolean; erro: unknown; tentar: () => void;
}) {
  const [pagina, setPagina] = useState(1);
  const [aberta, setAberta] = useState<string | null>(null);
  const totalPaginas = Math.ceil(linhas.length / TAMANHO);
  const atual = Math.min(pagina, Math.max(1, totalPaginas));
  return <Card padding={4} className="tracking-region-matrix min-w-0">
    <header className="tracking-cabecalho"><h2>Responsável pela Região de Destino</h2>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtro rápido de status">{status.map(valor =>
        <ToggleButton key={valor} label={valor} size="sm" isPressed={filtro.statusCarga?.includes(valor) ?? false} onPressedChange={() => alternarStatus(valor)} />)}
      </div>
    </header>
    <PainelConsulta erro={erro} carregando={carregando} vazio={!linhas.length} mensagem="Nenhuma carga para os filtros selecionados." tentar={tentar}>
      {linhas.slice((atual - 1) * TAMANHO, atual * TAMANHO).map(linha => <LinhaExpansivel key={linha.siglaRegiaoDestino}
        titulo={linha.siglaRegiaoDestino} nomeAcessivel={`Responsável ${linha.siglaRegiaoDestino}`} fundos={fundosTracking(linha.siglaRegiaoDestino)}
        aberta={aberta === linha.siglaRegiaoDestino} alternar={() => setAberta(aberta === linha.siglaRegiaoDestino ? null : linha.siglaRegiaoDestino)} resumo={<Metricas linha={linha} />}>
        <Regioes filtro={filtro} sigla={linha.siglaRegiaoDestino} />
      </LinhaExpansivel>)}
    </PainelConsulta>
    <Paginacao pagina={atual} total={totalPaginas} rotulo="responsáveis" mudar={setPagina} />
  </Card>;
}
