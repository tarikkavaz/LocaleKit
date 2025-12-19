"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  X,
  Plus,
  Trash2,
  Edit2,
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { open } from "@tauri-apps/plugin-shell";
import type { Provider } from "@/lib/types";
import { deleteKey, getKey, setKey } from "@/lib/secure-keys";
import {
  getAllLanguages,
  addCustomLanguage,
  updateCustomLanguage,
  deleteCustomLanguage,
  validateLanguageCode,
  type Language,
} from "@/lib/languages";
import { isTauri } from "@/lib/utils";
import { clearUsageHistory, getUsageStatsForPeriod } from "@/lib/usage-tracker";
import {
  getAvailableLocales,
  getLocaleName,
  getStoredLocale,
  setStoredLocale,
} from "@/lib/i18n/locale";
import CustomSelect from "@/components/CustomSelect";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKeys: Record<Provider, string>) => void;
  currentApiKeys: Record<Provider, string>;
}

const API_KEY_CONFIG: Array<{
  provider: Provider;
  url: string;
}> = [
  {
    provider: "openai",
    url: "https://platform.openai.com/api-keys",
  },
  {
    provider: "anthropic",
    url: "https://console.anthropic.com/settings/keys",
  },
  {
    provider: "mistral",
    url: "https://console.mistral.ai/api-keys/",
  },
  {
    provider: "openrouter",
    url: "https://openrouter.ai/keys",
  },
];

