"use client";

import {
  CheckCircle2,
  AlertCircle,
  Terminal,
  Copy,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useConsoleLogs, type LogEntry } from "@/lib/useConsoleLogs";
import Tooltip from "./Tooltip";

interface InlineTranslationProgressProps {
  currentLanguage: string | null;
  completedLanguages: string[];
  failedLanguages: Array<{ code: string; name: string; error: string }>;
  warningsLanguages: Array<{ code: string; name: string; warning: string }>;
  totalLanguages: number;
  progress: number; // 0-100
  isTranslating: boolean;
}

export default function InlineTranslationProgress({
  currentLanguage,
  completedLanguages,
  failedLanguages,
  warningsLanguages,
  totalLanguages,
  progress,
  isTranslating,
}: InlineTranslationProgressProps) {
  const t = useTranslations("translationProgress");
  const { logs } = useConsoleLogs();
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logsSectionRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (logContainerRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop =
            logContainerRef.current.scrollHeight;
        }
      });
    }
  }, [logs]);

  // Scroll to bottom when translation starts
  useEffect(() => {
    if (isTranslating && logContainerRef.current) {
      // Small delay to ensure logs container is rendered
      setTimeout(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop =
            logContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [isTranslating]);

  // Scroll to bottom when section is opened
  useEffect(() => {
    if (!isCollapsed) {
      // Small delay to ensure logs container is rendered
      setTimeout(() => {
        // Scroll the page to bring the logs section into view
        if (logsSectionRef.current) {
          logsSectionRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
        // Then scroll the log container to the bottom
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop =
            logContainerRef.current.scrollHeight;
        }
      }, 150);
    }
  }, [isCollapsed]);

  const copyLogsToClipboard = async () => {
    try {
      const logText = logs
        .map(
          (log) =>
            `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`
        )
        .join("\n");

      await navigator.clipboard.writeText(logText);
      // You could add a toast notification here if desired
      console.log("Logs copied to clipboard");
    } catch (err) {
      console.error("Failed to copy logs to clipboard:", err);
    }
  };

  const getLogColor = (
    level: "log" | "info" | "warn" | "error",
    message: string
  ) => {
    // Check if it's a success message (check for [SUCCESS] or "Successfully saved")
    const isSuccess =
      message.includes("[SUCCESS]") ||
      message.includes("Successfully saved") ||
      message.includes("SUCCESS");

    if (isSuccess) {
      return "text-success-text";
    }

    switch (level) {
      case "error":
        return "text-error-text";
      case "warn":
        return "text-warning-text";
      case "info":
        // Don't color info as purple if it's a success message
        return isSuccess ? "text-success-text" : "text-info-text";
      default:
        return "text-foreground/80";
    }
  };

  const completedCount = completedLanguages.length;
  const failedCount = failedLanguages.length;
  const warningsCount = warningsLanguages.length;
  const remainingCount = totalLanguages - completedCount - failedCount;

  // Don't show if not translating and no progress
  if (!isTranslating && completedCount === 0 && failedCount === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Translation Progress Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{t("title")}</h3>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">
              {t("completed", { count: completedCount, total: totalLanguages })}
            </span>
            <span className="text-foreground/60">
              {t("progress", { percent: Math.round(progress) })}
            </span>
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
          <div className="p-4 bg-info-bg border border-info-border rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-info-icon rounded-full animate-pulse" />
              <span className="text-sm font-medium text-info-text">
                {t("translating", { language: currentLanguage })}
              </span>
            </div>
          </div>
        )}

        {/* Status Summary */}
        <div className="space-y-2">
          {completedLanguages.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-success-text">
              <CheckCircle2 className="w-4 h-4 text-success-text" />
              <span className="text-success-text">
                {t("completedCount", { count: completedCount })}
              </span>
            </div>
          )}

          {failedLanguages.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-error-text">
                <AlertCircle className="w-4 h-4" />
                <span>{t("failedCount", { count: failedCount })}</span>
              </div>
              <div className="ml-6 space-y-1">
                {failedLanguages.map((failed) => (
                  <div key={failed.code} className="text-xs text-error-text/80">
                    {failed.name} ({failed.code}): {failed.error}
                  </div>
                ))}
              </div>
              <div className="ml-6 text-xs text-error-text/80">
                {t("failedReselected")}
              </div>
            </div>
          )}

          {warningsLanguages.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-warning-text">
                <AlertTriangle className="w-4 h-4" />
                <span>{t("warningsCount", { count: warningsCount })}</span>
              </div>
              <div className="ml-6 space-y-1">
                {warningsLanguages.map((warn) => (
                  <div key={warn.code} className="text-xs text-warning-text/80">
                    {warn.name} ({warn.code}): {warn.warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {warningsLanguages.length > 0 &&
            !isTranslating &&
            completedCount + failedCount === totalLanguages && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-warning-text">
                  <AlertTriangle className="w-4 h-4" />
                  <span>
                    {t("completedWithWarnings", {
                      languages: warningsLanguages
                        .map((warn) => warn.name || warn.code)
                        .join(", "),
                    })}
                  </span>
                </div>
              </div>
            )}

          {remainingCount > 0 && !currentLanguage && (
            <div className="text-sm text-foreground/60">
              {t("remaining", { count: remainingCount })}
            </div>
          )}
        </div>
      </div>

      {/* Console Logs Section */}
      <div ref={logsSectionRef} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              {t("translationLogs")}
            </h3>
            <div className="flex items-center gap-2">
              <Tooltip label={t("copyLogs")} position="left">
                <button
                  onClick={copyLogsToClipboard}
                  className="p-1.5 hover:bg-foreground/5 rounded transition-colors text-foreground/60 hover:text-foreground"
                  disabled={logs.length === 0}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full px-4 py-1.5 text-xs text-foreground/70 hover:text-foreground bg-primary/80 hover:bg-primary rounded transition-colors flex items-center justify-center gap-2"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            <span>
              {t("toggleLogs", {
                action: isCollapsed ? t("open") : t("close"),
              })}
            </span>
          </button>
        </div>

        {!isCollapsed && (
          <div
            className="border border-border rounded-lg overflow-hidden"
            style={{ height: "450px" }}
          >
            <div
              ref={logContainerRef}
              className="overflow-y-auto p-4 pb-8 font-mono text-xs select-text bg-card h-full"
              style={{
                backgroundColor: "var(--card-bg-solid)",
                userSelect: "text",
                WebkitUserSelect: "text",
              }}
            >
              {logs.length === 0 ? (
                <div className="text-center text-foreground/60 py-8">
                  {t("noLogs")}
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className="flex gap-2 items-start select-text"
                    >
                      <span className="text-foreground/40 shrink-0 select-text">
                        {log.timestamp}
                      </span>
                      <span
                        className={`shrink-0 font-semibold select-text ${getLogColor(log.level, log.message)}`}
                      >
                        [{log.level.toUpperCase()}]
                      </span>
                      <span
                        className={`wrap-break-words flex-1 whitespace-pre-wrap select-text ${getLogColor(log.level, log.message)}`}
                      >
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="pb-8"></div>
    </div>
  );
}
