/**
 * Translation Session Manager
 * Handles checkpointing and resume capability for translation sessions
 * Sessions are keyed by file path and expire after 7 days
 */

import type { Provider } from "./types";

export enum TranslationErrorType {
  TIMEOUT = "TIMEOUT",
  API_ERROR = "API_ERROR",
  PARSE_ERROR = "PARSE_ERROR",
  QUOTA_ERROR = "QUOTA_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  CHUNK_FAILED = "CHUNK_FAILED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNKNOWN = "UNKNOWN",
}

export interface FailedLanguage {
  code: string;
  name: string;
  error: string;
  errorType: TranslationErrorType;
  timestamp: number;
}

export interface TranslationSession {
  sessionId: string;
  filePath: string;
  sourceLanguage: string | null;
  targetLanguages: string[];
  completedLanguages: string[];
  failedLanguages: FailedLanguage[];
  pendingLanguages: string[];
  startTime: number;
  lastUpdated: number;
  model: string;
  provider: Provider;
  excludedPaths: string[];
  temperature?: number;
}

const SESSION_EXPIRY_DAYS = 7;
const SESSION_KEY_PREFIX = "translation-session-";

/**
 * Generate a session ID from file path and timestamp
 */
function generateSessionId(filePath: string): string {
  const timestamp = Date.now();
  const hash = filePath
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    .toString(36);
  return `${hash}-${timestamp}`;
}

/**
 * Get storage key for a file path
 */
function getStorageKey(filePath: string): string {
  const hash = filePath
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    .toString(36);
  return `${SESSION_KEY_PREFIX}${hash}`;
}

/**
 * Check if session has expired
 */
function isSessionExpired(session: TranslationSession): boolean {
  const expiryTime = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - session.lastUpdated > expiryTime;
}

/**
 * Start a new translation session
 */
export function startSession(
  filePath: string,
  targetLanguages: string[],
  model: string,
  provider: Provider,
  excludedPaths: string[] = [],
  sourceLanguage: string | null = null,
  temperature?: number
): TranslationSession {
  // Clear any existing session for this file
  clearSession(filePath);

  const session: TranslationSession = {
    sessionId: generateSessionId(filePath),
    filePath,
    sourceLanguage,
    targetLanguages: [...targetLanguages],
    completedLanguages: [],
    failedLanguages: [],
    pendingLanguages: [...targetLanguages],
    startTime: Date.now(),
    lastUpdated: Date.now(),
    model,
    provider,
    excludedPaths: [...excludedPaths],
    temperature,
  };

  saveSession(session);
  return session;
}

/**
 * Save session to localStorage
 */
function saveSession(session: TranslationSession): void {
  try {
    const key = getStorageKey(session.filePath);
    localStorage.setItem(key, JSON.stringify(session));
  } catch (error) {
    console.error("[SessionManager] Failed to save session:", error);
  }
}

/**
 * Get active session for a file path
 * Returns null if no session exists or it has expired
 */
export function getActiveSession(filePath: string): TranslationSession | null {
  try {
    const key = getStorageKey(filePath);
    const data = localStorage.getItem(key);

    if (!data) return null;

    const session: TranslationSession = JSON.parse(data);

    if (isSessionExpired(session)) {
      console.log("[SessionManager] Session expired, clearing...");
      clearSession(filePath);
      return null;
    }

    return session;
  } catch (error) {
    console.error("[SessionManager] Failed to get session:", error);
    return null;
  }
}

/**
 * Mark a language as completed
 */
export function markLanguageComplete(
  filePath: string,
  languageCode: string,
  warning?: string
): void {
  const session = getActiveSession(filePath);
  if (!session) return;

  // Remove from pending
  session.pendingLanguages = session.pendingLanguages.filter(
    (code) => code !== languageCode
  );

  // Add to completed if not already there
  if (!session.completedLanguages.includes(languageCode)) {
    session.completedLanguages.push(languageCode);
  }

  // Remove from failed if it was there
  session.failedLanguages = session.failedLanguages.filter(
    (f) => f.code !== languageCode
  );

  session.lastUpdated = Date.now();

  if (warning) {
    console.warn(
      `[SessionManager] Language ${languageCode} completed with warning: ${warning}`
    );
  }

  saveSession(session);

  console.log(
    `[SessionManager] Marked ${languageCode} as complete (${session.completedLanguages.length}/${session.targetLanguages.length})`
  );
}

/**
 * Mark a language as failed
 */
export function markLanguageFailed(
  filePath: string,
  languageCode: string,
  languageName: string,
  error: string,
  errorType: TranslationErrorType
): void {
  const session = getActiveSession(filePath);
  if (!session) return;

  // Remove from pending
  session.pendingLanguages = session.pendingLanguages.filter(
    (code) => code !== languageCode
  );

  // Remove existing failure record if present
  session.failedLanguages = session.failedLanguages.filter(
    (f) => f.code !== languageCode
  );

  // Add failure record
  session.failedLanguages.push({
    code: languageCode,
    name: languageName,
    error,
    errorType,
    timestamp: Date.now(),
  });

  session.lastUpdated = Date.now();
  saveSession(session);

  console.log(
    `[SessionManager] Marked ${languageCode} as failed: ${errorType}`
  );
}

/**
 * Clear session for a file path
 */
export function clearSession(filePath: string): void {
  try {
    const key = getStorageKey(filePath);
    localStorage.removeItem(key);
    console.log(`[SessionManager] Cleared session for ${filePath}`);
  } catch (error) {
    console.error("[SessionManager] Failed to clear session:", error);
  }
}

/**
 * Check if a session is complete
 */
export function isSessionComplete(session: TranslationSession): boolean {
  return session.pendingLanguages.length === 0;
}

/**
 * Get session progress percentage
 */
export function getSessionProgress(session: TranslationSession): number {
  const total = session.targetLanguages.length;
  const completed = session.completedLanguages.length;
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

/**
 * List all active sessions (for debugging)
 */
export function listAllSessions(): TranslationSession[] {
  const sessions: TranslationSession[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SESSION_KEY_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          const session: TranslationSession = JSON.parse(data);
          if (!isSessionExpired(session)) {
            sessions.push(session);
          }
        }
      }
    }
  } catch (error) {
    console.error("[SessionManager] Failed to list sessions:", error);
  }

  return sessions;
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): void {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SESSION_KEY_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          const session: TranslationSession = JSON.parse(data);
          if (isSessionExpired(session)) {
            localStorage.removeItem(key);
            console.log(`[SessionManager] Cleaned up expired session: ${key}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("[SessionManager] Failed to cleanup sessions:", error);
  }
}
