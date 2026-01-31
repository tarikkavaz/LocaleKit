/**
 * JSON Complexity Analyzer
 * Analyzes JSON structure to determine optimal chunk size
 * Considers target language expansion factors and provider speed
 */

import type { Provider } from "./types";

export interface ComplexityFactors {
  nestingDepth: number;
  totalKeys: number;
  totalChars: number;
  avgValueLength: number;
  arrayCount: number;
  objectCount: number;
  branchingFactor: number;
  maxArrayLength: number;
}

// Language expansion factors (target language length vs English)
// Higher factor = more tokens = more time = need smaller chunks
const LANGUAGE_EXPANSION_FACTORS: Record<string, number> = {
  de: 1.3, // German - significantly longer
  fr: 1.15, // French
  es: 1.1, // Spanish
  it: 1.1, // Italian
  pt: 1.1, // Portuguese
  ru: 1.25, // Russian (Cyrillic + longer words)
  ja: 0.85, // Japanese (often shorter due to kanji)
  ko: 0.9, // Korean
  zh: 0.8, // Chinese (much shorter)
  ar: 1.05, // Arabic
  hi: 1.2, // Hindi
  th: 1.1, // Thai
  vi: 1.15, // Vietnamese
  pl: 1.15, // Polish
  nl: 1.1, // Dutch
  sv: 1.05, // Swedish
  da: 1.05, // Danish
  no: 1.05, // Norwegian
  fi: 1.15, // Finnish
  tr: 1.1, // Turkish
  cs: 1.15, // Czech
  hu: 1.15, // Hungarian
  el: 1.15, // Greek
  he: 1.05, // Hebrew
  id: 0.95, // Indonesian (often shorter)
  ms: 0.95, // Malay
  default: 1.15, // Most languages expand 10-15%
};

// Provider speed factors (relative speed multiplier)
// Higher = slower = need smaller chunks
const PROVIDER_SPEED_FACTORS: Record<Provider, number> = {
  openai: 1.0, // Baseline
  anthropic: 1.1, // Slightly slower
  mistral: 0.9, // Faster
  openrouter: 1.2, // Variable, assume slower
};

// Model speed factors within providers
// These adjust the base provider speed
const MODEL_SPEED_FACTORS: Record<string, number> = {
  // OpenAI
  "gpt-4o-mini": 0.85, // Fastest
  "gpt-4o": 1.0, // Standard
  "gpt-4": 1.3, // Slower
  "gpt-4-turbo": 1.1,
  "gpt-5-nano": 0.8, // Fastest GPT-5
  "gpt-5-mini": 0.9,
  "gpt-5": 1.0,
  "gpt-5-pro": 1.2,
  "gpt-5-turbo": 0.95,

  // Anthropic
  "claude-3-5-haiku-20241022": 0.9,
  "claude-3-5-sonnet-20241022": 1.1,

  // Mistral
  "mistral-small-latest": 0.85,
  "mistral-large-latest": 1.1,

  // Default
  default: 1.0,
};

/**
 * Get language expansion factor
 */
export function getLanguageExpansionFactor(languageCode: string): number {
  // Extract base language code (e.g., "en_gb" -> "en")
  const baseCode = languageCode.split("_")[0].toLowerCase();
  return (
    LANGUAGE_EXPANSION_FACTORS[baseCode] || LANGUAGE_EXPANSION_FACTORS.default
  );
}

/**
 * Get provider speed factor
 */
export function getProviderSpeedFactor(
  provider: Provider,
  model: string
): number {
  const providerFactor = PROVIDER_SPEED_FACTORS[provider] || 1.0;
  const modelFactor = MODEL_SPEED_FACTORS[model] || MODEL_SPEED_FACTORS.default;
  return providerFactor * modelFactor;
}

/**
 * Analyze JSON structure complexity
 */
export function analyzeComplexity(jsonObj: any): ComplexityFactors {
  let maxDepth = 0;
  let totalKeys = 0;
  let totalChars = 0;
  let arrayCount = 0;
  let objectCount = 0;
  let maxArrayLength = 0;
  let allValueLengths: number[] = [];

  function traverse(obj: any, depth: number): void {
    maxDepth = Math.max(maxDepth, depth);

    if (Array.isArray(obj)) {
      arrayCount++;
      maxArrayLength = Math.max(maxArrayLength, obj.length);
      for (const item of obj) {
        if (typeof item === "object" && item !== null) {
          traverse(item, depth + 1);
        } else if (typeof item === "string") {
          totalChars += item.length;
          allValueLengths.push(item.length);
          totalKeys++;
        }
      }
    } else if (typeof obj === "object" && obj !== null) {
      objectCount++;
      const keys = Object.keys(obj);
      totalKeys += keys.length;

      for (const key of keys) {
        const value = obj[key];
        if (typeof value === "object" && value !== null) {
          traverse(value, depth + 1);
        } else if (typeof value === "string") {
          totalChars += value.length;
          allValueLengths.push(value.length);
        }
      }
    }
  }

  traverse(jsonObj, 1);

  const avgValueLength =
    allValueLengths.length > 0 ? totalChars / allValueLengths.length : 0;

  // Calculate branching factor (average keys per object level)
  let totalBranching = 0;
  let objectLevels = 0;

  function calculateBranching(obj: any): void {
    if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
      const keys = Object.keys(obj);
      if (keys.length > 0) {
        totalBranching += keys.length;
        objectLevels++;
      }

      for (const key of keys) {
        const value = obj[key];
        if (typeof value === "object" && value !== null) {
          calculateBranching(value);
        }
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === "object" && item !== null) {
          calculateBranching(item);
        }
      }
    }
  }

  calculateBranching(jsonObj);

  const branchingFactor = objectLevels > 0 ? totalBranching / objectLevels : 0;

  return {
    nestingDepth: maxDepth,
    totalKeys,
    totalChars,
    avgValueLength,
    arrayCount,
    objectCount,
    branchingFactor,
    maxArrayLength,
  };
}

