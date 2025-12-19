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
