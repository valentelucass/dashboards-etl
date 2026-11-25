import { useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Check, X } from 'lucide-react';
import DashboardSelector from '../../shared/DashboardSelector';
import {
  alterarCampoSinistro,
  statusCorretora,
  type CampoAcompanhamento,
  type Sinistro,
} from '../../../api/endpoints/ocorrenciasSinistros';
import { formatarNumero } from '../../../utils/formatadores';

function valorDecimal(texto: string) {
  if (!texto.trim()) return '';
  const entrada = texto.trim().replace(/^R\$\s*/i, '');
  const agrupado = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(entrada);
  const decimal = (agrupado ? entrada.replaceAll('.', '') : entrada).replace(',', '.');
  return /^\d{1,15}(?:\.\d{1,2})?$/.test(decimal) ? decimal : undefined;
}

export default function CelulaAcompanhamento({
  linha,
  campo,
  rotulo,
  atualizar,
}: {
  linha: Sinistro;
  campo: CampoAcompanhamento;
  rotulo: string;
  atualizar: () => Promise<void>;
}) {
  const [rascunho, setRascunho] = useState<{ texto: string; revisao: number } | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const emCurso = useRef(false);
  const nome = rotulo + ' do sinistro ' + linha.numero;
  function cancelar() {
    setRascunho(null);
    setErro('');
  }
  async function gravar(valor: string, revisao: number) {
    if (emCurso.current) return;
    emCurso.current = true;
    setEnviando(valor);
    setErro('');
    try {
      await alterarCampoSinistro(linha.numero, campo, valor, revisao);
      await atualizar();
      setRascunho(null);
    } catch (falha) {
      if (isAxiosError(falha) && falha.response?.status === 409) {
        setRascunho(null);
        setErro('Este sinistro mudou. Confira o valor atualizado antes de editar novamente.');
        await atualizar();
      } else {
        setErro('Não foi possível salvar. Tente novamente.');
      }
    } finally {
      emCurso.current = false;
      setEnviando(null);
    }
  }
  return (
    <div className="os-celula-edicao" aria-busy={enviando !== null}>
      {campo === 'statusCorretora' ? (
        <DashboardSelector
          aria-label={nome}
          value={enviando ?? linha.statusCorretora}
          disabled={enviando !== null}
          onValueChange={(valor) => {
            if (valor !== linha.statusCorretora) void gravar(valor, linha.revisao);
          }}
        >
          {statusCorretora.map((opcao) => (
            <option key={opcao} value={opcao}>
              {opcao}
            </option>
          ))}
        </DashboardSelector>
      ) : (
        <form
          className="os-edicao-moeda"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (!rascunho) return;
            const valor = valorDecimal(rascunho.texto);
            if (valor === undefined) setErro('Informe um valor em reais, por exemplo 1.234,56.');
            else void gravar(valor, rascunho.revisao);
          }}
        >
          <label>
            <span aria-hidden="true">R$</span>
            <input
              type="text"
              inputMode="decimal"
              aria-label={nome + ' em reais'}
              aria-invalid={Boolean(erro && rascunho)}
              placeholder="—"
              autoComplete="off"
              value={rascunho?.texto ?? (linha[campo] == null ? '' : formatarNumero(linha[campo], 2))}
              disabled={enviando !== null}
              onFocus={(evento) => evento.currentTarget.select()}
              onChange={(evento) => {
                setErro('');
                setRascunho({ texto: evento.target.value, revisao: rascunho?.revisao ?? linha.revisao });
              }}
              onKeyDown={(evento) => {
                if (evento.key === 'Escape') {
                  evento.preventDefault();
                  cancelar();
                }
              }}
            />
          </label>
          {rascunho && (
            <>
              <button type="submit" disabled={enviando !== null} aria-label={'Salvar ' + nome} title="Salvar">
                <Check size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={enviando !== null}
                onClick={cancelar}
                aria-label={'Cancelar ' + nome}
                title="Cancelar"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </>
          )}
        </form>
      )}
      {erro && (
        <span role="alert" className="os-erro-celula">
          {erro}
        </span>
      )}
    </div>
  );
}
