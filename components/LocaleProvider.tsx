"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState } from "react";
import {
  detectLocale,
  getLocaleName,
  denormalizeLocale,
} from "@/lib/i18n/locale";
import enGbMessages from "../messages/en_gb.json";

interface LocaleProviderProps {
  children: React.ReactNode;
}

export default function LocaleProvider({ children }: LocaleProviderProps) {
  // Start with en_gb as default to ensure provider is always available
  const [locale, setLocale] = useState<string>("en_gb");
  const [messages, setMessages] = useState<any>(enGbMessages);
  // Detect user's timezone
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    const loadLocale = async () => {
      try {
        // Add timeout to prevent blocking
        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Locale detection timeout")), 2000)
        );

        const detectedLocale = await Promise.race([
          detectLocale(),
          timeoutPromise,
        ]);

        // Only update if different from default
        if (detectedLocale !== "en_gb") {
          setLocale(detectedLocale);
          // Load messages for the detected locale
          try {
            const localeMessages = (
              await import(`../messages/${detectedLocale}.json`)
            ).default;
            setMessages(localeMessages);
          } catch (error) {
            // Keep en_gb as fallback
            setLocale("en_gb");
            setMessages(enGbMessages);
          }
        }
      } catch (error) {
        // Keep en_gb as fallback - don't block the app
        setLocale("en_gb");
        setMessages(enGbMessages);
      }
    };

    // Run asynchronously without blocking
    loadLocale().catch(() => {
      // Silently handle errors
    });
  }, []);

  // Listen for locale changes from Settings
  useEffect(() => {
    const handleLocaleChange = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const newLocale = customEvent.detail;
      setLocale(newLocale);
      // Reload messages for new locale
      import(`../messages/${newLocale}.json`)
        .then((module) => {
          setMessages(module.default);
        })
        .catch(() => {
          setMessages(enGbMessages);
          setLocale("en_gb");
        });
    };

    window.addEventListener("locale-change", handleLocaleChange);
    return () => {
      window.removeEventListener("locale-change", handleLocaleChange);
    };
  }, []);

  // Convert locale from app format (en_gb) to BCP 47 format (en-GB) for next-intl
  const bcp47Locale = denormalizeLocale(locale);

  return (
    <NextIntlClientProvider
      locale={bcp47Locale}
      messages={messages}
      timeZone={timeZone}
    >
      {children}
    </NextIntlClientProvider>
  );
}
