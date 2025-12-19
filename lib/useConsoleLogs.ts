/**
 * Global console logging hook that persists logs across component mounts/unmounts
 */

import { useState, useEffect, useRef } from "react";

export interface LogEntry {
  timestamp: string;
  level: "log" | "info" | "warn" | "error";
  message: string;
}

// Global log storage that persists across component mounts
const globalLogs: LogEntry[] = [];
const MAX_LOGS = 2000; // Increased limit for persistent logs
const logListeners = new Set<(logs: LogEntry[]) => void>();

// Intercept console methods once
let consoleIntercepted = false;

function interceptConsole() {
  if (consoleIntercepted) return;
  consoleIntercepted = true;

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  const addLog = (level: LogEntry["level"], ...args: any[]) => {
    const timestamp = new Date().toLocaleTimeString("en-GB", { hour12: false });
    const message = args
      .map((arg) => {
        if (typeof arg === "object" && arg !== null) {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");

    const logEntry: LogEntry = { timestamp, level, message };

    // Add to global storage
    globalLogs.push(logEntry);
    if (globalLogs.length > MAX_LOGS) {
      globalLogs.shift(); // Remove oldest log
    }

    // Notify all listeners
    logListeners.forEach((listener) => {
      listener([...globalLogs]);
    });
  };

  console.log = (...args: any[]) => {
    originalLog(...args);
    addLog("log", ...args);
  };

  console.info = (...args: any[]) => {
    originalInfo(...args);
    addLog("info", ...args);
  };

  console.warn = (...args: any[]) => {
    originalWarn(...args);
    addLog("warn", ...args);
  };

  console.error = (...args: any[]) => {
    originalError(...args);
    addLog("error", ...args);
  };
}

export function useConsoleLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Initialize console interception
    interceptConsole();

    // Set initial logs
    setLogs([...globalLogs]);

    // Subscribe to log updates
    const listener = (newLogs: LogEntry[]) => {
      setLogs([...newLogs]);
    };

    logListeners.add(listener);

    return () => {
      logListeners.delete(listener);
    };
  }, []);

  const clearLogs = () => {
    globalLogs.length = 0;
    logListeners.forEach((listener) => {
      listener([]);
    });
  };

  return { logs, clearLogs };
}
