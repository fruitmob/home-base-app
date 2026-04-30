import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  GaugeToolCallStatus,
  CasePriority,
  CaseStatus,
  EstimateStatus,
  KbArticleStatus,
  Role,
  VideoStatus,
  WorkOrderStatus,
} from "@/generated/prisma/client";
import { POST as prepareGaugeAction } from "@/app/api/gauge/actions/prepare/route";
import { GET as getGaugeConversation } from "@/app/api/gauge/conversations/[id]/route";
import { GET as listGaugeConversations } from "@/app/api/gauge/conversations/route";
import { POST as chatWithGauge } from "@/app/api/gauge/chat/route";
import { POST as confirmGaugeToolCall } from "@/app/api/gauge/tool-calls/[id]/confirm/route";
import type { CurrentUser } from "@/lib/auth";
import { extractGaugeActions, type GaugeActionArtifact, type GaugeActionKind } from "@/lib/gauge/actions";
import { extractGaugeDrafts, type GaugeDraftArtifact, type GaugeDraftKind } from "@/lib/gauge/drafts";
import { executeGaugeTool } from "@/lib/gauge/tools";
import { confirmGaugeWriteTool, prepareGaugeWriteFromDraft } from "@/lib/gauge/writeActions";
import { db } from "@/lib/db";

const csrfToken = "gauge-api-smoke-csrf";

type TestSession = {
  user: CurrentUser;
  sessionId: string;
};

