/**
 * Translation Error Classification
 * Provides detailed error types and user-friendly error messages
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

export interface ErrorContext {
  language?: string;
  languageCode?: string;
  chunkIndex?: number;
  totalChunks?: number;
  provider?: Provider;
  model?: string;
  retryCount?: number;
}

/**
 * Structured error class for translation failures
 */
export class TranslationError extends Error {
  constructor(
    public type: TranslationErrorType,
    message: string,
    public originalError?: Error | unknown,
    public context?: ErrorContext
  ) {
    super(message);
    this.name = "TranslationError";

    // Maintain prototype chain
    Object.setPrototypeOf(this, TranslationError.prototype);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    const prefix = this.getContextPrefix();
    const suggestion = this.getSuggestion();

    return `${prefix}${this.message}${suggestion ? `\n\n${suggestion}` : ""}`;
  }

  /**
   * Get short error message for UI display
   */
  getShortMessage(): string {
    switch (this.type) {
      case TranslationErrorType.TIMEOUT:
        return "Request timed out";
      case TranslationErrorType.API_ERROR:
        return "API error";
      case TranslationErrorType.PARSE_ERROR:
        return "Invalid response";
      case TranslationErrorType.QUOTA_ERROR:
        return "Quota exceeded";
      case TranslationErrorType.NETWORK_ERROR:
        return "Network error";
      case TranslationErrorType.CHUNK_FAILED:
        return `Chunk ${this.context?.chunkIndex} failed`;
      case TranslationErrorType.VALIDATION_ERROR:
        return "Validation error";
      default:
        return "Translation failed";
    }
  }

  /**
   * Get context prefix for the error message
   */
  private getContextPrefix(): string {
    const parts: string[] = [];

    if (this.context?.language) {
      parts.push(`${this.context.language}`);
    }

    if (this.context?.chunkIndex && this.context?.totalChunks) {
      parts.push(
        `(chunk ${this.context.chunkIndex}/${this.context.totalChunks})`
      );
    }

    return parts.length > 0 ? `[${parts.join(" ")}] ` : "";
  }

  /**
   * Get actionable suggestion based on error type
   */
  private getSuggestion(): string {
    switch (this.type) {
      case TranslationErrorType.TIMEOUT:
        return this.getTimeoutSuggestion();

      case TranslationErrorType.API_ERROR:
        return this.getApiErrorSuggestion();

      case TranslationErrorType.PARSE_ERROR:
        return this.getParseErrorSuggestion();

      case TranslationErrorType.QUOTA_ERROR:
        return "💳 Check your API billing dashboard to add credits or increase limits.";

      case TranslationErrorType.NETWORK_ERROR:
        return "🌐 Check your internet connection and try again.";

      case TranslationErrorType.CHUNK_FAILED:
        return this.getChunkFailedSuggestion();

      case TranslationErrorType.VALIDATION_ERROR:
        return "📝 The JSON structure may be invalid. Check the source file.";

      default:
        return "🔄 Try again or use a different model.";
    }
  }

  private getTimeoutSuggestion(): string {
    const suggestions = [
      "🎯 Try excluding more paths to reduce the translation complexity",
      "⚡ Consider using a faster model (GPT-4o-mini is faster than GPT-4)",
      "📄 This file may be too large for reliable translation with the current settings",
      "🔧 The chunk size is optimized for 60-second timeout, but some complex content may exceed this",
    ];

    // Add context-specific suggestions
    if (this.context?.chunkIndex && this.context?.totalChunks) {
      if (this.context.totalChunks > 5) {
        suggestions.push(
          "📊 This file has been split into many chunks - some may be more complex than others"
        );
      }
    }

    if (
      this.context?.model?.includes("gpt-4") &&
      !this.context.model.includes("mini")
    ) {
      suggestions.unshift(
        "🐌 GPT-4 models are slower - consider using GPT-4o-mini for better speed"
      );
    }

    return suggestions[0];
  }

  private getApiErrorSuggestion(): string {
    const message =
      this.originalError instanceof Error
        ? this.originalError.message
        : String(this.originalError);

    if (message.includes("429")) {
      return "⏱️ Rate limit exceeded. The API is throttling requests. Wait a moment and retry.";
    }

    if (message.includes("401") || message.includes("403")) {
      return "🔑 API key may be invalid or expired. Check your API key in Settings.";
    }

    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503")
    ) {
      return "🔧 The API service is experiencing issues. Wait a moment and retry.";
    }

    if (message.includes("context length") || message.includes("too long")) {
      return "📏 Content exceeds model's context window. Try excluding more paths.";
    }

