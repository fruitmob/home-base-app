import { createMockGaugeProvider } from "@/lib/gauge/providers/mock";
import { createOllamaGaugeProvider } from "@/lib/gauge/providers/ollama";
import type { GaugeProvider, GaugeProviderName } from "@/lib/gauge/types";

export type GaugeProviderConfig = {
  provider: GaugeProviderName;
  model: string;
  baseUrl: string | null;
};

export function getGaugeProviderConfig(): GaugeProviderConfig {
  const provider = normalizeProvider(process.env.GAUGE_PROVIDER);
  const defaultModel = provider === "ollama" ? "gemma3" : "mock-gauge";

  return {
    provider,
    model: process.env.GAUGE_MODEL?.trim() || defaultModel,
    baseUrl:
      provider === "ollama"
        ? process.env.GAUGE_BASE_URL?.trim() || "http://localhost:11434"
        : null,
  };
}

export function createGaugeProvider(config = getGaugeProviderConfig()): GaugeProvider {
  if (config.provider === "ollama") {
    return createOllamaGaugeProvider({
      baseUrl: config.baseUrl ?? "http://localhost:11434",
      model: config.model,
    });
  }

  return createMockGaugeProvider(config.model);
}

function normalizeProvider(value: string | undefined): GaugeProviderName {
  if (value === "ollama") {
    return "ollama";
  }

  return "mock";
}
