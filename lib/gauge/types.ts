import type { CurrentUser } from "@/lib/auth";
import type { GaugeActionArtifact } from "@/lib/gauge/actions";
import type { GaugeDraftArtifact } from "@/lib/gauge/drafts";

export type GaugeProviderName = "mock" | "ollama";

export type GaugeChatRole = "system" | "user" | "assistant" | "tool";

export type GaugeChatMessage = {
  role: GaugeChatRole;
  content: string;
  toolName?: string;
  toolCalls?: GaugeToolCallRequest[];
};

export type GaugeToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      required?: string[];
      properties: Record<string, unknown>;
    };
  };
};

export type GaugeToolCallRequest = {
  name: string;
  arguments: Record<string, unknown>;
};

export type GaugeProviderRequest = {
  messages: GaugeChatMessage[];
  tools: GaugeToolSchema[];
  user: CurrentUser;
};

export type GaugeProviderResponse = {
  content: string;
  toolCalls: GaugeToolCallRequest[];
};

export type GaugeChatDraftMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
  drafts?: GaugeDraftArtifact[];
  actions?: GaugeActionArtifact[];
};

export type GaugeProvider = {
  name: GaugeProviderName;
  model: string;
  chat(request: GaugeProviderRequest): Promise<GaugeProviderResponse>;
};
