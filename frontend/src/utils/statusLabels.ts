export const STATUS_OPERACIONAL_LABELS: Record<string, string> = {
  pending: 'Pendente',
  pendente: 'Pendente',
  sem_status: 'Sem status',
  in_transit: 'Em Trânsito',
  em_transito: 'Em Trânsito',
  transit: 'Em Trânsito',
  in_transfer: 'Em Transferência',
  transferring: 'Em Transferência',
  em_transferencia: 'Em Transferência',
  delivering: 'Em Entrega',
  out_for_delivery: 'Em Entrega',
  em_entrega: 'Em Entrega',
  manifested: 'Manifestado',
  manifestado: 'Manifestado',
  manifestada: 'Manifestada',
  delivered: 'Entregue',
  entregue: 'Entregue',
  finished: 'Entregue',
  finalized: 'Finalizado',
  finalizado: 'Finalizado',
  finalizada: 'Finalizada',
  completed: 'Concluído',
  complete: 'Concluído',
  concluido: 'Concluído',
  em_execucao: 'Em andamento',
  sem_atualizacao: 'Sem atualização recente',
  encerrado: 'Encerrado',
  encerrada: 'Encerrada',
  canceled: 'Cancelado',
  cancelled: 'Cancelado',
  cancelado: 'Cancelado',
  cancelada: 'Cancelada',
  in_treatment: 'Em Tratativa',
  em_tratativa: 'Em Tratativa',
  waiting: 'Aguardando',
  aguardando: 'Aguardando',
  no_prazo: 'No Prazo',
  fora_do_prazo: 'Fora do Prazo',
  em_aberto: 'Em aberto',
};

function normalizarStatusKey(status: string): string {
  return status
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function formatarStatusOperacional(status: unknown): string {
  if (status == null) {
    return '';
  }

  const texto = String(status).trim();
  if (!texto) {
    return '';
  }

  return STATUS_OPERACIONAL_LABELS[normalizarStatusKey(texto)] ?? texto;
}
