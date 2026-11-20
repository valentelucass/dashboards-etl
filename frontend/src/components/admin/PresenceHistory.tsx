import DashboardLoading from '../shared/DashboardLoading';
import DashboardButton from "../shared/DashboardButton";
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import clienteAxios from '../../api/clienteAxios';
import { Popover } from '@astryxdesign/core/Popover';
import { ADMIN_NAV_ITEMS, DASHBOARD_NAV_ITEMS } from '../../utils/accessControl';
import TooltipKpi from '../shared/TooltipKpi';
import PeoplePagination from './PeoplePagination';

// A API entrega dez rotas por consulta. Cada tela do histórico exibe cinco.
const VISITAS_POR_CONSULTA = 10;
const VISITAS_POR_PAGINA = 5;

interface NavegacaoDia {
  dia: string;
  agrupamento: 'PAGINA';
  total: number;
  segundosTotal: number;
  atualizadoEm: string | null;
  visitas: { ordem: number; rota: string; inicio: string; fim: string; segundos: number; trechos: number }[];
}

function diaBrasilia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function hora(valor: string) {
  const instante = new Date(valor);
  if (!Number.isFinite(instante.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(instante);
}
function duracao(segundos: number) {
  if (segundos === 0) return 'Menos de 1s';
  if (segundos < 60) return `${segundos}s`;
  if (segundos < 3600) return `${Math.floor(segundos / 60)}min ${segundos % 60}s`;
  return `${Math.floor(segundos / 3600)}h ${Math.floor(segundos % 3600 / 60)}min`;
}
function paginaNome(rota: string) {
  return rota === '/' ? 'Home' : [...ADMIN_NAV_ITEMS, ...DASHBOARD_NAV_ITEMS].find(item => item.path === rota)?.label ?? 'Página do portal';
}

export function PresenceHistoryContent({ usuarioId, nome, onClose }: { usuarioId: string; nome: string; onClose: () => void }) {
  const [pagina, setPagina] = useState(1);
  const inicio = (pagina - 1) * VISITAS_POR_PAGINA;
  const paginaApi = Math.floor(inicio / VISITAS_POR_CONSULTA);
  const [dia, setDia] = useState(diaBrasilia);
  useEffect(() => {
    const timer = setInterval(() => {
      const hoje = diaBrasilia();
      if (hoje !== dia) { setDia(hoje); setPagina(1); }
    }, 1000);
    return () => clearInterval(timer);
  }, [dia]);
  const query = useQuery({
    queryKey: ['admin', 'acesso', 'navegacao-dia', usuarioId, dia, paginaApi],
    queryFn: async ({ signal }) => (await clienteAxios.get<NavegacaoDia>(`/api/admin/acesso/usuarios/${usuarioId}/navegacao-dia`, { params: { pagina: paginaApi }, signal })).data,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === usuarioId && previous?.dia === dia ? previous : undefined,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const compativel = query.data?.agrupamento === 'PAGINA';
  const dados = !query.isError && compativel && query.data?.dia === dia ? query.data : undefined;
  const totalPaginas = Math.max(1, Math.ceil((dados?.total ?? 0) / VISITAS_POR_PAGINA));
  if (dados && pagina > totalPaginas) setPagina(totalPaginas);
  const offset = inicio % VISITAS_POR_CONSULTA;
  const visitas = dados?.visitas.slice(offset, offset + VISITAS_POR_PAGINA) ?? [];

  return <section className="min-w-0 p-4" aria-label={`Acessos de hoje de ${nome}`}>
    <DashboardButton type="button" autoFocus aria-label="Fechar acessos de hoje" onClick={onClose}
      className="mb-3 inline-flex items-center gap-1.5 rounded text-xs font-semibold focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      style={{ color: 'var(--color-primary)' }}><ArrowLeft size={15} />Voltar às pessoas</DashboardButton>
    <h3 className="text-base font-bold">Acessos de hoje</h3>
    <p className="mt-1 break-words text-sm font-medium">{nome}</p>
    <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>Uma linha por página, da mais recente para a mais antiga. Horários de Brasília.</p>
    {query.isPending && <DashboardLoading label="Carregando acessos..." />}
    {query.isError && <div className="py-5 text-sm" role="alert">Não foi possível atualizar os acessos. <DashboardButton type="button" className="underline" onClick={() => void query.refetch()}>Tentar novamente</DashboardButton></div>}
    {!query.isPending && !query.isError && !compativel && <p className="py-5 text-sm" role="status">O resumo por página ainda não está disponível. Aguarde a atualização do serviço.</p>}
    {!query.isPending && !query.isError && compativel && !dados?.visitas.length && <p className="py-5 text-sm">Nenhum acesso registrado hoje.</p>}
    {dados && dados.total > 0 && <>
      <div className="my-4 grid grid-cols-2 gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
        <div><p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Páginas acessadas</p><strong className="text-lg tabular-nums">{dados.total}</strong></div>
        <TooltipKpi kpiName="administracao.navegacaoHoje"><div><p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Tempo registrado em foco</p><strong className="text-lg tabular-nums">{duracao(dados.segundosTotal)}</strong></div></TooltipKpi>
      </div>
      <PeoplePagination label="Paginação dos acessos de hoje" page={pagina} totalPages={totalPaginas} onChange={setPagina} />
      {query.isPlaceholderData ? <DashboardLoading label="Carregando acessos..." /> : <ol className="space-y-2" aria-label="Páginas acessadas hoje">
        {visitas.map(visita => <li key={visita.rota} className="rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words font-semibold">{paginaNome(visita.rota)}</span><strong className="shrink-0 tabular-nums">{duracao(visita.segundos)}</strong></div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
            <span>Primeiro sinal: {hora(visita.inicio)}</span><span>Último sinal: {hora(visita.fim)}</span>
          </div>
        </li>)}
      </ol>}
      <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>Soma dos períodos registrados em foco; pausas ficam de fora. Os horários acima não representam permanência contínua.</p>
      {dados.atualizadoEm && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>Último sinal da pessoa: {hora(dados.atualizadoEm)} · Consulta a cada 15s.</p>}
    </>}
  </section>;
}

export default function PresenceHistory({ usuarioId, nome, children }: { usuarioId: string; nome: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Popover presentation="adaptive" label={"Acessos de hoje de " + nome} isOpen={open} onOpenChange={setOpen} alignment="start" width="min(27.5rem, calc(100vw - 24px))" padding={0}
      content={<div className="admin-presence-panel">
      {open && <PresenceHistoryContent usuarioId={usuarioId} nome={nome} onClose={() => setOpen(false)} />}
        </div>}>
      {trigger => (
        <DashboardButton {...trigger} type="button" className="block w-full rounded-xl text-left focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]" aria-label={`Ver acessos de hoje de ${nome}`}>{children}</DashboardButton>
      )}
    </Popover>;
}
