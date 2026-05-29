import { useEffect, useRef } from 'react';
import Stats from 'stats.js';

/**
 * Dev-only FPS / ms / MB overlay.
 * Volg performance regel in .roo/rules/03-performance.md:
 * "Stats.js overlay altijd zichtbaar in dev, Chrome Performance tab gebruikt voor profiling"
 *
 * Wordt automatisch niet gemount in production builds.
 */
export function PerfStats() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (import.meta.env.PROD) return;
    const container = containerRef.current;
    if (!container) return;

    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '0';
    stats.dom.style.left = '0';
    container.appendChild(stats.dom);

    let rafId = 0;
    const loop = () => {
      stats.begin();
      stats.end();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      if (stats.dom.parentNode) {
        stats.dom.parentNode.removeChild(stats.dom);
      }
    };
  }, []);

  if (import.meta.env.PROD) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none fixed top-2 left-2 z-[9999]"
    />
  );
}
