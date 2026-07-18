import { useRef, useState } from 'react';

export type MovementMode = 'stationary' | 'walking' | 'driving';

// Thresholds in m/s. ~1.5 m/s ≈ 5.4 km/h (brisk walk ceiling),
// ~2.8 m/s ≈ 10 km/h (driving floor, with a gap in between to avoid
// flicker at "fast walk / slow bike" speeds).
const WALK_MAX_MS = 1.5;
const DRIVE_MIN_MS = 2.8;
const SAMPLE_WINDOW = 5;

/**
 * Rolling-average speed classifier. Feed it every GPS fix via `sample()`;
 * it returns the current best-guess movement mode, only flipping once the
 * *average* of the last few samples crosses a threshold — avoids the mode
 * badge flickering on single noisy GPS readings.
 */
export function useMovementMode() {
  const [mode, setMode] = useState<MovementMode>('stationary');
  const samples = useRef<number[]>([]);

  function sample(speedMs: number) {
    const clean = Number.isFinite(speedMs) && speedMs > 0 ? speedMs : 0;
    samples.current.push(clean);
    if (samples.current.length > SAMPLE_WINDOW) samples.current.shift();

    const avg = samples.current.reduce((a, b) => a + b, 0) / samples.current.length;

    setMode((prev) => {
      if (avg >= DRIVE_MIN_MS) return 'driving';
      if (avg <= WALK_MAX_MS * 0.3) return 'stationary';
      if (avg <= WALK_MAX_MS) return 'walking';
      return prev; // in the gap between thresholds, keep previous mode
    });
  }

  return { mode, sample };
}
