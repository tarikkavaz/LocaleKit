"use client";

import { useState, useMemo } from "react";
import { Search, CheckSquare, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { getAllLanguages, type Language } from "@/lib/languages";

interface LanguageSelectorProps {
  selectedLanguages: string[];
  onSelectionChange: (languageCodes: string[]) => void;
  excludeLanguageCode?: string | null;
}

export default function LanguageSelector({
  selectedLanguages,
  onSelectionChange,
  excludeLanguageCode,
}: LanguageSelectorProps) {
  const t = useTranslations("languageSelector");
  const tCommon = useTranslations("common");
  const [searchQuery, setSearchQuery] = useState("");
  const allLanguages = getAllLanguages().filter(
    (lang) => lang.code !== excludeLanguageCode
  );

  const filteredLanguages = useMemo(() => {
    if (!searchQuery.trim()) {
      return allLanguages;
    }

    const query = searchQuery.toLowerCase();
    return allLanguages.filter(
      (lang) =>
        lang.name.toLowerCase().includes(query) ||
        lang.code.toLowerCase().includes(query)
    );
  }, [allLanguages, searchQuery]);

  const toggleLanguage = (code: string) => {
    const newSelection = [...selectedLanguages];
    const index = newSelection.indexOf(code);

    if (index >= 0) {
      newSelection.splice(index, 1);
    } else {
      newSelection.push(code);
    }

    onSelectionChange(newSelection);
  };

  const selectAll = () => {
    onSelectionChange(filteredLanguages.map((lang) => lang.code));
  };

  const deselectAll = () => {
    const filteredCodes = filteredLanguages.map((lang) => lang.code);
    onSelectionChange(
      selectedLanguages.filter((code) => !filteredCodes.includes(code))
    );
  };

  const isSelected = (code: string): boolean => {
    return selectedLanguages.includes(code);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">{t("title")}</h3>
        <div className="flex items-center gap-2 text-xs text-foreground/60">
          <span>
            {t("selected", {
              count: selectedLanguages.length,
              total: allLanguages.length,
            })}
          </span>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/40" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground transition-colors placeholder:text-muted-foreground text-sm"
        />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={selectAll}
          className="text-xs text-foreground/60 hover:text-foreground transition-colors"
        >
          {t("selectAll")}
        </button>
        <span className="text-xs text-foreground/40">|</span>
        <button
          onClick={deselectAll}
          className="text-xs text-foreground/60 hover:text-foreground transition-colors"
        >
          {t("deselectAll")}
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 max-h-96 overflow-y-auto">
        {filteredLanguages.length === 0 ? (
          <p className="text-sm text-foreground/60 text-center py-4">
            {t("noLanguagesFound")}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredLanguages.map((lang) => {
              const selected = isSelected(lang.code);
              return (
                <button
                  key={lang.code}
                  onClick={() => toggleLanguage(lang.code)}
                  className={`flex items-center gap-2 p-2 rounded-lg hover:bg-foreground/5 transition-colors text-left ${
                    selected ? "bg-primary/10" : ""
                  }`}
                >
                  {selected ? (
                    <CheckSquare
                      className="w-4 h-4 shrink-0"
                      style={{
                        color: "oklch(0.75 0.22 285)",
                      }}
                    />
                  ) : (
                    <Square className="w-4 h-4 text-foreground/40 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {lang.name}
                    </div>
                    <div className="text-xs text-foreground/60 font-mono">
                      {lang.code}
                    </div>
                  </div>
                  {lang.isDefault && (
                    <span className="text-xs text-foreground/40 px-1.5 py-0.5 bg-foreground/5 rounded">
                      {tCommon("default")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
