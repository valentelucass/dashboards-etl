// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FretesClienteRanking from './FretesClienteRanking';

const captured = vi.hoisted(() => ({ formatter: undefined as unknown }));
vi.mock('../../charts/ChartWrapper', () => ({ default: ({ option }: { option: { tooltip: { formatter: unknown } } }) => {
  captured.formatter = option.tooltip.formatter; return null;
} }));
afterEach(cleanup);

describe('nomes externos em HTML de tooltip', () => {
  it.each(['<img src=x onerror="window.injetado=1">', '<svg onload="window.injetado=1">', 'Cliente & Filhos <Sul> "A"'])('exibe literalmente %s sem criar elementos', (cliente) => {
    render(<FretesClienteRanking dados={[{ cliente, receita: 1234, fretes: 2, ticketMedio: 617 }]} />);
    const html = (captured.formatter as (items: unknown) => string)([{ name: cliente.length > 25 ? `${cliente.slice(0, 25)}...` : cliente, value: 1234 }]);
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.querySelector('img, svg, script, sul')).toBeNull();
    expect(container.textContent).toContain(cliente);
    expect(container.textContent).toContain('Receita: R$');
    expect(container.querySelectorAll('br')).toHaveLength(3);
  });
});
