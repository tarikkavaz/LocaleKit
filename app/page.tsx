"use client";

import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileJson, Languages, Play, ChevronDown, RotateCcw } from "lucide-react";
import { isTauri } from "@/lib/utils";
import { getKey, migrateFromLocalStorage } from "@/lib/secure-keys";
import { UnifiedTranslator, getProviderForModel } from "@/lib/llm";
import { getAvailableModels, type ModelInfo } from "@/lib/models";
import type { Provider } from "@/lib/types";
import { getAllLanguages, getLanguageByCode } from "@/lib/languages";
import DraggableHeader from "@/components/DraggableHeader";
import JSONStructureViewer from "@/components/JSONStructureViewer";
import LanguageSelector from "@/components/LanguageSelector";
import InlineTranslationProgress from "@/components/InlineTranslationProgress";
import { useTheme } from "@/lib/useTheme";
import { useConsoleLogs } from "@/lib/useConsoleLogs";
import SettingsModal from "@/components/SettingsModal";
import { trackUsage, estimateTokens } from "@/lib/usage-tracker";

interface TranslationResult {
  languageCode: string;
  translatedJson: string;
  success: boolean;
  error?: string;
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
  if (
    base &&
    typeof base === "object" &&
    !Array.isArray(base)
  ) {
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
  const [sourceFilePath, setSourceFilePath] = useState<string | null>(null);
  const [jsonContent, setJsonContent] = useState<any>(null);
  const [excludedPaths, setExcludedPaths] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [sourceLanguageCode, setSourceLanguageCode] = useState<string | null>(null);
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
    failed: [] as Array<{ code: string; error: string }>,
    progress: 0,
  });
  const [translationResults, setTranslationResults] = useState<TranslationResult[]>([]);
  const { theme } = useTheme();
  const progressSectionRef = useRef<HTMLDivElement>(null);
  const [isReloadConfirmOpen, setIsReloadConfirmOpen] = useState(false);
  
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
        progress: 0,
      });

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
        setSelectedLanguages((prev) => prev.filter((code) => code !== detectedLangCode));
      }

      // Read the file
      const content = await invoke<string>("read_json_file", { path: filePath });

      // Parse JSON
      try {
        const parsed = JSON.parse(content);
        setJsonContent(parsed);
      } catch (parseError) {
        setError("Invalid JSON file. Please select a valid JSON file.");
        setJsonContent(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select file");
      setJsonContent(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!jsonContent || selectedLanguages.length === 0) {
      setError("Please select a file and at least one language");
      return;
    }

    const provider = getProviderForModel(model);
    const apiKey = apiKeys[provider];

    if (!apiKey || !apiKey.trim()) {
      setError(`Please add your ${provider} API key in Settings`);
      setIsSettingsOpen(true);
      return;
    }

    console.log("=".repeat(60));
    console.log("[Translation] Starting translation process");
    console.log(`[Translation] Selected languages: ${selectedLanguages.join(", ")}`);
    console.log(`[Translation] Total languages to translate: ${selectedLanguages.length}`);
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
      progress: 0,
    });

    // Scroll to progress section after a short delay to ensure it's rendered
    setTimeout(() => {
      if (progressSectionRef.current) {
        progressSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        // Fallback: scroll to bottom of page
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      }
    }, 100);

    const translator = new UnifiedTranslator(provider, apiKey, model);
    const results: TranslationResult[] = [];

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
          .map((r) => ({ code: r.languageCode, error: r.error || "Unknown error" })),
        progress: (i / selectedLanguages.length) * 100,
      });

      const startTime = Date.now();

      try {
        console.log(`[Translation] Starting translation for language: ${langCode} (${language?.name || langCode})`);
        console.log(`[Translation] Model: ${model}, Provider: ${provider}`);
        console.log(`[Translation] Excluded paths: ${excludedPaths.length} paths excluded`);
        
        // Convert JSON to string for API call
        // The translator will convert it to TOON format internally for maximum size reduction
        const jsonString = JSON.stringify(jsonContent); // Minified JSON
        const jsonStringFormatted = JSON.stringify(jsonContent, null, 2); // Formatted for display
        
        const jsonSize = new Blob([jsonString]).size;
        const formattedSize = new Blob([jsonStringFormatted]).size;
        const jsonSizeKB = (jsonSize / 1024).toFixed(2);
        const formattedSizeKB = (formattedSize / 1024).toFixed(2);
        
        console.log(`[Translation] JSON size (formatted): ${formattedSizeKB} KB`);
        console.log(`[Translation] JSON size (minified): ${jsonSizeKB} KB`);
        console.log(`[Translation] JSON character count: ${jsonString.length.toLocaleString()}`);
        console.log(`[Translation] Using TOON format for API call (will be converted internally)`);
        
        console.log(`[Translation] Sending request to AI API at ${new Date().toISOString()}`);
        
        // Send JSON - translator will convert to TOON internally
        const result = await translator.translate({
          jsonContent: jsonString,
          targetLanguage: language?.name || langCode,
          excludedPaths,
          model,
        });

        // Merge back with original to preserve any missing keys
        let mergedJsonString = result.translatedJson;
        try {
          const translatedObj = JSON.parse(result.translatedJson);
          const mergedObj = alignToBaseStructure(jsonContent, translatedObj);
          mergedJsonString = JSON.stringify(mergedObj, null, 2);
        } catch (mergeErr) {
          console.error("[Translation] Failed to merge translated JSON, using raw result:", mergeErr);
        }
        
        const duration = Date.now() - startTime;
        const durationSeconds = (duration / 1000).toFixed(2);
        console.log(`[Translation] Translation completed in ${durationSeconds}s`);
        
        const translatedSize = new Blob([mergedJsonString]).size;
        const translatedSizeKB = (translatedSize / 1024).toFixed(2);
        console.log(`[Translation] Translated JSON size: ${translatedSizeKB} KB`);

        // Track usage (approximate tokens from translated JSON)
        trackUsage({
          timestamp: Date.now(),
          provider,
          model,
          tokens: estimateTokens(mergedJsonString),
          duration,
          success: true,
        });

        results.push({
          languageCode: langCode,
          translatedJson: mergedJsonString,
          success: true,
        });

        // Automatically save the file immediately after successful translation
        if (sourceFilePath && mergedJsonString) {
          try {
            // Get directory and extension from source file
            const lastSlash = sourceFilePath.lastIndexOf("/");
            const directory = lastSlash >= 0 ? sourceFilePath.substring(0, lastSlash + 1) : "";
            const extension = sourceFilePath.substring(sourceFilePath.lastIndexOf("."));
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
          completed: results.filter((r) => r.success).map((r) => r.languageCode),
          failed: results
            .filter((r) => !r.success)
            .map((r) => ({ code: r.languageCode, error: r.error || "Unknown error" })),
          progress: ((i + 1) / selectedLanguages.length) * 100,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Translation failed";
        const isTimeout = errorMessage.includes("timeout") || errorMessage.includes("timed out") || errorMessage.includes("Load failed");
        const quotaLikely =
          provider === "openai" &&
          /quota|billing|usage limit|budget/i.test(errorMessage);
        
        console.error(`[Translation] Failed for ${langCode}:`, errorMessage);
        console.error(`[Translation] Error details:`, err);
        if (isTimeout) {
          console.warn(`[Translation] Timeout detected - file may be too large or API is slow`);
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
          tokens: 0,
          duration: Date.now() - startTime,
          success: false,
          error: errorMessage,
        });

        // Update progress even on failure
        setTranslationProgress({
          currentLanguage: language?.name || langCode,
          completed: results.filter((r) => r.success).map((r) => r.languageCode),
          failed: results
            .filter((r) => !r.success)
            .map((r) => ({ code: r.languageCode, error: r.error || "Unknown error" })),
          progress: ((i + 1) / selectedLanguages.length) * 100,
        });
      }
    }

    setTranslationResults(results);
    setTranslationProgress({
      currentLanguage: null,
      completed: results.filter((r) => r.success).map((r) => r.languageCode),
      failed: results
        .filter((r) => !r.success)
        .map((r) => ({ code: r.languageCode, error: r.error || "Unknown error" })),
      progress: 100,
    });
    setIsTranslating(false);
  };


  const handleQuit = async () => {
    if (isTauri()) {
      try {
        const { exit } = await import("@tauri-apps/plugin-process");
        await exit(0);
      } catch (err) {
        console.error("Failed to quit app:", err);
      }
    }
  };

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
            <h2 className="text-xl font-semibold text-foreground mb-4">About LocaleKit <span className="text-xs text-foreground/60 ml-4">v 1.0.0</span></h2>
            <p className="text-sm text-foreground/80 mb-4">
              LocaleKit is an AI-powered i18n translator that helps you translate JSON files into
              multiple languages using advanced AI models.
            </p>
            
            <p className="text-xs text-foreground/60 mb-4">
              <a
                href="https://tarik.kavaz.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/70 hover:text-foreground hover:underline"
              >
                Tarik Kavaz
              </a>
            </p>
            <button
              onClick={() => setIsAboutOpen(false)}
              className="w-full px-4 py-2 text-sm font-medium bg-primary text-button-text rounded-lg hover:bg-primary-hover transition-colors"
            >
              Close
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
            <h2 className="text-xl font-semibold text-foreground mb-4">Reload and Clear Cache</h2>
            <p className="text-sm text-foreground/80 mb-4">
              This will clear the current file and restart the app. Continue?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsReloadConfirmOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium bg-foreground/10 text-foreground rounded-lg hover:bg-foreground/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReloadConfirm}
                className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-button-text rounded-lg hover:bg-primary-hover transition-colors"
              >
                Reload
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
                  ? "Loading..."
                  : sourceFilePath
                  ? "Select Different File"
                  : "Select JSON File"}
              </button>
            </div>

            {sourceFilePath && (
              <div className="p-4 bg-card border border-border rounded-lg">
                <p className="text-sm text-foreground/60 mb-1">Selected file:</p>
                <p className="text-sm font-mono text-foreground break-all">{sourceFilePath}</p>
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
              <label className="block text-sm font-medium text-foreground">AI Model</label>
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    localStorage.setItem("selected-model", e.target.value);
                  }}
                  className="w-full px-4 py-2.5 bg-background/40 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm appearance-none cursor-pointer hover:bg-background/60 transition-colors pr-10"
                  style={{ 
                    backgroundColor: "var(--color-background)",
                    backdropFilter: "blur(8px)"
                  }}
                >
                  {availableModels.map((m) => (
                    <option 
                      key={m.id} 
                      value={m.id}
                      style={{ 
                        backgroundColor: "var(--card-bg-solid)",
                        color: "var(--color-foreground)"
                      }}
                    >
                      {m.name} {m.description ? `- ${m.description}` : ""}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-foreground/60" />
                </div>
              </div>
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
                      progressSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
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
                {isTranslating ? "Translating..." : "Translate"}
              </button>
            </div>
          )}

          {/* Translation Progress & Logs (Inline) */}
          <div ref={progressSectionRef}>
            <InlineTranslationProgress
              currentLanguage={translationProgress.currentLanguage}
              completedLanguages={translationProgress.completed}
              failedLanguages={translationProgress.failed}
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
