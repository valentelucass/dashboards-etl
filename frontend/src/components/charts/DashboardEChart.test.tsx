// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardEChart from './DashboardEChart';

const runtime = vi.hoisted(() => {
  const instances: Array<ReturnType<typeof createInstance>> = [];
  function createInstance(element: HTMLElement) {
    const handlers = new Map<string, Set<(params?: unknown) => void>>();
    return { element, disposed: false, handlers,
      setOption: vi.fn(), resize: vi.fn(), showLoading: vi.fn(), hideLoading: vi.fn(),
      on: vi.fn((event: string, handler: (params?: unknown) => void) => {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event)!.add(handler);
      }),
      off: vi.fn((event: string, handler: (params?: unknown) => void) => handlers.get(event)?.delete(handler)),
      emit(event: string, params?: unknown) { [...(handlers.get(event) ?? [])].forEach(handler => handler(params)); },
      isDisposed() { return this.disposed; },
      dispose: vi.fn(function (this: { disposed: boolean }) { this.disposed = true; }),
    };
  }
  const init = vi.fn((element: HTMLElement) => {
    const instance = createInstance(element); instances.push(instance); return instance;
  });
  return { instances, init,
    getInstanceByDom: (element: HTMLElement) => instances.findLast(instance => instance.element === element && !instance.disposed),
    dispose: vi.fn((element: HTMLElement) => instances.filter(instance => instance.element === element).forEach(instance => instance.dispose())),
  };
});
vi.mock('./echartsRuntime', () => ({ echarts: runtime }));
vi.mock('size-sensor', () => ({ bind: vi.fn(), clear: vi.fn() }));

let width: number;
let height: number;
let observers: Array<{ callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }>;
let frames: Map<number, FrameRequestCallback>;
let frameId: number;
const option = (value = 30) => ({ series: [{ type: 'pie', data: [{ name: 'Em entrega', value }] }] });