    return "🔌 Check your API key and network connection, then try again.";
  }

  private getParseErrorSuggestion(): string {
    const suggestions = [
      "🤖 The AI model may have truncated output. Try a model with a larger context window.",
      "📄 The response format was unexpected. This can happen with very complex JSON structures.",
      "🔄 Try again - this may be a temporary issue with the AI response.",
    ];

    if (this.context?.chunkIndex && this.context.chunkIndex > 1) {
      suggestions.push(
        `ℹ️ Chunk ${this.context.chunkIndex} of ${this.context.totalChunks} failed - previous chunks succeeded`
      );
    }

    return suggestions[0];
  }

  private getChunkFailedSuggestion(): string {
    if (this.context?.totalChunks && this.context.totalChunks > 1) {
      return `📦 All ${this.context.totalChunks} chunks must succeed for the translation to complete. This chunk was too complex.`;
    }
    return "📦 The translation failed during processing. Try simplifying the content.";
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return [
      TranslationErrorType.TIMEOUT,
      TranslationErrorType.NETWORK_ERROR,
      TranslationErrorType.API_ERROR,
    ].includes(this.type);
  }

  /**
   * Check if error is related to API quota
   */
  isQuotaError(): boolean {
    return this.type === TranslationErrorType.QUOTA_ERROR;
  }

  /**
   * Log error details to console
   */
  log(): void {
    console.error(`[TranslationError] ${this.type}: ${this.message}`);
    console.error(`  Context:`, this.context);
    if (this.originalError) {
      console.error(`  Original error:`, this.originalError);
    }
  }
}

/**
 * Classify an error into TranslationError
 */
export function classifyError(
  error: unknown,
  context?: ErrorContext
): TranslationError {
  const message = error instanceof Error ? error.message : String(error);

  // Check for timeout conditions
  if (
    message.toLowerCase().includes("timeout") ||
    message.toLowerCase().includes("load failed") ||
    message.toLowerCase().includes("aborted") ||
    message.includes("60 second") ||
    message.includes("60s")
  ) {
    return new TranslationError(
      TranslationErrorType.TIMEOUT,
      "Request exceeded 60 second time limit",
      error,
      context
    );
  }

  // Check for quota/billing issues
  if (
    /quota|billing|usage limit|budget|insufficient|exceeded|payment/i.test(
      message
    )
  ) {
    return new TranslationError(
      TranslationErrorType.QUOTA_ERROR,
      "API quota or billing limit exceeded",
      error,
      context
    );
  }

  // Check for rate limiting and HTTP errors
  if (
    message.includes("429") ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("rate limit")
  ) {
    return new TranslationError(
      TranslationErrorType.API_ERROR,
      message,
      error,
      context
    );
  }

  // Check for network issues
  if (
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("fetch") ||
    message.toLowerCase().includes("econnrefused") ||
    message.toLowerCase().includes("etimedout") ||
    message.toLowerCase().includes("enotfound")
  ) {
    return new TranslationError(
      TranslationErrorType.NETWORK_ERROR,
      "Network connection error",
      error,
      context
    );
  }

  // Check for parse errors
  if (
    message.toLowerCase().includes("parse") ||
    message.toLowerCase().includes("json") ||
    message.toLowerCase().includes("invalid") ||
    message.toLowerCase().includes("unexpected token")
  ) {
    return new TranslationError(
      TranslationErrorType.PARSE_ERROR,
      "Failed to parse AI response",
      error,
      context
    );
  }

  // Check for validation errors
  if (
    message.toLowerCase().includes("validation") ||
    message.toLowerCase().includes("invalid") ||
    message.toLowerCase().includes("schema")
  ) {
    return new TranslationError(
      TranslationErrorType.VALIDATION_ERROR,
      message,
      error,
      context
    );
  }

  // Unknown error
  return new TranslationError(
    TranslationErrorType.UNKNOWN,
    message || "An unknown error occurred",
    error,
    context
  );
}

/**
 * Create a chunk failed error
 */
export function createChunkFailedError(
  chunkIndex: number,
  totalChunks: number,
  language: string,
  originalError: unknown
): TranslationError {
  const error = classifyError(originalError, {
    chunkIndex,
    totalChunks,
    language,
  });

  // If it was already classified as something specific, keep that type
  // but add chunk context
  if (error.type !== TranslationErrorType.UNKNOWN) {
    return error;
  }

  // Otherwise create a generic chunk failed error
  return new TranslationError(
    TranslationErrorType.CHUNK_FAILED,
    `Chunk ${chunkIndex} of ${totalChunks} failed after all retries`,
    originalError,
    { chunkIndex, totalChunks, language }
  );
}
