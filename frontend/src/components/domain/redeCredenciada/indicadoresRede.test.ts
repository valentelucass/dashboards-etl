import { describe, expect, it } from 'vitest';
import { percentual, resumirRede, valoresFinanceiros } from './indicadoresRede';
import type { DesempenhoParceiro, OperacaoRede } from '../../../api/endpoints/redeCredenciadaServico';

const desempenho: DesempenhoParceiro[] = [
  { filial: 'SJK', otif: 100, efd: 100, otifNoPrazo: 1, otifTotal: 1, efdEficientes: 1, efdTotal: 1 },
  { filial: 'SOR', otif: 0, efd: null, otifNoPrazo: 0, otifTotal: 3, efdEficientes: 0, efdTotal: 0 },
];
const operacao: OperacaoRede = {
  coberturaArquivos: { diasCobertos: 0, diasSolicitados: 1, completa: false },
  entregas: [{ data: '2026-11-10', parceiro: 'SOR', finalizadas: 1, anexadas: 0, arquivadas: null }],
  coletas: [{ data: '2026-11-10', parceiro: 'SOR', finalizadas: 2, noPrazo: 1 }],
};

describe('Rede Credenciada', () => {
  it('pondera as etapas e entregas e distingue cobertura incompleta de zero medido', () => {
    const resultado = resumirRede(desempenho, operacao, undefined, []);
    expect(resultado.taxas).toEqual({ otif: 25, efd: 100, coleta: 50, anexado: 0, arquivado: null });
    expect(resultado.parceiros[1].calculado).toBeNull();
  });

  it('filtra todas as medidas pelo parceiro e mantém sem base quando não há etapas', () => {
    const resultado = resumirRede(desempenho, operacao, undefined, ['SOR']);
    expect(resultado.taxas).toEqual({ otif: 0, efd: null, coleta: 50, anexado: 0, arquivado: null });
    expect(resultado.parceiros.map(p => p.nome)).toEqual(['SOR']);
  });

  it('preserva cálculo de custo zero, dados faltantes e diferença negativa', () => {
    const valores = {consolidacoes: 1, cobradoCentavos: 0, calculadoCentavos: 150, semCobrado: 0, semCalculado: 0, calculadoZero: 0};
    expect(valoresFinanceiros(valores)).toEqual({ cobrado: 0, calculado: 1.5, diferenca: -1.5 });
    expect(valoresFinanceiros({...valores, semCalculado: 1}).diferenca).toBeNull();
    expect(percentual(0, 0)).toBeNull();
  });
});