beforeEach(() => {
  runtime.instances.length = 0;
  vi.clearAllMocks();
  width = 640; height = 350; observers = []; frames = new Map(); frameId = 0;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn();
    observe = vi.fn();
    unobserve = vi.fn();
    constructor(callback: ResizeObserverCallback) { observers.push({ callback, disconnect: this.disconnect }); }
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('ciclo de vida compartilhado dos gráficos', () => {
  it('desenha uma única instância sem esperar a própria animação terminar', async () => {
    render(<DashboardEChart option={option()} notMerge />);
    expect(runtime.init).toHaveBeenCalledTimes(1);
    expect(runtime.instances[0].setOption).toHaveBeenCalledTimes(1);
    await act(async () => { runtime.instances[0].emit('finished'); });
    expect(runtime.init).toHaveBeenCalledTimes(1);
    expect(runtime.instances[0].setOption).toHaveBeenCalledTimes(1);
  });

  it('aceita dados que chegam antes do primeiro finished sem recriar o gráfico', async () => {
    const view = render(<DashboardEChart option={option()} notMerge />);
    view.rerender(<DashboardEChart option={option(80)} notMerge />);
    await act(async () => { runtime.instances[0].emit('finished'); });
    expect(runtime.init).toHaveBeenCalledTimes(1);
    expect(runtime.instances[0].setOption).toHaveBeenLastCalledWith(option(80), expect.objectContaining({ notMerge: true }));
    expect(runtime.instances[0].disposed).toBe(false);
  });

  it('não reaplica opções equivalentes quando outra parte da página atualiza', () => {
    const view = render(<DashboardEChart option={option()} style={{ height: 350 }} />);
    view.rerender(<DashboardEChart option={option()} style={{ height: 350 }} />);
    expect(runtime.instances[0].setOption).toHaveBeenCalledTimes(1);
  });

  it('atualiza dados e formatadores reais, inclusive closures com novos valores', () => {
    const makeOption = (unit: string) => ({ ...option(), tooltip: { formatter: () => unit } });
    const view = render(<DashboardEChart option={makeOption('cargas')} />);
    view.rerender(<DashboardEChart option={makeOption('kg')} />);
    const instance = runtime.instances[0];
    expect(instance.setOption).toHaveBeenCalledTimes(2);
    expect(instance.setOption.mock.lastCall?.[0].tooltip.formatter()).toBe('kg');
  });

  it('troca os handlers de clique sem reiniciar séries ou manter closures antigas', () => {
    const first = vi.fn(); const latest = vi.fn();
    const view = render(<DashboardEChart option={option()} onEvents={{ click: first }} />);
    const instance = runtime.instances[0];
    instance.emit('click', { name: 'Em entrega' });
    view.rerender(<DashboardEChart option={option()} onEvents={{ click: latest }} />);
    instance.emit('click', { name: 'Em entrega' });
    expect(first).toHaveBeenCalledTimes(1);
    expect(latest).toHaveBeenCalledWith({ name: 'Em entrega' }, instance);
    expect(instance.setOption).toHaveBeenCalledTimes(1);
    view.rerender(<DashboardEChart option={option()} />);
    instance.emit('click', {});
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it('troca o tema e as opções de renderização descartando somente a instância anterior', () => {
    const ready = vi.fn();
    const view = render(<DashboardEChart option={option()} onChartReady={ready} />);
    view.rerender(<DashboardEChart option={option()} theme="dark" onChartReady={ready} />);
    expect(runtime.instances[0].disposed).toBe(true);
    expect(runtime.init).toHaveBeenLastCalledWith(expect.any(HTMLElement), 'dark', undefined);
    view.rerender(<DashboardEChart option={option()} theme="dark" opts={{ renderer: 'svg' }} onChartReady={ready} />);
    expect(runtime.instances[1].disposed).toBe(true);
    expect(runtime.instances.filter(instance => !instance.disposed)).toHaveLength(1);
    expect(ready).toHaveBeenCalledTimes(3);
  });

  it('mantém as opções explícitas de substituição e loading', () => {
    const view = render(<DashboardEChart option={option()} replaceMerge={['series']} lazyUpdate showLoading loadingOption={{ text: 'Carregando' }} />);
    const instance = runtime.instances[0];
    expect(instance.setOption).toHaveBeenCalledWith(option(), { notMerge: false, replaceMerge: ['series'], lazyUpdate: true });
    expect(instance.showLoading).toHaveBeenCalledWith({ text: 'Carregando' });
    view.rerender(<DashboardEChart option={option()} replaceMerge={['series']} lazyUpdate />);
    expect(instance.hideLoading).toHaveBeenCalled();
  });

  it('redimensiona só quando as dimensões mudam, sem reaplicar dados', () => {
    const view = render(<DashboardEChart option={option()} />);
    const instance = runtime.instances[0];
    const notify = () => observers.at(-1)!.callback([], {} as ResizeObserver);
    notify();
    expect(frames.size).toBe(0);
    width = 390; notify(); notify();
    expect(frames.size).toBe(1);
    const [id, callback] = [...frames][0]; frames.delete(id); callback(1);
    expect(instance.resize).toHaveBeenCalledTimes(1);
    expect(instance.setOption).toHaveBeenCalledTimes(1);
    width = 1024; notify();
    view.unmount();
    expect(frames.size).toBe(0);
    expect(observers[0].disconnect).toHaveBeenCalled();
    expect(instance.disposed).toBe(true);
  });

  it('pode desabilitar e reativar o resize automático', () => {
    const view = render(<DashboardEChart option={option()} autoResize={false} />);
    expect(observers).toHaveLength(0);
    view.rerender(<DashboardEChart option={option()} />);
    expect(observers).toHaveLength(1);
    view.rerender(<DashboardEChart option={option()} autoResize={false} />);
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it('limpa completamente ao desmontar, inclusive em StrictMode', async () => {
    const view = render(<StrictMode><DashboardEChart option={option()} data-testid="chart" /></StrictMode>);
    expect(view.getByTestId('chart').classList.contains('echarts-for-react')).toBe(true);
    expect(runtime.instances.filter(instance => !instance.disposed)).toHaveLength(1);
    view.unmount();
    await act(async () => { runtime.instances.forEach(instance => instance.emit('finished')); });
    expect(runtime.instances.filter(instance => !instance.disposed)).toHaveLength(0);
    expect(runtime.instances).toHaveLength(2);
  });
});
