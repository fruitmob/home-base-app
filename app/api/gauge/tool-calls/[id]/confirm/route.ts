import { NextResponse } from "next/server";
import { GaugeMessageRole, GaugeToolCallStatus } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { attachToolCallIdToGaugeActions, extractGaugeActions } from "@/lib/gauge/actions";
import { jsonValue } from "@/lib/gauge/conversations";
import {
  confirmGaugeWriteTool,
  isGaugeWriteToolName,
  summarizeGaugeWriteOutput,
} from "@/lib/gauge/writeActions";
import { apiErrorResponse, verifyMutationCsrf } from "@/lib/core/api";
import { ValidationError } from "@/lib/core/validators";
import { db } from "@/lib/db";

type RouteContext = {
  params: {
    id: string;
  };
};

type ConfirmResponse = {
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

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth(request);
    verifyMutationCsrf(request);

    const toolCall = await db.gaugeToolCall.findFirst({
      where: {
        id: params.id,
        conversation: {
          userId: user.id,
          archivedAt: null,
        },
      },
      include: {
        conversation: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!toolCall) {
      return NextResponse.json({ error: "Gauge tool call not found." }, { status: 404 });
    }

    if (toolCall.status !== GaugeToolCallStatus.BLOCKED || !toolCall.writeRequested) {
      return NextResponse.json({ error: "That Gauge action is not waiting for confirmation." }, { status: 400 });
    }

    if (!isGaugeWriteToolName(toolCall.toolName)) {
      throw new ValidationError(["That Gauge write action is not supported."]);
    }

    const confirmed = await confirmGaugeWriteTool(toolCall.toolName, readInput(toolCall.inputJson), user, request);
    const outputWithToolCall = attachToolCallIdToGaugeActions(confirmed.output, toolCall.id);
    const completed = await db.gaugeToolCall.update({
      where: { id: toolCall.id },
      data: {
        status: GaugeToolCallStatus.COMPLETED,
        outputJson: jsonValue(outputWithToolCall),
        writeRequested: true,
        writePerformed: true,
        completedAt: new Date(),
      },
    });

    await db.gaugeMessage.create({
      data: {
        conversationId: toolCall.conversation.id,
        role: GaugeMessageRole.TOOL,
        content: JSON.stringify(outputWithToolCall),
        toolName: toolCall.toolName,
        toolInputJson: jsonValue(toolCall.inputJson),
        toolOutputJson: jsonValue(outputWithToolCall),
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

    const actions = extractGaugeActions(outputWithToolCall);
    const assistantMessage = await db.gaugeMessage.create({
      data: {
        conversationId: toolCall.conversation.id,
        role: GaugeMessageRole.ASSISTANT,
        content: confirmed.assistantContent || summarizeGaugeWriteOutput(outputWithToolCall),
        toolOutputJson: jsonValue(outputWithToolCall),
      },
    });

    return NextResponse.json({
      conversationId: toolCall.conversation.id,
      message: {
        id: assistantMessage.id,
        role: "ASSISTANT",
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
        ...(actions.length > 0 ? { actions } : {}),
      },
      toolCall: {
        id: completed.id,
        toolName: completed.toolName,
        status: completed.status,
        writeRequested: completed.writeRequested,
        writePerformed: completed.writePerformed,
      },
    } satisfies ConfirmResponse);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function readInput(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
