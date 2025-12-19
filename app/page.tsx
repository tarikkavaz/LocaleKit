"use client";

import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FileJson,
  Languages,
  Play,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { isTauri } from "@/lib/utils";
import { getKey, migrateFromLocalStorage } from "@/lib/secure-keys";
import { UnifiedTranslator, getProviderForModel } from "@/lib/llm";
import { getAvailableModels, type ModelInfo } from "@/lib/models";
import type { Provider } from "@/lib/types";
import { getAllLanguages, getLanguageByCode } from "@/lib/languages";
import { jsonToToon } from "@/lib/toon";
import DraggableHeader from "@/components/DraggableHeader";
import JSONStructureViewer from "@/components/JSONStructureViewer";
import LanguageSelector from "@/components/LanguageSelector";
import InlineTranslationProgress from "@/components/InlineTranslationProgress";
import { useTheme } from "@/lib/useTheme";
import { useConsoleLogs } from "@/lib/useConsoleLogs";
import SettingsModal from "@/components/SettingsModal";
import { trackUsage, estimateTokens } from "@/lib/usage-tracker";
import packageJson from "../package.json";
import CustomSelect from "@/components/CustomSelect";

interface TranslationResult {
  languageCode: string;
  translatedJson: string;
  success: boolean;
  error?: string;
  warnings?: string[];
}

// Align translated JSON to the base structure:
// - Only keep keys that exist in the base
// - If a key is missing in translated, fallback to base
// - Prevent extra keys from being added
function alignToBaseStructure(base: any, translated: any): any {
  // Arrays: if both arrays, use translated; otherwise fallback to base
  if (Array.isArray(base)) {
    if (Array.isArray(translated)) {
      return translated;
    }
    return base;
  }

  // Objects: keep only base keys, recurse
  if (base && typeof base === "object" && !Array.isArray(base)) {
    const result: any = {};
    const baseKeys = Object.keys(base);
    for (const key of baseKeys) {
      if (translated && typeof translated === "object" && key in translated) {
        result[key] = alignToBaseStructure(base[key], translated[key]);
      } else {
        result[key] = base[key];
      }
    }
    return result;
  }

  // Primitives: use translated if defined, else base
  if (translated !== undefined) return translated;
  return base;
}

