import { describe, expect, it } from 'vitest';
import { buildPerformanceKpis } from './usePerformanceData';
import type { PerformanceOverview } from '../types/performance';

describe('buildPerformanceKpis', () => {
  it('formata os 9 KPIs principais do dashboard de performance', () => {
    const overview: PerformanceOverview = {
      updatedAt: '2026-05-24T10:00:00',
      totalEntregas: 100,
      finalizadas: 80,
      noPrazo: 76,
      foraDoPrazo: 4,
      performancePercentual: 95,
      emAtraso: 6,
      pesoTaxadoToneladas: 12.345,
      comprovanteAnexadoPercentual: 90,
      valorNfSemComprovante: 1500.5,
    };

    const kpis = buildPerformanceKpis(overview);

    expect(kpis).toHaveLength(9);
    expect(kpis.map((item) => item.label)).toEqual([
      'Total de Entregas',
      'Finalizadas',
      'No Prazo',
      'Fora do Prazo',
      'OTIF - On-Time In-Full',
      'Em Atraso',
      'Peso Taxado (t)',
      'Comprovante Anexado',
      'Valor NF sem Comprovante',
    ]);
    expect(kpis[4]).toMatchObject({ valor: '95,00%', tone: 'positive' });
    expect(kpis[4].helperText).toBeUndefined();
    expect(kpis[6].valor).toBe('12,345 t');
    expect(kpis[7].helperText).toBeUndefined();
    expect(kpis[8].valor).toContain('1.500,50');
  });

  it('protege os cards contra overview ausente', () => {
    const kpis = buildPerformanceKpis(undefined);

    expect(kpis).toHaveLength(9);
    expect(kpis[0].valor).toBe('0');
    expect(kpis[4].valor).toBe('0,00%');
    expect(kpis[7].valor).toBe('0,00%');
  });
});
