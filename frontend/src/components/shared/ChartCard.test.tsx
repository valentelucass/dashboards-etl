// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { chartDictionary } from '../../constants/chartDictionary';
import ChartCard from './ChartCard';

afterEach(cleanup);

it('mostra o resumo no título e mantém as regras completas ao fixar os detalhes', async () => {
  const titulo = 'Coletas por dia, mês e ano';
  const definition = chartDictionary.coletasSerie;
  render(<ChartCard titulo={titulo} chartKey="coletasSerie"><p>Dados do gráfico</p></ChartCard>);

  const heading = screen.getByRole('heading', { name: titulo });
  fireEvent.mouseEnter(heading);
  const summary = await screen.findByRole('tooltip');
  expect(summary.textContent).toContain(definition.descricao);
  expect(summary.textContent).not.toContain(definition.calculoTecnico);

  const detailsButton = screen.getByRole('button', { name: `Fixar detalhes do gráfico ${titulo}` });
  fireEvent.click(detailsButton);
  expect(detailsButton.getAttribute('aria-expanded')).toBe('true');
  const details = screen.getByRole('tooltip');
  for (const text of Object.values(definition)) {
    expect(details.textContent).toContain(text);
  }

  fireEvent.keyDown(detailsButton, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).toBeNull();
});
