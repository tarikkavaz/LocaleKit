import { createAnthropic } from "@ai-sdk/anthropic";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { TranslationInput, TranslationResult, Translator, Provider } from "./types";
import { isValidOpenAIModel, getModelInfo } from "./models";
import { jsonToToon, toonToJson } from "./toon";
import { chunkJson, mergeChunks } from "./chunking";

/**
 * Unified Translator using Vercel AI SDK
 * Supports multiple providers with a consistent interface
 */
export class UnifiedTranslator implements Translator {
  private provider: string;
  private apiKey: string;
  private defaultModel: string;

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
    
    console.log(`[LLM] Starting translation with model: ${model}, provider: ${this.provider}`);
    console.log(`[LLM] Target language: ${input.targetLanguage}`);
    console.log(`[LLM] Excluded paths count: ${input.excludedPaths.length}`);
    
    // Parse JSON
    let jsonObj: any;
    try {
      jsonObj = JSON.parse(input.jsonContent);
    } catch {
      throw new Error("Invalid JSON content");
    }
    
    const jsonSize = new Blob([input.jsonContent]).size;
    const jsonSizeKB = jsonSize / 1024;
    console.log(`[LLM] JSON size: ${jsonSizeKB.toFixed(2)} KB`);
    
    // Check if we need to chunk (if > 5KB, chunk to avoid timeout in production)
    // Production webview has 60s timeout; use smaller threshold to keep calls fast
    const CHUNK_THRESHOLD_KB = 5;
    const needsChunking = jsonSizeKB > CHUNK_THRESHOLD_KB;
    
    if (needsChunking) {
      console.log(`[LLM] File is large (${jsonSizeKB.toFixed(2)} KB), using chunking to avoid timeout`);
      return await this.translateWithChunking(jsonObj, input, model);
    }
    
    // Use minified JSON (TOON was causing parsing issues)
    const jsonContent = JSON.stringify(jsonObj); // Minified JSON
    console.log(`[LLM] Using minified JSON format`);
    
    // Build system prompt for translation
    const systemPrompt = this.buildTranslationPrompt(input.targetLanguage, input.excludedPaths, false);
    const systemPromptSize = new Blob([systemPrompt]).size;
    console.log(`[LLM] System prompt size: ${(systemPromptSize / 1024).toFixed(2)} KB`);
    
