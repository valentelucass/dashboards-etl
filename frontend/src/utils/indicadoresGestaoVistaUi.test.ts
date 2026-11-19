import { describe, expect, it } from 'vitest';
import {
  aggregateCubagemRanking,
  aggregateHorariosRanking,
  aggregateIndenizacaoRanking,
  aggregatePerformanceRanking,
  aggregateUtilizacaoRanking,
  avaliarMetaIndicador,
  calcularProgressoMeta,
  getGoalToneStyle,
} from './indicadoresGestaoVistaUi';

describe('indicadoresGestaoVistaUi', () => {
  it('avalia meta minima corretamente', () => {
    expect(avaliarMetaIndicador({
      value: 92,
      threshold: 95,
      mode: 'atLeast',
      hasData: true,
    })).toEqual({
      tone: 'warning',
      label: 'Em atenção',
      met: false,
      delta: -3,
      progressPct: 96.8,
    });
  });

  it('avalia limite maximo corretamente', () => {
    expect(avaliarMetaIndicador({
      value: 0.18,
      threshold: 0.2,
      mode: 'atMost',
      hasData: true,
    })).toEqual({
      tone: 'positive',
      label: 'Dentro da meta',
      met: true,
      delta: -0.02,
      progressPct: 100,
    });
  });

  it('marca indicador como critico quando fica abaixo de 50% da meta', () => {
    expect(avaliarMetaIndicador({
      value: 40,
      threshold: 95,
      mode: 'atLeast',
      hasData: true,
    })).toEqual({
      tone: 'negative',
      label: 'Crítico',
      met: false,
      delta: -55,
      progressPct: 42.1,
    });
  });

  it('usa amarelo quando indicador percentual fica entre 50% e abaixo da meta', () => {
    expect(avaliarMetaIndicador({
      value: 50,
      threshold: 90,
      mode: 'atLeast',
      hasData: true,
    })).toMatchObject({
      tone: 'warning',
      label: 'Em atenção',
      met: false,
      delta: -40,
    });
  });

  it('calcula progresso invertido para metas de teto', () => {
    expect(calcularProgressoMeta(0.3, 0.2, 'atMost')).toBe(66.7);
  });

  it('usa amarelo no tom de atencao para nao confundir com vermelho', () => {
    expect(getGoalToneStyle('warning')).toMatchObject({
      border: 'var(--color-warning-border, #facc15)',
      text: 'var(--color-warning-text, #713f12)',
      fill: 'var(--color-warning-fill, #facc15)',
    });
    expect(getGoalToneStyle('empty')).toMatchObject({
      border: 'var(--color-warning-border, #facc15)',
      text: 'var(--color-warning-text, #713f12)',
      fill: 'var(--color-warning-fill, #facc15)',
    });
  });

  it('mantem performance agregada pelo SQL por label dinamico', () => {
    const ranking = aggregatePerformanceRanking([
      { label: 'SPO', filtro: 'SPO', visao: 'RESPONSAVEL', totalEntregas: 15, finalizadas: 15, entregasNoPrazo: 9, entregasForaDoPrazo: 6, pctNoPrazo: 60 },
    ]);

    expect(ranking).toEqual([
      {
        group: 'SPO',
        filtro: 'SPO',
        totalEntregas: 15, finalizadas: 15,
        entregasNoPrazo: 9,
        entregasForaDoPrazo: 6,
        pctNoPrazo: 60,
      },
    ]);
  });

  it('agrega utilizacao por filial e classificacao', () => {
    const ranking = aggregateUtilizacaoRanking([
      {
        date: '2026-04-01',
        filial: 'SPO',
        classificacao: 'DISTRIBUIÇÃO',
        manifestosBipados: 6,
        manifestosEmitidos: 5,
        manifestosDescarregamento: 5,
        totalManifestos: 10,
        manifestosIncompletos: 2,
        pctUtilizacao: 60,
      },
      {
        date: '2026-04-02',
        filial: 'SPO',
        classificacao: 'DISTRIBUIÇÃO',
        manifestosBipados: 4,
        manifestosEmitidos: 3,
        manifestosDescarregamento: 2,
        totalManifestos: 5,
        manifestosIncompletos: 1,
        pctUtilizacao: 80,
      },
    ]);

    expect(ranking[0]).toEqual({
      group: 'SPO · DISTRIBUIÇÃO',
      manifestosBipados: 10,
      manifestosEmitidos: 8,
      manifestosDescarregamento: 7,
      totalManifestos: 15,
      manifestosIncompletos: 3,
      pctUtilizacao: 66.7,
    });
  });

  it('agrega cubagem por filial', () => {
    const ranking = aggregateCubagemRanking([
      { date: '2026-04-01', filial: 'CWB', totalFretes: 10, fretesCubados: 8, pctCubagem: 80 },
      { date: '2026-04-02', filial: 'CWB', totalFretes: 5, fretesCubados: 2, pctCubagem: 40 },
    ]);

    expect(ranking[0]).toEqual({
      group: 'CWB',
      totalFretes: 15,
      fretesCubados: 10,
      fretesNaoCubados: 5,
      pctCubagem: 66.7,
    });
  });

  it('agrega indenizacao por filial', () => {
    const ranking = aggregateIndenizacaoRanking([
      { date: '2026-04-01', filial: 'REC', totalSinistros: 1, valorIndenizadoOriginal: -100, valorIndenizadoAbs: 100, faturamentoBase: 10000, pctIndenizacao: 1 },
      { date: '2026-04-02', filial: 'REC', totalSinistros: 2, valorIndenizadoOriginal: -50, valorIndenizadoAbs: 50, faturamentoBase: 5000, pctIndenizacao: 1 },
    ]);

    expect(ranking[0]).toEqual({
      group: 'REC',
      totalSinistros: 3,
      valorIndenizadoOriginal: -150,
      valorIndenizadoAbs: 150,
      faturamentoBase: 15000,
      pctIndenizacao: 1,
    });
  });

  it('usa faturamento do periodo da filial no ranking de indenizacao', () => {
    const ranking = aggregateIndenizacaoRanking([
      {
        date: '2026-04-01',
        filial: 'RJR',
        totalSinistros: 1,
        valorIndenizadoOriginal: -100,
        valorIndenizadoAbs: 100,
        faturamentoBase: 1000,
        faturamentoPeriodoFilial: 10000,
        pctIndenizacao: 10,
      },
      {
        date: '2026-04-02',
        filial: 'RJR',
        totalSinistros: 1,
        valorIndenizadoOriginal: -200,
        valorIndenizadoAbs: 200,
        faturamentoBase: 2000,
        faturamentoPeriodoFilial: 10000,
        pctIndenizacao: 10,
      },
    ]);

    expect(ranking[0]).toEqual({
      group: 'RJR',
      totalSinistros: 2,
      valorIndenizadoOriginal: -300,
      valorIndenizadoAbs: 300,
      faturamentoBase: 10000,
      pctIndenizacao: 3,
    });
  });

  it('calcula indenizacao agregada pelo saldo assinado antes do abs', () => {
    const ranking = aggregateIndenizacaoRanking([
      {
        date: '2026-04-01',
        filial: 'SPO',
        totalSinistros: 1,
        valorIndenizadoOriginal: -100,
        valorIndenizadoAbs: 100,
        faturamentoBase: 1000,
        pctIndenizacao: 10,
      },
      {
        date: '2026-05-01',
        filial: 'SPO',
        totalSinistros: 1,
        valorIndenizadoOriginal: 40,
        valorIndenizadoAbs: 40,
        faturamentoBase: 1000,
        pctIndenizacao: 4,
      },
    ]);

    expect(ranking[0]).toEqual({
      group: 'SPO',
      totalSinistros: 2,
      valorIndenizadoOriginal: -60,
      valorIndenizadoAbs: 60,
      faturamentoBase: 2000,
      pctIndenizacao: 3,
    });
  });

  it('permite saldo consolidado zerado na indenizacao', () => {
    const ranking = aggregateIndenizacaoRanking([
      {
        date: '2026-04-01',
        filial: 'CWB',
        totalSinistros: 1,
        valorIndenizadoOriginal: -100,
        valorIndenizadoAbs: 100,
        faturamentoBase: 1000,
        pctIndenizacao: 10,
      },
      {
        date: '2026-04-01',
        filial: 'CWB',
        totalSinistros: 1,
        valorIndenizadoOriginal: 100,
        valorIndenizadoAbs: 100,
        faturamentoBase: 1000,
        pctIndenizacao: 10,
      },
    ]);

    expect(ranking[0]).toEqual({
      group: 'CWB',
      totalSinistros: 2,
      valorIndenizadoOriginal: 0,
      valorIndenizadoAbs: 0,
      faturamentoBase: 2000,
      pctIndenizacao: 0,
    });
  });

  it('agrega horarios por filial', () => {
    const ranking = aggregateHorariosRanking([
      { date: '2026-04-01', filial: 'NHB', saidasNoHorario: 9, totalProgramado: 10, pctNoHorario: 90 },
      { date: '2026-04-02', filial: 'NHB', saidasNoHorario: 6, totalProgramado: 10, pctNoHorario: 60 },
    ]);

    expect(ranking[0]).toEqual({
      group: 'NHB',
      saidasNoHorario: 15,
      saidasForaDoHorario: 5,
      totalProgramado: 20,
      pctNoHorario: 75,
    });
  });
});
