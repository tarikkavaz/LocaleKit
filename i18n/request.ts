import { getRequestConfig } from "next-intl/server";
import { detectLocale } from "@/lib/i18n/locale";

export default getRequestConfig(async () => {
  // Detect locale from stored preference, OS, or default
  const locale = await detectLocale();

  // Load messages for the detected locale
  let messages;
  try {
    messages = (await import(`../messages/${locale}.json`)).default;
  } catch (error) {
    console.error(
      `Failed to load messages for locale ${locale}, falling back to en_gb:`,
      error
    );
    // Fallback to en_gb if locale file doesn't exist
    messages = (await import(`../messages/en_gb.json`)).default;
  }

  return {
    locale,
    messages,
  };
});
