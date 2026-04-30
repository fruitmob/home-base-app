import { NextResponse } from "next/server";
import { GaugeMessageRole, GaugeToolCallStatus } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { attachToolCallIdToGaugeActions, extractGaugeActions } from "@/lib/gauge/actions";
import { findConversationForUser, jsonValue } from "@/lib/gauge/conversations";
import { prepareGaugeWriteFromDraft } from "@/lib/gauge/writeActions";
import { apiErrorResponse, readJsonObject, verifyMutationCsrf } from "@/lib/core/api";
import { ValidationError } from "@/lib/core/validators";
import { db } from "@/lib/db";
import { extractGaugeDrafts } from "@/lib/gauge/drafts";

type PrepareResponse = {
  conversationId: string;
  message: {
    id: string;
    role: "ASSISTANT";
    content: string;
    createdAt: Date;
    actions?: unknown[];
  };
  toolCall: {
    id: string;
    toolName: string;
    status: GaugeToolCallStatus;
    writeRequested: boolean;
    writePerformed: boolean;
  };
};

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    verifyMutationCsrf(request);

    const input = await readJsonObject(request);
    const conversationId = readRequiredString(input.conversationId, "conversationId");
    const conversation = await findConversationForUser(conversationId, user.id);

    if (!conversation) {
      return NextResponse.json({ error: "Gauge conversation not found." }, { status: 404 });
    }

    const draft = readDraft(input.draft);
    const prepared = await prepareGaugeWriteFromDraft(draft, user);
    const requested = await db.gaugeToolCall.create({
      data: {
        conversationId: conversation.id,
        userId: user.id,
        toolName: prepared.toolName,
        status: GaugeToolCallStatus.REQUESTED,
        inputJson: jsonValue(prepared.input),
      },
    });
    const outputWithToolCall = attachToolCallIdToGaugeActions(prepared.output, requested.id);
    const blocked = await db.gaugeToolCall.update({
      where: { id: requested.id },
      data: {
        status: GaugeToolCallStatus.BLOCKED,
        outputJson: jsonValue(outputWithToolCall),
        writeRequested: true,
        writePerformed: false,
        completedAt: new Date(),
      },
    });

    await db.gaugeMessage.create({
      data: {
        conversationId: conversation.id,
        role: GaugeMessageRole.TOOL,
        content: JSON.stringify(outputWithToolCall),
        toolName: prepared.toolName,
        toolInputJson: jsonValue(prepared.input),
        toolOutputJson: jsonValue(outputWithToolCall),
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "gauge.tool_call",
      entityType: "GaugeToolCall",
      entityId: blocked.id,
      after: blocked,
      request,
    });

    const actions = extractGaugeActions(outputWithToolCall);
    const assistantMessage = await db.gaugeMessage.create({
      data: {
        conversationId: conversation.id,
        role: GaugeMessageRole.ASSISTANT,
        content: prepared.assistantContent,
        toolOutputJson: jsonValue(outputWithToolCall),
      },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      message: {
        id: assistantMessage.id,
        role: "ASSISTANT",
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
        ...(actions.length > 0 ? { actions } : {}),
      },
      toolCall: {
        id: blocked.id,
        toolName: blocked.toolName,
        status: blocked.status,
        writeRequested: blocked.writeRequested,
        writePerformed: blocked.writePerformed,
      },
    } satisfies PrepareResponse);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function readRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError([`${field} is required.`]);
  }

  return value.trim();
}

function readDraft(value: unknown) {
  const draft = extractGaugeDrafts({ drafts: [value] })[0];

  if (!draft) {
    throw new ValidationError(["A valid Gauge draft is required."]);
  }

  return draft;
}
