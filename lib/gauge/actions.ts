import type {
  GaugeDraftArtifact,
  GaugeDraftLineItem,
  GaugeDraftReviewItem,
} from "@/lib/gauge/drafts";

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike };

export type GaugeActionKind =
  | "create_estimate_draft"
  | "create_change_order_draft"
  | "save_vehicle_note";

export type GaugeActionStatus = "pending_confirmation" | "completed";

export type GaugeActionArtifact = {
  id: string;
  kind: GaugeActionKind;
  status: GaugeActionStatus;
  title: string;
  summary: string;
  confirmationLabel: string;
  toolCallId?: string | null;
  relatedHref?: string | null;
  relatedLabel?: string | null;
  resultHref?: string | null;
  resultLabel?: string | null;
  body?: string | null;
  reviewItems?: GaugeDraftReviewItem[];
  lineItems?: GaugeDraftLineItem[];
  metadata?: Record<string, JsonLike> | null;
};

export type GaugeActionEnvelope = {
  actions: GaugeActionArtifact[];
};

export function createGaugeActionArtifact(
  action: Omit<GaugeActionArtifact, "id"> & { id?: string },
): GaugeActionArtifact {
  return {
    ...action,
    id: action.id ?? buildActionId(action.kind, action.title),
    toolCallId: action.toolCallId ?? null,
    relatedHref: action.relatedHref ?? null,
    relatedLabel: action.relatedLabel ?? null,
    resultHref: action.resultHref ?? null,
    resultLabel: action.resultLabel ?? null,
    body: action.body ?? null,
    reviewItems: action.reviewItems ?? [],
    lineItems: action.lineItems ?? [],
    metadata: action.metadata ?? null,
  };
}

export function createGaugeActionEnvelope(
  actions: Array<Omit<GaugeActionArtifact, "id"> & { id?: string }>,
) {
  return {
    actions: actions.map(createGaugeActionArtifact),
  } satisfies GaugeActionEnvelope;
}

export function extractGaugeActions(value: unknown): GaugeActionArtifact[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const actions = record.actions;

  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .filter(
      (action): action is Record<string, unknown> =>
        !!action && typeof action === "object" && !Array.isArray(action),
    )
    .flatMap((action) => {
      const kind = typeof action.kind === "string" ? action.kind : null;
      const status =
        action.status === "completed"
          ? "completed"
          : action.status === "pending_confirmation"
            ? "pending_confirmation"
            : null;
      const title = typeof action.title === "string" ? action.title : null;
      const summary = typeof action.summary === "string" ? action.summary : null;
      const confirmationLabel =
        typeof action.confirmationLabel === "string" ? action.confirmationLabel : null;

      if (!kind || !status || !title || !summary || !confirmationLabel) {
        return [];
      }

      return [
        createGaugeActionArtifact({
          id: typeof action.id === "string" ? action.id : undefined,
          kind: kind as GaugeActionKind,
          status,
          title,
          summary,
          confirmationLabel,
          toolCallId: typeof action.toolCallId === "string" ? action.toolCallId : null,
          relatedHref: typeof action.relatedHref === "string" ? action.relatedHref : null,
          relatedLabel: typeof action.relatedLabel === "string" ? action.relatedLabel : null,
          resultHref: typeof action.resultHref === "string" ? action.resultHref : null,
          resultLabel: typeof action.resultLabel === "string" ? action.resultLabel : null,
          body: typeof action.body === "string" ? action.body : null,
          reviewItems: Array.isArray(action.reviewItems)
            ? action.reviewItems
                .filter(
                  (item): item is Record<string, unknown> =>
                    !!item && typeof item === "object" && !Array.isArray(item),
                )
                .flatMap((item) => {
                  if (typeof item.label !== "string" || typeof item.value !== "string") {
                    return [];
                  }

                  return [{ label: item.label, value: item.value }];
                })
            : [],
          lineItems: Array.isArray(action.lineItems)
            ? action.lineItems
                .filter(
                  (line): line is Record<string, unknown> =>
                    !!line && typeof line === "object" && !Array.isArray(line),
                )
                .flatMap((line) => {
                  if (
                    typeof line.lineType !== "string" ||
                    typeof line.description !== "string" ||
                    typeof line.quantity !== "number" ||
                    typeof line.taxable !== "boolean"
                  ) {
                    return [];
                  }

                  return [
                    {
                      lineType: line.lineType,
                      description: line.description,
                      quantity: line.quantity,
                      unitPrice: typeof line.unitPrice === "number" ? line.unitPrice : null,
                      taxable: line.taxable,
                      rationale: typeof line.rationale === "string" ? line.rationale : null,
                    },
                  ];
                })
            : [],
          metadata:
            action.metadata && typeof action.metadata === "object" && !Array.isArray(action.metadata)
              ? (action.metadata as Record<string, JsonLike>)
              : null,
        }),
      ];
    });
}

export function attachToolCallIdToGaugeActions(value: unknown, toolCallId: string) {
  const actions = extractGaugeActions(value);

  if (actions.length === 0) {
    return value;
  }

  return createGaugeActionEnvelope(
    actions.map((action) => ({
      ...action,
      toolCallId,
    })),
  );
}

export function canPrepareGaugeDraftWrite(draft: GaugeDraftArtifact) {
  if (draft.kind === "estimate_suggestions") {
    return hasMetadataString(draft, "workOrderId");
  }

  if (draft.kind === "change_order_suggestions") {
    return hasMetadataString(draft, "workOrderId");
  }

  if (draft.kind === "internal_note") {
    return hasMetadataString(draft, "vehicleId");
  }

  return false;
}

export function getGaugeDraftWriteLabel(draft: GaugeDraftArtifact) {
  if (draft.kind === "estimate_suggestions") {
    return "Prepare Estimate";
  }

  if (draft.kind === "change_order_suggestions") {
    return "Prepare Change Order";
  }

  if (draft.kind === "internal_note") {
    return "Prepare Note";
  }

  return "Prepare Write";
}

function buildActionId(kind: GaugeActionKind, title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48);

  return `${kind}:${slug || "action"}`;
}

function hasMetadataString(draft: GaugeDraftArtifact, key: string) {
  const value = draft.metadata?.[key];
  return typeof value === "string" && value.trim().length > 0;
}
