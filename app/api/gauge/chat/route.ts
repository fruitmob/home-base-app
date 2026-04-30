import { NextResponse } from "next/server";
import {
  GaugeMessageRole,
  GaugeToolCallStatus,
  Prisma,
  type GaugeMessage,
} from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  findConversationForUser,
  jsonValue,
  loadConversationHistory,
  toChatMessage,
} from "@/lib/gauge/conversations";
import { GAUGE_SYSTEM_PROMPT } from "@/lib/gauge/prompts";
import { createGaugeProvider, getGaugeProviderConfig } from "@/lib/gauge/provider";
import {
  gaugeToolSchemas,
  collectDraftsFromToolOutputs,
  executeGaugeTool,
  summarizeToolOutputs,
} from "@/lib/gauge/tools";
import type { GaugeChatMessage, GaugeProviderResponse } from "@/lib/gauge/types";
import { apiErrorResponse, readJsonObject, verifyMutationCsrf } from "@/lib/core/api";
import { ValidationError } from "@/lib/core/validators";
import { db } from "@/lib/db";

type ChatResponse = {
  conversationId: string;
  provider: string;
  model: string;
  message: {
    id: string;
    role: "ASSISTANT";
    content: string;
    createdAt: Date;
    drafts?: unknown[];
  };
  toolCalls: Array<{
    id: string;
    toolName: string;
    status: GaugeToolCallStatus;
    writeRequested: boolean;
    writePerformed: boolean;
  }>;
};

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    verifyMutationCsrf(request);

    const input = await readJsonObject(request);
    const prompt = readPrompt(input);
    const requestedConversationId = readOptionalString(input.conversationId);
    const config = getGaugeProviderConfig();
    const provider = createGaugeProvider(config);

    const conversation = requestedConversationId
      ? await findConversationForUser(requestedConversationId, user.id)
      : await db.gaugeConversation.create({
          data: {
            userId: user.id,
            title: titleFromPrompt(prompt),
            provider: provider.name,
            model: provider.model,
          },
        });

    if (!conversation) {
      return NextResponse.json({ error: "Gauge conversation not found." }, { status: 404 });
    }

    await db.gaugeMessage.create({
      data: {
        conversationId: conversation.id,
        role: GaugeMessageRole.USER,
        content: prompt,
      },
    });

    const history = await loadConversationHistory(conversation.id);
    const firstProviderResponse = await provider.chat({
      messages: [systemMessage(), ...history.map(toChatMessage)],
      tools: gaugeToolSchemas,
      user,
    });

    const completedToolCalls: ChatResponse["toolCalls"] = [];
    let finalContent = firstProviderResponse.content || "I'm ready.";
    let assistantDrafts: unknown[] = [];

    if (firstProviderResponse.toolCalls.length > 0) {
      const assistantToolMessage = await db.gaugeMessage.create({
        data: {
          conversationId: conversation.id,
          role: GaugeMessageRole.ASSISTANT,
          content: firstProviderResponse.content || "I'll look that up.",
        },
      });
      const toolResults: Array<{ toolName: string; output: Prisma.InputJsonValue }> = [];

      for (const toolCall of firstProviderResponse.toolCalls.slice(0, 4)) {
        const inputJson = jsonValue(toolCall.arguments);
        const requested = await db.gaugeToolCall.create({
          data: {
            conversationId: conversation.id,
            messageId: assistantToolMessage.id,
            userId: user.id,
            toolName: toolCall.name,
            status: GaugeToolCallStatus.REQUESTED,
            inputJson,
          },
        });

        try {
          const result = await executeGaugeTool(toolCall.name, toolCall.arguments, user);
          const completed = await db.gaugeToolCall.update({
            where: { id: requested.id },
            data: {
              status: GaugeToolCallStatus.COMPLETED,
              outputJson: result.output,
              writeRequested: result.writeRequested,
              writePerformed: result.writePerformed,
              completedAt: new Date(),
            },
          });

          await db.gaugeMessage.create({
            data: {
              conversationId: conversation.id,
              role: GaugeMessageRole.TOOL,
              content: JSON.stringify(result.output),
              toolName: toolCall.name,
              toolInputJson: inputJson,
              toolOutputJson: result.output,
            },
          });

          await logAudit({
            actorUserId: user.id,
            action: "gauge.tool_call",
            entityType: "GaugeToolCall",
            entityId: completed.id,
            after: completed,
            request,
          });

          toolResults.push({ toolName: toolCall.name, output: result.output });
          completedToolCalls.push({
            id: completed.id,
            toolName: completed.toolName,
            status: completed.status,
            writeRequested: completed.writeRequested,
            writePerformed: completed.writePerformed,
          });
        } catch (toolError) {
          const failed = await db.gaugeToolCall.update({
            where: { id: requested.id },
            data: {
              status: GaugeToolCallStatus.FAILED,
              error: toolError instanceof Error ? toolError.message : "Gauge tool failed.",
              completedAt: new Date(),
            },
          });

          completedToolCalls.push({
            id: failed.id,
            toolName: failed.toolName,
            status: failed.status,
            writeRequested: failed.writeRequested,
            writePerformed: failed.writePerformed,
          });
        }
      }

      assistantDrafts = collectDraftsFromToolOutputs(toolResults);
      finalContent = await finalizeWithToolResults({
        firstProviderResponse,
        history,
        provider,
        user,
        toolResults,
      });
    }

    const assistantMessage = await db.gaugeMessage.create({
      data: {
        conversationId: conversation.id,
        role: GaugeMessageRole.ASSISTANT,
        content: finalContent,
        toolOutputJson:
          assistantDrafts.length > 0 ? jsonValue({ drafts: assistantDrafts }) : undefined,
      },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      provider: provider.name,
      model: provider.model,
      message: {
        id: assistantMessage.id,
        role: "ASSISTANT",
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
        ...(assistantDrafts.length > 0 ? { drafts: assistantDrafts } : {}),
      },
      toolCalls: completedToolCalls,
    } satisfies ChatResponse);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function finalizeWithToolResults({
  firstProviderResponse,
  history,
  provider,
  user,
  toolResults,
}: {
  firstProviderResponse: GaugeProviderResponse;
  history: GaugeMessage[];
  provider: ReturnType<typeof createGaugeProvider>;
  user: Awaited<ReturnType<typeof requireAuth>>;
  toolResults: Array<{ toolName: string; output: Prisma.InputJsonValue }>;
}) {
  const fallback = summarizeToolOutputs(toolResults);

  try {
    const final = await provider.chat({
      messages: [
        systemMessage(),
        ...history.map(toChatMessage),
        {
          role: "assistant",
          content: firstProviderResponse.content,
          toolCalls: firstProviderResponse.toolCalls,
        },
        ...toolResults.map((result): GaugeChatMessage => ({
          role: "tool",
          toolName: result.toolName,
          content: JSON.stringify(result.output),
        })),
      ],
      tools: gaugeToolSchemas,
      user,
    });

    return final.content || fallback;
  } catch {
    return fallback;
  }
}

function systemMessage(): GaugeChatMessage {
  return { role: "system", content: GAUGE_SYSTEM_PROMPT };
}

function readPrompt(input: Record<string, unknown>) {
  const value = input.message;

  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(["Gauge message is required."]);
  }

  return value.trim().slice(0, 4000);
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function titleFromPrompt(prompt: string) {
  return prompt.length > 64 ? `${prompt.slice(0, 61)}...` : prompt;
}
