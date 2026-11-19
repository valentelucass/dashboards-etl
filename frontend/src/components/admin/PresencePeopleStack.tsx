import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { Clock3, MapPin } from 'lucide-react';
import { formatarDataHoraMinuto } from '../../utils/formatadores';
import PeoplePagination from './PeoplePagination';
import type { PessoaPresente, usePresencePage } from './usePresencePage';

function formatTempoUltimoPulso(valor: string | null): string {
  const timestamp = valor ? new Date(valor).getTime() : 0;
  if (!timestamp) return 'Sem pulso registrado';

  const segundos = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (segundos < 10) return 'Sinal recebido agora';
  if (segundos < 60) return `Último sinal há ${segundos}s`;

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Último sinal há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  return `Último sinal há ${horas}h ${minutos % 60}min`;
}

export default function PresencePeopleStack({ pagina, online, aberta, onOpen, onHistory }: {
  pagina: ReturnType<typeof usePresencePage>;
  online: boolean;
  aberta: string | null;
  onOpen: (id: string | null) => void;
  onHistory?: (pessoa: PessoaPresente) => void;
}) {
  return (
    <>
      <PeoplePagination
        label={online ? 'Paginação de pessoas online' : 'Paginação de pessoas vistas recentemente'}
        page={pagina.page} totalPages={pagina.totalPages}
        onChange={proxima => {
          if (pagina.pessoas.some(pessoa => pessoa.id === aberta)) onOpen(null);
          pagina.setPage(proxima);
        }}
      />
      <div className="admin-presence-stack">
        {pagina.pessoas.map(pessoa => (
          <Card key={pessoa.id} padding={0} className="admin-presence-sheet" data-open={aberta === pessoa.id}>
            <Collapsible isOpen={aberta === pessoa.id} onOpenChange={open => onOpen(open ? pessoa.id : null)}
              id={`presenca-pessoa-${pessoa.id}`}
              trigger={<span className="admin-presence-identity">
                <span aria-hidden="true" className="admin-presence-avatar" data-online={online}>{pessoa.nome.trim().charAt(0).toUpperCase() || '?'}</span>
                <span className="wrap-anywhere">{pessoa.nome}</span>
              </span>}>
              <div className="admin-presence-details">
                <p className="min-w-0 wrap-anywhere">{pessoa.email}</p>
                <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-2">
                  <span className="inline-flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />{online ? formatTempoUltimoPulso(pessoa.ultimaAtividade) : pessoa.ultimaAtividade ? formatarDataHoraMinuto(pessoa.ultimaAtividade) : 'Sem atividade registrada'}</span>
                  {pessoa.ultimaRotaAcessada && <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin size={14} className="shrink-0" aria-hidden="true" /><span className="wrap-anywhere">{pessoa.ultimaRotaAcessada}</span></span>}
                </div>
                {onHistory && <Button variant="secondary" size="sm" id={`presenca-historico-${pessoa.id}`}
                  label="Ver acessos de hoje" onClick={() => onHistory(pessoa)} />}
              </div>
            </Collapsible>
          </Card>
        ))}
      </div>
    </>
  );
}
