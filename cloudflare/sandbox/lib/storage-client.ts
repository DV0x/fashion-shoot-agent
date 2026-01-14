/**
 * Storage Client - R2 file operations from container
 *
 * Note: In the container, R2 is mounted at /storage
 * Files can be accessed directly via filesystem operations
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { dirname } from "path";

// R2 mount point in container
const STORAGE_ROOT = "/storage";

/**
 * Ensure directory exists
 */
export function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get full path for R2 key
 */
export function getStoragePath(key: string): string {
  return `${STORAGE_ROOT}/${key}`;
}

/**
 * Write file to R2 storage
 */
export function writeToStorage(key: string, data: Buffer | string): void {
  const path = getStoragePath(key);
  ensureDir(path);
  writeFileSync(path, data);
}

/**
 * Read file from R2 storage
 */
export function readFromStorage(key: string): Buffer | null {
  const path = getStoragePath(key);
  if (!existsSync(path)) {
    return null;
  }
  return readFileSync(path);
}

/**
 * Check if file exists in R2 storage
 */
export function existsInStorage(key: string): boolean {
  return existsSync(getStoragePath(key));
}
