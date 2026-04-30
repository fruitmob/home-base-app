import type {
  GaugeProvider,
  GaugeProviderRequest,
  GaugeProviderResponse,
} from "@/lib/gauge/types";
import { summarizeToolOutputs } from "@/lib/gauge/tools";

export function createMockGaugeProvider(model = "mock-gauge"): GaugeProvider {
  return {
    name: "mock",
    model,
    async chat(request) {
      return mockChat(request);
    },
  };
}

async function mockChat(request: GaugeProviderRequest): Promise<GaugeProviderResponse> {
  const lastMessage = [...request.messages].reverse().find((message) => message.role !== "system");

  if (lastMessage?.role === "tool") {
    return {
      content: summarizeToolOutputs([
        {
          toolName: lastMessage.toolName ?? "unknown",
          output: safeParseJson(lastMessage.content),
        },
      ]),
      toolCalls: [],
    };
  }

  const lastUserMessage = [...request.messages].reverse().find((message) => message.role === "user");
  const content = lastUserMessage?.content ?? "";
  const inferredTool = inferToolCall(content);

  if (inferredTool) {
    return {
      content: inferredTool.leadIn,
      toolCalls: [
        {
          name: inferredTool.name,
          arguments: inferredTool.arguments,
        },
      ],
    };
  }

  return {
    content:
      "Gauge is running in local mock mode. Ask about a work order, customer, vehicle, part, estimate, case, KB article, Lens video, or draft workflow to exercise the tool layer.",
    toolCalls: [],
  };
}

function inferToolCall(content: string) {
  const normalized = content.trim();
  const workOrderQuery = extractWorkOrderQuery(normalized);
  const wantsDraft = /\bdraft|write|compose|prepare|suggest\b/i.test(normalized);

  if (wantsDraft) {
    if (/\b(follow-?up|text|email|customer update|customer message)\b/i.test(normalized)) {
      return {
        name: "draft_customer_follow_up",
        arguments: {
          query: workOrderQuery ?? normalized,
          ...( /\bemail\b/i.test(normalized) ? { channel: "email" } : { channel: "text" } ),
        },
        leadIn: "I'll draft a customer follow-up.",
      };
    }

    if (/\bchange\s*order\b/i.test(normalized)) {
      return {
        name: "draft_line_suggestions",
        arguments: {
          query: workOrderQuery ?? normalized,
          draftType: "change_order",
        },
        leadIn: "I'll draft change-order line suggestions.",
      };
    }

    if (/\bestimate|line suggestions|repair lines|quote lines\b/i.test(normalized)) {
      return {
        name: "draft_line_suggestions",
        arguments: {
          query: workOrderQuery ?? normalized,
          draftType: "estimate",
        },
        leadIn: "I'll draft estimate line suggestions.",
      };
    }

    if (/\b(kb|knowledge\s*base|article|procedure|training|sop)\b/i.test(normalized)) {
      return {
        name: "draft_kb_article",
        arguments: { query: workOrderQuery ?? normalized },
        leadIn: "I'll draft a KB article.",
      };
    }

    if (/\binternal note|advisor note|shop note|note\b/i.test(normalized)) {
      return {
        name: "draft_internal_note",
        arguments: { query: workOrderQuery ?? normalized },
        leadIn: "I'll draft an internal note.",
      };
    }
  }

  if (workOrderQuery) {
    return {
      name: "get_work_order_status",
      arguments: { query: workOrderQuery },
      leadIn: "I'll check that work order.",
    };
  }

  if (/\b(kb|knowledge\s*base|article|procedure|training|sop)\b/i.test(normalized)) {
    return {
      name: "search_kb_articles",
      arguments: { query: normalized },
      leadIn: "I'll search the knowledge base.",
    };
  }

  if (/\b(video|lens|walkaround|walk-through|clip)\b/i.test(normalized)) {
    return {
      name: "search_lens_videos",
      arguments: { query: normalized },
      leadIn: "I'll look through Lens videos.",
    };
  }

  if (/\bestimate\b/i.test(normalized)) {
    return {
      name: "search_estimates",
      arguments: { query: normalized },
      leadIn: "I'll look up that estimate.",
    };
  }

  if (/\b(part|parts|inventory|stock|sku|availability|available|bin)\b/i.test(normalized)) {
    return {
      name: "get_parts_availability",
      arguments: { query: normalized },
      leadIn: "I'll check parts availability.",
    };
  }

  if (/\b(case|callback|concern|complaint)\b/i.test(normalized)) {
    return {
      name: "search_cases",
      arguments: { query: normalized },
      leadIn: "I'll look up matching cases.",
    };
  }

  if (/\b(vehicle|vin|plate|unit|mileage|history)\b/i.test(normalized)) {
    return {
      name: "get_vehicle_history",
      arguments: { query: normalized },
      leadIn: "I'll pull that vehicle history.",
    };
  }

  if (/\b(customer|contact|account)\b/i.test(normalized)) {
    return {
      name: "search_customers",
      arguments: { query: normalized },
      leadIn: "I'll look up that customer.",
    };
  }

  return null;
}

function extractWorkOrderQuery(content: string) {
  const workOrderNumber = content.match(/\bWO[-\s]?\d{6}[-\s]?\d{4}\b/i)?.[0];

  if (workOrderNumber) {
    return workOrderNumber.replace(/\s+/g, "-").toUpperCase();
  }

  if (/work\s*order|status|wo\b/i.test(content)) {
    return content;
  }

  return null;
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