    // Build user prompt with JSON content
    const userPrompt = `Translate the following JSON to ${input.targetLanguage}. Preserve the exact JSON structure, including all keys, brackets, and formatting. Only translate string values, not keys or structure. Return ONLY valid JSON, no explanations or markdown.\n\n${jsonContent}`;
    const userPromptSize = new Blob([userPrompt]).size;
    const totalSize = systemPromptSize + userPromptSize;
    console.log(`[LLM] User prompt size: ${(userPromptSize / 1024).toFixed(2)} KB`);
    console.log(`[LLM] Total request size: ${(totalSize / 1024).toFixed(2)} KB (${(totalSize / (1024 * 1024)).toFixed(2)} MB)`);

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
        console.warn(`[LLM] Request timeout after ${timeoutDuration / 1000}s, aborting...`);
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
            reject(new Error("Request timeout: The translation took too long. Try excluding more paths or using a faster model."));
          }, timeoutDuration);
        });

        const result = await Promise.race([generateTextPromise, timeoutPromise]);
        text = result.text;
        
        clearTimeout(timeoutId);
      } catch (raceError) {
        clearTimeout(timeoutId);
        throw raceError;
      }
      
      const apiDuration = Date.now() - apiStartTime;
      console.log(`[LLM] API call completed in ${(apiDuration / 1000).toFixed(2)}s`);
      console.log(`[LLM] Response text length: ${text.length.toLocaleString()} characters`);

      if (!text || text.trim().length === 0) {
        throw new Error("Empty response from LLM");
      }

      // Parse JSON response (extract from any markdown or extra text)
      let translatedJson: string;
      try {
        // First, try to extract JSON from markdown code blocks if present
        let content = text.trim();
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          content = codeBlockMatch[1].trim();
        }
        
        // Remove any leading/trailing explanation text
        // Sometimes AI adds explanations before/after the JSON
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}');
        const arrayStart = content.indexOf('[');
        const arrayEnd = content.lastIndexOf(']');
        
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          content = content.substring(jsonStart, jsonEnd + 1);
        } else if (arrayStart >= 0 && arrayEnd > arrayStart) {
          content = content.substring(arrayStart, arrayEnd + 1);
        }
        
        // Parse as JSON
        try {
          const parsed = JSON.parse(content);
          translatedJson = JSON.stringify(parsed, null, 2);
          console.log(`[LLM] Successfully parsed JSON response`);
        } catch (jsonError) {
          // Log the actual response for debugging
          console.error(`[LLM] Failed to parse JSON. First 500 chars:`, content.substring(0, 500));
          console.error(`[LLM] JSON parse error:`, jsonError);
          throw new Error(`Response is not valid JSON format. The AI may have returned an explanation or invalid format.`);
        }
      } catch (parseError) {
        console.error(`[LLM] Failed to parse response:`, parseError);
        // Log the raw response for debugging
        console.error(`[LLM] Raw response (first 1000 chars):`, text.substring(0, 1000));
        throw new Error("Response is not valid JSON format");
      }

      return { translatedJson };
    } catch (error) {
      console.error("Translation failed:", error);
      
      // Check for specific timeout errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("timeout") || errorMessage.includes("Load failed") || errorMessage.includes("aborted")) {
        console.error("[LLM] Timeout detected - this may be due to:");
        console.error("[LLM] 1. Production webview has a 60-second default timeout");
        console.error("[LLM] 2. File is too large for a single request");
        console.error("[LLM] 3. API is slow or overloaded");
        console.error("[LLM] Suggestions:");
        console.error("[LLM] - Try excluding more paths to reduce file size");
        console.error("[LLM] - Use a faster model (e.g., gpt-4o-mini instead of gpt-5)");
        console.error("[LLM] - Split large files into smaller chunks");
        throw new Error("Translation timed out after 60 seconds. This is a known limitation in production builds. Try excluding more paths, using a faster model, or splitting the file into smaller chunks.");
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
    // Split into chunks (max 8KB per chunk to stay well under timeout)
    const chunks = chunkJson(jsonObj, 8 * 1024, input.excludedPaths);
    console.log(`[LLM] Split into ${chunks.length} chunks`);
    
    const translatedChunks: Array<{ key: string; data: any }> = [];
    const aiProvider = this.getAIProvider();
    const aiModel = aiProvider(model);
    
    // Build system prompt (same for all chunks)
    const systemPrompt = this.buildTranslationPrompt(input.targetLanguage, input.excludedPaths, false);
    
    // Translate each chunk with retry logic
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[LLM] Translating chunk ${i + 1}/${chunks.length} (key: ${chunk.key}, size: ${(chunk.size / 1024).toFixed(2)} KB)`);
      
      const MAX_RETRIES = 2; // Retry up to 2 times
      let chunkTranslated = false;
      
      for (let retry = 0; retry <= MAX_RETRIES; retry++) {
        try {
          if (retry > 0) {
            console.log(`[LLM] Retrying chunk ${i + 1} (attempt ${retry + 1}/${MAX_RETRIES + 1})...`);
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * retry));
          }
          
          // Convert chunk to minified JSON
          const jsonContent = JSON.stringify(chunk.data);
          const userPrompt = `Translate the following JSON to ${input.targetLanguage}. Preserve the exact JSON structure, including all keys, brackets, and formatting. Only translate string values, not keys or structure. Return ONLY valid JSON, no explanations or markdown.\n\n${jsonContent}`;
          
          // Translate chunk with timeout (45 seconds to stay under 60s webview limit)
          // Smaller chunks finish quicker; tighten timeout for faster failure/retry
          const abortController = new AbortController();
          const timeoutDuration = 45 * 1000; // 45 seconds per chunk (safety margin under 60s)
          const timeoutId = setTimeout(() => {
            console.warn(`[LLM] Chunk ${i + 1} timeout after ${timeoutDuration / 1000}s, aborting...`);
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
            console.log(`[LLM] Chunk ${i + 1} API call completed in ${(chunkDuration / 1000).toFixed(2)}s`);
          } catch (chunkError) {
            clearTimeout(timeoutId);
            const errorMessage = chunkError instanceof Error ? chunkError.message : String(chunkError);
            
            // Check if it's a timeout/abort error
            if (errorMessage.includes("aborted") || errorMessage.includes("timeout") || errorMessage.includes("abort") || errorMessage.includes("Load failed")) {
              console.error(`[LLM] Chunk ${i + 1} failed: ${errorMessage}`);
              
              if (retry < MAX_RETRIES) {
                console.log(`[LLM] Will retry chunk ${i + 1} (attempt ${retry + 2}/${MAX_RETRIES + 1})`);
                continue; // Retry
              } else {
                throw new Error(`Translation timeout after ${MAX_RETRIES + 1} attempts: The chunk took longer than ${timeoutDuration / 1000} seconds. Try excluding more paths or using a faster model.`);
              }
            }
            
            // Non-timeout error - don't retry
            throw chunkError;
          }
        
          // Parse JSON response
          let parsedChunk: any;
          try {
            let content = text.trim();
            const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
              content = codeBlockMatch[1].trim();
            }
            
            // Extract JSON content (remove any explanations)
            const jsonStart = content.indexOf('{');
            const jsonEnd = content.lastIndexOf('}');
            const arrayStart = content.indexOf('[');
            const arrayEnd = content.lastIndexOf(']');
            
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              content = content.substring(jsonStart, jsonEnd + 1);
            } else if (arrayStart >= 0 && arrayEnd > arrayStart) {
              content = content.substring(arrayStart, arrayEnd + 1);
            }
            
            // Parse as JSON
            parsedChunk = JSON.parse(content);
          } catch (parseError) {
            console.error(`[LLM] Failed to parse chunk ${i + 1} response. First 500 chars:`, text.substring(0, 500));
            throw new Error(`Failed to parse chunk ${i + 1} response: not valid JSON`);
          }
          
          translatedChunks.push({
            key: chunk.key,
            data: parsedChunk,
          });
          
          console.log(`[LLM] Chunk ${i + 1}/${chunks.length} translated successfully`);
          chunkTranslated = true;
          break; // Success - exit retry loop
        } catch (chunkError) {
          const errorMessage = chunkError instanceof Error ? chunkError.message : String(chunkError);
          
          if (retry < MAX_RETRIES) {
            console.warn(`[LLM] Chunk ${i + 1} failed (attempt ${retry + 1}): ${errorMessage}. Will retry...`);
            continue; // Retry
          } else {
            console.error(`[LLM] Failed to translate chunk ${i + 1} after ${MAX_RETRIES + 1} attempts:`, errorMessage);
            throw new Error(`Failed to translate chunk ${i + 1}/${chunks.length} after ${MAX_RETRIES + 1} attempts: ${errorMessage}`);
          }
        }
      }
      
      // If chunk wasn't translated after all retries, throw error
      if (!chunkTranslated) {
        throw new Error(`Failed to translate chunk ${i + 1}/${chunks.length} after ${MAX_RETRIES + 1} attempts`);
      }
    }
    
    // Merge chunks back together
    console.log(`[LLM] Merging ${translatedChunks.length} translated chunks...`);
    const merged = mergeChunks(translatedChunks, jsonObj);
    const translatedJson = JSON.stringify(merged, null, 2);
    
    console.log(`[LLM] Successfully merged all chunks`);
    return { translatedJson };
  }

  /**
   * Build translation system prompt
   */
  private buildTranslationPrompt(targetLanguage: string, excludedPaths: string[], useToon: boolean = false): string {
    const formatName = useToon ? "TOON" : "JSON";
    const formatDescription = useToon 
      ? "TOON (Tom's Object-Oriented Notation) - a compact format similar to JSON but more space-efficient"
      : "JSON";
    
    let prompt = `You are a professional translator specializing in ${formatName} file translation. Your task is to translate ${formatName} content to ${targetLanguage} while preserving the exact structure.

CRITICAL RULES:
1. Preserve the exact ${formatName} structure - all keys, brackets, commas, and formatting must remain identical
2. Only translate string VALUES, never translate keys
3. Maintain the same ${formatName} structure, indentation, and formatting as the input
4. Do not add or remove any fields
5. Do not change data types (strings stay strings, numbers stay numbers, booleans stay booleans)
6. Return ONLY the translated ${formatName}, no explanations or markdown formatting`;

    if (useToon) {
      prompt += `\n\nTOON FORMAT RULES:
- Use colons (:) to separate keys from values
- Use indentation (2 spaces) for nested structures
- Arrays use square brackets [] with items on separate lines
- Objects use curly braces {} with key-value pairs on separate lines
- Example:
  user:
    name: "John"
    age: 30
    tags: [
      "developer"
      "designer"
    ]`;
    }

    if (excludedPaths.length > 0) {
      prompt += `\n\nEXCLUDED PATHS (do not translate these):\n${excludedPaths.map(path => `- ${path}`).join("\n")}`;
    }

    prompt += `\n\nReturn the complete translated JSON with the same structure as the input.`;

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
