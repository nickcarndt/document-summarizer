/**
 * Format latency in milliseconds to a human-readable string
 * @param ms - Latency in milliseconds
 * @returns Formatted string (e.g., "150ms", "2.5s")
 */
export function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

