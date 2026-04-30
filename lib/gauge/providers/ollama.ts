import type {
  GaugeChatMessage,
  GaugeProvider,
  GaugeProviderRequest,
  GaugeProviderResponse,
  GaugeToolCallRequest,
} from "@/lib/gauge/types";

type OllamaChatResponse = {
  message?: {
    content?: string;
    tool_calls?: Array<{
      function?: {
        name?: string;
        arguments?: unknown;
      };
    }>;
  };
};

export function createOllamaGaugeProvider({
  baseUrl,
  model,
}: {
  baseUrl: string;
  model: string;
}): GaugeProvider {
  return {
    name: "ollama",
    model,
    async chat(request) {
      return ollamaChat({ baseUrl, model, request });
    },
  };
}

async function ollamaChat({
  baseUrl,
  model,
  request,
}: {
  baseUrl: string;
  model: string;
  request: GaugeProviderRequest;
}): Promise<GaugeProviderResponse> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: request.messages.map(toOllamaMessage),
      tools: request.tools,
      stream: false,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama chat failed with status ${response.status}: ${await response.text()}`);
  }

  const body = (await response.json()) as OllamaChatResponse;
  const message = body.message;

  return {
    content: message?.content?.trim() ?? "",
    toolCalls: parseToolCalls(message?.tool_calls ?? []),
  };
}

function toOllamaMessage(message: GaugeChatMessage) {
  return {
    role: message.role,
    content: message.content,
    ...(message.toolName ? { tool_name: message.toolName } : {}),
    ...(message.toolCalls?.length
      ? {
          tool_calls: message.toolCalls.map((call, index) => ({
            type: "function",
            function: {
              index,
              name: call.name,
              arguments: call.arguments,
            },
          })),
        }
      : {}),
  };
}

function parseToolCalls(
  calls: NonNullable<OllamaChatResponse["message"]>["tool_calls"] = [],
): GaugeToolCallRequest[] {
  return calls
    .map((call) => {
      const name = call.function?.name;

      if (!name) {
        return null;
      }

      return {
        name,
        arguments: parseArguments(call.function?.arguments),
      };
    })
    .filter((call): call is GaugeToolCallRequest => call !== null);
}

function parseArguments(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
