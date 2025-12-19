import type { Provider } from "./types";

export interface ModelInfo {
  id: string;
  name: string;
  provider: Provider;
  category: "paid" | "free";
  description?: string;
  contextWindow?: number;
  costPer1kTokens?: { input: number; output: number };
}

/**
 * All available models grouped by category
 * Includes comprehensive OpenAI model support including GPT-5 series
 */
export const MODELS: ModelInfo[] = [
  // OpenAI GPT-5 Series
  {
    id: "gpt-5",
    name: "GPT-5",
    provider: "openai",
    category: "paid",
    description: "Most advanced reasoning",
    contextWindow: 128000,
    costPer1kTokens: { input: 0.005, output: 0.015 },
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    category: "paid",
    description: "Balanced performance",
    contextWindow: 128000,
    costPer1kTokens: { input: 0.001, output: 0.003 },
  },
  {
    id: "gpt-5-pro",
    name: "GPT-5 Pro",
    provider: "openai",
    category: "paid",
    description: "Professional grade",
    contextWindow: 128000,
    costPer1kTokens: { input: 0.01, output: 0.03 },
  },
  {
    id: "gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "openai",
    category: "paid",
    description: "Lightweight and fast",
    contextWindow: 128000,
    costPer1kTokens: { input: 0.0005, output: 0.0015 },
  },
  {
    id: "gpt-5.1",
    name: "GPT-5.1",
    provider: "openai",
    category: "paid",
    description: "Enhanced version",
    contextWindow: 128000,
    costPer1kTokens: { input: 0.0055, output: 0.016 },
  },
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    category: "paid",
    description: "Latest iteration",
    contextWindow: 128000,
    costPer1kTokens: { input: 0.006, output: 0.017 },
  },
  {
    id: "gpt-5-turbo",
    name: "GPT-5 Turbo",
    provider: "openai",
    category: "paid",
    description: "Fast GPT-5 variant",
    contextWindow: 128000,
    costPer1kTokens: { input: 0.003, output: 0.009 },
  },

  // OpenAI GPT-4 Series
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    category: "paid",
    description: "Most capable model",
    contextWindow: 128000,
    costPer1kTokens: { input: 0.0025, output: 0.01 },
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    category: "paid",
    description: "Fast and affordable",
    contextWindow: 128000,
    costPer1kTokens: { input: 0.00015, output: 0.0006 },
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    category: "paid",
    description: "Powerful and versatile",
    contextWindow: 128000,
    costPer1kTokens: { input: 0.03, output: 0.06 },
  },
  {
    id: "gpt-4",
    name: "GPT-4",
    provider: "openai",
    category: "paid",
    description: "Original GPT-4",
    contextWindow: 8192,
    costPer1kTokens: { input: 0.03, output: 0.06 },
  },
  {
    id: "gpt-4-32k",
    name: "GPT-4 32k",
    provider: "openai",
    category: "paid",
    description: "Extended context",
    contextWindow: 32768,
    costPer1kTokens: { input: 0.06, output: 0.12 },
  },

  // OpenAI GPT-3.5 Series
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "openai",
    category: "paid",
    description: "Very affordable and fast",
    contextWindow: 16385,
    costPer1kTokens: { input: 0.0005, output: 0.0015 },
  },
  {
    id: "gpt-3.5-turbo-16k",
    name: "GPT-3.5 Turbo 16k",
    provider: "openai",
    category: "paid",
    description: "Extended context",
    contextWindow: 16385,
    costPer1kTokens: { input: 0.001, output: 0.002 },
  },

  // Anthropic Models (Paid)
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    category: "paid",
    description: "Balanced performance",
    contextWindow: 200000,
    costPer1kTokens: { input: 0.003, output: 0.015 },
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    category: "paid",
    description: "Fast and efficient",
    contextWindow: 200000,
    costPer1kTokens: { input: 0.0008, output: 0.004 },
  },

  // Mistral Models
  {
    id: "mistral-small-latest",
    name: "Mistral Small",
    provider: "mistral",
    category: "paid",
    description: "Cost-effective",
    contextWindow: 32000,
    costPer1kTokens: { input: 0.0001, output: 0.0003 },
  },
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    provider: "mistral",
    category: "paid",
    description: "Most capable Mistral",
    contextWindow: 128000,
    costPer1kTokens: { input: 0.004, output: 0.012 },
  },

  // OpenRouter Free Models
  {
    id: "meta-llama/llama-3.2-3b-instruct:free",
    name: "Llama 3.2 3B (Free)",
    provider: "openrouter",
    category: "free",
    description: "Fast, lightweight",
    contextWindow: 131072,
  },
  {
    id: "google/gemma-2-9b-it:free",
    name: "Gemma 2 9B (Free)",
    provider: "openrouter",
    category: "free",
    description: "Google's open model",
    contextWindow: 8192,
  },
  {
    id: "microsoft/phi-3-mini-128k-instruct:free",
    name: "Phi-3 Mini (Free)",
    provider: "openrouter",
    category: "free",
    description: "Microsoft research model",
    contextWindow: 128000,
  },
  {
    id: "mistralai/mistral-7b-instruct:free",
    name: "Mistral 7B (Free)",
    provider: "openrouter",
    category: "free",
    description: "Open source Mistral",
    contextWindow: 32768,
  },
];

/**
 * Get models by category
 */
export function getModelsByCategory(category: "paid" | "free"): ModelInfo[] {
  return MODELS.filter((m) => m.category === category);
}

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: Provider): ModelInfo[] {
  return MODELS.filter((m) => m.provider === provider);
}

/**
 * Get model by ID
 */
export function getModelById(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

/**
 * Get default model (gpt-4o-mini for cost-effectiveness)
 */
export function getDefaultModel(): ModelInfo {
  return MODELS.find((m) => m.id === "gpt-4o-mini") || MODELS[0];
}

/**
 * Get available models based on which API keys are configured
 */
export function getAvailableModels(hasKeys: Record<Provider, boolean>): ModelInfo[] {
  return MODELS.filter((model) => {
    // All models require their provider's API key
    return hasKeys[model.provider] === true;
  });
}

/**
 * Validate if a model ID is a valid OpenAI model
 * Supports dynamic model IDs (any gpt-* model)
 */
export function isValidOpenAIModel(modelId: string): boolean {
  // Any model starting with gpt- is considered valid for OpenAI
  return modelId.trim().toLowerCase().startsWith("gpt-");
}

/**
 * Get model info, creating a generic entry for unknown models if needed
 */
export function getModelInfo(modelId: string): ModelInfo | null {
  // First check predefined models
  const predefined = getModelById(modelId);
  if (predefined) {
    return predefined;
  }

  // For OpenAI models, create a generic entry
  if (isValidOpenAIModel(modelId)) {
    return {
      id: modelId,
      name: `Custom: ${modelId}`,
      provider: "openai",
      category: "paid",
      description: "Custom OpenAI model",
    };
  }

  return null;
}
