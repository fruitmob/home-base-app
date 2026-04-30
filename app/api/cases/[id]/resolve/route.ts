import { NextResponse } from "next/server";
import { CaseStatus } from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  requireCaseWrite,
} from "@/lib/core/api";
import { parseCaseResolveInput } from "@/lib/sales/validators";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { caseDetailInclude, findActiveCase } from "@/lib/sales/cases";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCaseWrite(request);
    const before = await findActiveCase(params.id);
    const input = parseCaseResolveInput(await readJsonObject(request));

    const supportCase = await db.case.update({
      where: { id: before.id },
      data: {
        status: CaseStatus.RESOLVED,
        resolvedAt: before.resolvedAt ?? new Date(),
        resolutionNotes: input.resolutionNotes,
      },
      include: caseDetailInclude,
    });

    await logAudit({
      actorUserId: user.id,
      action: "case.resolve",
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
