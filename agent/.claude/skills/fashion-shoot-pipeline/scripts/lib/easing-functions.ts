/**
 * Easing Functions Library
 * Ported from easy-peasy-ease for MediaBunny speed curve processing
 *
 * All functions take a normalized time value t (0-1) and return
 * a normalized progress value (0-1). The slope of the curve at any
 * point represents the instantaneous speed.
 */

export type EasingFunction = (t: number) => number;

// =============================================================================
// BASE EASING FUNCTIONS
// =============================================================================

export const easingFunctions = {
  // ---------------------------------------------------------------------------
  // Linear - No easing, constant speed
  // ---------------------------------------------------------------------------
  linear: (t: number): number => t,

  // ---------------------------------------------------------------------------
  // Quadratic (Power of 2) - Gentle acceleration/deceleration
  // ---------------------------------------------------------------------------
  easeInQuad: (t: number): number => t * t,

  easeOutQuad: (t: number): number => t * (2 - t),

  easeInOutQuad: (t: number): number =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  // ---------------------------------------------------------------------------
  // Cubic (Power of 3) - Moderate acceleration/deceleration
  // ---------------------------------------------------------------------------
  easeInCubic: (t: number): number => t * t * t,

  easeOutCubic: (t: number): number => {
    const t1 = t - 1;
    return t1 * t1 * t1 + 1;
  },

  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  // ---------------------------------------------------------------------------
  // Quartic (Power of 4) - Stronger acceleration/deceleration
  // ---------------------------------------------------------------------------
  easeInQuart: (t: number): number => t * t * t * t,

  easeOutQuart: (t: number): number => {
    const t1 = t - 1;
    return 1 - t1 * t1 * t1 * t1;
  },

  easeInOutQuart: (t: number): number =>
    t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,

  // ---------------------------------------------------------------------------
  // Quintic (Power of 5) - Very strong acceleration/deceleration
  // ---------------------------------------------------------------------------
  easeInQuint: (t: number): number => t * t * t * t * t,

  easeOutQuint: (t: number): number => {
    const t1 = t - 1;
    return 1 + t1 * t1 * t1 * t1 * t1;
  },

  easeInOutQuint: (t: number): number =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,

  // ---------------------------------------------------------------------------
  // Sinusoidal - Smooth, organic feel (recommended default)
  // ---------------------------------------------------------------------------
  easeInSine: (t: number): number => 1 - Math.cos((t * Math.PI) / 2),

  easeOutSine: (t: number): number => Math.sin((t * Math.PI) / 2),

  easeInOutSine: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2,

  // ---------------------------------------------------------------------------
  // Exponential - Dramatic acceleration/deceleration
  // ---------------------------------------------------------------------------
  easeInExpo: (t: number): number =>
    t === 0 ? 0 : Math.pow(2, 10 * t - 10),

  easeOutExpo: (t: number): number =>
    t === 1 ? 1 : 1 - Math.pow(2, -10 * t),

  easeInOutExpo: (t: number): number =>
    t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? Math.pow(2, 20 * t - 10) / 2
          : (2 - Math.pow(2, -20 * t + 10)) / 2,

  // ---------------------------------------------------------------------------
  // Circular - Based on circular motion
  // ---------------------------------------------------------------------------
  easeInCirc: (t: number): number => 1 - Math.sqrt(1 - Math.pow(t, 2)),

  easeOutCirc: (t: number): number => Math.sqrt(1 - Math.pow(t - 1, 2)),

  easeInOutCirc: (t: number): number =>
    t < 0.5
      ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
      : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,

  // ---------------------------------------------------------------------------
  // Elastic - Bouncy, spring-like motion
  // ---------------------------------------------------------------------------
  easeInElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },

  easeOutElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },

  easeInOutElastic: (t: number): number => {
    const c5 = (2 * Math.PI) / 4.5;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
          : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },

  // ---------------------------------------------------------------------------
  // Back - Slight overshoot
  // ---------------------------------------------------------------------------
  easeInBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },

  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },

  easeInOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },

  // ---------------------------------------------------------------------------
  // Bounce - Ball bouncing effect
  // ---------------------------------------------------------------------------
  easeInBounce: (t: number): number => 1 - easingFunctions.easeOutBounce(1 - t),

  easeOutBounce: (t: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },

  easeInOutBounce: (t: number): number =>
    t < 0.5
      ? (1 - easingFunctions.easeOutBounce(1 - 2 * t)) / 2
      : (1 + easingFunctions.easeOutBounce(2 * t - 1)) / 2,
};

// =============================================================================
// CUBIC BEZIER (CSS-compatible custom curves)
// =============================================================================

/**
 * Creates a custom easing function from cubic bezier control points.
 * Compatible with CSS cubic-bezier() syntax.
 *
 * @param p1x - X coordinate of first control point (0-1)
 * @param p1y - Y coordinate of first control point (can exceed 0-1 for overshoot)
 * @param p2x - X coordinate of second control point (0-1)
 * @param p2y - Y coordinate of second control point (can exceed 0-1 for overshoot)
 * @returns An easing function
 *
 * @example
 * // CSS ease-in-out equivalent
 * const easeInOut = createBezierEasing(0.42, 0, 0.58, 1);
 *
 * // Dramatic swoop (easy-peasy-ease default)
 * const dramaticSwoop = createBezierEasing(0.85, 0, 0.15, 1);
 */
