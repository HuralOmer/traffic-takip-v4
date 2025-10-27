/**
 * Timestamp Utility Functions
 * Converts timestamps to human-readable formats
 */
/**
 * Convert timestamp to readable format: "2024-10-15 06:25:01"
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
/**
 * Calculate relative time: "2 seconds ago", "5 minutes ago", etc.
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  // Less than 1 minute
  if (diff < 60000) {
    const seconds = Math.floor(diff / 1000);
    return seconds <= 1 ? 'just now' : `${seconds} seconds ago`;
  }
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  // Less than 1 day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  // Less than 1 week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  // More than 1 week
  const weeks = Math.floor(diff / 604800000);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}
/**
 * Get current timestamp in readable format
 */
export function getCurrentTimestamp(): string {
  return formatTimestamp(Date.now());
}
/**
 * Parse readable timestamp back to number (for compatibility)
 */
export function parseTimestamp(readable: string): number {
  // Format: "2024-10-15 06:25:01"
  const parts = readable.split(' ');
  if (parts.length !== 2) {
    throw new Error(`Invalid timestamp format: ${readable}. Expected format: "YYYY-MM-DD HH:MM:SS"`);
  }
  const datePart = parts[0]!;
  const timePart = parts[1]!;
  const dateParts = datePart.split('-').map(Number);
  const timeParts = timePart.split(':').map(Number);
  if (dateParts.length !== 3 || timeParts.length !== 3) {
    throw new Error(`Invalid timestamp format: ${readable}. Expected format: "YYYY-MM-DD HH:MM:SS"`);
  }
  const year = dateParts[0]!;
  const month = dateParts[1]!;
  const day = dateParts[2]!;
  const hours = timeParts[0]!;
  const minutes = timeParts[1]!;
  const seconds = timeParts[2]!;
  return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
}
