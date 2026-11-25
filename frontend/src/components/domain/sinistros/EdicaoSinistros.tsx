import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import DashboardAdaptiveDialog from '../../shared/DashboardAdaptiveDialog';
import {
  lerApolices,
  salvarAcompanhamento,
  salvarApolice,
  statusCorretora,
  dominioSinistros,
  type Apolice,
  type Sinistro,
} from '../../../api/endpoints/ocorrenciasSinistros';
import { formatarData, formatarMoeda } from '../../../utils/formatadores';

function mensagem(erro: unknown) {
  if (isAxiosError(erro) && typeof erro.response?.data?.mensagem === 'string')
    return erro.response.data.mensagem;
  if (isAxiosError(erro) && erro.response?.status === 409)
    return 'O cadastro mudou ou a vigência já existe. Reabra os dados para conferir.';
  return 'Não foi possível salvar. Confira os valores e tente novamente.';
}

export function EditarSinistro({
  linha,
  fechar,
  salvou,
}: {
  linha: Sinistro;
  fechar: () => void;
  salvou: () => Promise<void>;
}) {
  const [status, setStatus] = useState(linha.statusCorretora);
  const [franquia, setFranquia] = useState(linha.franquia?.toString() ?? '');
  const [salvados, setSalvados] = useState(linha.salvados?.toString() ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    setErro('');
    try {
      await salvarAcompanhamento(linha.numero, {
        statusCorretora: status,
        franquia: franquia === '' ? null : Number(franquia),
        salvados: salvados === '' ? null : Number(salvados),
        revisao: linha.revisao,
      });
      await salvou();
      fechar();
    } catch (falha) {
      setErro(mensagem(falha));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <DashboardAdaptiveDialog
      isOpen
      label={'Editar sinistro ' + linha.numero}
      onOpenChange={(aberto) => {
        if (!aberto && !salvando) fechar();
      }}
    >
      <form className="os-formulario" onSubmit={enviar}>
        <h2>Sinistro {linha.numero}</h2>
        <label>
          Status do processo da corretora
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {statusCorretora.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Franquia da seguradora (R$)
          <input
            type="number"
            min="0"
            step="0.01"
            max="999999999999999.99"
            value={franquia}
            onChange={(e) => setFranquia(e.target.value)}
          />
        </label>
        <label>
          Venda de salvados (R$)
          <input
            type="number"
            min="0"
            step="0.01"
            max="999999999999999.99"
            value={salvados}
            onChange={(e) => setSalvados(e.target.value)}
          />
        </label>
        {erro && <p role="alert">{erro}</p>}
        <div className="os-acoes">
          <button className="os-botao" type="button" disabled={salvando} onClick={fechar}>
            Cancelar
          </button>
          <button className="os-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </DashboardAdaptiveDialog>
  );
}

function FormularioApolice({
  atual,
  salvou,
  cancelar,
}: {
  atual?: Apolice;
  salvou: () => Promise<void>;
  cancelar: () => void;
}) {
  const [numero, setNumero] = useState(atual?.numero ?? '');
  const [inicio, setInicio] = useState(atual?.inicio ?? '');
  const [fim, setFim] = useState(atual?.fim ?? '');
  const [valor, setValor] = useState(atual?.valorSegurado.toString() ?? '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    setErro('');
    try {
      await salvarApolice({
        id: atual?.id,
        numero: numero.trim(),
        inicio,
        fim,
        valorSegurado: Number(valor),
        revisao: atual?.revisao ?? 0,
      });
      await salvou();
    } catch (falha) {
      setErro(mensagem(falha));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <form className="os-formulario" onSubmit={enviar}>
      <label>
        Número da apólice
        <input required maxLength={120} value={numero} onChange={(e) => setNumero(e.target.value)} />
      </label>
      <div className="os-datas">
        <label>
          Início da vigência
          <input required type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label>
          Fim da vigência
          <input required type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} />
        </label>
      </div>
      <label>
        Valor segurado (R$)
        <input
          required
          type="number"
          min="0.01"
          step="0.01"
          max="999999999999999.99"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
      </label>
      {erro && <p role="alert">{erro}</p>}
      <div className="os-acoes">
        <button type="button" className="os-botao" disabled={salvando} onClick={cancelar}>
          Voltar
        </button>
        <button className="os-primario" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar apólice'}
        </button>
      </div>
    </form>
  );
}

export function GerenciarApolices({ fechar, salvou }: { fechar: () => void; salvou: () => Promise<void> }) {
  const lista = useQuery({
    queryKey: [dominioSinistros, 'apolices'],
    queryFn: ({ signal }) => lerApolices(signal),
  });
  const [editando, setEditando] = useState<Apolice | 'nova'>();
  return (
    <DashboardAdaptiveDialog
      label="Apólices"
      isOpen
      onOpenChange={(aberto) => {
        if (!aberto) fechar();
      }}
    >
      <div className="os-formulario">
        <h2>Apólices</h2>
        {editando ? (
          <FormularioApolice
            atual={editando === 'nova' ? undefined : editando}
            cancelar={() => setEditando(undefined)}
            salvou={async () => {
              await Promise.all([lista.refetch(), salvou()]);
              setEditando(undefined);
            }}
          />
        ) : (
          <>
            {lista.isLoading && <p role="status">Carregando apólices…</p>}
            {lista.isError && (
              <p role="alert">
                Não foi possível consultar as apólices.{' '}
                <button type="button" onClick={() => void lista.refetch()}>
                  Tentar novamente
                </button>
              </p>
            )}
            {lista.data?.length === 0 && <p>Nenhuma apólice cadastrada.</p>}
            {lista.data?.map((item) => (
              <button className="os-apolice" type="button" key={item.id} onClick={() => setEditando(item)}>
                <strong>{item.numero}</strong>
                <span>
                  {formatarData(item.inicio)} – {formatarData(item.fim)}
                </span>
                <b>{formatarMoeda(item.valorSegurado)}</b>
              </button>
            ))}
            <div className="os-acoes">
              <button className="os-botao" type="button" onClick={fechar}>
                Fechar
              </button>
              <button className="os-primario" type="button" onClick={() => setEditando('nova')}>
                Cadastrar apólice
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardAdaptiveDialog>
  );
}