export function createBezierEasing(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number
): EasingFunction {
  // Clamp x values to [0, 1] (required for valid timing function)
  const x1 = Math.min(1, Math.max(0, p1x));
  const x2 = Math.min(1, Math.max(0, p2x));
  // Y values can exceed [0, 1] for overshoot effects
  const y1 = p1y;
  const y2 = p2y;

  // Bezier coefficients for x(t) and y(t)
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  // Sample x(t) - cubic bezier x coordinate at parameter t
  const sampleCurveX = (t: number): number => ((ax * t + bx) * t + cx) * t;

  // Sample y(t) - cubic bezier y coordinate at parameter t
  const sampleCurveY = (t: number): number => ((ay * t + by) * t + cy) * t;

  // Derivative of x(t) - needed for Newton-Raphson
  const sampleDerivativeX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;

  // Solve for t given x using Newton-Raphson with binary search fallback
  const solveCurveX = (x: number): number => {
    let t2 = x;
    const epsilon = 1e-6;

    // Newton-Raphson iteration (fast convergence for most cases)
    for (let i = 0; i < 8; i++) {
      const x2 = sampleCurveX(t2) - x;
      if (Math.abs(x2) < epsilon) return t2;
      const d2 = sampleDerivativeX(t2);
      if (Math.abs(d2) < epsilon) break;
      t2 -= x2 / d2;
    }

    // Fallback to binary search for edge cases
    let t0 = 0;
    let t1 = 1;
    t2 = x;

    while (t0 < t1) {
      const x2 = sampleCurveX(t2);
      if (Math.abs(x2 - x) < epsilon) return t2;
      if (x > x2) t0 = t2;
      else t1 = t2;
      t2 = (t1 + t0) / 2;
    }

    return t2;
  };

  // Return the easing function: given x (time), find y (progress)
  return (t: number): number => {
    // Handle edge cases exactly
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleCurveY(solveCurveX(t));
  };
}

// =============================================================================
// PRESET BEZIER CURVES
// =============================================================================

export const bezierPresets = {
  // CSS standard presets
  ease: createBezierEasing(0.25, 0.1, 0.25, 1),
  easeIn: createBezierEasing(0.42, 0, 1, 1),
  easeOut: createBezierEasing(0, 0, 0.58, 1),
  easeInOut: createBezierEasing(0.42, 0, 0.58, 1),

  // Cinematic presets
  dramaticSwoop: createBezierEasing(0.85, 0, 0.15, 1), // easy-peasy-ease default
  gentleSwoop: createBezierEasing(0.7, 0, 0.3, 1),
  cinematic: createBezierEasing(0.77, 0, 0.175, 1),
  luxurious: createBezierEasing(0.19, 1, 0.22, 1), // Fast start, ultra gentle end

  // Material Design
  materialStandard: createBezierEasing(0.4, 0, 0.2, 1),
  materialDecelerate: createBezierEasing(0, 0, 0.2, 1),
  materialAccelerate: createBezierEasing(0.4, 0, 1, 1),
};

// =============================================================================
// ASYMMETRIC/HYBRID EASING
// =============================================================================

/**
 * Creates an asymmetric easing function that uses different curves
 * for the first and second half of the animation.
 *
 * @param easeIn - Easing function for first half (0 to 0.5)
 * @param easeOut - Easing function for second half (0.5 to 1)
 * @returns Combined easing function
 *
 * @example
 * // Exponential acceleration, cubic deceleration
 * const hybrid = createAsymmetricEase(
 *   easingFunctions.easeInExpo,
 *   easingFunctions.easeOutCubic
 * );
 */
export function createAsymmetricEase(
  easeIn: EasingFunction,
  easeOut: EasingFunction
): EasingFunction {
  return (t: number): number => {
    if (t <= 0.5) {
      // First half: apply easeIn scaled to [0, 0.5]
      return 0.5 * easeIn(t * 2);
    }
    // Second half: apply easeOut scaled to [0.5, 1]
    return 0.5 + 0.5 * easeOut((t - 0.5) * 2);
  };
}

// Pre-built hybrid easings
export const hybridEasings = {
  easeInExpoOutCubic: createAsymmetricEase(
    easingFunctions.easeInExpo,
    easingFunctions.easeOutCubic
  ),
  easeInQuartOutQuad: createAsymmetricEase(
    easingFunctions.easeInQuart,
    easingFunctions.easeOutQuad
  ),
  easeInCircOutQuad: createAsymmetricEase(
    easingFunctions.easeInCirc,
    easingFunctions.easeOutQuad
  ),
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get an easing function by name
 *
 * @param name - Name of the easing function
 * @returns The easing function, or linear if not found
 */
export function getEasingFunction(name: string): EasingFunction {
  // Check base easings
  if (name in easingFunctions) {
    return easingFunctions[name as keyof typeof easingFunctions];
  }

  // Check bezier presets
  if (name in bezierPresets) {
    return bezierPresets[name as keyof typeof bezierPresets];
  }

  // Check hybrid easings
  if (name in hybridEasings) {
    return hybridEasings[name as keyof typeof hybridEasings];
  }

  // Default to linear
  console.warn(`Unknown easing "${name}", falling back to linear`);
  return easingFunctions.linear;
}

/**
 * List all available easing function names
 */
export function listEasingNames(): string[] {
  return [
    ...Object.keys(easingFunctions),
    ...Object.keys(bezierPresets),
    ...Object.keys(hybridEasings),
  ];
}

/**
 * Type guard to check if a string is a valid easing name
 */
export function isValidEasingName(name: string): boolean {
  return (
    name in easingFunctions ||
    name in bezierPresets ||
    name in hybridEasings
  );
}

// =============================================================================
// DEFAULT EXPORT - All easings combined
// =============================================================================

export const allEasings = {
  ...easingFunctions,
  ...bezierPresets,
  ...hybridEasings,
};

export default allEasings;
