const BISECTION_STEPS = 20

const cubicBezier =
  (x1: number, y1: number, x2: number, y2: number) =>
  (t: number): number => {
    const at = (s: number, a: number, b: number) =>
      3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s
    let lo = 0
    let hi = 1
    for (let step = 0; step < BISECTION_STEPS; step += 1) {
      const mid = (lo + hi) / 2
      if (at(mid, x1, x2) < t) lo = mid
      else hi = mid
    }
    return at((lo + hi) / 2, y1, y2)
  }

export const easeOut = cubicBezier(0.23, 1, 0.32, 1)
export const ENTER_S = 0.2
export const EXIT_S = 0.15
export const DRAW_IN_S = 0.22
export const GLOW_S = 0.6
export const CUT_S = 0.18
export const RETRACT_S = 0.18
export const CURSOR_MS = 40
export const HOVER_SETTLE_MS = 150

let reduceQuery: MediaQueryList | null = null

export const reducedMotion = (): boolean =>
  document.documentElement.dataset['motion'] === 'reduce' ||
  (reduceQuery ??= matchMedia('(prefers-reduced-motion: reduce)')).matches

export const follow = (seconds: number, rate: number, still: boolean): number =>
  still ? 1 : 1 - Math.exp(-rate * seconds)
