import { GaugeMessageRole, type GaugeMessage, Prisma } from "@/generated/prisma/client";
import { extractGaugeActions } from "@/lib/gauge/actions";
import { extractGaugeDrafts } from "@/lib/gauge/drafts";
import type { GaugeChatMessage } from "@/lib/gauge/types";
import { db } from "@/lib/db";

export const MAX_GAUGE_HISTORY_MESSAGES = 20;

export async function findConversationForUser(id: string, userId: string) {
  return db.gaugeConversation.findFirst({
    where: { id, userId, archivedAt: null },
  });
}

export async function loadConversationHistory(conversationId: string) {
  const messages = await db.gaugeMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: MAX_GAUGE_HISTORY_MESSAGES,
  });

  return messages.reverse();
}

export async function listGaugeConversationsForUser(userId: string, take = 24) {
  const conversations = await db.gaugeConversation.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    take,
    include: {
      messages: {
        where: {
          role: {
            in: [GaugeMessageRole.USER, GaugeMessageRole.ASSISTANT],
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 4,
        include: {
          toolCalls: {
            select: { id: true },
            take: 1,
          },
        },
      },
      _count: {
        select: {
          messages: true,
          toolCalls: true,
        },
      },
    },
  });

  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    provider: conversation.provider,
    model: conversation.model,
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt,
    preview:
      conversation.messages.find(
        (message) =>
          message.role === GaugeMessageRole.USER ||
          (message.role === GaugeMessageRole.ASSISTANT && message.toolCalls.length === 0),
      )?.content ?? null,
    messageCount: conversation._count.messages,
    toolCallCount: conversation._count.toolCalls,
  }));
}

export async function loadGaugeConversationForUser(id: string, userId: string) {
  const conversation = await db.gaugeConversation.findFirst({
    where: { id, userId, archivedAt: null },
    include: {
      messages: {
        where: {
          role: {
            in: [GaugeMessageRole.USER, GaugeMessageRole.ASSISTANT],
          },
        },
        orderBy: [{ createdAt: "asc" }],
        include: {
          toolCalls: {
            select: { id: true },
            take: 1,
          },
        },
      },
      _count: {
        select: {
          toolCalls: true,
        },
      },
    },
  });

  if (!conversation) {
    return null;
  }

  return {
    id: conversation.id,
    title: conversation.title,
    provider: conversation.provider,
    model: conversation.model,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    toolCallCount: conversation._count.toolCalls,
    messages: conversation.messages
      .filter(
        (message) =>
          message.role === GaugeMessageRole.USER ||
          (message.role === GaugeMessageRole.ASSISTANT && message.toolCalls.length === 0),
      )
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        drafts: extractGaugeDrafts(message.toolOutputJson),
        actions: extractGaugeActions(message.toolOutputJson),
      })),
  };
}

export function toChatMessage(message: GaugeMessage): GaugeChatMessage {
  if (message.role === GaugeMessageRole.TOOL) {
    return {
      role: "tool",
      content: message.content,
      toolName: message.toolName ?? undefined,
    };
  }

  return {
    role: message.role === GaugeMessageRole.USER ? "user" : "assistant",
    content: message.content,
  };
}

export function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
