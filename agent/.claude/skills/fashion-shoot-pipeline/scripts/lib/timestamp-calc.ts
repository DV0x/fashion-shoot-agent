/**
 * timestamp-calc.ts
 *
 * Core algorithm for calculating source timestamps based on easing functions.
 * This is the heart of the speed curve implementation.
 *
 * The algorithm maps output frames to source timestamps using easing functions,
 * creating the slow-fast-slow effect that makes hard cuts invisible.
 */

import type { EasingFunction } from "./easing-functions.js";

// =============================================================================
// TYPES
// =============================================================================

export interface TimestampCalculationOptions {
  /** The easing function to apply */
  easingFunc: EasingFunction;
  /** Duration of source video in seconds */
  inputDuration: number;
  /** Desired output duration in seconds */
  outputDuration: number;
  /** Output frame rate (fps) */
  outputFps: number;
}

export interface TimestampCalculationResult {
  /** Array of source timestamps in seconds */
  timestamps: number[];
  /** Total number of output frames */
  totalFrames: number;
  /** Compression ratio (input/output duration) */
  compressionRatio: number;
}

// =============================================================================
// CORE ALGORITHM
// =============================================================================

/**
 * Calculate source timestamps based on easing function.
 *
 * This is the core algorithm from easy-peasy-ease:
 * For each output frame, calculate which source timestamp to sample.
 *
 * The easing function maps output progress (0→1) to source progress (0→1).
 * A steep slope means fast playback, a flat slope means slow playback.
 *
 * @example
 * // With dramaticSwoop easing (0.85, 0, 0.15, 1):
 * // Frame 0-9:   Very slow (near frozen) - 0.03s of source
 * // Frame 40-50: Very fast - ~170ms jumps between frames
 * // Frame 80-89: Very slow (near frozen) - 0.03s of source
 *
 * @param options - Calculation options
 * @returns Object with timestamps array and metadata
 */
export function calculateSourceTimestamps(
  options: TimestampCalculationOptions
): TimestampCalculationResult {
  const { easingFunc, inputDuration, outputDuration, outputFps } = options;

  const totalFrames = Math.floor(outputDuration * outputFps);
  const timestamps: number[] = [];

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    // Normalize frame index to 0-1 range (output progress)
    const outputProgress =
      totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;

    // Apply easing function: maps output progress to source progress
    // This is where the "magic" happens - the easing curve determines speed
    const sourceProgress = easingFunc(outputProgress);

    // Map to source timestamp, clamped to valid range
    // Subtract tiny amount to avoid seeking past end of video
    const sourceTime = Math.max(
      0,
      Math.min(sourceProgress * inputDuration, inputDuration - 0.001)
    );

    timestamps.push(sourceTime);
  }

  return {
    timestamps,
    totalFrames,
    compressionRatio: inputDuration / outputDuration,
  };
}

/**
 * Simplified version that just returns the timestamps array.
 * For backwards compatibility with existing code.
 *
 * @param easingFunc - The easing function to apply
 * @param inputDuration - Duration of source video in seconds
 * @param outputDuration - Desired output duration in seconds
 * @param outputFps - Output frame rate
 * @returns Array of source timestamps in seconds
 */
export function calculateTimestamps(
  easingFunc: EasingFunction,
  inputDuration: number,
  outputDuration: number,
  outputFps: number
): number[] {
  const result = calculateSourceTimestamps({
    easingFunc,
    inputDuration,
    outputDuration,
    outputFps,
  });
  return result.timestamps;
}

// =============================================================================
// ANALYSIS UTILITIES
// =============================================================================

/**
 * Analyze the speed profile of a set of timestamps.
 * Useful for debugging and visualization.
 *
 * @param timestamps - Array of source timestamps
 * @param outputFps - Output frame rate
 * @returns Analysis object with speed statistics
 */
export function analyzeSpeedProfile(
  timestamps: number[],
  outputFps: number
): {
  minSpeed: number;
  maxSpeed: number;
  avgSpeed: number;
  speedAtStart: number;
  speedAtMiddle: number;
  speedAtEnd: number;
} {
  const speeds: number[] = [];
  const frameDuration = 1 / outputFps;

  for (let i = 1; i < timestamps.length; i++) {
    const sourceDelta = timestamps[i] - timestamps[i - 1];
    // Speed = how much source time per output time
    // 1.0 = normal speed, >1 = fast forward, <1 = slow motion
    const speed = sourceDelta / frameDuration;
    speeds.push(speed);
  }

  const sortedSpeeds = [...speeds].sort((a, b) => a - b);

  return {
    minSpeed: sortedSpeeds[0] || 0,
    maxSpeed: sortedSpeeds[sortedSpeeds.length - 1] || 0,
    avgSpeed: speeds.reduce((a, b) => a + b, 0) / speeds.length || 0,
    speedAtStart: speeds[0] || 0,
    speedAtMiddle: speeds[Math.floor(speeds.length / 2)] || 0,
    speedAtEnd: speeds[speeds.length - 1] || 0,
  };
}

/**
 * Get sample timestamps for logging/debugging.
 * Returns timestamps at 0%, 25%, 50%, 75%, 100% of output.
 *
 * @param timestamps - Full array of timestamps
 * @returns Array of sample points with progress and timestamp
 */
export function getSampleTimestamps(
  timestamps: number[]
): Array<{ progress: number; timestamp: number }> {
  const samples = [0, 0.25, 0.5, 0.75, 1];
  return samples.map((progress) => {
    const idx = Math.floor(progress * (timestamps.length - 1));
    return {
      progress,
      timestamp: timestamps[idx],
    };
  });
}
