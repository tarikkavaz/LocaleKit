import { getKey, setKey } from "@/lib/secure-keys";

const DEFAULT_LOCALE = "en_gb";
const LOCALE_STORAGE_KEY = "app-locale";

/**
 * Convert OS locale format (e.g., "en-GB") to app format (e.g., "en_gb")
 */
export function normalizeLocale(osLocale: string): string {
  // Convert "en-GB" to "en_gb"
  return osLocale.toLowerCase().replace(/-/g, "_");
}

/**
 * Convert app locale format (e.g., "en_gb") to OS format (e.g., "en-GB")
 */
export function denormalizeLocale(appLocale: string): string {
  // Convert "en_gb" to "en-GB"
  const parts = appLocale.split("_");
  if (parts.length === 2) {
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
  }
  return appLocale;
}

/**
 * Get OS/browser locale
 */
export function getOSLocale(): string {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  // Try navigator.language first (e.g., "en-GB")
  const browserLocale =
    navigator.language || navigator.languages?.[0] || "en-GB";
  return normalizeLocale(browserLocale);
}

/**
 * Get available locales from messages directory
 * For now, we'll hardcode the available locales. In the future, this could
 * dynamically read from the messages/ directory
 */
export function getAvailableLocales(): string[] {
  return ["en_gb", "tr_tr", "de_de", "fr_fr"];
}

/**
 * Check if a locale is available
 */
export function isLocaleAvailable(locale: string): boolean {
  return getAvailableLocales().includes(locale);
}

/**
 * Get stored locale preference from secure storage
 */
export async function getStoredLocale(): Promise<string | null> {
  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => {
        resolve(null);
      }, 2000)
    );

    const localePromise = getKey(LOCALE_STORAGE_KEY);
    const locale = await Promise.race([localePromise, timeoutPromise]);

    if (locale && isLocaleAvailable(locale)) {
      return locale;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Store locale preference in secure storage
 */
export async function setStoredLocale(locale: string): Promise<void> {
  if (!isLocaleAvailable(locale)) {
    throw new Error(`Locale ${locale} is not available`);
  }
  try {
    await setKey(LOCALE_STORAGE_KEY, locale);
  } catch (error) {
    throw error;
  }
}

/**
 * Detect the locale to use:
 * 1. Stored preference
 * 2. OS/browser locale (if available)
 * 3. Default (en_gb)
 */
export async function detectLocale(): Promise<string> {
  // Try stored preference first
  const stored = await getStoredLocale();
  if (stored) {
    return stored;
  }

  // Try OS locale
  const osLocale = getOSLocale();
  if (isLocaleAvailable(osLocale)) {
    return osLocale;
  }

  // Fallback to default
  return DEFAULT_LOCALE;
}

/**
 * Get locale name for display
 */
export function getLocaleName(locale: string): string {
  const names: Record<string, string> = {
    en_gb: "English (UK)",
    tr_tr: "Türkçe (Turkish)",
    de_de: "Deutsch (German)",
    fr_fr: "Français (French)",
  };
  return names[locale] || locale;
}
