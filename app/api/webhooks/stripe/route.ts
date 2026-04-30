import { NextResponse } from "next/server";
import { STRIPE_SIGNATURE_HEADER, verifyStripeSignature } from "@/lib/billing/signature";
import { ingestStripeEvent, type StripeEvent } from "@/lib/billing/subscription";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Stripe webhook secret is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get(STRIPE_SIGNATURE_HEADER);

  if (!verifyStripeSignature(secret, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON." }, { status: 400 });
  }

  if (!event || typeof event.id !== "string" || typeof event.type !== "string") {
    return NextResponse.json({ error: "Event is missing required fields." }, { status: 400 });
  }

  try {
    const result = await ingestStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error("[stripe-webhook] failed to ingest event", event.id, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to ingest event." },
      { status: 500 },
    );
  }
}
