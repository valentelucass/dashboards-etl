import type { Sinistro } from '../../../api/endpoints/ocorrenciasSinistros';
import type { TableFilterField, TableFilters } from '../../../types/tableFilters';
import { formatarData, formatarMoeda } from '../../../utils/formatadores';

interface Campo {
  chave: Exclude<keyof Sinistro, 'saldoParcial' | 'revisao'>;
  label: string;
  largura?: string;
  tipo?: 'data' | 'moeda';
  filtroTabela?: TableFilterField;
  fixo?: boolean;
  tooltip?: string;
}

const explicacaoSaldo =
  'Saldo acumulado na vigência da apólice. Parcial indica dias sem cobertura de dados ou sinistros com apólice por identificar.';

export const camposSinistros: Campo[] = [
  { chave: 'numero', label: 'Nº do sinistro', largura: '145px', fixo: true, filtroTabela: 'codigo' },
  { chave: 'ocorrido', label: 'Data da ocorrência', tipo: 'data', largura: '160px' },
  { chave: 'abertura', label: 'Data de abertura', tipo: 'data' },
  { chave: 'status', label: 'Status do sinistro', largura: '165px', filtroTabela: 'status' },
  { chave: 'finalizacao', label: 'Data da finalização', tipo: 'data', largura: '165px' },
  { chave: 'cliente', label: 'Cliente (pagador)', largura: '270px', filtroTabela: 'razaoSocial' },
  { chave: 'minutas', label: 'Nº da minuta' },
  { chave: 'notas', label: 'Nº da NF' },
  { chave: 'valorNf', label: 'Valor total NF', tipo: 'moeda' },
  { chave: 'seguradora', label: 'Seguradora', largura: '190px' },
  { chave: 'processo', label: 'Nº do processo da corretora', largura: '210px' },
  { chave: 'statusCorretora', label: 'Status do processo da corretora', largura: '235px' },
  { chave: 'prejuizo', label: 'Prejuízo', tipo: 'moeda' },
  { chave: 'aReceber', label: 'Valor a receber da seguradora', tipo: 'moeda', largura: '225px' },
  { chave: 'franquia', label: 'Franquia da seguradora', tipo: 'moeda', largura: '190px' },
  { chave: 'salvados', label: 'Venda de salvados', tipo: 'moeda', largura: '170px' },
  {
    chave: 'sinistralidade',
    label: 'Sinistralidade',
    tipo: 'moeda',
    largura: '185px',
    tooltip: explicacaoSaldo,
  },
  {
    chave: 'sinistralidadeReal',
    label: 'Sinistralidade real',
    tipo: 'moeda',
    largura: '185px',
    tooltip: explicacaoSaldo,
  },
];

export function apresentarCampo(linha: Sinistro, campo: Campo): string {
  const valor = linha[campo.chave];
  if (valor == null || valor === '') return '—';
  if (campo.tipo === 'data') return formatarData(String(valor));
  if (campo.tipo === 'moeda') {
    const parcial =
      (campo.chave === 'sinistralidade' || campo.chave === 'sinistralidadeReal') && linha.saldoParcial;
    return formatarMoeda(Number(valor)) + (parcial ? ' (parcial)' : '');
  }
  return String(valor);
}

function normalizar(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function corresponde(linha: Sinistro, campo: Campo, termo: string) {
  return (
    normalizar(linha[campo.chave]).includes(termo) ||
    normalizar(apresentarCampo(linha, campo)).includes(termo)
  );
}

export function filtrarSinistros(linhas: Sinistro[], filtros: TableFilters) {
  const busca = normalizar(filtros.busca);
  const codigo = normalizar(filtros.codigo);
  const cliente = normalizar(filtros.razaoSocial);
  const status = filtros.status?.map(normalizar) ?? [];
  const porColuna = camposSinistros.flatMap((campo) => {
    const entrada = filtros.columnFilters?.[campo.chave];
    const valores = (Array.isArray(entrada) ? entrada : [entrada]).map(normalizar).filter(Boolean);
    return valores.length ? [{ campo, valores }] : [];
  });
  return linhas.filter(
    (linha) =>
      (!codigo || String(linha.numero).includes(codigo)) &&
      (!cliente || normalizar(linha.cliente).includes(cliente)) &&
      (!status.length || status.includes(normalizar(linha.status))) &&
      (!busca || camposSinistros.some((campo) => corresponde(linha, campo, busca))) &&
      porColuna.every(({ campo, valores }) =>
        campo.chave === 'status'
          ? valores.includes(normalizar(linha.status))
          : valores.some((termo) => corresponde(linha, campo, termo)),
      ),
  );
}

const compararTexto = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
export function ordenarSinistros(linhas: Sinistro[], chave: keyof Sinistro | null, direcao: 'asc' | 'desc') {
  if (!chave) return linhas;
  return [...linhas].sort((a, b) => {
    const x = a[chave],
      y = b[chave];
    if (x == null || y == null) return Number(x == null) - Number(y == null);
    const diferenca =
      typeof x === 'number' && typeof y === 'number' ? x - y : compararTexto.compare(String(x), String(y));
    return direcao === 'asc' ? diferenca : -diferenca;
  });
}

function celulaCsv(texto: string) {
  const seguro = /^\s*[=+@-]/.test(texto) || /^[\t\r]/.test(texto) ? "'" + texto : texto;
  return '"' + seguro.replaceAll('"', '""') + '"';
}

export function gerarCsvSinistros(linhas: Sinistro[]) {
  const registros = [
    camposSinistros.map((c) => c.label),
    ...linhas.map((l) => camposSinistros.map((c) => apresentarCampo(l, c))),
  ];
  return '\uFEFF' + registros.map((celulas) => celulas.map(celulaCsv).join(';')).join('\r\n');
}
