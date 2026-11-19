import { Grid } from '@astryxdesign/core/Grid';
import DashboardLoading from '../shared/DashboardLoading';
import { DashboardInput } from "../shared/DashboardTextEntry";
import DashboardButton from "../shared/DashboardButton";
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import DashboardAdaptiveDialog from '../shared/DashboardAdaptiveDialog';
import { ChevronDown, ChevronUp, Play, Plus, Trash2, X } from 'lucide-react';
import { criarApresentacao, excluirApresentacao, listarApresentacoes } from '../../api/endpoints/apresentacoesServico';
import type { ApresentacaoSequencia } from '../../types/apresentacao';

export interface PresentationPageOption { id: string; label: string; }

interface PresentationSequencesModalProps {
  open: boolean;
  paginasDisponiveis: PresentationPageOption[];
  onClose: () => void;
  onStart: (paginas: string[]) => void;
}

export default function PresentationSequencesModal({ open, paginasDisponiveis, onClose, onStart }: PresentationSequencesModalProps) {
  const [sequencias, setSequencias] = useState<ApresentacaoSequencia[]>([]);
  const [nome, setNome] = useState('Nova apresentação');
  const [paginas, setPaginas] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const paginasPorId = useMemo(() => new Map(paginasDisponiveis.map((pagina) => [pagina.id, pagina])), [paginasDisponiveis]);

  useEffect(() => {
    if (!open) return;
    setCarregando(true);
    void listarApresentacoes().then(setSequencias).catch(() => setSequencias([])).finally(() => setCarregando(false));
  }, [open]);

  if (!open) return null;

  const alternarPagina = (id: string) => setPaginas((atual) => atual.includes(id) ? atual.filter((pagina) => pagina !== id) : [...atual, id]);
  const mover = (indice: number, direcao: -1 | 1) => setPaginas((atual) => {
    const destino = indice + direcao;
    if (destino < 0 || destino >= atual.length) return atual;
    const proxima = [...atual]; [proxima[indice], proxima[destino]] = [proxima[destino], proxima[indice]]; return proxima;
  });
  const salvar = async () => {
    if (!nome.trim() || paginas.length === 0) return;
    setSalvando(true);
    try {
      const sequencia = await criarApresentacao({ nome: nome.trim(), paginas });
      setSequencias((atual) => [sequencia, ...atual]); setNome('Nova apresentação'); setPaginas([]);
    } finally { setSalvando(false); }
  };
  const excluir = async (id: number) => { await excluirApresentacao(id); setSequencias((atual) => atual.filter((sequencia) => sequencia.id !== id)); };

  return (
    <DashboardAdaptiveDialog label="Minhas apresentações" isOpen={open} purpose="info" width={760} aria-labelledby="presentation-sequences-title"
      onOpenChange={next => { if (!next) onClose(); }}>
        <div className="flex items-start justify-between gap-4"><div><h2 id="presentation-sequences-title" className="text-lg font-bold">Minhas apresentações</h2><p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>A sequência padrão permanece fixa; crie versões pessoais com as telas que você pode acessar.</p></div><DashboardButton type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2"><X size={20} /></DashboardButton></div>
        <Grid columns={{ minWidth: 285, max: 2 }} gap={4} className="mt-4 min-w-0 sm:mt-6">
          <Card padding={4} className="min-w-0">
            <h3 className="font-semibold">Criar versão</h3>
            <DashboardInput value={nome} onChange={(event) => setNome(event.target.value)} maxLength={80} className="mt-3 h-10 w-full rounded-lg border px-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }} aria-label="Nome da apresentação" />
            <div className="mt-3 space-y-2">{paginasDisponiveis.map((pagina) => <CheckboxInput key={pagina.id} label={pagina.label} value={paginas.includes(pagina.id)} onChange={() => alternarPagina(pagina.id)} />)}</div>
            {paginas.length > 0 && <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}><p className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>Ordem</p>{paginas.map((id, indice) => <div key={id} className="mt-2 flex items-center justify-between gap-2 text-sm"><span>{indice + 1}. {paginasPorId.get(id)?.label}</span><span><DashboardButton type="button" onClick={() => mover(indice, -1)} disabled={indice === 0} className="p-1 disabled:opacity-30" aria-label="Subir"><ChevronUp size={16} /></DashboardButton><DashboardButton type="button" onClick={() => mover(indice, 1)} disabled={indice === paginas.length - 1} className="p-1 disabled:opacity-30" aria-label="Descer"><ChevronDown size={16} /></DashboardButton></span></div>)}</div>}
            <DashboardButton type="button" onClick={() => void salvar()} disabled={salvando || !nome.trim() || paginas.length === 0} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-40" style={{ backgroundColor: 'var(--color-primary)' }}><Plus size={16} />Salvar versão</DashboardButton>
          </Card>
          <Card padding={4} className="min-w-0"><h3 className="font-semibold">Versões salvas</h3>{carregando ? <DashboardLoading label="Carregando…" /> : sequencias.length === 0 ? <p className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhuma versão criada.</p> : <div className="mt-3 space-y-2">{sequencias.map((sequencia) => <div key={sequencia.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}><p className="font-semibold">{sequencia.nome}</p><p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>{sequencia.paginas.map((id) => paginasPorId.get(id)?.label).filter(Boolean).join(' → ') || 'Sem páginas disponíveis'}</p><div className="mt-3 flex gap-2"><DashboardButton type="button" onClick={() => { onStart(sequencia.paginas.filter((id) => paginasPorId.has(id))); onClose(); }} disabled={sequencia.paginas.every((id) => !paginasPorId.has(id))} className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}><Play size={15} />Iniciar</DashboardButton><DashboardButton type="button" onClick={() => void excluir(sequencia.id)} className="inline-flex items-center gap-1 text-sm text-red-500"><Trash2 size={15} />Excluir</DashboardButton></div></div>)}</div>}</Card>
        </Grid>
    </DashboardAdaptiveDialog>
  );
}
