import clienteAxios from '../clienteAxios';

export interface PeriodoRede {
  dataInicio: string;
  dataFim: string;
}

export interface DesempenhoParceiro {
  filial: string;
  otif: number | null;
  efd: number | null;
  otifNoPrazo: number;
  otifTotal: number;
  efdEficientes: number;
  efdTotal: number;
}

export interface OperacaoRede {
  coberturaArquivos: {
    diasCobertos: number;
    diasSolicitados: number;
    completa: boolean;
  };
  entregas: {data: string; parceiro: string; finalizadas: number; anexadas: number; arquivadas: number | null}[];
  coletas: {data: string; parceiro: string; finalizadas: number; noPrazo: number}[];
}

export interface ValoresConsolidacao {
  consolidacoes: number;
  cobradoCentavos: number;
  calculadoCentavos: number;
  semCobrado: number;
  semCalculado: number;
  calculadoZero: number;
}

export interface CustosRede {
  diasCobertos: number;
  diasSolicitados: number;
  totais: ValoresConsolidacao & {
    freteVinculadoCentavos: number;
    fretesVinculados: number;
    cobradoVinculadoCentavos: number;
    consolidacoesSemFrete: number;
  };
  linhas: (ValoresConsolidacao & {dia: string; status: string; parceiro: string})[];
}

const BASE = '/api/painel/rede-credenciada';

export async function buscarDesempenhoRede(periodo: PeriodoRede, signal?: AbortSignal) {
  const resposta = await clienteAxios.get<DesempenhoParceiro[]>(`${BASE}/desempenho`, { params: periodo, signal });
  return resposta.data;
}

export async function buscarOperacaoRede(periodo: PeriodoRede, signal?: AbortSignal) {
  const resposta = await clienteAxios.get<OperacaoRede>(`${BASE}/operacional`, { params: periodo, signal });
  return resposta.data;
}

export async function buscarCustosRede(periodo: PeriodoRede, parceiros: string[], situacoes: string[], signal?: AbortSignal) {
  const params = new URLSearchParams({dataInicio: periodo.dataInicio, dataFim: periodo.dataFim});
  for (const parceiro of parceiros) params.append('parceiros', parceiro);
  for (const situacao of situacoes) params.append('status', situacao);
  const resposta = await clienteAxios.get<CustosRede>(`${BASE}/custos`, { params, signal });
  return resposta.data;
}
