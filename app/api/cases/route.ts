import { NextResponse } from "next/server";
import { CasePriority, CaseStatus, Prisma } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
  requireCaseWrite,
} from "@/lib/core/api";
import { parseCaseInput } from "@/lib/sales/validators";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { caseDetailInclude } from "@/lib/sales/cases";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();
    const priority = searchParams.get("priority")?.trim();
    const assignedUserId = searchParams.get("assignedUserId")?.trim();

    const where: Prisma.CaseWhereInput = {
      deletedAt: null,
    };

    if (status) {
      where.status = status as CaseStatus;
    }

    if (priority) {
      where.priority = priority as CasePriority;
    }

    if (assignedUserId === "unassigned") {
      where.assignedUserId = null;
    } else if (assignedUserId) {
      where.assignedUserId = assignedUserId;
    }

    const cases = await db.case.findMany({
      where,
      include: caseDetailInclude,
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    });

    return NextResponse.json({ cases });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCaseWrite(request);
    const input = parseCaseInput(await readJsonObject(request));

    const supportCase = await db.case.create({
      data: {
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        openedByUserId: input.openedByUserId ?? user.id,
        assignedUserId: input.assignedUserId,
        status: input.status,
        priority: input.priority,
        subject: input.subject,
        description: input.description,
        resolvedAt: input.status === CaseStatus.RESOLVED ? new Date() : null,
      },
      include: caseDetailInclude,
    });

    await logAudit({
      actorUserId: user.id,
      action: "case.create",
      entityType: "Case",
      entityId: supportCase.id,
      after: supportCase,
      request,
    });

    return NextResponse.json({ case: supportCase }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
