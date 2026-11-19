import { useEffect, useRef, useState } from 'react';

export function useNavScroll(enabled = true) {
  const listRef = useRef<HTMLDivElement>(null);
  const arrowUpRef = useRef<HTMLDivElement>(null);
  const arrowDownRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ overflow: false, up: false, down: false });

  useEffect(() => {
    const list = listRef.current;
    const viewport = list?.parentElement;
    if (!enabled || !list || !viewport) return;

    function measure() {
      if (!viewport || !list) return;
      const arrowHeight = (arrowUpRef.current?.offsetHeight ?? 0) + (arrowDownRef.current?.offsetHeight ?? 0);
      const overflow = viewport.clientHeight > 0 && viewport.scrollHeight > viewport.clientHeight + arrowHeight + 1;
      const up = overflow && viewport.scrollTop > 1;
      const down = overflow && viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop > 1;
      setScrollState(current => current.overflow === overflow && current.up === up && current.down === down
        ? current : { overflow, up, down });
    }
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    observer.observe(viewport);
    viewport.addEventListener('scroll', measure, { passive: true });
    const frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport.removeEventListener('scroll', measure);
    };
  }, [enabled]);

  function scrollMenu(direction: -1 | 1) {
    const viewport = listRef.current?.parentElement;
    if (!viewport) return;
    viewport.scrollBy({
      top: direction * Math.max(76, Math.round(viewport.clientHeight * .56)),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  return { listRef, arrowUpRef, arrowDownRef, scrollState, scrollMenu };
}
