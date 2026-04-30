import { requireSalesWrite, apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { parseLeadInput } from "@/lib/sales/validators";
import { db } from "@/lib/db";
import { Role, LeadStatus } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();
    const status = url.searchParams.get("status")?.trim();
    const ownerUserId = url.searchParams.get("ownerUserId")?.trim();

    const whereAnd: Prisma.LeadWhereInput[] = [{ deletedAt: null }];

    if (query) {
      whereAnd.push({
        OR: [
          { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { companyName: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
        ],
      });
    }

    if (status) {
      whereAnd.push({ status: status as LeadStatus });
    }

    if (user.role === Role.SALES_REP) {
      if (ownerUserId === user.id) {
        whereAnd.push({ ownerUserId: user.id });
      } else if (ownerUserId === "unassigned") {
        whereAnd.push({ ownerUserId: null });
      } else if (ownerUserId) {
        return NextResponse.json({ leads: [] });
      } else {
        whereAnd.push({
          OR: [{ ownerUserId: user.id }, { ownerUserId: null }],
        });
      }
    } else {
      if (ownerUserId === "unassigned") {
        whereAnd.push({ ownerUserId: null });
      } else if (ownerUserId) {
        whereAnd.push({ ownerUserId });
      }
    }

    const where: Prisma.LeadWhereInput = { AND: whereAnd };

    const leads = await db.lead.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: {
        ownerUser: { select: { id: true, email: true } },
      },
    });

    return NextResponse.json({ leads });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSalesWrite(request);
    const input = parseLeadInput(await readJsonObject(request));
    
    // Additional restriction: if SALES_REP, they can't create leads for other unassigned/other people unless it's for themselves or unassigned.
    // Actually, letting them create unassigned is fine. Letting them create for others might be blocked, but the validators.ts doesn't restrict.
    // Let's enforce that a SALES_REP can only create for themselves or unassigned.
    if (user.role === Role.SALES_REP && input.ownerUserId && input.ownerUserId !== user.id) {
      return NextResponse.json({ error: "Sales Reps can only assign leads to themselves or leave them unassigned." }, { status: 403 });
    }

    const lead = await db.lead.create({
      data: input,
      include: {
        ownerUser: { select: { id: true, email: true } },
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "lead.create",
      entityType: "Lead",
      entityId: lead.id,
      after: lead,
      request,
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