export default function SettingsModal({
  isOpen,
  onClose,
  onSave,
  currentApiKeys,
}: SettingsModalProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  const [apiKeys, setApiKeys] =
    useState<Record<Provider, string>>(currentApiKeys);
  const [activeTab, setActiveTab] = useState<
    "app-settings" | "languages" | "api-keys" | "usage"
  >("app-settings");
  const [languages, setLanguages] = useState<Language[]>(getAllLanguages());
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null);
  const [newLanguageCode, setNewLanguageCode] = useState("");
  const [newLanguageName, setNewLanguageName] = useState("");
  const [isTauriApp, setIsTauriApp] = useState(false);
  const [usagePeriod, setUsagePeriod] = useState<7 | 30 | 90>(30);
  const [usageRefreshKey, setUsageRefreshKey] = useState(0);
  const usageStats = getUsageStatsForPeriod(usagePeriod);
  const [pendingDeleteCode, setPendingDeleteCode] = useState<string | null>(
    null
  );
  const [selectedLocale, setSelectedLocale] = useState<string>("en_gb");
  const availableLocales = getAvailableLocales();

  useEffect(() => {
    setIsTauriApp(isTauri());
  }, []);

  useEffect(() => {
    // Load current locale preference
    const loadLocale = async () => {
      try {
        // Add overall timeout for the entire operation
        const timeoutPromise = new Promise<void>((resolve) =>
          setTimeout(() => {
            resolve();
          }, 3000)
        );

        const localePromise = (async () => {
          const stored = await getStoredLocale();
          if (stored) {
            setSelectedLocale(stored);
          }
        })();

        await Promise.race([localePromise, timeoutPromise]);
      } catch (error) {
        // Silently handle errors
      }
    };
    if (isOpen) {
      loadLocale().catch(() => {
        // Silently handle errors
      });
    }
  }, [isOpen]);

  useEffect(() => {
    setApiKeys(currentApiKeys);
  }, [currentApiKeys]);

  useEffect(() => {
    setLanguages(getAllLanguages());
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Save all API keys to secure storage
    try {
      for (const provider of Object.keys(apiKeys) as Provider[]) {
        const keyValue = apiKeys[provider];
        const keyName = `${provider}-api-key`;

        if (keyValue && keyValue.trim().length > 0) {
          await setKey(keyName, keyValue);
        } else {
          try {
            await deleteKey(keyName);
          } catch (err) {
            // Ignore if key doesn't exist
          }
        }
      }

      // Save locale preference
      await setStoredLocale(selectedLocale);

      // Dispatch locale change event
      window.dispatchEvent(
        new CustomEvent("locale-change", { detail: selectedLocale })
      );

      onSave(apiKeys);
      onClose();
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert(t("apiKeys.failedSave"));
    }
  };

  const handleLocaleChange = async (locale: string) => {
    setSelectedLocale(locale);
    // Save immediately
    try {
      await setStoredLocale(locale);
      // Dispatch locale change event
      window.dispatchEvent(
        new CustomEvent("locale-change", { detail: locale })
      );
    } catch (error) {
      console.error("Failed to save locale:", error);
    }
  };

  const handleAddLanguage = () => {
    if (!newLanguageCode.trim() || !newLanguageName.trim()) {
      alert(t("languages.enterBoth"));
      return;
    }

    if (!validateLanguageCode(newLanguageCode)) {
      alert(t("languages.invalidCode"));
      return;
    }

    try {
      addCustomLanguage(newLanguageCode.trim(), newLanguageName.trim());
      setLanguages(getAllLanguages());
      setNewLanguageCode("");
      setNewLanguageName("");
    } catch (error) {
      alert(error instanceof Error ? error.message : t("languages.failedAdd"));
    }
  };

  const handleUpdateLanguage = (oldCode: string) => {
    if (!editingLanguage) return;

    if (!editingLanguage.code.trim() || !editingLanguage.name.trim()) {
      alert(t("languages.enterBoth"));
      return;
    }

    if (!validateLanguageCode(editingLanguage.code)) {
      alert(t("languages.invalidCode"));
      return;
    }

    try {
      updateCustomLanguage(
        oldCode,
        editingLanguage.code.trim(),
        editingLanguage.name.trim()
      );
      setLanguages(getAllLanguages());
      setEditingLanguage(null);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : t("languages.failedUpdate")
      );
    }
  };

  const handleDeleteLanguage = (code: string) => {
    setPendingDeleteCode(code);
  };

  const confirmDeleteLanguage = () => {
    if (!pendingDeleteCode) return;
    try {
      deleteCustomLanguage(pendingDeleteCode);
      setLanguages(getAllLanguages());
    } catch (error) {
      alert(
        error instanceof Error ? error.message : t("languages.failedDelete")
      );
    } finally {
      setPendingDeleteCode(null);
    }
  };

  const handleClearUsage = () => {
    if (!confirm(t("usage.clearConfirm"))) return;
    clearUsageHistory();
    setUsageRefreshKey((k) => k + 1);
  };

  const handleApiKeyChange = (provider: Provider, value: string) => {
    setApiKeys((prev) => ({ ...prev, [provider]: value }));
  };

  const handleOpenAPIKey = async (url: string) => {
    try {
      await open(url);
    } catch (error) {
      console.error("Failed to open API key URL:", error);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: "var(--color-modal-backdrop)" }}
    >
      <div
        className="relative w-full max-w-[550px] mx-4 bg-card-bg rounded-lg shadow-xl transition-colors"
        style={{ backgroundColor: "var(--card-bg-solid)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {t("title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-foreground/5 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("app-settings")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "app-settings"
                ? "bg-primary text-button-text border-b-2 border-primary"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {t("tabs.appSettings")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("languages")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "languages"
                ? "bg-primary text-button-text border-b-2 border-primary"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {t("tabs.languages")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("api-keys")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "api-keys"
                ? "bg-primary text-button-text border-b-2 border-primary"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {t("tabs.apiKeys")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("usage")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "usage"
                ? "bg-primary text-button-text border-b-2 border-primary"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {t("tabs.usage")}
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSave}
          className="p-6 space-y-6 max-h-[60vh] overflow-y-auto"
        >
          {/* App Settings Tab */}
          {activeTab === "app-settings" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  {t("appSettings.selectLanguage")}
                </label>
                <CustomSelect
                  value={selectedLocale}
                  onChange={handleLocaleChange}
                  options={availableLocales.map((locale) => ({
                    value: locale,
                    label: getLocaleName(locale),
                  }))}
                />
                <p className="text-xs text-foreground/60">
                  {t("appSettings.languageDescription")}
                </p>
              </div>
            </div>
          )}

          {/* Languages Tab */}
          {activeTab === "languages" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">
                  {t("languages.addCustom")}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder={t("languages.codePlaceholder")}
                    value={newLanguageCode}
                    onChange={(e) => setNewLanguageCode(e.target.value)}
                    className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
                  />
                  <input
                    type="text"
                    placeholder={t("languages.namePlaceholder")}
                    value={newLanguageName}
                    onChange={(e) => setNewLanguageName(e.target.value)}
                    className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddLanguage}
                  className="px-4 py-2 text-sm font-medium bg-primary text-button-text rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {t("languages.add")}
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">
                  {t("languages.allLanguages")}
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {languages.map((lang) => {
                    const isEditing = editingLanguage?.code === lang.code;
                    return (
                      <div
                        key={lang.code}
                        className="flex items-center gap-2 p-2 bg-background/50 rounded-lg"
                      >
                        {isEditing ? (
                          <>
                            <input
                              type="text"
                              value={editingLanguage.code}
                              onChange={(e) =>
                                setEditingLanguage({
                                  ...editingLanguage,
                                  code: e.target.value,
                                })
                              }
                              className="flex-1 px-2 py-1 bg-background border border-border rounded text-sm text-foreground"
                            />
                            <input
                              type="text"
                              value={editingLanguage.name}
                              onChange={(e) =>
                                setEditingLanguage({
                                  ...editingLanguage,
                                  name: e.target.value,
                                })
                              }
                              className="flex-1 px-2 py-1 bg-background border border-border rounded text-sm text-foreground"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateLanguage(lang.code)}
                              className="px-2 py-1 text-xs bg-primary text-button-text rounded"
                            >
                              {tCommon("save")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingLanguage(null)}
                              className="px-2 py-1 text-xs bg-foreground/10 text-foreground rounded"
                            >
                              {tCommon("cancel")}
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-foreground">
                                {lang.name}
                              </div>
                              <div className="text-xs text-foreground/60 font-mono">
                                {lang.code}
                              </div>
                            </div>
                            {lang.isDefault ? (
                              <span className="text-xs text-foreground/40 px-2 py-1 bg-foreground/5 rounded">
                                {tCommon("default")}
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingLanguage({ ...lang })
                                  }
                                  className="p-1 hover:bg-foreground/10 rounded"
                                >
                                  <Edit2 className="w-4 h-4 text-foreground/60" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteLanguage(lang.code)
                                  }
                                  className="p-1 hover:bg-foreground/10 rounded"
                                >
                                  <Trash2 className="w-4 h-4 text-error-text" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Delete Language Confirmation */}
          {pendingDeleteCode && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
              style={{ backgroundColor: "var(--color-modal-backdrop)" }}
            >
              <div
                className="relative w-full max-w-md mx-4 bg-card-bg rounded-lg shadow-xl p-6"
                style={{ backgroundColor: "var(--card-bg-solid)" }}
              >
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  {t("languages.deleteConfirm")}
                </h2>
                <p className="text-sm text-foreground/80 mb-4">
                  {t("languages.deleteMessage", { code: pendingDeleteCode })}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPendingDeleteCode(null)}
                    className="flex-1 px-4 py-2 text-sm font-medium bg-foreground/10 text-foreground rounded-lg hover:bg-foreground/20 transition-colors"
                  >
                    {tCommon("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteLanguage}
                    className="flex-1 px-4 py-2 text-sm font-medium bg-error-text text-black rounded-lg hover:brightness-110 transition-colors"
                  >
                    {tCommon("delete")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === "api-keys" && (
            <div className="space-y-4">
              {API_KEY_CONFIG.map((config) => {
                const providerKey = config.provider;
                const providerLabel = t(`apiKeys.${providerKey}` as any);
                const getKeyLabel = t(
                  `apiKeys.getKey${providerKey.charAt(0).toUpperCase() + providerKey.slice(1)}` as any
                );
                return (
                  <div key={config.provider} className="space-y-2">
                    <label
                      htmlFor={`apiKey-${config.provider}`}
                      className="block text-sm font-medium text-foreground"
                    >
                      {providerLabel}
                    </label>
                    <input
                      id={`apiKey-${config.provider}`}
                      type="password"
                      value={apiKeys[config.provider]}
                      onChange={(e) =>
                        handleApiKeyChange(config.provider, e.target.value)
                      }
                      placeholder={t("apiKeys.placeholder", {
                        label: providerLabel,
                      })}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground transition-colors text-sm placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenAPIKey(config.url)}
                      className="inline-flex items-center text-xs text-foreground/60 hover:text-foreground hover:underline cursor-pointer"
                    >
                      {getKeyLabel} →
                    </button>
                  </div>
                );
              })}
              <div className="flex items-start gap-2 text-xs text-foreground/60 pt-2">
                <p className="flex-1">{t("apiKeys.secureStorage")}</p>
              </div>
            </div>
          )}

          {/* Usage Tab */}
          {activeTab === "usage" && (
            <div key={`usage-${usageRefreshKey}`} className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("usage.title")}
                  </h3>
                  <p className="text-xs text-foreground/60">
                    {t("usage.description")}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setUsagePeriod(days as 7 | 30 | 90)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      usagePeriod === days
                        ? "bg-primary text-button-text"
                        : "bg-foreground/5 text-foreground/70 hover:bg-foreground/10"
                    }`}
                  >
                    {t("usage.lastDays", { days })}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-foreground/5 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-foreground/60 mb-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{t("usage.totalRequests")}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {usageStats.totalRequests}
                  </p>
                </div>

                <div className="p-4 bg-foreground/5 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-foreground/60 mb-1">
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>{t("usage.successRate")}</span>
                  </div>
                  <p className="text-2xl font-bold text-success-text">
                    {usageStats.totalRequests > 0
                      ? Math.round(
                          (usageStats.successfulRequests /
                            usageStats.totalRequests) *
                            100
                        )
                      : 0}
                    %
                  </p>
                </div>

                <div className="p-4 bg-foreground/5 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-foreground/60 mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{t("usage.avgDuration")}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {usageStats.totalRequests > 0
                      ? (
                          usageStats.totalDuration /
                          usageStats.totalRequests /
                          1000
                        ).toFixed(1)
                      : 0}
                    s
                  </p>
                </div>

                <div className="p-4 bg-foreground/5 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-foreground/60 mb-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>{t("usage.estCost")}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    ${usageStats.estimatedCost.toFixed(3)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  {t("usage.byProvider")}
                </h4>
                {(
                  Object.entries(usageStats.byProvider) as [
                    Provider,
                    (typeof usageStats.byProvider)[Provider],
                  ][]
                ).map(([provider, data]) => {
                  if (data.requests === 0) return null;
                  return (
                    <div
                      key={provider}
                      className="p-4 bg-foreground/5 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground uppercase">
                          {provider}
                        </span>
                        <span className="text-xs text-foreground/60">
                          {t("usage.requests", { count: data.requests })}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <div className="text-foreground/60">
                            {t("usage.tokens")}
                          </div>
                          <div className="font-semibold text-foreground mt-0.5">
                            {data.tokens.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-foreground/60">
                            {t("usage.avgTime")}
                          </div>
                          <div className="font-semibold text-foreground mt-0.5">
                            {data.requests > 0
                              ? (data.duration / data.requests / 1000).toFixed(
                                  1
                                )
                              : 0}
                            s
                          </div>
                        </div>
                        <div>
                          <div className="text-foreground/60">
                            {t("usage.cost")}
                          </div>
                          <div className="font-semibold text-foreground mt-0.5">
                            ${data.cost.toFixed(3)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-info-bg border border-info-border rounded-lg text-xs text-info-text">
                {t("usage.estimatedNote")}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleClearUsage}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-error-text hover:bg-error-bg rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {t("usage.clearHistory")}
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5 rounded-lg transition-colors"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-button-text rounded-lg hover:bg-primary-hover transition-colors"
            >
              {tCommon("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
