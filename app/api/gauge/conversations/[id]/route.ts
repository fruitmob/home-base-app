import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { loadGaugeConversationForUser } from "@/lib/gauge/conversations";
import { apiErrorResponse } from "@/lib/core/api";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth(request);
    const conversation = await loadGaugeConversationForUser(params.id, user.id);

    if (!conversation) {
      return NextResponse.json({ error: "Gauge conversation not found." }, { status: 404 });
    }

    return NextResponse.json({
      conversation: {
        ...conversation,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        messages: conversation.messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
