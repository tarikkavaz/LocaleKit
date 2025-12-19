"use client";

import { X, CheckCircle2, AlertCircle, Terminal, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useConsoleLogs, type LogEntry } from "@/lib/useConsoleLogs";

interface TranslationProgressProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: string | null;
  completedLanguages: string[];
  failedLanguages: Array<{ code: string; error: string }>;
  totalLanguages: number;
  progress: number; // 0-100
  onCancel?: () => void;
  onConsoleClick?: () => void;
}

export default function TranslationProgress({
  isOpen,
  onClose,
  currentLanguage,
  completedLanguages,
  failedLanguages,
  totalLanguages,
  progress,
  onCancel,
  onConsoleClick,
}: TranslationProgressProps) {
  const { logs, clearLogs } = useConsoleLogs();
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const getLogColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "error":
        return "text-error-text";
      case "warn":
        return "text-warning-text";
      case "info":
        return "text-info-text";
      default:
        return "text-foreground/80";
    }
  };

  if (!isOpen) return null;

  const completedCount = completedLanguages.length;
  const failedCount = failedLanguages.length;
  const remainingCount = totalLanguages - completedCount - failedCount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: "var(--color-modal-backdrop)" }}
    >
      <div
        className="relative w-full h-full max-w-6xl mx-4 my-4 bg-card-bg rounded-lg shadow-xl transition-colors flex flex-col"
        style={{ backgroundColor: "var(--card-bg-solid)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">
            Translation Progress
          </h2>
          <div className="flex items-center gap-2">
            {onConsoleClick && (
              <button
                onClick={onConsoleClick}
                className="p-2 hover:bg-foreground/5 rounded-lg transition-colors"
                aria-label="Open Console"
                title="View console logs"
              >
                <Terminal className="w-5 h-5 text-foreground" />
              </button>
            )}
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-1 hover:bg-foreground/5 rounded-lg transition-colors"
                aria-label="Cancel"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">
                {completedCount} of {totalLanguages} completed
              </span>
              <span className="text-foreground/60">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-foreground/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Current Language */}
          {currentLanguage && (
            <div className="p-4 bg-info-bg border border-info-border rounded-lg flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-info-icon rounded-full animate-pulse" />
                <span className="text-sm font-medium text-info-text">
                  Translating: {currentLanguage}
                </span>
              </div>
            </div>
          )}

          {/* Console Logs */}
          <div className="flex-1 flex flex-col min-h-0 border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-border bg-foreground/5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">Console Logs</span>
                <span className="text-xs text-foreground/60">({logs.length} entries)</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-foreground/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="form-checkbox h-3 w-3 text-primary rounded border-gray-300 focus:ring-primary"
                  />
                  Auto-scroll
                </label>
                <button
                  onClick={clearLogs}
                  className="p-1.5 hover:bg-foreground/5 rounded transition-colors text-foreground/60 hover:text-foreground"
                  title="Clear Logs"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div
              ref={logContainerRef}
              className="flex-1 overflow-y-auto p-4 font-mono text-xs select-text"
              style={{ 
                backgroundColor: "var(--card-bg-solid)",
                userSelect: "text",
                WebkitUserSelect: "text"
              }}
            >
              {logs.length === 0 ? (
                <div className="text-center text-foreground/60 py-8">No logs yet...</div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div key={index} className="flex gap-2 items-start select-text">
                      <span className="text-foreground/40 flex-shrink-0 select-text">{log.timestamp}</span>
                      <span className={`flex-shrink-0 font-semibold select-text ${getLogColor(log.level)}`}>
                        [{log.level.toUpperCase()}]
                      </span>
                      <span className="text-foreground/80 break-words flex-1 whitespace-pre-wrap select-text">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status Summary */}
          <div className="space-y-2 flex-shrink-0">
            {completedLanguages.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-success-text">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {completedCount} language{completedCount !== 1 ? "s" : ""} completed
                </span>
              </div>
            )}

            {failedLanguages.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-error-text">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    {failedCount} language{failedCount !== 1 ? "s" : ""} failed
                  </span>
                </div>
                <div className="ml-6 space-y-1">
                  {failedLanguages.map((failed) => (
                    <div key={failed.code} className="text-xs text-error-text/80">
                      {failed.code}: {failed.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {remainingCount > 0 && !currentLanguage && (
              <div className="text-sm text-foreground/60">
                {remainingCount} language{remainingCount !== 1 ? "s" : ""} remaining
              </div>
            )}
          </div>

          {/* Completed State */}
          {!currentLanguage && completedCount + failedCount === totalLanguages && (
            <div className="pt-4 border-t border-border flex-shrink-0">
              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-sm font-medium bg-primary text-button-text rounded-lg hover:bg-primary-hover transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
