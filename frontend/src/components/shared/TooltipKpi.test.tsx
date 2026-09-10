// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import TooltipKpi from './TooltipKpi';

afterEach(cleanup);
const definition = { titulo: 'Indicador de teste', descricao: 'Descrição do indicador', calculo: 'Total / quantidade', observacao: 'Período selecionado' };

describe('TooltipKpi acessível', () => {
  it('exibe o contrato por foco e fecha com Escape', async () => {
    const { container } = render(<TooltipKpi definition={definition}><span>123</span></TooltipKpi>);
    const trigger = container.querySelector('[tabindex="0"]') as HTMLElement;
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(trigger);
    const tooltip = await screen.findByRole('tooltip');
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(tooltip.textContent).toContain(definition.descricao);
    expect(tooltip.textContent).toContain(definition.calculo);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(screen.getByText('123')).toBeTruthy();
  });

  it('não perde foco ao mover entre ações dentro do card', async () => {
    render(<TooltipKpi definition={definition}><button>Ação do card</button></TooltipKpi>);
    const button = screen.getByRole('button', { name: 'Ação do card' });
    fireEvent.focus(button);
    expect(await screen.findByRole('tooltip')).toBeTruthy();
    fireEvent.blur(button, { relatedTarget: document.body });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('mantém conteúdo disponível quando a definição não existe', () => {
    render(<TooltipKpi kpiName="inexistente"><button>Indicador</button></TooltipKpi>);
    expect(screen.getByRole('button', { name: 'Indicador' })).toBeTruthy();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('renderiza texto HTML como texto, sem criar elemento executável', async () => {
    const { container } = render(<TooltipKpi definition={{ ...definition, descricao: '<img src=x onerror=alert(1)>' }}><span>123</span></TooltipKpi>);
    fireEvent.focus(container.querySelector('[tabindex="0"]') as HTMLElement);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(tooltip.querySelector('img')).toBeNull();
  });
});
