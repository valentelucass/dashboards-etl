import { expect, it } from 'vitest';
import { completarDiasEtapas, rotuloEtapa } from './integracoesEtapas';

it('preenche dias vazios e mantém XML e comprovantes separados', () => {
  const dias = [{ data: '2026-09-02', etapa: 'COMPROVANTE' as const, sucessos: 10, falhas: 1 }];
  const xml = completarDiasEtapas('2026-09-01', '2026-09-03', dias, 'DADOS');
  const pod = completarDiasEtapas('2026-09-01', '2026-09-03', dias, 'COMPROVANTE');
  expect(xml.map(d => d.sucessos)).toEqual([0, 0, 0]);
  expect(pod.map(d => d.sucessos)).toEqual([0, 10, 0]);
  expect(pod.map(d => d.falhas)).toEqual([0, 1, 0]);
});

it('calendário não perde a virada do mês ou o dia bissexto', () => {
  expect(completarDiasEtapas('2024-02-28', '2024-03-01', [], 'DADOS').map(d => d.data))
    .toEqual(['2024-02-28', '2024-02-29', '2024-03-01']);
});

it('preserva os nomes das etapas de outros destinos', () => {
  expect(rotuloEtapa({ sistemaDestino: 'SELIA', etapa: 'DADOS' })).toBe('AddEvents');
  expect(rotuloEtapa({ sistemaDestino: 'SUPPORTE', etapa: 'DADOS' })).toBe('Ocorrência');
  expect(rotuloEtapa({ sistemaDestino: 'VEDACIT', etapa: 'DADOS' })).toBe('XML/Dados');
});
