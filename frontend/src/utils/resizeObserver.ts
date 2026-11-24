import { ResizeObserver as ResizeObserverCompativel } from '@juggle/resize-observer';

if (typeof window.ResizeObserver !== 'function') {
  window.ResizeObserver = ResizeObserverCompativel;
}
