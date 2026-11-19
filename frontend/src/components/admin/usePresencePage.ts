import { useState } from 'react';
import type { UsuarioAdmin } from '../../types/access';

export type PessoaPresente = Pick<UsuarioAdmin, 'id' | 'nome' | 'email' | 'ultimaAtividade' | 'ultimaRotaAcessada'>;
const PESSOAS_POR_PAGINA = 5;

export function usePresencePage<T extends PessoaPresente>(pessoas: T[]) {
  const [requestedPage, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(pessoas.length / PESSOAS_POR_PAGINA));
  const page = Math.min(requestedPage, totalPages);
  // Se o pulso remove a última página, não volte a ela quando a lista crescer novamente.
  if (page !== requestedPage) setPage(page);

  const inicio = (page - 1) * PESSOAS_POR_PAGINA;
  return {
    page,
    totalPages,
    pessoas: pessoas.slice(inicio, inicio + PESSOAS_POR_PAGINA),
    setPage,
    reset: () => setPage(1),
  };
}
