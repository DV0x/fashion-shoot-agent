/**
 * video-utils.ts
 *
 * Shared video utilities for the fashion-shoot-pipeline scripts.
 * Consolidates duplicated code from apply-speed-curve.ts, stitch-videos-eased.ts,
 * and stitch-videos.ts.
 */

import { execSync } from "child_process";
import * as path from "path";

// =============================================================================
// TYPES
// =============================================================================

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

export interface EncodeOptions {
  inputPattern: string;
  outputPath: string;
  fps: number;
  bitrate: string;
  preset?: string;
  crf?: number;
}

// =============================================================================
// VIDEO METADATA
// =============================================================================

/**
 * Get video metadata using ffprobe
 *
 * @param videoPath - Path to the video file
 * @returns VideoMetadata object with duration, dimensions, and fps
 */
export function getVideoMetadata(videoPath: string): VideoMetadata {
  const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
  const result = execSync(cmd, { encoding: "utf-8" });
  const data = JSON.parse(result);

  const videoStream = data.streams.find((s: any) => s.codec_type === "video");
  if (!videoStream) {
    throw new Error(`No video stream found in ${videoPath}`);
  }

  // Parse frame rate (can be "24/1" or "23.976")
  let fps = 24;
  if (videoStream.r_frame_rate) {
    const [num, den] = videoStream.r_frame_rate.split("/").map(Number);
    fps = den ? num / den : num;
  }

  return {
    duration: parseFloat(data.format.duration),
    width: videoStream.width,
    height: videoStream.height,
    fps,
  };
}

// =============================================================================
// FFMPEG FILTERS
// =============================================================================

/**
 * Build FFmpeg scale filter with aspect ratio preservation and padding
 *
 * @param width - Target width
 * @param height - Target height
 * @param padColor - Padding color (default: black)
 * @returns FFmpeg filter string
 */
export function buildScaleFilter(
  width: number,
  height: number,
  padColor: string = "black"
): string {
  return (
    `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:${padColor},` +
    `setsar=1`
  );
}

/**
 * Build simple scale filter (no padding)
 *
 * @param width - Target width
 * @param height - Target height
 * @returns FFmpeg filter string
 */
export function buildSimpleScaleFilter(width: number, height: number): string {
  return `scale=${width}:${height}`;
}

// =============================================================================
// FRAME ENCODING
// =============================================================================

/**
 * Encode frames to video using FFmpeg
 *
 * @param options - Encoding options
 */
export function encodeFramesToVideo(options: EncodeOptions): void {
  const {
    inputPattern,
    outputPath,
    fps,
    bitrate,
    preset = "slow",
    crf = 18,
  } = options;

  console.error(`Encoding video at ${fps}fps...`);

  const cmd = [
    "ffmpeg",
    "-y",
    "-framerate",
    String(fps),
    "-i",
    `"${inputPattern}"`,
    "-c:v",
    "libx264",
    "-preset",
    preset,
    "-crf",
    String(crf),
    "-b:v",
    bitrate,
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    `"${outputPath}"`,
  ];

  execSync(cmd.join(" "), { stdio: "pipe" });
}

// =============================================================================
// FRAME EXTRACTION
// =============================================================================

export interface ExtractFrameOptions {
  inputPath: string;
  outputPath: string;
  timestamp: number;
  width: number;
  height: number;
  scaleWithPadding?: boolean;
}

/**
 * Extract a single frame at a specific timestamp
 *
 * @param options - Extraction options
 */
export function extractFrameAtTimestamp(options: ExtractFrameOptions): void {
  const {
    inputPath,
    outputPath,
    timestamp,
    width,
    height,
    scaleWithPadding = false,
  } = options;

  const scaleFilter = scaleWithPadding
    ? buildScaleFilter(width, height)
    : buildSimpleScaleFilter(width, height);

  const cmd = [
    "ffmpeg",
    "-y",
    "-ss",
    timestamp.toFixed(6),
    "-i",
    `"${inputPath}"`,
    "-frames:v",
    "1",
    "-vf",
    `"${scaleFilter}"`,
    "-q:v",
    "1",
    `"${outputPath}"`,
  ];

  execSync(cmd.join(" "), { stdio: "pipe" });
}

export interface ExtractFramesBatchOptions {
  inputPath: string;
  tempDir: string;
  timestamps: number[];
  width: number;
  height: number;
  frameOffset?: number;
  scaleWithPadding?: boolean;
  onProgress?: (extracted: number, total: number) => void;
}

/**
 * Extract multiple frames at specific timestamps
 *
 * @param options - Batch extraction options
 * @returns Number of frames extracted
 */
export async function extractFramesAtTimestamps(
  options: ExtractFramesBatchOptions
): Promise<number> {
  const {
    inputPath,
    tempDir,
    timestamps,
    width,
    height,
    frameOffset = 0,
    scaleWithPadding = false,
    onProgress,
  } = options;

  const totalFrames = timestamps.length;
  let extracted = 0;
  const batchSize = 10;

  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i];
    const globalFrameIndex = frameOffset + i;
    const outputFile = path.join(
      tempDir,
      `frame_${String(globalFrameIndex).padStart(6, "0")}.png`
    );

    extractFrameAtTimestamp({
      inputPath,
      outputPath: outputFile,
      timestamp,
      width,
      height,
      scaleWithPadding,
    });

    extracted++;

    if (onProgress && (extracted % batchSize === 0 || extracted === totalFrames)) {
      onProgress(extracted, totalFrames);
    }
  }

  return timestamps.length;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Find maximum dimensions from a list of video metadata
 *
 * @param metadataList - Array of VideoMetadata
 * @returns Object with maxWidth and maxHeight
 */
export function findMaxDimensions(
  metadataList: VideoMetadata[]
): { maxWidth: number; maxHeight: number } {
  return {
    maxWidth: Math.max(...metadataList.map((m) => m.width)),
    maxHeight: Math.max(...metadataList.map((m) => m.height)),
  };
}

/**
 * Default progress reporter for frame extraction
 */
export function defaultProgressReporter(extracted: number, total: number): void {
  const percent = Math.round((extracted / total) * 100);
  process.stderr.write(`\r    Frames: ${extracted}/${total} (${percent}%)`);
  if (extracted === total) {
    process.stderr.write("\n");
  }
}
