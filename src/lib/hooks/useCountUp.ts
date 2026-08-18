"use client";

import { useEffect, useRef, useState } from "react";

// The signature "growing number" interaction (design doc 2.5): every balance,
// equity, or contribution figure counts up from its previous value instead of
// snapping instantly, reinforcing "your money is growing" on every open.
// Respects prefers-reduced-motion.
export function useCountUp(value: number, duration = 600) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(value);
      prevRef.current = value;
      return;
    }

    const start = prevRef.current;
    const startTime = performance.now();
    let frame: number;

    function tick(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      setDisplay(Math.round(start + (value - start) * progress));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        prevRef.current = value;
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return display;
}
