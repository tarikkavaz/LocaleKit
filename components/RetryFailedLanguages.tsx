"use client";

import { AlertCircle, RotateCcw, X } from "lucide-react";

interface FailedLanguage {
  code: string;
  name: string;
  error: string;
}

interface RetryFailedLanguagesProps {
  failedLanguages: FailedLanguage[];
  onRetry: () => void;
  onClear: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export default function RetryFailedLanguages({
  failedLanguages,
  onRetry,
  onClear,
  t,
}: RetryFailedLanguagesProps) {
  if (failedLanguages.length === 0) {
    return null;
  }

  const truncateError = (error: string, maxLength: number = 100) => {
    if (error.length <= maxLength) return error;
    return `${error.substring(0, maxLength)}...`;
  };

  return (
    <div className="p-4 bg-error-bg border border-error-border rounded-lg space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-error-icon" />
        <h3 className="text-sm font-semibold text-error-text">
          {t("retryFailedLanguages.title", {
            count: failedLanguages.length,
          })}
        </h3>
      </div>

      {/* Failed Languages List */}
      <div className="space-y-2">
        {failedLanguages.map((language) => (
          <div
            key={language.code}
            className="flex items-start gap-2 p-2 bg-foreground/5 rounded"
          >
            <span className="text-sm font-medium text-foreground shrink-0">
              {language.name} ({language.code}):
            </span>
            <span
              className="text-sm text-error-text/80 truncate"
              title={language.error}
            >
              {truncateError(language.error)}
            </span>
          </div>
        ))}
      </div>

      {/* Note */}
      <p className="text-xs text-foreground/60">
        {t("retryFailedLanguages.note")}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-button-text rounded-lg hover:bg-primary-hover transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          {t("retryFailedLanguages.retryButton")}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-foreground/10 text-foreground rounded-lg hover:bg-foreground/20 transition-colors"
        >
          <X className="w-4 h-4" />
          {t("retryFailedLanguages.clearButton")}
        </button>
      </div>
    </div>
  );
}
