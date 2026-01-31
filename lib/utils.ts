/**
 * Check if running in Tauri
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

/**
 * Format a timestamp to a relative time string (e.g., "2 days ago")
 */
export function formatDistanceToNow(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) {
    return "just now";
  } else if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  } else if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  } else if (weeks < 4) {
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  } else {
    const months = Math.floor(days / 30);
    if (months < 12) {
      return `${months} month${months === 1 ? "" : "s"} ago`;
    } else {
      const years = Math.floor(months / 12);
      return `${years} year${years === 1 ? "" : "s"} ago`;
    }
  }
}
