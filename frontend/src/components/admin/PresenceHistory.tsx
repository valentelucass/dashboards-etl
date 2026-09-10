import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import clienteAxios from '../../api/clienteAxios';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ADMIN_NAV_ITEMS, DASHBOARD_NAV_ITEMS } from '../../utils/accessControl';

interface NavegacaoDia {
  dia: string;
  total: number;
  visitas: { ordem: number; rota: string; inicio: string; fim: string; segundos: number }[];
}

function diaBrasilia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function hora(valor: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(valor));
}
function duracao(segundos: number) {
  if (segundos < 60) return `${segundos}s`;
  if (segundos < 3600) return `${Math.floor(segundos / 60)}min ${segundos % 60}s`;
  return `${Math.floor(segundos / 3600)}h ${Math.floor(segundos % 3600 / 60)}min`;
}
function paginaNome(rota: string) {
  return rota === '/' ? 'Home' : [...ADMIN_NAV_ITEMS, ...DASHBOARD_NAV_ITEMS].find(item => item.path === rota)?.label ?? 'Página do portal';
}

export default function PresenceHistory({ usuarioId, nome, children }: { usuarioId: string; nome: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [dia, setDia] = useState(diaBrasilia);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abrir = () => { clearTimeout(closeTimer.current); setOpen(true); };
  const fechar = () => { closeTimer.current = setTimeout(() => setOpen(false), 180); };
  useEffect(() => {
    const timer = setInterval(() => { const hoje = diaBrasilia(); if (hoje !== dia) { setDia(hoje); setPagina(0); } }, 1000);
    return () => { clearInterval(timer); clearTimeout(closeTimer.current); };
  }, [dia]);
  const query = useQuery({
    queryKey: ['admin', 'acesso', 'navegacao-dia', usuarioId, dia, pagina],
    queryFn: async ({ signal }) => (await clienteAxios.get<NavegacaoDia>(`/api/admin/acesso/usuarios/${usuarioId}/navegacao-dia`, { params: { pagina }, signal })).data,
    enabled: open,
    refetchInterval: open ? 30000 : false,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const dados = query.data?.dia === dia ? query.data : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" onMouseEnter={abrir} onMouseLeave={fechar} onFocus={abrir}
          onClick={event => { event.preventDefault(); abrir(); }}
          className="block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          aria-label={`Ver acessos de hoje de ${nome}`}>
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" sideOffset={8} collisionPadding={12}
        onMouseEnter={abrir} onMouseLeave={fechar} onOpenAutoFocus={event => event.preventDefault()}
        style={{ width: 'min(360px, calc(100vw - 24px))', maxHeight: 'var(--radix-popover-content-available-height)', overflowY: 'auto', zIndex: 60 }}>
        <h4 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Acessos de hoje</h4>
        <p className="mt-1 break-words text-xs" style={{ color: 'var(--color-text-subtle)' }}>{nome}</p>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Horários de Brasília. Tempo estimado com a página em foco; atualizado a cada 30 segundos. Somente o dia atual.</p>
        {query.isPending && <p className="py-4 text-xs" role="status">Carregando acessos...</p>}
        {query.isError && <div className="py-4 text-xs" role="alert">Não foi possível consultar os acessos. <button type="button" className="underline" onClick={() => void query.refetch()}>Tentar novamente</button></div>}
        {!query.isPending && !query.isError && !dados?.visitas.length && <p className="py-4 text-xs">Nenhum acesso registrado hoje.</p>}
        <ol className="mt-3 max-h-60 space-y-3 overflow-y-auto pr-1">
          {dados?.visitas.map(visita => <li key={visita.ordem} className="border-l-2 pl-3" style={{ borderColor: 'var(--color-primary)' }}>
            <div className="flex items-start justify-between gap-3 text-xs"><span className="font-semibold">{paginaNome(visita.rota)}</span><strong className="shrink-0 tabular-nums">{duracao(visita.segundos)}</strong></div>
            <div className="mt-1 text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{hora(visita.inicio)} – {hora(visita.fim)}</div>
          </li>)}
        </ol>
        {!!dados?.total && <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs" style={{ borderColor: 'var(--color-border)' }}>
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" disabled={pagina === 0 || query.isFetching} onClick={() => setPagina(p => p - 1)}>Anterior</button>
          <span>{pagina + 1}/{Math.max(1, Math.ceil(dados.total / 10))} · {dados.total} acessos</span>
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" disabled={(pagina + 1) * 10 >= dados.total || query.isFetching} onClick={() => setPagina(p => p + 1)}>Próxima</button>
        </div>}
      </PopoverContent>
    </Popover>
  );
}