async function main() {
  const suffix = randomUUID();
  const priorEnv = captureEnv();
  const sessions: TestSession[] = [];
  const customerIds: string[] = [];
  const vehicleIds: string[] = [];
  const workOrderIds: string[] = [];
  const partIds: string[] = [];
  const estimateIds: string[] = [];
  const caseIds: string[] = [];
  const kbArticleIds: string[] = [];
  const videoIds: string[] = [];
  const conversationIds: string[] = [];
  const toolCallIds: string[] = [];
  const auditedEntityIds: string[] = [];
  const retrievalSourceIds: string[] = [];

  process.env.GAUGE_PROVIDER = "mock";
  process.env.GAUGE_MODEL = "mock-gauge";

  try {
    const serviceWriter = await createTestSession(Role.SERVICE_WRITER, `writer-${suffix}`);
    sessions.push(serviceWriter);

    const customer = await db.customer.create({
      data: {
        displayName: `Gauge Smoke Customer ${suffix}`,
        email: `gauge-${suffix}@example.test`,
        phone: "555-0101",
        notes: "Prefers text updates and quick brake-status summaries.",
      },
    });
    customerIds.push(customer.id);
    retrievalSourceIds.push(customer.id);

    const vehicle = await db.vehicle.create({
      data: {
        customerId: customer.id,
        year: 2026,
        make: "Ram",
        model: "5500",
        unitNumber: `BOLT-${suffix.slice(0, 6).toUpperCase()}`,
        licensePlate: `HB${suffix.slice(0, 5).toUpperCase()}`,
        currentMileage: 120345,
        notes: "Brake pulse under load after recent delivery.",
      },
    });
    vehicleIds.push(vehicle.id);
    retrievalSourceIds.push(vehicle.id);

    await db.vehicleNote.create({
      data: {
        vehicleId: vehicle.id,
        authorUserId: serviceWriter.user.id,
        type: "GENERAL",
        body: "Brake bedding was completed after rotor replacement.",
      },
    });

    await db.vehicleMileageReading.create({
      data: {
        vehicleId: vehicle.id,
        value: 120345,
        source: "service counter",
        recordedAt: new Date(),
        recordedByUserId: serviceWriter.user.id,
        note: "Mileage confirmed during intake.",
      },
    });

    const workOrderNumber = `WO-909090-${String(Date.now()).slice(-4)}`;
    const workOrder = await db.workOrder.create({
      data: {
        workOrderNumber,
        customerId: customer.id,
        vehicleId: vehicle.id,
        serviceWriterUserId: serviceWriter.user.id,
        assignedTechUserId: serviceWriter.user.id,
        status: WorkOrderStatus.IN_PROGRESS,
        title: "Brake pulse diagnosis",
        complaint: "Brake pulse under load and mild steering shake after the last delivery.",
        internalNotes: "Verify rotor runout, confirm bedding results, and prepare the next customer update.",
        promisedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    workOrderIds.push(workOrder.id);

    const part = await db.part.create({
      data: {
        sku: `BRAKE-${suffix.slice(0, 8).toUpperCase()}`,
        name: "Brake Pad Kit",
        manufacturer: "FreshForge",
        manufacturerPartNumber: `FF-${suffix.slice(0, 6).toUpperCase()}`,
        binLocation: "A-14",
        unitOfMeasure: "kit",
        unitCost: 125.5,
        quantityOnHand: 6,
        quantityReserved: 2,
        reorderPoint: 3,
      },
    });
    partIds.push(part.id);
    retrievalSourceIds.push(part.id);

    await db.workOrderLineItem.create({
      data: {
        workOrderId: workOrder.id,
        partId: part.id,
        lineType: "LABOR",
        description: "Inspect brake pulsation, confirm bedding, and document findings",
        quantity: 1.5,
        unitPrice: 145,
        lineTotal: 217.5,
      },
    });

    await db.workOrderStatusHistory.create({
      data: {
        workOrderId: workOrder.id,
        fromStatus: WorkOrderStatus.OPEN,
        toStatus: WorkOrderStatus.IN_PROGRESS,
        changedByUserId: serviceWriter.user.id,
        reason: "Road test confirmed the complaint and diagnosis started.",
      },
    });

    const changeOrder = await db.changeOrder.create({
      data: {
        changeOrderNumber: `CO-909090-${String(Date.now() + 2).slice(-4)}`,
        workOrderId: workOrder.id,
        requestedByUserId: serviceWriter.user.id,
        status: "DRAFT",
        title: "Additional front brake hardware",
        reason: "Rotor hardware wear found during inspection.",
      },
    });

    await db.changeOrderLineItem.create({
      data: {
        changeOrderId: changeOrder.id,
        partId: part.id,
        lineType: "PART",
        description: "Front rotor hardware kit",
        quantity: 1,
        unitPrice: 86,
        lineTotal: 86,
      },
    });

    const estimate = await db.estimate.create({
      data: {
        estimateNumber: `EST-909090-${String(Date.now() + 1).slice(-4)}`,
        customerId: customer.id,
        vehicleId: vehicle.id,
        createdByUserId: serviceWriter.user.id,
        status: EstimateStatus.SENT,
        title: "Front brake refresh",
        notes: "Pads, rotors, and bedding procedure included.",
        subtotal: 850,
        taxTotal: 75.5,
        total: 925.5,
      },
    });
    estimateIds.push(estimate.id);
    retrievalSourceIds.push(estimate.id);

    await db.estimateLineItem.create({
      data: {
        estimateId: estimate.id,
        partId: part.id,
        lineType: "LABOR",
        description: "Front brake inspection and road test verification",
        quantity: 1.5,
        unitPrice: 140,
        lineTotal: 210,
      },
    });

    const supportCase = await db.case.create({
      data: {
        customerId: customer.id,
        vehicleId: vehicle.id,
        openedByUserId: serviceWriter.user.id,
        assignedUserId: serviceWriter.user.id,
        status: CaseStatus.WAITING,
        priority: CasePriority.HIGH,
        subject: `Brake follow-up ${suffix}`,
        description: "Customer wants confirmation that the brake pulse is gone after bedding.",
      },
    });
    caseIds.push(supportCase.id);
    retrievalSourceIds.push(supportCase.id);

    const kbArticle = await db.kbArticle.create({
      data: {
        title: `Brake Bedding Procedure ${suffix}`,
        slug: `brake-bedding-${suffix}`,
        body: "Brake bedding procedure for heavy service trucks. Warm the brakes, complete staged stops, then verify feel and customer notes.",
        authorId: serviceWriter.user.id,
        status: KbArticleStatus.PUBLISHED,
      },
    });
    kbArticleIds.push(kbArticle.id);
    retrievalSourceIds.push(kbArticle.id);

    const video = await db.video.create({
      data: {
        cloudflareId: `cf-${suffix}`,
        status: VideoStatus.READY,
        title: `Brake Walkaround ${suffix}`,
        description: "Explains the completed brake bedding and post-test-drive feel.",
        uploadedByUserId: serviceWriter.user.id,
        workOrderId: workOrder.id,
        vehicleId: vehicle.id,
        customerId: customer.id,
      },
    });
    videoIds.push(video.id);
    retrievalSourceIds.push(video.id);

    await verifyReadOnlyTools({
      user: serviceWriter.user,
      customer,
      vehicle,
      part,
      estimate,
      supportCase,
      kbArticle,
      video,
    });

    await verifyDraftTools({
      user: serviceWriter.user,
      customer,
      vehicle,
      workOrder,
      estimate,
      supportCase,
    });

    await verifyConfirmedWriteTools({
      user: serviceWriter.user,
      vehicle,
      workOrder,
      changeOrderDraftQuery: workOrder.workOrderNumber,
      auditedEntityIds,
    });

    const retrievalRows = await db.gaugeRetrievalIndex.findMany({
      where: {
        sourceId: {
          in: retrievalSourceIds,
        },
      },
    });
    assert.ok(retrievalRows.length >= 7, "Expected retrieval index rows for the Step 2 entities");

    const unauthenticated = await chatWithGauge(
      jsonRequest(null, { message: `What is the status of ${workOrder.workOrderNumber}?` }),
    );
    await expectStatus(unauthenticated, 401, "unauthenticated Gauge chat");

    const missingCsrf = await chatWithGauge(
      new Request("http://homebase.local/api/gauge/chat", {
        method: "POST",
        headers: {
          cookie: `hb_session=${serviceWriter.sessionId}; hb_csrf=${csrfToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: `Find customer ${customer.displayName}` }),
      }),
    );
    await expectStatus(missingCsrf, 403, "Gauge chat requires CSRF");

    const customerResponse = await chatWithGauge(
      jsonRequest(serviceWriter.sessionId, {
        message: `Find customer ${customer.displayName}`,
      }),
    );
    await expectStatus(customerResponse, 200, "Gauge customer lookup chat");

    const customerBody = (await customerResponse.json()) as ChatRouteResponse;
    conversationIds.push(customerBody.conversationId);
    toolCallIds.push(...customerBody.toolCalls.map((toolCall) => toolCall.id));

    assert.equal(customerBody.provider, "mock");
    assert.equal(customerBody.model, "mock-gauge");
    assert.equal(customerBody.toolCalls.length, 1);
    assert.equal(customerBody.toolCalls[0]?.toolName, "search_customers");
    assert.equal(customerBody.toolCalls[0]?.status, GaugeToolCallStatus.COMPLETED);
    assert.match(customerBody.message.content, new RegExp(customer.displayName));

    const kbResponse = await chatWithGauge(
      jsonRequest(serviceWriter.sessionId, {
        conversationId: customerBody.conversationId,
        message: `Find the knowledge base article about brake bedding ${suffix}`,
      }),
    );
    await expectStatus(kbResponse, 200, "Gauge KB lookup chat");

    const kbBody = (await kbResponse.json()) as ChatRouteResponse;
    toolCallIds.push(...kbBody.toolCalls.map((toolCall) => toolCall.id));
    assert.equal(kbBody.conversationId, customerBody.conversationId);
    assert.equal(kbBody.toolCalls[0]?.toolName, "search_kb_articles");
    assert.match(kbBody.message.content, /brake bedding/i);

    const videoResponse = await chatWithGauge(
      jsonRequest(serviceWriter.sessionId, {
        conversationId: customerBody.conversationId,
        message: `Show the Lens video about brake bedding ${suffix}`,
      }),
    );
    await expectStatus(videoResponse, 200, "Gauge Lens video chat");

    const videoBody = (await videoResponse.json()) as ChatRouteResponse;
    toolCallIds.push(...videoBody.toolCalls.map((toolCall) => toolCall.id));
    assert.equal(videoBody.conversationId, customerBody.conversationId);
    assert.equal(videoBody.toolCalls[0]?.toolName, "search_lens_videos");
    assert.match(videoBody.message.content, /ready/i);

    const followUpResponse = await chatWithGauge(
      jsonRequest(serviceWriter.sessionId, {
        conversationId: customerBody.conversationId,
        message: `Draft an email follow-up for ${workOrder.workOrderNumber}`,
      }),
    );
    await expectStatus(followUpResponse, 200, "Gauge customer follow-up draft chat");

    const followUpBody = (await followUpResponse.json()) as ChatRouteResponse;
    toolCallIds.push(...followUpBody.toolCalls.map((toolCall) => toolCall.id));
    assert.equal(followUpBody.conversationId, customerBody.conversationId);
    assert.equal(followUpBody.toolCalls[0]?.toolName, "draft_customer_follow_up");
    assert.equal(followUpBody.toolCalls[0]?.writeRequested, false);
    assert.equal(followUpBody.message.drafts?.[0]?.kind, "customer_follow_up");
    assert.equal(followUpBody.message.drafts?.[0]?.relatedHref, `/work-orders/${workOrder.id}`);

    const changeOrderDraftResponse = await chatWithGauge(
      jsonRequest(serviceWriter.sessionId, {
        conversationId: customerBody.conversationId,
        message: `Draft change order suggestions for ${workOrder.workOrderNumber}`,
      }),
    );
    await expectStatus(changeOrderDraftResponse, 200, "Gauge change-order draft chat");

    const changeOrderDraftBody = (await changeOrderDraftResponse.json()) as ChatRouteResponse;
    toolCallIds.push(...changeOrderDraftBody.toolCalls.map((toolCall) => toolCall.id));
    assert.equal(changeOrderDraftBody.conversationId, customerBody.conversationId);
    assert.equal(changeOrderDraftBody.toolCalls[0]?.toolName, "draft_line_suggestions");
    assert.equal(changeOrderDraftBody.message.drafts?.[0]?.kind, "change_order_suggestions");

    const kbDraftResponse = await chatWithGauge(
      jsonRequest(serviceWriter.sessionId, {
        conversationId: customerBody.conversationId,
        message: `Draft a KB article for work order ${workOrder.workOrderNumber}`,
      }),
    );
    await expectStatus(kbDraftResponse, 200, "Gauge KB draft chat");

    const kbDraftBody = (await kbDraftResponse.json()) as ChatRouteResponse;
    toolCallIds.push(...kbDraftBody.toolCalls.map((toolCall) => toolCall.id));
    assert.equal(kbDraftBody.conversationId, customerBody.conversationId);
    assert.equal(kbDraftBody.toolCalls[0]?.toolName, "draft_kb_article");
    assert.equal(kbDraftBody.message.drafts?.[0]?.kind, "kb_article");
    assert.match(kbDraftBody.message.drafts?.[0]?.body ?? "", /^#/);

    const internalNoteResponse = await chatWithGauge(
      jsonRequest(serviceWriter.sessionId, {
        conversationId: customerBody.conversationId,
        message: `Draft an internal note for ${workOrder.workOrderNumber}`,
      }),
    );
    await expectStatus(internalNoteResponse, 200, "Gauge internal-note draft chat");

    const internalNoteBody = (await internalNoteResponse.json()) as ChatRouteResponse;
    toolCallIds.push(...internalNoteBody.toolCalls.map((toolCall) => toolCall.id));
    assert.equal(internalNoteBody.conversationId, customerBody.conversationId);
    assert.equal(internalNoteBody.toolCalls[0]?.toolName, "draft_internal_note");
    assert.equal(internalNoteBody.message.drafts?.[0]?.kind, "internal_note");
    assert.equal(internalNoteBody.message.drafts?.[0]?.relatedHref, `/work-orders/${workOrder.id}`);

    const estimateDraftResponse = await chatWithGauge(
      jsonRequest(serviceWriter.sessionId, {
        conversationId: customerBody.conversationId,
        message: `Draft estimate suggestions for ${workOrder.workOrderNumber}`,
      }),
    );
    await expectStatus(estimateDraftResponse, 200, "Gauge estimate draft chat");

    const estimateDraftBody = (await estimateDraftResponse.json()) as ChatRouteResponse;
    toolCallIds.push(...estimateDraftBody.toolCalls.map((toolCall) => toolCall.id));
    assert.equal(estimateDraftBody.conversationId, customerBody.conversationId);
    assert.equal(estimateDraftBody.toolCalls[0]?.toolName, "draft_line_suggestions");
    assert.equal(estimateDraftBody.message.drafts?.[0]?.kind, "estimate_suggestions");

    const prepareEstimateResponse = await prepareGaugeAction(
      jsonPostRequest("http://homebase.local/api/gauge/actions/prepare", serviceWriter.sessionId, {
        conversationId: customerBody.conversationId,
        draft: estimateDraftBody.message.drafts?.[0],
      }),
    );
    await expectStatus(prepareEstimateResponse, 200, "Gauge prepare estimate write");

    const prepareEstimateBody = (await prepareEstimateResponse.json()) as ActionRouteResponse;
    toolCallIds.push(prepareEstimateBody.toolCall.id);
    assert.equal(prepareEstimateBody.conversationId, customerBody.conversationId);
    assert.equal(prepareEstimateBody.toolCall.status, GaugeToolCallStatus.BLOCKED);
    assert.equal(prepareEstimateBody.toolCall.writeRequested, true);
    assert.equal(prepareEstimateBody.toolCall.writePerformed, false);
    assert.equal(prepareEstimateBody.message.actions?.[0]?.kind, "create_estimate_draft");
    assert.equal(prepareEstimateBody.message.actions?.[0]?.status, "pending_confirmation");

    const confirmEstimateResponse = await confirmGaugeToolCall(
      authPostRequest(
        `http://homebase.local/api/gauge/tool-calls/${prepareEstimateBody.toolCall.id}/confirm`,
        serviceWriter.sessionId,
      ),
      {
        params: { id: prepareEstimateBody.toolCall.id },
      },
    );
    await expectStatus(confirmEstimateResponse, 200, "Gauge confirm estimate write");

    const confirmEstimateBody = (await confirmEstimateResponse.json()) as ActionRouteResponse;
    assert.equal(confirmEstimateBody.conversationId, customerBody.conversationId);
    assert.equal(confirmEstimateBody.toolCall.status, GaugeToolCallStatus.COMPLETED);
    assert.equal(confirmEstimateBody.toolCall.writePerformed, true);
    assert.equal(confirmEstimateBody.message.actions?.[0]?.kind, "create_estimate_draft");
    assert.equal(confirmEstimateBody.message.actions?.[0]?.status, "completed");

    const createdEstimate = await db.estimate.findFirst({
      where: {
        createdByUserId: serviceWriter.user.id,
        customerId: customer.id,
        title: {
          contains: workOrder.workOrderNumber,
        },
        id: {
          notIn: estimateIds,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        lineItems: {
          where: { deletedAt: null },
        },
      },
    });
    assert.ok(createdEstimate, "Expected a confirmed Gauge estimate draft");
    estimateIds.push(createdEstimate.id);
    auditedEntityIds.push(createdEstimate.id);
    assert.ok(createdEstimate.lineItems.length >= 1, "Expected line items on the confirmed estimate");

    const prepareNoteResponse = await prepareGaugeAction(
      jsonPostRequest("http://homebase.local/api/gauge/actions/prepare", serviceWriter.sessionId, {
        conversationId: customerBody.conversationId,
        draft: internalNoteBody.message.drafts?.[0],
      }),
    );
    await expectStatus(prepareNoteResponse, 200, "Gauge prepare vehicle note");

    const prepareNoteBody = (await prepareNoteResponse.json()) as ActionRouteResponse;
    toolCallIds.push(prepareNoteBody.toolCall.id);
    assert.equal(prepareNoteBody.toolCall.status, GaugeToolCallStatus.BLOCKED);
    assert.equal(prepareNoteBody.message.actions?.[0]?.kind, "save_vehicle_note");
    assert.equal(prepareNoteBody.message.actions?.[0]?.status, "pending_confirmation");

    const confirmNoteResponse = await confirmGaugeToolCall(
      authPostRequest(
        `http://homebase.local/api/gauge/tool-calls/${prepareNoteBody.toolCall.id}/confirm`,
        serviceWriter.sessionId,
      ),
      {
        params: { id: prepareNoteBody.toolCall.id },
      },
    );
    await expectStatus(confirmNoteResponse, 200, "Gauge confirm vehicle note");

    const confirmNoteBody = (await confirmNoteResponse.json()) as ActionRouteResponse;
    assert.equal(confirmNoteBody.toolCall.status, GaugeToolCallStatus.COMPLETED);
    assert.equal(confirmNoteBody.toolCall.writePerformed, true);
    assert.equal(confirmNoteBody.message.actions?.[0]?.kind, "save_vehicle_note");
    assert.equal(confirmNoteBody.message.actions?.[0]?.status, "completed");

    const createdVehicleNote = await db.vehicleNote.findFirst({
      where: {
        vehicleId: vehicle.id,
        authorUserId: serviceWriter.user.id,
        body: internalNoteBody.message.drafts?.[0]?.body,
      },
      orderBy: [{ createdAt: "desc" }],
    });
    assert.ok(createdVehicleNote, "Expected a confirmed Gauge vehicle note");
    auditedEntityIds.push(createdVehicleNote.id);

    const listResponse = await listGaugeConversations(authGetRequest(serviceWriter.sessionId));
    await expectStatus(listResponse, 200, "Gauge conversation list");
    const listBody = (await listResponse.json()) as {
      conversations: Array<{ id: string; title: string; preview: string | null }>;
    };
    assert.ok(
      listBody.conversations.some((conversation) => conversation.id === customerBody.conversationId),
      "Expected the active conversation in the history list",
    );

    const detailResponse = await getGaugeConversation(authGetRequest(serviceWriter.sessionId), {
      params: { id: customerBody.conversationId },
    });
    await expectStatus(detailResponse, 200, "Gauge conversation detail");
    const detailBody = (await detailResponse.json()) as {
      conversation: {
        id: string;
        messages: Array<{
          role: string;
          content: string;
          drafts?: GaugeDraftArtifact[];
          actions?: GaugeActionArtifact[];
        }>;
      };
    };
    assert.equal(detailBody.conversation.id, customerBody.conversationId);
    assert.ok(detailBody.conversation.messages.length >= 16, "Expected resumable user/assistant history");
    assert.ok(
      detailBody.conversation.messages.some((message) => message.content.includes(customer.displayName)),
      "Expected customer lookup history in the resumed thread",
    );
    assert.ok(
      detailBody.conversation.messages.some((message) => message.content.includes(kbArticle.title)),
      "Expected KB history in the resumed thread",
    );
    const persistedDraftKinds = detailBody.conversation.messages
      .flatMap((message) => message.drafts ?? [])
      .map((draft) => draft.kind);
    assert.ok(
      persistedDraftKinds.includes("customer_follow_up"),
      "Expected the customer follow-up draft in resumed history",
    );
    assert.ok(
      persistedDraftKinds.includes("change_order_suggestions"),
      "Expected the change-order draft in resumed history",
    );
    assert.ok(
      persistedDraftKinds.includes("kb_article"),
      "Expected the KB draft in resumed history",
    );
    assert.ok(
      persistedDraftKinds.includes("internal_note"),
      "Expected the internal-note draft in resumed history",
    );
    const persistedActionKinds = detailBody.conversation.messages
      .flatMap((message) => message.actions ?? [])
      .map((action) => action.kind);
    assert.ok(
      persistedActionKinds.includes("create_estimate_draft"),
      "Expected the confirmed estimate action in resumed history",
    );
    assert.ok(
      persistedActionKinds.includes("save_vehicle_note"),
      "Expected the confirmed vehicle-note action in resumed history",
    );

    const auditRow = await db.auditLog.findFirst({
      where: {
        action: "gauge.tool_call",
        entityType: "GaugeToolCall",
        entityId: customerBody.toolCalls[0]!.id,
      },
    });
    assert.ok(auditRow, "Gauge tool calls should be audit-logged");

    console.log("Gauge API smoke test: OK");
  } finally {
    await cleanup({
      sessions,
      customerIds,
      vehicleIds,
      workOrderIds,
      partIds,
      estimateIds,
      caseIds,
      kbArticleIds,
      videoIds,
      conversationIds,
      toolCallIds,
      auditedEntityIds,
      retrievalSourceIds,
    });
    restoreEnv(priorEnv);
    await db.$disconnect();
  }
}

async function verifyReadOnlyTools({
  user,
  customer,
  vehicle,
  part,
  estimate,
  supportCase,
  kbArticle,
  video,
}: {
  user: CurrentUser;
  customer: { displayName: string };
  vehicle: { unitNumber: string | null };
  part: { sku: string; id: string };
  estimate: { estimateNumber: string };
  supportCase: { subject: string };
  kbArticle: { title: string };
  video: { title: string };
}) {
  const customerTool = await executeGaugeTool(
    "search_customers",
    { query: customer.displayName },
    user,
  );
  const customerOutput = customerTool.output as {
    found: boolean;
    results: Array<{ displayName: string }>;
  };
  assert.equal(customerOutput.found, true);
  assert.equal(customerOutput.results[0]?.displayName, customer.displayName);

  const vehicleTool = await executeGaugeTool(
    "get_vehicle_history",
    { query: vehicle.unitNumber ?? customer.displayName },
    user,
  );
  const vehicleOutput = vehicleTool.output as {
    found: boolean;
    vehicle: { label?: string | null };
  };
  assert.equal(vehicleOutput.found, true);
  assert.match(vehicleOutput.vehicle.label ?? "", /BOLT/i);

  const partTool = await executeGaugeTool(
    "get_parts_availability",
    { query: part.sku },
    user,
  );
  const partOutput = partTool.output as {
    found: boolean;
    results: Array<{ sku: string }>;
  };
  assert.equal(partOutput.found, true);
  assert.equal(partOutput.results[0]?.sku, part.sku);

  const estimateTool = await executeGaugeTool(
    "search_estimates",
    { query: estimate.estimateNumber },
    user,
  );
  const estimateOutput = estimateTool.output as {
    found: boolean;
    results: Array<{ estimateNumber: string }>;
  };
  assert.equal(estimateOutput.found, true);
  assert.equal(estimateOutput.results[0]?.estimateNumber, estimate.estimateNumber);

  const caseTool = await executeGaugeTool(
    "search_cases",
    { query: supportCase.subject },
    user,
  );
  const caseOutput = caseTool.output as {
    found: boolean;
    results: Array<{ subject: string }>;
  };
  assert.equal(caseOutput.found, true);
  assert.equal(caseOutput.results[0]?.subject, supportCase.subject);

  const kbTool = await executeGaugeTool(
    "search_kb_articles",
    { query: "brake bedding procedure" },
    user,
  );
  const kbOutput = kbTool.output as {
    found: boolean;
    results: Array<{ title: string }>;
  };
  assert.equal(kbOutput.found, true);
  assert.equal(kbOutput.results[0]?.title, kbArticle.title);

  const videoTool = await executeGaugeTool(
    "search_lens_videos",
    { query: "brake walkaround" },
    user,
  );
  const videoOutput = videoTool.output as {
    found: boolean;
    results: Array<{ title: string }>;
  };
  assert.equal(videoOutput.found, true);
  assert.equal(videoOutput.results[0]?.title, video.title);
}

async function verifyDraftTools({
  user,
  customer,
  vehicle,
  workOrder,
  estimate,
  supportCase,
}: {
  user: CurrentUser;
  customer: { displayName: string };
  vehicle: { id: string; licensePlate: string | null };
  workOrder: { id: string; workOrderNumber: string };
  estimate: { id: string; estimateNumber: string };
  supportCase: { id: string; subject: string };
}) {
  const followUpTool = await executeGaugeTool(
    "draft_customer_follow_up",
    { query: workOrder.workOrderNumber, channel: "email" },
    user,
  );
  const followUpDraft = expectSingleDraft(
    followUpTool.output,
    "customer_follow_up",
    "customer follow-up draft",
  );
  assert.equal(followUpDraft.relatedHref, `/work-orders/${workOrder.id}`);
  assert.equal(followUpDraft.metadata?.channel, "email");
  assert.match(followUpDraft.body, new RegExp(workOrder.workOrderNumber));
  assert.ok(
    followUpDraft.reviewItems?.some(
      (item) => item.label === "Customer" && item.value === customer.displayName,
    ),
    "Expected customer context in the follow-up draft",
  );

  const estimateDraftTool = await executeGaugeTool(
    "draft_line_suggestions",
    { query: estimate.estimateNumber, draftType: "estimate" },
    user,
  );
  const estimateDraft = expectSingleDraft(
    estimateDraftTool.output,
    "estimate_suggestions",
    "estimate draft suggestions",
  );
  assert.equal(estimateDraft.relatedHref, `/estimates/${estimate.id}`);
  assert.equal(estimateDraft.metadata?.draftType, "estimate");
  assert.ok((estimateDraft.lineItems?.length ?? 0) >= 1);
  assert.match(estimateDraft.body, /Review pricing, taxes/i);

  const changeOrderDraftTool = await executeGaugeTool(
    "draft_line_suggestions",
    { query: workOrder.workOrderNumber, draftType: "change_order" },
    user,
  );
  const changeOrderDraft = expectSingleDraft(
    changeOrderDraftTool.output,
    "change_order_suggestions",
    "change-order draft suggestions",
  );
  assert.equal(changeOrderDraft.relatedHref, `/work-orders/${workOrder.id}`);
  assert.equal(changeOrderDraft.metadata?.draftType, "change_order");
  assert.ok((changeOrderDraft.lineItems?.length ?? 0) >= 1);
  assert.match(changeOrderDraft.body, /customer approval/i);

  const kbDraftTool = await executeGaugeTool(
    "draft_kb_article",
    { query: supportCase.subject },
    user,
  );
  const kbDraft = expectSingleDraft(kbDraftTool.output, "kb_article", "KB article draft");
  assert.equal(kbDraft.relatedHref, `/cases/${supportCase.id}`);
  assert.match(kbDraft.body, /^#/);
  assert.ok(
    kbDraft.reviewItems?.some((item) => item.label === "Source" && item.value.includes(supportCase.subject)),
    "Expected source context in the KB draft",
  );

  const internalNoteTool = await executeGaugeTool(
    "draft_internal_note",
    { query: vehicle.licensePlate ?? customer.displayName },
    user,
  );
  const internalNoteDraft = expectSingleDraft(
    internalNoteTool.output,
    "internal_note",
    "internal note draft",
  );
  assert.equal(internalNoteDraft.relatedHref, `/vehicles/${vehicle.id}`);
  assert.match(internalNoteDraft.body, /Internal vehicle note/i);
}

async function verifyConfirmedWriteTools({
  user,
  vehicle,
  workOrder,
  changeOrderDraftQuery,
  auditedEntityIds,
}: {
  user: CurrentUser;
  vehicle: { id: string; licensePlate: string | null };
  workOrder: { id: string; workOrderNumber: string };
  changeOrderDraftQuery: string;
  auditedEntityIds: string[];
}) {
  const changeOrderSuggestionTool = await executeGaugeTool(
    "draft_line_suggestions",
    { query: changeOrderDraftQuery, draftType: "change_order" },
    user,
  );
  const changeOrderSuggestion = expectSingleDraft(
    changeOrderSuggestionTool.output,
    "change_order_suggestions",
    "change-order confirmed write draft",
  );

  const preparedChangeOrder = await prepareGaugeWriteFromDraft(changeOrderSuggestion, user);
  const pendingChangeOrderAction = expectSingleAction(
    preparedChangeOrder.output,
    "create_change_order_draft",
    "pending change-order action",
  );
  assert.equal(pendingChangeOrderAction.status, "pending_confirmation");
  assert.equal(preparedChangeOrder.toolName, "create_change_order_draft_from_draft");

  const confirmedChangeOrder = await confirmGaugeWriteTool(
    preparedChangeOrder.toolName,
    preparedChangeOrder.input,
    user,
  );
  const completedChangeOrderAction = expectSingleAction(
    confirmedChangeOrder.output,
    "create_change_order_draft",
    "completed change-order action",
  );
  assert.equal(completedChangeOrderAction.status, "completed");

  const createdChangeOrder = await db.changeOrder.findFirst({
    where: {
      workOrderId: workOrder.id,
      title: {
        contains: workOrder.workOrderNumber,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      lineItems: {
        where: { deletedAt: null },
      },
    },
  });
  assert.ok(createdChangeOrder, "Expected a confirmed Gauge change order");
  assert.ok(createdChangeOrder.lineItems.length >= 1, "Expected line items on the confirmed change order");
  auditedEntityIds.push(createdChangeOrder.id);

  const noteDraftTool = await executeGaugeTool(
    "draft_internal_note",
    { query: vehicle.licensePlate ?? workOrder.workOrderNumber },
    user,
  );
  const noteDraft = expectSingleDraft(
    noteDraftTool.output,
    "internal_note",
    "confirmed vehicle-note draft",
  );

  const preparedNote = await prepareGaugeWriteFromDraft(noteDraft, user);
  const pendingNoteAction = expectSingleAction(
    preparedNote.output,
    "save_vehicle_note",
    "pending vehicle-note action",
  );
  assert.equal(pendingNoteAction.status, "pending_confirmation");

  const confirmedNote = await confirmGaugeWriteTool(
    preparedNote.toolName,
    preparedNote.input,
    user,
  );
  const completedNoteAction = expectSingleAction(
    confirmedNote.output,
    "save_vehicle_note",
    "completed vehicle-note action",
  );
  assert.equal(completedNoteAction.status, "completed");

  const createdVehicleNote = await db.vehicleNote.findFirst({
    where: {
      vehicleId: vehicle.id,
      authorUserId: user.id,
      body: noteDraft.body,
    },
    orderBy: [{ createdAt: "desc" }],
  });
  assert.ok(createdVehicleNote, "Expected a confirmed Gauge vehicle note from direct helper execution");
  auditedEntityIds.push(createdVehicleNote.id);
}

function jsonRequest(sessionId: string | null, body: unknown) {
  return new Request("http://homebase.local/api/gauge/chat", {
    method: "POST",
    headers: {
      ...(sessionId ? authHeaders(sessionId) : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function jsonPostRequest(url: string, sessionId: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: {
      ...authHeaders(sessionId),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function authGetRequest(sessionId: string) {
  return new Request("http://homebase.local/api/gauge/conversations", {
    method: "GET",
    headers: authHeaders(sessionId),
  });
}

function authPostRequest(url: string, sessionId: string) {
  return new Request(url, {
    method: "POST",
    headers: authHeaders(sessionId),
  });
}

function authHeaders(sessionId: string) {
  return {
    cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
    "x-csrf-token": csrfToken,
    "user-agent": "gauge-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `gauge-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `gauge-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "gauge-api-smoke-test",
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    sessionId,
  };
}

async function expectStatus(response: Response, expected: number, label: string) {
  if (response.status !== expected) {
    throw new Error(`${label} returned ${response.status}: ${await response.text()}`);
  }
}

async function cleanup({
  sessions,
  customerIds,
  vehicleIds,
  workOrderIds,
  partIds,
  estimateIds,
  caseIds,
  kbArticleIds,
  videoIds,
  conversationIds,
  toolCallIds,
  auditedEntityIds,
  retrievalSourceIds,
}: {
  sessions: TestSession[];
  customerIds: string[];
  vehicleIds: string[];
  workOrderIds: string[];
  partIds: string[];
  estimateIds: string[];
  caseIds: string[];
  kbArticleIds: string[];
  videoIds: string[];
  conversationIds: string[];
  toolCallIds: string[];
  auditedEntityIds: string[];
  retrievalSourceIds: string[];
}) {
  if (toolCallIds.length) {
    await db.auditLog.deleteMany({ where: { entityId: { in: toolCallIds } } });
  }

  if (auditedEntityIds.length) {
    await db.auditLog.deleteMany({ where: { entityId: { in: auditedEntityIds } } });
  }

  if (conversationIds.length) {
    await db.gaugeConversation.deleteMany({ where: { id: { in: conversationIds } } });
  }

  if (videoIds.length) {
    await db.video.deleteMany({ where: { id: { in: videoIds } } });
  }

  if (kbArticleIds.length) {
    await db.kbArticle.deleteMany({ where: { id: { in: kbArticleIds } } });
  }

  if (caseIds.length) {
    await db.case.deleteMany({ where: { id: { in: caseIds } } });
  }

  if (estimateIds.length) {
    await db.estimate.deleteMany({ where: { id: { in: estimateIds } } });
  }

  if (partIds.length) {
    await db.part.deleteMany({ where: { id: { in: partIds } } });
  }

  if (workOrderIds.length) {
    await db.workOrder.deleteMany({ where: { id: { in: workOrderIds } } });
  }

  if (vehicleIds.length) {
    await db.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
  }

  if (customerIds.length) {
    await db.customer.deleteMany({ where: { id: { in: customerIds } } });
  }

  if (retrievalSourceIds.length) {
    await db.gaugeRetrievalIndex.deleteMany({
      where: { sourceId: { in: retrievalSourceIds } },
    });
  }

  if (sessions.length) {
    await db.session.deleteMany({
      where: { id: { in: sessions.map((session) => session.sessionId) } },
    });
    await db.user.deleteMany({
      where: { id: { in: sessions.map((session) => session.user.id) } },
    });
  }
}

function captureEnv() {
  return {
    GAUGE_PROVIDER: process.env.GAUGE_PROVIDER,
    GAUGE_MODEL: process.env.GAUGE_MODEL,
  };
}

function restoreEnv(values: ReturnType<typeof captureEnv>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

type ChatRouteResponse = {
  conversationId: string;
  provider: string;
  model: string;
  message: { content: string; drafts?: GaugeDraftArtifact[]; actions?: GaugeActionArtifact[] };
  toolCalls: Array<{
    id: string;
    toolName: string;
    status: string;
    writeRequested: boolean;
    writePerformed?: boolean;
  }>;
};

type ActionRouteResponse = {
  conversationId: string;
  message: {
    content: string;
    drafts?: GaugeDraftArtifact[];
    actions?: GaugeActionArtifact[];
  };
  toolCall: {
    id: string;
    toolName: string;
    status: GaugeToolCallStatus;
    writeRequested: boolean;
    writePerformed: boolean;
  };
};

function expectSingleDraft(
  output: unknown,
  expectedKind: GaugeDraftKind,
  label: string,
) {
  const drafts = extractGaugeDrafts(output);
  assert.equal(drafts.length, 1, `Expected exactly one draft for ${label}`);
  assert.equal(drafts[0]?.kind, expectedKind, `Expected ${expectedKind} for ${label}`);
  return drafts[0]!;
}

function expectSingleAction(
  output: unknown,
  expectedKind: GaugeActionKind,
  label: string,
) {
  const actions = extractGaugeActions(output);
  assert.equal(actions.length, 1, `Expected exactly one action for ${label}`);
  assert.equal(actions[0]?.kind, expectedKind, `Expected ${expectedKind} for ${label}`);
  return actions[0]!;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
