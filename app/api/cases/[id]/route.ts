import { NextResponse } from "next/server";
import { CaseStatus } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
  requireCaseWrite,
} from "@/lib/core/api";
import { parseCaseInput } from "@/lib/sales/validators";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { caseDetailInclude, findActiveCase } from "@/lib/sales/cases";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAuth(request);
    const supportCase = await findActiveCase(params.id);

    return NextResponse.json({ case: supportCase });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCaseWrite(request);
    const before = await findActiveCase(params.id);
    const body = await readJsonObject(request);
    const input = parseCaseInput({
      customerId: before.customerId,
      vehicleId: before.vehicleId,
      openedByUserId: before.openedByUserId,
      assignedUserId: before.assignedUserId,
      status: before.status,
      priority: before.priority,
      subject: before.subject,
      description: before.description,
      ...body,
    });

    const supportCase = await db.case.update({
      where: { id: before.id },
      data: {
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        openedByUserId: input.openedByUserId,
        assignedUserId: input.assignedUserId,
        status: input.status,
        priority: input.priority,
        subject: input.subject,
        description: input.description,
        resolvedAt:
          input.status === CaseStatus.RESOLVED
            ? before.resolvedAt ?? new Date()
            : null,
        resolutionNotes:
          input.status === CaseStatus.RESOLVED ? before.resolutionNotes : null,
      },
      include: caseDetailInclude,
    });

    await logAudit({
      actorUserId: user.id,
      action: "case.update",
      entityType: "Case",
      entityId: supportCase.id,
      before,
      after: supportCase,
      request,
    });

    return NextResponse.json({ case: supportCase });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCaseWrite(request);
    const before = await findActiveCase(params.id);

    const supportCase = await db.case.update({
      where: { id: before.id },
      data: {
        deletedAt: new Date(),
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "case.delete",
      entityType: "Case",
      entityId: supportCase.id,
      before,
      after: supportCase,
      request,
    });

    return NextResponse.json({ case: supportCase });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
