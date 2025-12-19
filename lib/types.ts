export type Provider = "openai" | "anthropic" | "mistral" | "openrouter";

export interface TranslationInput {
  jsonContent: string;
  targetLanguage: string;
  excludedPaths: string[];
  model?: string;
  temperature?: number;
}

export interface TranslationResult {
  translatedJson: string;
}

export interface Translator {
  translate(input: TranslationInput): Promise<TranslationResult>;
}
