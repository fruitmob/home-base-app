import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();

  try {
    await db.$queryRaw`SELECT 1`;
    const dbMs = Math.round(performance.now() - startedAt);

    return NextResponse.json({ ok: true, db: dbMs });
  } catch (error) {
    const dbMs = Math.round(performance.now() - startedAt);
    console.error("Health check failed", error);

    return NextResponse.json({ ok: false, db: dbMs }, { status: 503 });
  }
}
