import { useState } from 'react';
import { Download, Pencil } from 'lucide-react';
import { salvarBlobComoArquivo } from '../../../api/downloadArquivo';
import {
  lerSinistros,
  type Periodo,
  type Relacao,
  type Sinistro,
} from '../../../api/endpoints/ocorrenciasSinistros';
import { formatarData, formatarMoeda, formatarNumero } from '../../../utils/formatadores';

const colunas = [
  ['numero', 'Nº do sinistro'],
  ['ocorrido', 'Data da ocorrência'],
  ['abertura', 'Data de abertura'],
  ['status', 'Status do sinistro'],
  ['finalizacao', 'Data da finalização'],
  ['cliente', 'Cliente (pagador)'],
  ['minutas', 'Nº da minuta'],
  ['notas', 'Nº da NF'],
  ['valorNf', 'Valor total NF'],
  ['seguradora', 'Seguradora'],
  ['processo', 'Nº do processo da corretora'],
  ['statusCorretora', 'Status do processo da corretora'],
  ['prejuizo', 'Prejuízo'],
  ['aReceber', 'Valor a receber da seguradora'],
  ['franquia', 'Franquia da seguradora'],
  ['salvados', 'Venda de salvados'],
  ['sinistralidade', 'Sinistralidade'],
  ['sinistralidadeReal', 'Sinistralidade real'],
] as const;
type Campo = (typeof colunas)[number][0];
function apresentar(linha: Sinistro, campo: Campo) {
  const valor = linha[campo];
  if (valor === null || valor === '') return '—';
  if (campo === 'numero') return String(valor);
  if (typeof valor === 'number') {
    const saldo = campo === 'sinistralidade' || campo === 'sinistralidadeReal';
    return formatarMoeda(valor) + (saldo && linha.saldoParcial ? ' (parcial)' : '');
  }
  if (campo === 'ocorrido' || campo === 'abertura' || campo === 'finalizacao') return formatarData(valor);
  return valor;
}
function csvSeguro(texto: string) {
  const valor = /^\s*[=+@-]/.test(texto) || /^[\t\r]/.test(texto) ? "'" + texto : texto;
  return '"' + valor.replaceAll('"', '""') + '"';
}
export default function RelacaoSinistros({
  periodo,
  relacao,
  pagina,
  setPagina,
  editar,
}: {
  periodo: Periodo;
  relacao: Relacao;
  pagina: number;
  setPagina: (p: number) => void;
  editar?: (s: Sinistro) => void;
}) {
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState('');
  const paginas = Math.max(1, Math.ceil(relacao.total / 25));
  async function exportar() {
    if (exportando) return;
    setExportando(true);
    setErro('');
    try {
      const todas: Sinistro[] = [];
      for (let p = 0; p < paginas; p++) {
        const dados = p === pagina ? relacao : await lerSinistros(periodo, p);
        todas.push(...dados.linhas);
      }
      if (new Set(todas.map((l) => l.numero)).size !== relacao.total || todas.length !== relacao.total)
        throw new Error('Relação atualizada');
      const texto = [
        colunas.map(([, titulo]) => titulo),
        ...todas.map((l) => colunas.map(([campo]) => apresentar(l, campo))),
      ]
        .map((l) => l.map(csvSeguro).join(';'))
        .join('\r\n');
      salvarBlobComoArquivo(
        new Blob(['\uFEFF', texto], { type: 'text/csv;charset=utf-8;' }),
        'sinistros-' + periodo.dataInicio + '-' + periodo.dataFim + '.csv',
      );
    } catch {
      setErro('Não foi possível exportar a relação completa. Tente novamente.');
    } finally {
      setExportando(false);
    }
  }
  return (
    <section className="os-relacao" aria-label="Relação de sinistros">
      <header>
        <div>
          <h2>Relação de sinistros</h2>
          <span>{formatarNumero(relacao.total)} sinistros no período</span>
        </div>
        <button
          className="os-botao"
          type="button"
          disabled={exportando || !relacao.total}
          onClick={() => void exportar()}
        >
          <Download size={15} />
          {exportando ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </header>
      {erro && <p role="alert">{erro}</p>}
      <div className="os-scroll" role="region" aria-label="Dados da relação de sinistros" tabIndex={0}>
        <table>
          <thead>
            <tr>
              {colunas.map(([c, n]) => (
                <th key={c} scope="col">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {relacao.linhas.map((l) => (
              <tr key={l.numero}>
                {colunas.map(([campo]) => (
                  <td key={campo}>
                    {campo === 'numero' && editar ? (
                      <button
                        className="os-editar"
                        type="button"
                        aria-label={'Editar sinistro ' + l.numero}
                        onClick={() => editar(l)}
                      >
                        {l.numero}
                        <Pencil size={12} />
                      </button>
                    ) : campo === 'status' || campo === 'statusCorretora' ? (
                      <span className={'os-status ' + (l[campo] === 'Finalizado' ? 'os-finalizado' : '')}>
                        {l[campo]}
                      </span>
                    ) : (
                      apresentar(l, campo)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!relacao.linhas.length && <p>Nenhum sinistro neste período.</p>}
      <footer>
        <small>
          O saldo acumula os sinistros da vigência. “Parcial” indica dias sem cobertura de dados ou sinistros
          com apólice por identificar.
        </small>
        {paginas > 1 && (
          <nav aria-label="Paginação de sinistros">
            <button className="os-botao" disabled={!pagina} onClick={() => setPagina(pagina - 1)}>
              Anterior
            </button>
            <span>
              {pagina + 1} de {paginas}
            </span>
            <button
              className="os-botao"
              disabled={pagina + 1 >= paginas}
              onClick={() => setPagina(pagina + 1)}
            >
              Próxima
            </button>
          </nav>
        )}
      </footer>
    </section>
  );
}
