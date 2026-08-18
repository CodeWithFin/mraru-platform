"use client";

import { useCountUp } from "@/lib/hooks/useCountUp";

interface GrowingFigureProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}

// The signature "growing number" (design doc 2.5) applied wherever a balance,
// equity, or contribution figure is shown — counts up on mount/update instead
// of snapping instantly, with tabular figures so digits stay aligned.
export function GrowingFigure({ value, prefix = "", suffix = "", className = "", duration }: GrowingFigureProps) {
  const display = useCountUp(value, duration);
  return (
    <span className={`figure ${className}`}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