/**
 * Calculate complexity score (0-100)
 * Higher score = more complex = need smaller chunks
 */
export function calculateComplexityScore(
  jsonObj: any,
  targetLanguage: string,
  provider: Provider,
  model: string
): number {
  const factors = analyzeComplexity(jsonObj);
  const languageFactor = getLanguageExpansionFactor(targetLanguage);
  const speedFactor = getProviderSpeedFactor(provider, model);

  let score = 0;

  // 1. Nesting depth (0-20 points)
  // Deeper nesting = harder to translate contextually
  score += Math.min(factors.nestingDepth * 4, 20);

  // 2. Content volume (0-30 points)
  // More content = more tokens = more time
  const contentScore =
    Math.min(factors.totalKeys / 50, 15) +
    Math.min(factors.totalChars / 2000, 15);
  score += contentScore;

  // 3. Structural complexity (0-25 points)
  // Complex structures are harder to parse and translate
  const structuralScore =
    Math.min(factors.arrayCount * 2, 10) +
    Math.min(factors.branchingFactor * 3, 10) +
    Math.min(factors.maxArrayLength / 10, 5);
  score += structuralScore;

  // 4. Language expansion factor (0-15 points)
  // Languages that expand more need more careful chunking
  // Higher expansion = lower safe chunk size
  const expansionScore = Math.min((languageFactor - 0.8) * 50, 15);
  score += expansionScore;

  // 5. Provider/model speed (0-10 points)
  // Slower models need smaller chunks to stay within timeout
  const speedScore = Math.min((speedFactor - 0.8) * 25, 10);
  score += speedScore;

  return Math.min(Math.round(score), 100);
}

/**
 * Get optimal chunk size based on complexity score
 * Returns size in bytes
 */
export function getOptimalChunkSize(complexityScore: number): number {
  // These sizes are optimized for 60-second webview timeout
  // Conservative estimates to ensure reliability

  const sizes = {
    veryComplex: 4096, // 4KB - score 80-100
    complex: 6144, // 6KB - score 60-79
    moderate: 8192, // 8KB - score 40-59 (default)
    simple: 10240, // 10KB - score 20-39
    verySimple: 12288, // 12KB - score 0-19
  };

  if (complexityScore >= 80) return sizes.veryComplex;
  if (complexityScore >= 60) return sizes.complex;
  if (complexityScore >= 40) return sizes.moderate;
  if (complexityScore >= 20) return sizes.simple;
  return sizes.verySimple;
}

/**
 * Get chunk size for a specific translation context
 * Convenience function that calculates everything
 */
export function calculateChunkSize(
  jsonObj: any,
  targetLanguage: string,
  provider: Provider,
  model: string
): { size: number; score: number; factors: ComplexityFactors } {
  const factors = analyzeComplexity(jsonObj);
  const score = calculateComplexityScore(
    jsonObj,
    targetLanguage,
    provider,
    model
  );
  const size = getOptimalChunkSize(score);

  return { size, score, factors };
}

/**
 * Log complexity analysis for debugging
 */
export function logComplexityAnalysis(
  jsonObj: any,
  targetLanguage: string,
  provider: Provider,
  model: string
): void {
  const { size, score, factors } = calculateChunkSize(
    jsonObj,
    targetLanguage,
    provider,
    model
  );

  const languageFactor = getLanguageExpansionFactor(targetLanguage);
  const speedFactor = getProviderSpeedFactor(provider, model);

  console.log("[Complexity] Analysis:");
  console.log(
    `  Target: ${targetLanguage} (expansion: ${languageFactor.toFixed(2)}x)`
  );
  console.log(
    `  Provider: ${provider}, Model: ${model} (speed: ${speedFactor.toFixed(2)}x)`
  );
  console.log(`  Structure:`);
  console.log(`    - Nesting depth: ${factors.nestingDepth}`);
  console.log(`    - Total keys: ${factors.totalKeys}`);
  console.log(`    - Total chars: ${factors.totalChars.toLocaleString()}`);
  console.log(
    `    - Avg value length: ${Math.round(factors.avgValueLength)} chars`
  );
  console.log(
    `    - Arrays: ${factors.arrayCount}, Objects: ${factors.objectCount}`
  );
  console.log(`    - Max array length: ${factors.maxArrayLength}`);
  console.log(`    - Branching factor: ${factors.branchingFactor.toFixed(2)}`);
  console.log(
    `  Score: ${score}/100 → Chunk size: ${(size / 1024).toFixed(1)}KB`
  );
}
