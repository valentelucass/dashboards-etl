// Installed only by the isolated CDP harness, never shipped in the application.
// Observe the real React/ECharts bridge without replacing its rendering lifecycle.
export const chartTitleProbe = `
  window.__chartTitleFor = element => {
    let card = element?.parentElement;
    while (card && !card.querySelector('h3')) card = card.parentElement;
    const heading = card?.querySelector('h3');
    const title = heading?.textContent || 'unknown';
    const sameTitles = [...document.querySelectorAll('h3')].filter(h => h.textContent === title);
    const siblings = [...(card?.querySelectorAll('.echarts-for-react') ?? [])];
    return title + (sameTitles.length > 1 ? ' [' + (sameTitles.indexOf(heading) + 1) + ']' : '')
      + (siblings.length > 1 ? ' / ' + (siblings.indexOf(element) + 1) : '');
  };
`;
export const chartAnimationProbe = `
  window.__chartUpdates = [];
  window.__chartFinished = [];
  window.__chartInitializations = [];
  window.__chartTestInstances = new Map();
  const observedPrototypes = new WeakSet();
  const observedInstances = new WeakSet();
  function titleFor(element) {
    return window.__chartTitleFor(element);
  }
  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (name === '_echarts_instance_' && value) window.__chartInitializations.push({ title: titleFor(this), id: value, at: performance.now() });
    return originalSetAttribute.call(this, name, value);
  };
  function observeInstance(instance, title) {
    if (!instance || observedInstances.has(instance)) return;
    observedInstances.add(instance);
    instance.on('finished', () => window.__chartFinished.push({ title, at: performance.now() }));
    window.__chartTestInstances.set(title, instance);
  }
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: () => 1,
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      const stack = [root.current];
      while (stack.length) {
        const fiber = stack.pop();
        if (fiber.child) stack.push(fiber.child);
        if (fiber.sibling) stack.push(fiber.sibling);
        const component = fiber.stateNode;
        if (!component?.ele || typeof component.updateEChartsOption !== 'function') continue;
        const instance = component.getEchartsInstance();
        const title = titleFor(component.ele);
        // Synchronous mounts have already set their first option when React commits.
        // Read the real model once; subsequent calls are intercepted below.
        if (instance && !observedInstances.has(instance) && instance.getOption()?.series?.length) {
          window.__chartUpdates.push({ title, at: performance.now(), notMerge: !!component.props.notMerge,
            source: 'mounted-model', series: JSON.parse(JSON.stringify(component.props.option.series)) });
          observeInstance(instance, title);
        }
        const prototype = Object.getPrototypeOf(component);
        if (observedPrototypes.has(prototype)) continue;
        observedPrototypes.add(prototype);
        const original = prototype.updateEChartsOption;
        prototype.updateEChartsOption = function(...args) {
          const title = titleFor(this.ele);
          const instance = this.getEchartsInstance();
          observeInstance(instance, title);
          window.__chartUpdates.push({ title, at: performance.now(), notMerge: !!this.props.notMerge,
            series: JSON.parse(JSON.stringify(this.props.option.series)) });
          return original.apply(this, args);
        };
      }
    },
  };
`;
