import type ReactEChartsCore from 'echarts-for-react/lib/core';
import { PureComponent, type ComponentProps } from 'react';
import type { EChartsType } from 'echarts/core';
import isEqual from 'fast-deep-equal';
import { echarts } from './echartsRuntime';

type DashboardEChartProps = Omit<ComponentProps<typeof ReactEChartsCore>, 'echarts'>;

const CHART_PROPS = ['option', 'theme', 'notMerge', 'replaceMerge', 'lazyUpdate', 'showLoading',
  'loadingOption', 'opts', 'onChartReady', 'onEvents', 'shouldSetOption', 'autoResize'] as const;
const OPTION_PROPS = ['option', 'notMerge', 'replaceMerge', 'lazyUpdate'] as const;

/** One instance per mounted chart. Initialization never depends on the finished event. */
export default class DashboardEChart extends PureComponent<DashboardEChartProps> {
  private ele: HTMLDivElement | null = null;
  private instance: EChartsType | undefined;
  private observer: ResizeObserver | undefined;
  private resizeFrame: number | undefined;
  private width = 0;
  private height = 0;
  private eventHandlers = new Map<string, (params: unknown) => void>();

  componentDidMount() {
    this.initialize();
  }

  componentDidUpdate(previous: DashboardEChartProps) {
    if (this.props.shouldSetOption && !this.props.shouldSetOption(previous, this.props)) return;
    if (!isEqual(previous.theme, this.props.theme) || !isEqual(previous.opts, this.props.opts)) {
      this.dispose();
      this.initialize();
      return;
    }
    if (!isEqual(previous.onEvents, this.props.onEvents)) this.bindEvents();
    if (OPTION_PROPS.some(key => !isEqual(previous[key], this.props[key]))) this.updateEChartsOption();
    if (previous.showLoading !== this.props.showLoading || !isEqual(previous.loadingOption, this.props.loadingOption)) this.updateLoading();
    if (previous.autoResize !== this.props.autoResize) this.observeSize();
    if (!isEqual(previous.style, this.props.style) || previous.className !== this.props.className) this.scheduleResize();
  }

  componentWillUnmount() {
    this.dispose();
  }

  getEchartsInstance() {
    return this.instance;
  }

  private initialize() {
    if (!this.ele) return;
    const opts = this.props.opts;
    this.instance = echarts.init(this.ele, this.props.theme, opts
      ? { ...opts, width: opts.width ?? undefined, height: opts.height ?? undefined }
      : undefined);
    this.width = this.ele.clientWidth;
    this.height = this.ele.clientHeight;
    this.bindEvents();
    this.updateEChartsOption();
    this.updateLoading();
    this.observeSize();
    this.props.onChartReady?.(this.instance);
  }

  private updateEChartsOption() {
    const { option, notMerge = false, replaceMerge, lazyUpdate = false } = this.props;
    this.instance?.setOption(option, { notMerge, replaceMerge, lazyUpdate });
    return this.instance;
  }

  private updateLoading() {
    if (this.props.showLoading) this.instance?.showLoading(this.props.loadingOption);
    else this.instance?.hideLoading();
  }

  private unbindEvents() {
    this.eventHandlers.forEach((handler, event) => this.instance?.off(event, handler));
    this.eventHandlers.clear();
  }

  private bindEvents() {
    this.unbindEvents();
    const instance = this.instance;
    if (!instance) return;
    Object.entries(this.props.onEvents ?? {}).forEach(([event, callback]) => {
      if (typeof callback !== 'function') return;
      const handler = (params: unknown) => callback(params, instance);
      this.eventHandlers.set(event, handler);
      instance.on(event, handler);
    });
  }

  private observeSize() {
    this.observer?.disconnect();
    this.observer = undefined;
    if (this.resizeFrame !== undefined) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = undefined;
    if (this.props.autoResize === false || !this.ele) return;
    this.observer = new ResizeObserver(this.scheduleResize);
    this.observer.observe(this.ele);
  }

  private scheduleResize = () => {
    if (!this.ele || !this.instance || this.resizeFrame !== undefined) return;
    if (this.ele.clientWidth === this.width && this.ele.clientHeight === this.height) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = undefined;
      if (!this.ele || !this.instance || this.instance.isDisposed()) return;
      this.width = this.ele.clientWidth;
      this.height = this.ele.clientHeight;
      // Preserve explicit dimensions; otherwise follow the actual card, including sidebar changes.
      this.instance.resize({ width: this.props.opts?.width ?? 'auto', height: this.props.opts?.height ?? 'auto' });
    });
  };

  private dispose() {
    this.observer?.disconnect();
    this.observer = undefined;
    if (this.resizeFrame !== undefined) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = undefined;
    this.unbindEvents();
    this.instance?.dispose();
    this.instance = undefined;
  }

  render() {
    const domProps: Partial<DashboardEChartProps> = { ...this.props };
    CHART_PROPS.forEach(key => { delete domProps[key]; });
    return <div {...domProps} ref={element => { this.ele = element; }}
      className={`echarts-for-react ${this.props.className ?? ''}`}
      style={{ height: 300, ...this.props.style }} />;
  }
}
