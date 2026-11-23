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

  it('mantém bloqueios e cálculos zerados na conferência e fora das séries financeiras', () => {
    const linha = {dia: '2026-10-29', status: 'Faturada', parceiro: 'Parceiro anterior', consolidacoes: 1,
      cobradoCentavos: 4491, calculadoCentavos: 5240, semCobrado: 0, semCalculado: 0, calculadoZero: 0};
    const custos = {diasCobertos: 1, diasSolicitados: 1,
      totais: {...linha, freteVinculadoCentavos: 10000, fretesVinculados: 1, cobradoVinculadoCentavos: 4491, consolidacoesSemFrete: 0},
      linhas: [linha, {...linha, status: 'Bloqueada', conferencia: 'Bloqueada', calculadoCentavos: 0},
        {...linha, conferencia: 'Cálculo zerado', calculadoCentavos: 0}]};
    const resumo = resumirRede([], undefined, custos, []);
    expect(resumo.dias).toEqual([{dia: linha.dia, cobrado: 44.91, calculado: 52.4, diferenca: expect.closeTo(-7.49)}]);
    expect(resumo.conferencia.size).toBe(2);
    expect(resumo.conferencia.get('Bloqueada')?.consolidacoes).toBe(1);
  });

  it('preserva cálculo de custo zero, dados faltantes e diferença negativa', () => {
    const valores = {consolidacoes: 1, cobradoCentavos: 0, calculadoCentavos: 150, semCobrado: 0, semCalculado: 0, calculadoZero: 0};
    expect(valoresFinanceiros(valores)).toEqual({ cobrado: 0, calculado: 1.5, diferenca: -1.5 });
    expect(valoresFinanceiros({...valores, semCalculado: 1}).diferenca).toBeNull();
    expect(percentual(0, 0)).toBeNull();
  });
});
