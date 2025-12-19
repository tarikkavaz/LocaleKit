import { createAnthropic } from "@ai-sdk/anthropic";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type {
  TranslationInput,
  TranslationResult,
  Translator,
  Provider,
} from "./types";
import { isValidOpenAIModel, getModelInfo } from "./models";
import { jsonToToon, toonToJson } from "./toon";
import { estimateTokens } from "./usage-tracker";
import { chunkJson, mergeChunks } from "./chunking";

/**
 * Unified Translator using Vercel AI SDK
 * Supports multiple providers with a consistent interface
 */
export class UnifiedTranslator implements Translator {
  private provider: string;
  private apiKey: string;
  private defaultModel: string;
  /**
   * Parse model output that should be TOON but may be JSON.
   * Tries TOON first, then JSON fallback with simple extraction.
   */
  private parseToonOrJson(raw: string): any {
    let content = raw.trim();
    const codeBlockMatch = content.match(
      /```(?:json|toon)?\s*([\s\S]*?)\s*```/
    );
    if (codeBlockMatch) {
      content = codeBlockMatch[1].trim();
    }

    let toonError: unknown = null;
    try {
      return toonToJson(content);
    } catch (err) {
      toonError = err;
    }

    // Retry TOON parse after stripping outer braces (some models return brace-wrapped TOON without commas)
    try {
      const unwrapped = this.stripOuterBraces(content);
      if (unwrapped !== content) {
        return toonToJson(unwrapped);
      }
    } catch {
      // ignore and continue
    }

    // JSON fallback: try to extract bracketed content if present
    try {
      let extracted = content;
      const jsonStart = content.indexOf("{");
      const jsonEnd = content.lastIndexOf("}");
      const arrayStart = content.indexOf("[");
      const arrayEnd = content.lastIndexOf("]");

      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        extracted = content.substring(jsonStart, jsonEnd + 1);
      } else if (arrayStart >= 0 && arrayEnd > arrayStart) {
        extracted = content.substring(arrayStart, arrayEnd + 1);
      }

      return JSON.parse(extracted);
    } catch (jsonError) {
      // Last attempts: normalize and repair common JSON-ish outputs
      try {
        const normalized = this.normalizeJsonish(
          this.insertMissingCommas(
            this.fixLineQuotes(this.fixQuotes(this.repairBrackets(content)))
          )
        );
        return JSON.parse(normalized);
      } catch (normalizedError) {
        try {
          const truncated = this.truncateToLastCloser(content);
          if (truncated) {
            const normalizedTruncated = this.normalizeJsonish(
              this.insertMissingCommas(
                this.fixLineQuotes(
                  this.fixQuotes(this.repairBrackets(truncated))
                )
              )
            );
            return JSON.parse(normalizedTruncated);
          }
        } catch (truncatedError) {
          console.error(
            `[LLM] parse failed (TOON->JSON->normalized->truncated). First 500 chars:`,
            content.substring(0, 500)
          );
          console.error(`[LLM] TOON parse error:`, toonError);
          console.error(`[LLM] JSON parse error:`, jsonError);
          console.error(`[LLM] Normalized JSON parse error:`, normalizedError);
          console.error(`[LLM] Truncated parse error:`, truncatedError);
          // Try TOON again after removing commas entirely
          try {
            const deComma = content.replace(/,/g, "");
            return toonToJson(deComma);
          } catch (toonNoCommaErr) {
            console.error(`[LLM] TOON no-comma parse error:`, toonNoCommaErr);
            throw truncatedError;
          }
        }
        console.error(
          `[LLM] parse failed (TOON->JSON->normalized). First 500 chars:`,
          content.substring(0, 500)
        );
        console.error(`[LLM] TOON parse error:`, toonError);
        console.error(`[LLM] JSON parse error:`, jsonError);
        console.error(`[LLM] Normalized JSON parse error:`, normalizedError);
        // Final fallback: JS-like eval after cleanup
        try {
          let jsish = this.normalizeJsonish(
            this.insertMissingCommas(
              this.fixLineQuotes(this.fixQuotes(this.repairBrackets(content)))
            )
          );
          // Try as-is
          try {
            // eslint-disable-next-line no-new-func
            return new Function(`return (${jsish});`)();
          } catch {
            // If not object/array literal, wrap in braces
            const wrapped =
              jsish.trim().startsWith("{") || jsish.trim().startsWith("[")
                ? jsish
                : `{${jsish}}`;
            // eslint-disable-next-line no-new-func
            return new Function(`return (${wrapped});`)();
          }
        } catch (evalError) {
          console.error(
            `[LLM] Eval fallback parse error:`,
            evalError instanceof Error ? evalError.message : evalError
          );
          throw evalError;
        }
      }
    }
  }

  // Best-effort cleanup for JSON-ish with unquoted keys and trailing commas
  private normalizeJsonish(content: string): string {
    let normalized = content;
    // Strip trailing commas before } or ]
    normalized = normalized.replace(/,(\s*[}\]])/g, "$1");
    // Quote unquoted object keys (simple heuristic)
    normalized = normalized.replace(
      /([{\s])([A-Za-z0-9_]+)\s*:/g,
      (_m, prefix, key) => {
        return `${prefix}"${key}":`;
      }
    );
    return normalized;
  }

  private stripOuterBraces(content: string): string {
    let trimmed = content.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      trimmed = trimmed.slice(1, -1).trim();
    }
    return trimmed;
  }

  // Repair unmatched brackets/braces by appending missing closers
  private repairBrackets(content: string): string {
    let repaired = content;
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    const openBrackets = (content.match(/\[/g) || []).length;
    const closeBrackets = (content.match(/]/g) || []).length;

    if (openBraces > closeBraces) {
      repaired += "}".repeat(openBraces - closeBraces);
    }
    if (openBrackets > closeBrackets) {
      repaired += "]".repeat(openBrackets - closeBrackets);
    }
    return repaired;
  }

  // If odd number of unescaped quotes, close the last string
  private fixQuotes(content: string): string {
    const quotes = (content.match(/(?<!\\)"/g) || []).length;
    if (quotes % 2 !== 0) {
      return content + '"';
    }
    return content;
  }

  // Fix lines with odd quote counts by closing them at line end
  private fixLineQuotes(content: string): string {
    const lines = content.split("\n");
    const fixed = lines.map((line) => {
      const count = (line.match(/(?<!\\)"/g) || []).length;
      if (count % 2 !== 0) {
        return line + '"';
      }
      return line;
    });
    return fixed.join("\n");
  }

  // Try to truncate to the last closing brace/bracket and return that slice
  private truncateToLastCloser(content: string): string | null {
    const lastBrace = content.lastIndexOf("}");
    const lastBracket = content.lastIndexOf("]");
    const lastIndex = Math.max(lastBrace, lastBracket);
    if (lastIndex <= 0) return null;
    return content.slice(0, lastIndex + 1);
  }

  // Insert commas between adjacent object/array entries when missing
  private insertMissingCommas(content: string): string {
    let updated = content;
    // Add commas between } or ] or "..." and the next key line
    const pattern = /([}\]"])\s*\n(\s*["A-Za-z0-9_]+\s*:)/g;
    // Also between closing brace/bracket and next opening brace/bracket (arrays of objects)
    const pattern2 = /([}\]])\s*\n(\s*[{\[])/g;
    // Between quoted/number literal and next item line in arrays
    const pattern3 = /(["\d])\s*\n(\s*["\d{\[])/g;

    let prev: string;
    do {
      prev = updated;
      updated = updated
        .replace(pattern, "$1,\n$2")
        .replace(pattern2, "$1,\n$2")
        .replace(pattern3, "$1,\n$2");
    } while (updated !== prev);

    return updated;
  }

  constructor(provider: string, apiKey: string, defaultModel?: string) {
    if (!apiKey) {
      throw new Error(`API key is required for provider: ${provider}`);
    }
    this.provider = provider;
    this.apiKey = apiKey;

    // Set default models per provider
    switch (provider) {
      case "openai":
        this.defaultModel = defaultModel || "gpt-4o-mini";
        break;
      default:
        this.defaultModel = defaultModel || "gpt-4o-mini";
    }
  }

  async translate(input: TranslationInput): Promise<TranslationResult> {
    const model = input.model || this.defaultModel;

    console.log(
      `[LLM] Starting translation with model: ${model}, provider: ${this.provider}`
    );
    console.log(`[LLM] Target language: ${input.targetLanguage}`);
    console.log(`[LLM] Excluded paths count: ${input.excludedPaths.length}`);

    // Parse JSON
    let jsonObj: any;
    try {
      jsonObj = JSON.parse(input.jsonContent);
    } catch {
      throw new Error("Invalid JSON content");
    }

    const jsonContent = JSON.stringify(jsonObj); // Minified JSON for sizing
    const toonContent = jsonToToon(jsonObj);
    const jsonSize = new Blob([jsonContent]).size;
    const toonSize = new Blob([toonContent]).size;
    const toonSizeKB = toonSize / 1024;
    const jsonSizeKB = jsonSize / 1024;
    const jsonTokens = estimateTokens(jsonContent);
    const toonTokens = estimateTokens(toonContent);
    const sizeSavingsPct = jsonSize > 0 ? (1 - toonSize / jsonSize) * 100 : 0;
    const tokenSavingsPct =
      jsonTokens > 0 ? (1 - toonTokens / jsonTokens) * 100 : 0;
    console.log(
      `[LLM] TOON size: ${toonSizeKB.toFixed(2)} KB (JSON: ${jsonSizeKB.toFixed(2)} KB) | size saved: ${sizeSavingsPct.toFixed(1)}%`
    );
    console.log(
      `[LLM] TOON tokens est: ~${toonTokens} (JSON est: ~${jsonTokens}) | token saved: ${tokenSavingsPct.toFixed(1)}%`
    );

    // Check if we need to chunk (larger threshold after TOON integration)
    // Production webview has 60s timeout; keep threshold conservative
    const CHUNK_THRESHOLD_KB = 4; // tighter to avoid large single requests
    const needsChunking = toonSizeKB > CHUNK_THRESHOLD_KB;

    if (needsChunking) {
      console.log(
        `[LLM] File is large (${jsonSizeKB.toFixed(2)} KB), using chunking to avoid timeout`
      );
      return await this.translateWithChunking(jsonObj, input, model);
    }

    console.log(`[LLM] Using TOON format for request payload`);

    // Build system prompt for translation (TOON-aware)
    const systemPrompt = this.buildTranslationPrompt(
      input.targetLanguage,
      input.excludedPaths,
      true
    );
    const systemPromptSize = new Blob([systemPrompt]).size;
    console.log(
      `[LLM] System prompt size: ${(systemPromptSize / 1024).toFixed(2)} KB`
    );

    // Build user prompt with TOON content
    const userPrompt = `Translate the following TOON to ${input.targetLanguage}. Output TOON only (no JSON, no code fences, no markdown). Preserve structure and keys; translate string values only. Do not insert commas. Use two-space indentation. Keep the response concise and complete.\n\n${toonContent}`;
    const userPromptSize = new Blob([userPrompt]).size;
    const totalSize = systemPromptSize + userPromptSize;
    const requestTokensEstimate = estimateTokens(
      systemPrompt + "\n" + userPrompt
    );
    console.log(
      `[LLM] User prompt size: ${(userPromptSize / 1024).toFixed(2)} KB`
    );
    console.log(
      `[LLM] Total request size: ${(totalSize / 1024).toFixed(2)} KB (${(totalSize / (1024 * 1024)).toFixed(2)} MB)`
    );
    console.log(`[LLM] Estimated request tokens: ~${requestTokensEstimate}`);

    try {
      // Get the appropriate AI SDK provider
      const aiProvider = this.getAIProvider();
      const aiModel = aiProvider(model);

      console.log(`[LLM] Calling generateText API...`);
      const apiStartTime = Date.now();

      // Create an AbortController for timeout handling (10 minutes for non-chunked files)
      // Production builds may have stricter timeouts, so we use a longer timeout
      // Note: This is for files that don't need chunking (< 10KB)
      const abortController = new AbortController();
      const timeoutDuration = 10 * 60 * 1000; // 10 minutes for small files
      const timeoutId = setTimeout(() => {
        console.warn(
          `[LLM] Request timeout after ${timeoutDuration / 1000}s, aborting...`
        );
        abortController.abort();
      }, timeoutDuration);

      let text: string;
      try {
        // Use Vercel AI SDK's generateText for translation
        // Wrap in Promise.race to handle potential webview timeouts
        const generateTextPromise = generateText({
          model: aiModel,
          system: systemPrompt,
          prompt: userPrompt,
          temperature: input.temperature ?? 0.3,
          abortSignal: abortController.signal,
        });

        // Also create a timeout promise as a fallback
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "Request timeout: The translation took too long. Try excluding more paths or using a faster model."
              )
            );
          }, timeoutDuration);
        });

        const result = await Promise.race([
          generateTextPromise,
          timeoutPromise,
        ]);
        text = result.text;

        clearTimeout(timeoutId);
      } catch (raceError) {
        clearTimeout(timeoutId);
        throw raceError;
      }

      const apiDuration = Date.now() - apiStartTime;
      console.log(
        `[LLM] API call completed in ${(apiDuration / 1000).toFixed(2)}s`
      );
      console.log(
        `[LLM] Response text length: ${text.length.toLocaleString()} characters`
      );
      console.log(`[LLM] Estimated response tokens: ~${estimateTokens(text)}`);

      if (!text || text.trim().length === 0) {
        throw new Error("Empty response from LLM");
      }

      try {
        const parsed = this.parseToonOrJson(text);
        const translatedJson = JSON.stringify(parsed, null, 2);
        return { translatedJson };
      } catch (parseError) {
        console.error(`[LLM] Failed to parse response:`, parseError);
        console.error(
          `[LLM] Raw response (first 1000 chars):`,
          text.substring(0, 1000)
        );
        throw new Error("Response is not valid TOON/JSON format");
      }
    } catch (error) {
      console.error("Translation failed:", error);

      // Check for specific timeout errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("Load failed") ||
        errorMessage.includes("aborted")
      ) {
        console.error("[LLM] Timeout detected - this may be due to:");
        console.error(
          "[LLM] 1. Production webview has a 60-second default timeout"
        );
        console.error("[LLM] 2. File is too large for a single request");
        console.error("[LLM] 3. API is slow or overloaded");
        console.error("[LLM] Suggestions:");
        console.error("[LLM] - Try excluding more paths to reduce file size");
        console.error(
          "[LLM] - Use a faster model (e.g., gpt-4o-mini instead of gpt-5)"
        );
        console.error("[LLM] - Split large files into smaller chunks");
        throw new Error(
          "Translation timed out after 60 seconds. This is a known limitation in production builds. Try excluding more paths, using a faster model, or splitting the file into smaller chunks."
        );
      }

      throw new Error(errorMessage || "Failed to translate JSON");
    }
  }

  /**
   * Translate large JSON files by splitting into chunks
   */
  private async translateWithChunking(
    jsonObj: any,
    input: TranslationInput,
    model: string
  ): Promise<TranslationResult> {
    // Split into smaller chunks to stay comfortably under 60s webview limit
    const CHUNK_SIZE_BYTES = 3 * 1024; // ~3KB per chunk to minimize truncation risk
    const chunks = chunkJson(jsonObj, CHUNK_SIZE_BYTES, input.excludedPaths);
    console.log(`[LLM] Split into ${chunks.length} chunks`);

    const translatedChunks: Array<{ key: string; data: any }> = [];
    const aiProvider = this.getAIProvider();
    const aiModel = aiProvider(model);

    // Build system prompt (same for all chunks)
    const systemPrompt = this.buildTranslationPrompt(
      input.targetLanguage,
      input.excludedPaths,
      true
    );

    // Translate each chunk with retry logic
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(
        `[LLM] Translating chunk ${i + 1}/${chunks.length} (key: ${chunk.key}, size: ${(chunk.size / 1024).toFixed(2)} KB)`
      );

      const MAX_RETRIES = 2; // Retry up to 2 times
      let chunkTranslated = false;

      for (let retry = 0; retry <= MAX_RETRIES; retry++) {
        try {
          if (retry > 0) {
            console.log(
              `[LLM] Retrying chunk ${i + 1} (attempt ${retry + 1}/${MAX_RETRIES + 1})...`
            );
            // Wait a bit before retrying
            await new Promise((resolve) => setTimeout(resolve, 1000 * retry));
          }

          const toonContent = jsonToToon(chunk.data);
          const chunkJsonContent = JSON.stringify(chunk.data);
          const chunkJsonTokens = estimateTokens(chunkJsonContent);
          const chunkToonTokens = estimateTokens(toonContent);
          const chunkSizeSavingsPct =
            chunkJsonContent.length > 0
              ? (1 -
                  new Blob([toonContent]).size /
                    new Blob([chunkJsonContent]).size) *
                100
              : 0;
          const chunkTokenSavingsPct =
            chunkJsonTokens > 0
              ? (1 - chunkToonTokens / chunkJsonTokens) * 100
              : 0;
          console.log(
            `[LLM] Chunk ${i + 1} size saved: ${chunkSizeSavingsPct.toFixed(1)}% | token saved: ${chunkTokenSavingsPct.toFixed(1)}% (TOON est: ~${chunkToonTokens}, JSON est: ~${chunkJsonTokens})`
          );
          const userPrompt = `Translate the following TOON to ${input.targetLanguage}. Output TOON only (no JSON, no code fences, no markdown). Preserve structure and keys; translate string values only. Do not insert commas. Use two-space indentation. Keep the response concise and complete.\n\n${toonContent}`;
          const requestTokensEstimate = estimateTokens(
            systemPrompt + "\n" + userPrompt
          );
          console.log(
            `[LLM] Chunk ${i + 1} estimated request tokens: ~${requestTokensEstimate}`
          );

          // Translate chunk with timeout (45 seconds to stay under 60s webview limit)
          // Smaller chunks finish quicker; tighten timeout for faster failure/retry
          const abortController = new AbortController();
          const timeoutDuration = 60 * 1000; // 60 seconds per chunk to allow full TOON output
          const timeoutId = setTimeout(() => {
            console.warn(
              `[LLM] Chunk ${i + 1} timeout after ${timeoutDuration / 1000}s, aborting...`
            );
            abortController.abort();
          }, timeoutDuration);

          let text: string;
          try {
            const chunkStartTime = Date.now();
            const result = await generateText({
              model: aiModel,
              system: systemPrompt,
              prompt: userPrompt,
              temperature: input.temperature ?? 0.3,
              abortSignal: abortController.signal,
            });
            text = result.text;
            clearTimeout(timeoutId);
            const chunkDuration = Date.now() - chunkStartTime;
            console.log(
              `[LLM] Chunk ${i + 1} API call completed in ${(chunkDuration / 1000).toFixed(2)}s`
            );
            console.log(
              `[LLM] Chunk ${i + 1} estimated response tokens: ~${estimateTokens(text)}`
            );
          } catch (chunkError) {
            clearTimeout(timeoutId);
            const errorMessage =
              chunkError instanceof Error
                ? chunkError.message
                : String(chunkError);

            // Check if it's a timeout/abort error
            if (
              errorMessage.includes("aborted") ||
              errorMessage.includes("timeout") ||
              errorMessage.includes("abort") ||
              errorMessage.includes("Load failed")
            ) {
              console.error(`[LLM] Chunk ${i + 1} failed: ${errorMessage}`);

              if (retry < MAX_RETRIES) {
                console.log(
                  `[LLM] Will retry chunk ${i + 1} (attempt ${retry + 2}/${MAX_RETRIES + 1})`
                );
                continue; // Retry
              } else {
                throw new Error(
                  `Translation timeout after ${MAX_RETRIES + 1} attempts: The chunk took longer than ${timeoutDuration / 1000} seconds. Try excluding more paths or using a faster model.`
                );
              }
            }

            // Non-timeout error - don't retry
            throw chunkError;
          }

          // Parse TOON/JSON response
          let parsedChunk: any;
          try {
            parsedChunk = this.parseToonOrJson(text);
          } catch (parseError) {
            console.error(
              `[LLM] Failed to parse chunk ${i + 1} response. First 500 chars:`,
              text.substring(0, 500)
            );
            throw new Error(
              `Failed to parse chunk ${i + 1} response: not valid TOON/JSON`
            );
          }

          translatedChunks.push({
            key: chunk.key,
            data: parsedChunk,
          });

          console.log(
            `[LLM] Chunk ${i + 1}/${chunks.length} translated successfully`
          );
          chunkTranslated = true;
          break; // Success - exit retry loop
        } catch (chunkError) {
          const errorMessage =
            chunkError instanceof Error
              ? chunkError.message
              : String(chunkError);

          if (retry < MAX_RETRIES) {
            console.warn(
              `[LLM] Chunk ${i + 1} failed (attempt ${retry + 1}): ${errorMessage}. Will retry...`
            );
            continue; // Retry
          } else {
            console.error(
              `[LLM] Failed to translate chunk ${i + 1} after ${MAX_RETRIES + 1} attempts:`,
              errorMessage
            );
            throw new Error(
              `Failed to translate chunk ${i + 1}/${chunks.length} after ${MAX_RETRIES + 1} attempts: ${errorMessage}`
            );
          }
        }
      }

      // If chunk wasn't translated after all retries, throw error
      if (!chunkTranslated) {
        throw new Error(
          `Failed to translate chunk ${i + 1}/${chunks.length} after ${MAX_RETRIES + 1} attempts`
        );
      }
    }

    // Merge chunks back together
    console.log(
      `[LLM] Merging ${translatedChunks.length} translated chunks...`
    );
    const merged = mergeChunks(translatedChunks, jsonObj);
    const translatedJson = JSON.stringify(merged, null, 2);

    console.log(`[LLM] Successfully merged all chunks`);
    return { translatedJson };
  }

  /**
   * Build translation system prompt
   */
  private buildTranslationPrompt(
    targetLanguage: string,
    excludedPaths: string[],
    useToon: boolean = false
  ): string {
    const formatName = useToon ? "TOON" : "JSON";
    let prompt = `Translate to ${targetLanguage}. Rules:
- Translate string values only; keep keys and structure identical
- Preserve data types; no additions or removals
- Return only valid ${formatName}; no extra text`;

    if (useToon) {
      prompt += `\nTOON-only output. Do NOT return JSON, code fences, or markdown. No commas. Use two-space indentation. Example:
{
  title: "Hello"
  nested: {
    subtitle: "World"
  }
  list: [
    "a"
    "b"
  ]
}`;
    }

    if (excludedPaths.length > 0) {
      prompt += `\nDo not translate these paths:\n${excludedPaths.map((path) => `- ${path}`).join("\n")}`;
    }

    return prompt;
  }

  /**
   * Get the appropriate AI SDK provider based on the provider string
   */
  private getAIProvider() {
    switch (this.provider) {
      case "openai":
        return createOpenAI({
          apiKey: this.apiKey,
        });
      case "anthropic":
        return createAnthropic({
          apiKey: this.apiKey,
        });
      case "mistral":
        return createMistral({
          apiKey: this.apiKey,
        });
      case "openrouter":
        // OpenRouter uses OpenAI-compatible API
        return createOpenAI({
          apiKey: this.apiKey,
          baseURL: "https://openrouter.ai/api/v1",
        });
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }
}

/**
 * Get the provider for a given model ID
 * Supports dynamic OpenAI model detection
 */
export function getProviderForModel(modelId: string): Provider {
  // OpenRouter models have specific patterns
  if (modelId.includes("/") && modelId.includes(":")) {
    return "openrouter";
  }

  // Claude models
  if (modelId.startsWith("claude-")) {
    return "anthropic";
  }

  // Mistral models
  if (modelId.startsWith("mistral-")) {
    return "mistral";
  }

  // OpenAI models - support any gpt-* model dynamically
  if (isValidOpenAIModel(modelId)) {
    return "openai";
  }

  // Default to OpenAI for GPT models
  return "openai";
}
