"use client";

import { CheckCircle2, AlertCircle, Terminal, Copy } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useConsoleLogs, type LogEntry } from "@/lib/useConsoleLogs";

interface InlineTranslationProgressProps {
  currentLanguage: string | null;
  completedLanguages: string[];
  failedLanguages: Array<{ code: string; error: string }>;
  totalLanguages: number;
  progress: number; // 0-100
  isTranslating: boolean;
}

export default function InlineTranslationProgress({
  currentLanguage,
  completedLanguages,
  failedLanguages,
  totalLanguages,
  progress,
  isTranslating,
}: InlineTranslationProgressProps) {
  const { logs } = useConsoleLogs();
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
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
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [isTranslating]);

  const copyLogsToClipboard = async () => {
    try {
      const logText = logs
        .map((log) => `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`)
        .join("\n");
      
      await navigator.clipboard.writeText(logText);
      // You could add a toast notification here if desired
      console.log("Logs copied to clipboard");
    } catch (err) {
      console.error("Failed to copy logs to clipboard:", err);
    }
  };

  const getLogColor = (level: "log" | "info" | "warn" | "error", message: string) => {
    // Check if it's a success message (check for [SUCCESS] or "Successfully saved")
    const isSuccess = message.includes("[SUCCESS]") || 
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
  const remainingCount = totalLanguages - completedCount - failedCount;

  // Don't show if not translating and no progress
  if (!isTranslating && completedCount === 0 && failedCount === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Translation Progress Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Translation Progress</h3>
        
        {/* Progress Bar */}
        <div className="space-y-2">
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
          <div className="p-4 bg-info-bg border border-info-border rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-info-icon rounded-full animate-pulse" />
              <span className="text-sm font-medium text-info-text">
                Translating: {currentLanguage}
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
      </div>

      {/* Console Logs Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Translation Logs
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={copyLogsToClipboard}
              className="p-1.5 hover:bg-foreground/5 rounded transition-colors text-foreground/60 hover:text-foreground"
              title="Copy logs to clipboard"
              disabled={logs.length === 0}
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden" style={{ height: "450px" }}>
          <div
            ref={logContainerRef}
            className="overflow-y-auto p-4 pb-8 font-mono text-xs select-text bg-card h-full"
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
                    <span className="text-foreground/40 shrink-0 select-text">{log.timestamp}</span>
                    <span className={`shrink-0 font-semibold select-text ${getLogColor(log.level, log.message)}`}>
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className={`wrap-break-words flex-1 whitespace-pre-wrap select-text ${getLogColor(log.level, log.message)}`}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="pb-8"></div>
    </div>
  );
}
