import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listGaugeConversationsForUser } from "@/lib/gauge/conversations";
import { apiErrorResponse } from "@/lib/core/api";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const conversations = await listGaugeConversationsForUser(user.id);

    return NextResponse.json({
      conversations: conversations.map((conversation) => ({
        ...conversation,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
