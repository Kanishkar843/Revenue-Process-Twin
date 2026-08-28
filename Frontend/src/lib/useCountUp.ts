import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";

/**
 * Animates a number from 0 → target over ~600ms ease-out.
 * Instantly snaps to target under prefers-reduced-motion.
 */
export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);
  const raf = useRef<number>(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const from = 0;
    const delta = target - from;

    function tick(timestamp: number) {
      if (!start.current) start.current = timestamp;
      const elapsed = timestamp - start.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + delta * eased));
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      }
    }

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}