export default function HomePage() {
  const t = useTranslations();
  const [sourceFilePath, setSourceFilePath] = useState<string | null>(null);
  const [jsonContent, setJsonContent] = useState<any>(null);
  const [excludedPaths, setExcludedPaths] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [sourceLanguageCode, setSourceLanguageCode] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<Provider, string>>({
    openai: "",
    anthropic: "",
    mistral: "",
    openrouter: "",
  });
  const [model, setModel] = useState<string>("gpt-4o-mini");
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({
    currentLanguage: null as string | null,
    completed: [] as string[],
    failed: [] as Array<{ code: string; name: string; error: string }>,
    warnings: [] as Array<{ code: string; name: string; warning: string }>,
    progress: 0,
  });
  const [translationResults, setTranslationResults] = useState<
    TranslationResult[]
  >([]);
  const { theme } = useTheme();
  const progressSectionRef = useRef<HTMLDivElement>(null);
  const [isReloadConfirmOpen, setIsReloadConfirmOpen] = useState(false);
  const [isQuitConfirmOpen, setIsQuitConfirmOpen] = useState(false);

  // Initialize console logging (logs persist across component mounts)
  useConsoleLogs();

  useEffect(() => {
    const initializeApp = async () => {
      if (isTauri()) {
        await migrateFromLocalStorage();
      }

      // Load API keys
      const loadedKeys: Record<Provider, string> = {
        openai: (await getKey("openai-api-key")) || "",
        anthropic: (await getKey("anthropic-api-key")) || "",
        mistral: (await getKey("mistral-api-key")) || "",
        openrouter: (await getKey("openrouter-api-key")) || "",
      };

      setApiKeys(loadedKeys);

      // Compute available models
      const hasKeys: Record<Provider, boolean> = {
        openai: !!loadedKeys.openai,
        anthropic: !!loadedKeys.anthropic,
        mistral: !!loadedKeys.mistral,
        openrouter: !!loadedKeys.openrouter,
      };
      const available = getAvailableModels(hasKeys);
      setAvailableModels(available);

      // Load saved model or default
      const savedModel = localStorage.getItem("selected-model");
      if (savedModel && available.some((m) => m.id === savedModel)) {
        setModel(savedModel);
      } else if (available.length > 0) {
        setModel(available[0].id);
      }
    };

    initializeApp().catch(console.error);
  }, []);

  const handleReset = () => {
    setSourceFilePath(null);
    setJsonContent(null);
    setExcludedPaths([]);
    setSelectedLanguages([]);
    setSourceLanguageCode(null);
    setError("");
    setIsTranslating(false);
    setTranslationResults([]);
    setTranslationProgress({
      currentLanguage: null,
      completed: [],
      failed: [],
      warnings: [],
      progress: 0,
    });
  };

  const handleSelectFile = async () => {
    try {
      setIsLoading(true);
      setError("");
      setJsonContent(null);
      setExcludedPaths([]);
      setTranslationResults([]);
      setSourceLanguageCode(null);
      setIsTranslating(false);
      setTranslationProgress({
        currentLanguage: null,
        completed: [],
        failed: [],
        warnings: [],
        progress: 0,
      });

      // Get file path (no timeout needed - dialog will return null if cancelled)
      const filePath = await invoke<string | null>("select_source_file");

      if (!filePath) {
        setIsLoading(false);
        setSourceLanguageCode(null);
        return;
      }

      setSourceFilePath(filePath);

      // Extract language code from filename if it matches pattern {name}_{langCode}.json
      const fileName = filePath.split(/[/\\]/).pop() || "";
      const fileNameWithoutExt = fileName.replace(/\.json$/i, "");
      const allLanguages = getAllLanguages();

      // Check if filename ends with a known language code pattern
      let detectedLangCode: string | null = null;
      for (const lang of allLanguages) {
        if (fileNameWithoutExt.endsWith(`_${lang.code}`)) {
          detectedLangCode = lang.code;
          break;
        }
        // Also check if the entire filename is just the language code
        if (fileNameWithoutExt === lang.code) {
          detectedLangCode = lang.code;
          break;
        }
      }

      setSourceLanguageCode(detectedLangCode);

      // Remove source language from selected languages if it was selected
      if (detectedLangCode) {
        setSelectedLanguages((prev) =>
          prev.filter((code) => code !== detectedLangCode)
        );
      }

      // Read the file with timeout
      const readPromise = invoke<string>("read_json_file", { path: filePath });
      const readTimeoutPromise = new Promise<string>(
        (_, reject) =>
          setTimeout(() => reject(new Error("File read timeout")), 10000) // 10 second timeout
      );

      const content = await Promise.race([readPromise, readTimeoutPromise]);

      // Parse JSON
      try {
        const parsed = JSON.parse(content);
        setJsonContent(parsed);
      } catch (parseError) {
        setError(t("homePage.errorInvalidJson"));
        setJsonContent(null);
      }
    } catch (err) {
      console.error("Error selecting file:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage || t("homePage.errorFailedSelect"));
      setJsonContent(null);
      setSourceFilePath(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!jsonContent || selectedLanguages.length === 0) {
      setError(t("homePage.errorSelectFile"));
      return;
    }

    const provider = getProviderForModel(model);
    const apiKey = apiKeys[provider];

    if (!apiKey || !apiKey.trim()) {
      setError(t("homePage.errorApiKey", { provider }));
      setIsSettingsOpen(true);
      return;
    }

    console.log("=".repeat(60));
    console.log("[Translation] Starting translation process");
    console.log(
      `[Translation] Selected languages: ${selectedLanguages.join(", ")}`
    );
    console.log(
      `[Translation] Total languages to translate: ${selectedLanguages.length}`
    );
    console.log(`[Translation] Model: ${model}`);
    console.log(`[Translation] Provider: ${provider}`);
    console.log(`[Translation] Excluded paths: ${excludedPaths.length}`);
    if (excludedPaths.length > 0) {
      console.log(`[Translation] Excluded paths:`, excludedPaths);
    }

    setIsTranslating(true);
    setError("");
    setTranslationResults([]);
    setTranslationProgress({
      currentLanguage: null,
      completed: [],
      failed: [],
      warnings: [],
      progress: 0,
    });

    // Scroll to progress section after a short delay to ensure it's rendered
    setTimeout(() => {
      if (progressSectionRef.current) {
        progressSectionRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      } else {
        // Fallback: scroll to bottom of page
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 100);

    const translator = new UnifiedTranslator(provider, apiKey, model);
    const results: TranslationResult[] = [];
    const INPUT_TOKEN_OVERHEAD = 400;
    const baseJsonString = JSON.stringify(jsonContent); // Minified for transport
    const baseJsonFormatted = JSON.stringify(jsonContent, null, 2); // Pretty for logs/merge display
    const baseToonString = jsonToToon(jsonContent);
    const inputTokensEstimate =
      estimateTokens(baseToonString) + INPUT_TOKEN_OVERHEAD;
    const jsonSize = new Blob([baseJsonString]).size;
    const formattedSize = new Blob([baseJsonFormatted]).size;
    const jsonSizeKB = (jsonSize / 1024).toFixed(2);
    const formattedSizeKB = (formattedSize / 1024).toFixed(2);

    // TEST MODE: Set to true to test warnings and errors
    // Specify language codes that should fail, have warnings, or pass
    const TEST_MODE = false; // Set to true to enable test mode
    const TEST_FAIL_LANGUAGE = "en_us"; // Language code that will fail
    const TEST_WARNING_LANGUAGE = "es_es"; // Language code that will have a warning
    // All other languages will pass normally

    // Resolve which languages to simulate based on the current selection
    const testFailLangCode = TEST_MODE
      ? (selectedLanguages.find((code) => code === TEST_FAIL_LANGUAGE) ??
        selectedLanguages[0])
      : null;
    const testWarningLangCode = TEST_MODE
      ? (selectedLanguages.find(
          (code) => code === TEST_WARNING_LANGUAGE && code !== testFailLangCode
        ) ?? selectedLanguages.find((code) => code !== testFailLangCode))
      : null;

    // Sequential translation - one language at a time
    for (let i = 0; i < selectedLanguages.length; i++) {
      const langCode = selectedLanguages[i];
      const language = getLanguageByCode(langCode);

      // Update progress before starting this language
      setTranslationProgress({
        currentLanguage: language?.name || langCode,
        completed: results.filter((r) => r.success).map((r) => r.languageCode),
        failed: results
          .filter((r) => !r.success)
          .map((r) => {
            const failedLang = getLanguageByCode(r.languageCode);
            return {
              code: r.languageCode,
              name: failedLang?.name || r.languageCode,
              error: r.error || "Unknown error",
            };
          }),
        warnings: results
          .filter((r) => r.success && r.warnings?.length)
          .map((r) => {
            const warnLang = getLanguageByCode(r.languageCode);
            return {
              code: r.languageCode,
              name: warnLang?.name || r.languageCode,
              warning: r.warnings?.[0] || "Warning",
            };
          }),
        progress: (i / selectedLanguages.length) * 100,
      });

      const startTime = Date.now();

      // TEST MODE: Simulate outcomes without calling API
      if (TEST_MODE) {
        const simulatedJson = JSON.stringify(jsonContent, null, 2);

        if (langCode === testFailLangCode) {
          results.push({
            languageCode: langCode,
            translatedJson: "",
            success: false,
            error: "Test error: Simulated translation failure for testing",
          });

          setTranslationProgress({
            currentLanguage: language?.name || langCode,
            completed: results
              .filter((r) => r.success)
              .map((r) => r.languageCode),
            failed: results
              .filter((r) => !r.success)
              .map((r) => {
                const failedLang = getLanguageByCode(r.languageCode);
                return {
                  code: r.languageCode,
                  name: failedLang?.name || r.languageCode,
                  error: r.error || "Unknown error",
                };
              }),
            warnings: results
              .filter((r) => r.success && r.warnings?.length)
              .map((r) => {
                const warnLang = getLanguageByCode(r.languageCode);
                return {
                  code: r.languageCode,
                  name: warnLang?.name || r.languageCode,
                  warning: r.warnings?.[0] || "Warning",
                };
              }),
            progress: ((i + 1) / selectedLanguages.length) * 100,
          });

          continue;
        }

        const simulatedWarning = langCode === testWarningLangCode;
        results.push({
          languageCode: langCode,
          translatedJson: simulatedJson,
          success: true,
          warnings: simulatedWarning
            ? ["Test warning: Simulated merge failure for testing"]
            : undefined,
        });

        setTranslationProgress({
          currentLanguage: language?.name || langCode,
          completed: results
            .filter((r) => r.success)
            .map((r) => r.languageCode),
          failed: results
            .filter((r) => !r.success)
            .map((r) => {
              const failedLang = getLanguageByCode(r.languageCode);
              return {
                code: r.languageCode,
                name: failedLang?.name || r.languageCode,
                error: r.error || "Unknown error",
              };
            }),
          warnings: results
            .filter((r) => r.success && r.warnings?.length)
            .map((r) => {
              const warnLang = getLanguageByCode(r.languageCode);
              return {
                code: r.languageCode,
                name: warnLang?.name || r.languageCode,
                warning: r.warnings?.[0] || "Warning",
              };
            }),
          progress: ((i + 1) / selectedLanguages.length) * 100,
        });

        continue;
      }

      try {
        console.log(
          `[Translation] Starting translation for language: ${langCode} (${language?.name || langCode})`
        );
        console.log(`[Translation] Model: ${model}, Provider: ${provider}`);
        console.log(
          `[Translation] Excluded paths: ${excludedPaths.length} paths excluded`
        );

        console.log(
          `[Translation] JSON size (formatted): ${formattedSizeKB} KB`
        );
        console.log(`[Translation] JSON size (minified): ${jsonSizeKB} KB`);
        console.log(
          `[Translation] JSON character count: ${baseJsonString.length.toLocaleString()}`
        );
        console.log(
          `[Translation] Using TOON format for API call (converted internally)`
        );

        console.log(
          `[Translation] Sending request to AI API at ${new Date().toISOString()}`
        );

        // Send JSON - translator will convert to TOON internally
        const result = await translator.translate({
          jsonContent: baseJsonString,
          targetLanguage: language?.name || langCode,
          excludedPaths,
          model,
        });

        // Merge back with original to preserve any missing keys
        let mergedJsonString = result.translatedJson;
        let hasWarning = false;
        try {
          const translatedObj = JSON.parse(result.translatedJson);
          const mergedObj = alignToBaseStructure(jsonContent, translatedObj);
          mergedJsonString = JSON.stringify(mergedObj, null, 2);
        } catch (mergeErr) {
          console.error(
            "[Translation] Failed to merge translated JSON, using raw result:",
            mergeErr
          );
          hasWarning = true;
        }

        const duration = Date.now() - startTime;
        const durationSeconds = (duration / 1000).toFixed(2);
        console.log(
          `[Translation] Translation completed in ${durationSeconds}s`
        );

        const translatedSize = new Blob([mergedJsonString]).size;
        const translatedSizeKB = (translatedSize / 1024).toFixed(2);
        console.log(
          `[Translation] Translated JSON size: ${translatedSizeKB} KB`
        );

        // Track usage (approximate tokens for input + output)
        const outputTokens = estimateTokens(mergedJsonString);
        const totalTokens = inputTokensEstimate + outputTokens;
        trackUsage({
          timestamp: Date.now(),
          provider,
          model,
          tokens: totalTokens,
          inputTokens: inputTokensEstimate,
          outputTokens,
          totalTokens,
          duration,
          success: true,
        });

        results.push({
          languageCode: langCode,
          translatedJson: mergedJsonString,
          success: true,
          warnings: hasWarning
            ? ["Merge failed - using raw translation result"]
            : undefined,
        });

        // Automatically save the file immediately after successful translation
        if (sourceFilePath && mergedJsonString) {
          try {
            // Get directory and extension from source file
            const lastSlash = sourceFilePath.lastIndexOf("/");
            const directory =
              lastSlash >= 0 ? sourceFilePath.substring(0, lastSlash + 1) : "";
            const extension = sourceFilePath.substring(
              sourceFilePath.lastIndexOf(".")
            );
            const targetPath = `${directory}${langCode}${extension}`;

            // Never overwrite the source file
            if (targetPath !== sourceFilePath) {
              console.log(`Auto-saving: ${targetPath}`);
              await invoke("write_json_file", {
                path: targetPath,
                content: mergedJsonString,
              });
              // Use console.info with a success prefix for green color in logs
              console.info(`[SUCCESS] Successfully saved: ${targetPath}`);
            }
          } catch (saveErr) {
            console.error(`Failed to auto-save ${langCode}:`, saveErr);
            // Don't fail the translation if save fails - user can save manually later
          }
        }

        // Update progress after completing this language
        setTranslationProgress({
          currentLanguage: language?.name || langCode,
          completed: results
            .filter((r) => r.success)
            .map((r) => r.languageCode),
          failed: results
            .filter((r) => !r.success)
            .map((r) => {
              const failedLang = getLanguageByCode(r.languageCode);
              return {
                code: r.languageCode,
                name: failedLang?.name || r.languageCode,
                error: r.error || "Unknown error",
              };
            }),
          warnings: results
            .filter((r) => r.success && r.warnings?.length)
            .map((r) => {
              const warnLang = getLanguageByCode(r.languageCode);
              return {
                code: r.languageCode,
                name: warnLang?.name || r.languageCode,
                warning: r.warnings?.[0] || "Warning",
              };
            }),
          progress: ((i + 1) / selectedLanguages.length) * 100,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Translation failed";
        const isTimeout =
          errorMessage.includes("timeout") ||
          errorMessage.includes("timed out") ||
          errorMessage.includes("Load failed");
        const quotaLikely =
          provider === "openai" &&
          /quota|billing|usage limit|budget/i.test(errorMessage);

        console.error(`[Translation] Failed for ${langCode}:`, errorMessage);
        console.error(`[Translation] Error details:`, err);
        if (isTimeout) {
          console.warn(
            `[Translation] Timeout detected - file may be too large or API is slow`
          );
        }
        if (quotaLikely) {
          console.warn(
            `[Translation] Possible OpenAI quota/budget limit reached. Check your usage/billing dashboard.`
          );
        }

        results.push({
          languageCode: langCode,
          translatedJson: "",
          success: false,
          error: isTimeout
            ? `Translation timed out. The file may be too large. Try excluding more paths or using a faster model.`
            : quotaLikely
              ? `OpenAI may have hit a quota/budget limit. Check billing/usage.`
              : errorMessage,
        });

        // Track failed attempt
        trackUsage({
          timestamp: Date.now(),
          provider,
          model,
          tokens: inputTokensEstimate,
          inputTokens: inputTokensEstimate,
          outputTokens: 0,
          totalTokens: inputTokensEstimate,
          duration: Date.now() - startTime,
          success: false,
          error: errorMessage,
        });

        // Update progress even on failure
        setTranslationProgress({
          currentLanguage: language?.name || langCode,
          completed: results
            .filter((r) => r.success)
            .map((r) => r.languageCode),
          failed: results
            .filter((r) => !r.success)
            .map((r) => {
              const failedLang = getLanguageByCode(r.languageCode);
              return {
                code: r.languageCode,
                name: failedLang?.name || r.languageCode,
                error: r.error || "Unknown error",
              };
            }),
          warnings: results
            .filter((r) => r.success && r.warnings?.length)
            .map((r) => {
              const warnLang = getLanguageByCode(r.languageCode);
              return {
                code: r.languageCode,
                name: warnLang?.name || r.languageCode,
                warning: r.warnings?.[0] || "Warning",
              };
            }),
          progress: ((i + 1) / selectedLanguages.length) * 100,
        });
      }
    }

    setTranslationResults(results);
    const failedLanguages = results.filter((r) => !r.success);
    const warningLanguages = results.filter(
      (r) => r.success && r.warnings?.length
    );

    setTranslationProgress({
      currentLanguage: null,
      completed: results.filter((r) => r.success).map((r) => r.languageCode),
      failed: failedLanguages.map((r) => {
        const failedLang = getLanguageByCode(r.languageCode);
        return {
          code: r.languageCode,
          name: failedLang?.name || r.languageCode,
          error: r.error || "Unknown error",
        };
      }),
      warnings: warningLanguages.map((r) => {
        const warnLang = getLanguageByCode(r.languageCode);
        return {
          code: r.languageCode,
          name: warnLang?.name || r.languageCode,
          warning: r.warnings?.[0] || "Warning",
        };
      }),
      progress: 100,
    });
    setIsTranslating(false);

    // Show messages and auto-deselect languages
    if (warningLanguages.length > 0) {
      const warningNames = warningLanguages.map((r) => {
        const lang = getLanguageByCode(r.languageCode);
        return lang?.name || r.languageCode;
      });
      console.info(
        `[Translation] Translation completed with these languages with warnings: ${warningNames.join(", ")}.`
      );
    }

    if (failedLanguages.length > 0) {
      const failedNames = failedLanguages.map((r) => {
        const lang = getLanguageByCode(r.languageCode);
        return lang?.name || r.languageCode;
      });
      console.error(
        `[Translation] Translation completed with these languages failed: ${failedNames.join(
          ", "
        )}. These have been reselected in the Language Selector—review the errors and try again.`
      );
      // Deselect all languages except failed ones
      setSelectedLanguages(failedLanguages.map((r) => r.languageCode));
    }
  };

  const handleQuit = () => {
    setIsQuitConfirmOpen(true);
  };

  const handleQuitConfirm = async () => {
    setIsQuitConfirmOpen(false);
    if (isTauri()) {
      try {
        // Exit the process directly - this works for all quit methods
        const { exit } = await import("@tauri-apps/plugin-process");
        await exit(0);
      } catch (err) {
        console.error("Failed to quit app:", err);
        // Fallback: try to close the window
        try {
          await invoke("close_window");
        } catch (closeErr) {
          console.error("Failed to close window:", closeErr);
        }
      }
    }
  };

  // Handle keyboard shortcut for quit (Cmd+Q on Mac, Ctrl+Q on Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isQuitShortcut = isMac
        ? event.metaKey && event.key === "q"
        : event.ctrlKey && event.key === "q";

      if (isQuitShortcut && isTauri()) {
        event.preventDefault();
        setIsQuitConfirmOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Listen for window close events from Tauri (red traffic light, menubar close)
  useEffect(() => {
    if (!isTauri()) return;

    let unlistenCloseFn: (() => void) | null = null;
    let unlistenAboutFn: (() => void) | null = null;

    const setupEventListeners = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const unlistenClose = await listen("window-close-requested", () => {
        setIsQuitConfirmOpen(true);
      });
      unlistenCloseFn = unlistenClose;

      const unlistenAbout = await listen("open-about", () => {
        setIsAboutOpen(true);
      });
      unlistenAboutFn = unlistenAbout;
    };

    setupEventListeners();

    return () => {
      if (unlistenCloseFn) {
        unlistenCloseFn();
      }
      if (unlistenAboutFn) {
        unlistenAboutFn();
      }
    };
  }, []);

  const handleAbout = () => {
    setIsAboutOpen(true);
  };

  const handleReloadConfirm = () => {
    // Clear app state
    handleReset();
    setIsReloadConfirmOpen(false);
    // Reload the app to ensure any cached content is cleared
    window.location.reload();
  };

  return (
    <>
      <DraggableHeader
        onSettingsClick={() => setIsSettingsOpen(true)}
        onAboutClick={handleAbout}
        onQuitClick={handleQuit}
        onReloadClick={() => setIsReloadConfirmOpen(true)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(newApiKeys) => {
          setApiKeys(newApiKeys);
          const hasKeys: Record<Provider, boolean> = {
            openai: !!newApiKeys.openai,
            anthropic: !!newApiKeys.anthropic,
            mistral: !!newApiKeys.mistral,
            openrouter: !!newApiKeys.openrouter,
          };
          const available = getAvailableModels(hasKeys);
          setAvailableModels(available);
          if (available.length > 0 && !available.some((m) => m.id === model)) {
            setModel(available[0].id);
          }
        }}
        currentApiKeys={apiKeys}
      />

      {isAboutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{ backgroundColor: "var(--color-modal-backdrop)" }}
        >
          <div
            className="relative w-full max-w-md mx-4 bg-card-bg rounded-lg shadow-xl p-6"
            style={{ backgroundColor: "var(--card-bg-solid)" }}
          >
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("about.title")}{" "}
              <span className="text-xs text-foreground/60 ml-4">
                v{packageJson.version}
              </span>
            </h2>
            <p className="text-sm text-foreground/80 mb-4">
              {t("about.description")}
            </p>

            <p className="text-xs text-foreground/60 mb-4">
              <a
                href="https://tarik.kavaz.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/70 hover:text-foreground hover:underline"
              >
                {t("about.author")}
              </a>
            </p>
            <button
              onClick={() => setIsAboutOpen(false)}
              className="w-full px-4 py-2 text-sm font-medium bg-primary text-button-text rounded-lg hover:bg-primary-hover transition-colors"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      )}

      {isReloadConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{ backgroundColor: "var(--color-modal-backdrop)" }}
        >
          <div
            className="relative w-full max-w-md mx-4 bg-card-bg rounded-lg shadow-xl p-6"
            style={{ backgroundColor: "var(--card-bg-solid)" }}
          >
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("reloadConfirm.title")}
            </h2>
            <p className="text-sm text-foreground/80 mb-4">
              {t("reloadConfirm.message")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsReloadConfirmOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium bg-foreground/10 text-foreground rounded-lg hover:bg-foreground/20 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleReloadConfirm}
                className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-button-text rounded-lg hover:bg-primary-hover transition-colors"
              >
                {t("common.reload")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isQuitConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{ backgroundColor: "var(--color-modal-backdrop)" }}
        >
          <div
            className="relative w-full max-w-md mx-4 bg-card-bg rounded-lg shadow-xl p-6"
            style={{ backgroundColor: "var(--card-bg-solid)" }}
          >
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("quitConfirm.title")}
            </h2>
            <p className="text-sm text-foreground/80 mb-4">
              {t("quitConfirm.message")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsQuitConfirmOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium bg-foreground/10 text-foreground rounded-lg hover:bg-foreground/20 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleQuitConfirm}
                className="flex-1 px-4 py-2 text-sm font-medium bg-error-text text-black rounded-lg hover:brightness-110 transition-colors"
              >
                {t("common.quit")}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="h-screen flex justify-center p-6 bg-transparent pt-24 transition-colors overflow-auto">
        <div className="w-full max-w-4xl space-y-6">
          {/* File Selection */}
          <div className="space-y-4">
            <div className="flex gap-3">
              <button
                onClick={handleSelectFile}
                disabled={isLoading || isTranslating}
                className="flex-1 px-6 py-4 bg-primary text-button-text font-medium rounded-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <FileJson className="w-5 h-5" />
                {isLoading
                  ? t("common.loading")
                  : sourceFilePath
                    ? t("homePage.selectDifferentFile")
                    : t("homePage.selectFile")}
              </button>
            </div>

            {sourceFilePath && (
              <div className="p-4 bg-card border border-border rounded-lg">
                <p className="text-sm text-foreground/60 mb-1">
                  {t("homePage.selectedFile")}
                </p>
                <p className="text-sm font-mono text-foreground break-all">
                  {sourceFilePath}
                </p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-error-bg border border-error-border rounded-lg">
                <p className="text-sm text-error-text">{error}</p>
              </div>
            )}
          </div>

          {/* Model Selection */}
          {availableModels.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                {t("homePage.selectModel")}
              </label>
              <CustomSelect
                value={model}
                onChange={(value) => {
                  setModel(value);
                  localStorage.setItem("selected-model", value);
                }}
                options={availableModels.map((m) => ({
                  value: m.id,
                  label: `${m.name}${m.description ? ` - ${m.description}` : ""}`,
                }))}
              />
            </div>
          )}

          {/* JSON Structure Viewer */}
          {jsonContent && (
            <JSONStructureViewer
              jsonData={jsonContent}
              excludedPaths={excludedPaths}
              onExcludedPathsChange={setExcludedPaths}
            />
          )}

          {/* Language Selector */}
          {jsonContent && (
            <LanguageSelector
              selectedLanguages={selectedLanguages}
              onSelectionChange={(languages) => {
                setSelectedLanguages(languages);
                // Scroll to progress section when at least one language is selected
                if (languages.length > 0 && progressSectionRef.current) {
                  setTimeout(() => {
                    if (progressSectionRef.current) {
                      progressSectionRef.current.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }
                  }, 100);
                }
              }}
              excludeLanguageCode={sourceLanguageCode}
            />
          )}

          {/* Translate Button */}
          {jsonContent && selectedLanguages.length > 0 && (
            <div className="pb-4">
              <button
                onClick={handleTranslate}
                disabled={isTranslating || availableModels.length === 0}
                className="w-full px-6 py-3 bg-primary text-button-text font-medium rounded-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                {isTranslating
                  ? t("homePage.translating")
                  : t("homePage.translate")}
              </button>
            </div>
          )}

          {/* Translation Progress & Logs (Inline) */}
          <div ref={progressSectionRef}>
            <InlineTranslationProgress
              currentLanguage={translationProgress.currentLanguage}
              completedLanguages={translationProgress.completed}
              failedLanguages={translationProgress.failed}
              warningsLanguages={translationProgress.warnings}
              totalLanguages={selectedLanguages.length}
              progress={translationProgress.progress}
              isTranslating={isTranslating}
            />
          </div>
        </div>
      </main>
    </>
  );
}
