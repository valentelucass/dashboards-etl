// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PerformanceIndicadoresOperacionais from './PerformanceIndicadoresOperacionais';

const consulta = vi.hoisted(() => ({
  usePerformanceOcorrenciasAtraso: vi.fn(),
  usePerformanceEficienciaFiliais: vi.fn(),
  usePerformanceEntregasAtencao: vi.fn(),
}));
vi.mock('../../../hooks/queries/usePerformance', () => consulta);

const filtro = { dataInicio: '2026-11-01', dataFim: '2026-11-19' };
afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  consulta.usePerformanceOcorrenciasAtraso.mockReturnValue({ data: [{ ocorrencia: 'Sem ocorrência', notas: 25 }] });
  consulta.usePerformanceEficienciaFiliais.mockReturnValue({
    data: [{ filial: 'SPO', efe: null, eft: 0, efd: null, otif: null, semInformacao: 2 }],
  });
  consulta.usePerformanceEntregasAtencao.mockImplementation((_, pagina: number) => ({
    data: {
      totalPaginas: 3, conteudo: [{
        numeroMinuta: 480000 + pagina, cliente: 'Cliente pagador', destino: 'Recife/PE',
        previsaoEntrega: '2026-11-17', status: 'Em Tratativa', alerta: 'Vencida', ultimaOcorrencia: 'Contato com destinatário',
      }],
    },
  }));
});

describe('indicadores operacionais de performance', () => {
  it('apresenta as notas por ocorrência e diferencia eficiência zero de ausência de base', () => {
    render(<PerformanceIndicadoresOperacionais filtro={filtro} />);
    const ocorrencias = screen.getByRole('region', { name: 'Notas em atraso por última ocorrência' });
    expect(ocorrencias.textContent).toContain('Sem ocorrência25 notas');
    const filial = screen.getByRole('table', { name: 'Percentuais de eficiência por filial' });
    expect(within(filial).getByText('0,00%')).toBeTruthy();
    expect(within(filial).getAllByLabelText('Sem base para cálculo')).toHaveLength(3);
    expect(within(filial).getByText('2 etapas sem informação')).toBeTruthy();
  });

  it('mostra urgência e status juntos, pagina as minutas e volta à primeira página ao mudar o filtro', () => {
    const view = render(<PerformanceIndicadoresOperacionais filtro={filtro} />);
    const atencao = screen.getByRole('table', { name: 'Entregas em atenção por minuta' });
    expect(within(atencao).getByText('Vencida')).toBeTruthy();
    expect(within(atencao).getByText('Em Tratativa')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página de entregas em atenção' }));
    expect(within(atencao).getByRole('rowheader', { name: '480002' })).toBeTruthy();
    view.rerender(<PerformanceIndicadoresOperacionais filtro={{ ...filtro, filiais: ['REC'] }} />);
    expect(within(atencao).getByRole('rowheader', { name: '480001' })).toBeTruthy();
  });
});
