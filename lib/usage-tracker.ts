import { getModelById } from "./models";
import type { Provider } from "./types";

export interface UsageEntry {
  timestamp: number;
  provider: Provider;
  model: string;
  tokens?: number; // legacy total tokens
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  duration: number; // milliseconds
  success: boolean;
  error?: string;
}

export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number; // milliseconds
  totalTokens: number;
  estimatedCost: number; // in USD
  byProvider: Record<
    Provider,
    {
      requests: number;
      tokens: number;
      duration: number;
      cost: number;
    }
  >;
}

const STORAGE_KEY = "localekit_usage_history";
const MAX_ENTRIES = 1000; // Keep last 1000 entries

/**
 * Get all usage entries from localStorage
 */
export function getUsageHistory(): UsageEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to load usage history:", error);
    return [];
  }
}

/**
 * Add a new usage entry
 */
export function trackUsage(entry: UsageEntry): void {
  if (typeof window === "undefined") return;

  try {
    const history = getUsageHistory();
    history.push(entry);

    const trimmed = history.slice(-MAX_ENTRIES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Failed to track usage:", error);
  }
}

/**
 * Clear all usage history
 */
export function clearUsageHistory(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear usage history:", error);
  }
}

/**
 * Calculate usage statistics
 */
export function calculateUsageStats(
  entries: UsageEntry[] = getUsageHistory()
): UsageStats {
  const stats: UsageStats = {
    totalRequests: entries.length,
    successfulRequests: entries.filter((e) => e.success).length,
    failedRequests: entries.filter((e) => !e.success).length,
    totalDuration: 0,
    totalTokens: 0,
    estimatedCost: 0,
    byProvider: {
      openai: { requests: 0, tokens: 0, duration: 0, cost: 0 },
      anthropic: { requests: 0, tokens: 0, duration: 0, cost: 0 },
      mistral: { requests: 0, tokens: 0, duration: 0, cost: 0 },
      openrouter: { requests: 0, tokens: 0, duration: 0, cost: 0 },
    },
  };

  for (const entry of entries) {
    stats.totalDuration += entry.duration;
    const entryTotalTokens = entry.totalTokens ?? entry.tokens ?? 0;
    stats.totalTokens += entryTotalTokens;

    const modelInfo = getModelById(entry.model);
    if (modelInfo?.costPer1kTokens && entryTotalTokens) {
      const avgCost =
        (modelInfo.costPer1kTokens.input + modelInfo.costPer1kTokens.output) /
        2;
      const cost = (entryTotalTokens / 1000) * avgCost;
      stats.estimatedCost += cost;
      stats.byProvider[entry.provider].cost += cost;
    }

    stats.byProvider[entry.provider].requests++;
    stats.byProvider[entry.provider].tokens += entryTotalTokens;
    stats.byProvider[entry.provider].duration += entry.duration;
  }

  return stats;
}

/**
 * Get usage stats for a specific time period
 */
export function getUsageStatsForPeriod(days: number): UsageStats {
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  const entries = getUsageHistory().filter((e) => e.timestamp >= cutoff);
  return calculateUsageStats(entries);
}

/**
 * Estimate tokens from text length (rough approximation)
 * GPT-style models: ~1 token per 4 characters
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
