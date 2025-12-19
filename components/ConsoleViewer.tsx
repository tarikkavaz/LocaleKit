"use client";

import { useState, useEffect, useRef } from "react";
import { X, Terminal, Trash2 } from "lucide-react";
import { useConsoleLogs, type LogEntry } from "@/lib/useConsoleLogs";

interface ConsoleViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConsoleViewer({ isOpen, onClose }: ConsoleViewerProps) {
  const { logs, clearLogs } = useConsoleLogs();
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "var(--color-modal-backdrop)" }}>
      <div
        className="relative w-full max-w-4xl mx-4 bg-card-bg rounded-lg shadow-xl flex flex-col"
        style={{ backgroundColor: "var(--card-bg-solid)", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Console Logs</h2>
            <span className="text-xs text-foreground/60">({logs.length} entries)</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              Auto-scroll
            </label>
            <button
              onClick={clearLogs}
              className="p-2 text-foreground/60 hover:text-foreground hover:bg-foreground/5 rounded transition-colors"
              title="Clear logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-foreground/60 hover:text-foreground hover:bg-foreground/5 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Logs */}
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs select-text"
          style={{
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
                  <span className={`flex-shrink-0 font-semibold select-text ${getLogColor(log.level, log.message)}`}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className={`break-words flex-1 whitespace-pre-wrap select-text ${getLogColor(log.level, log.message)}`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
