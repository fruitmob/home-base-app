type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike };

export type GaugeDraftKind =
  | "customer_follow_up"
  | "estimate_suggestions"
  | "change_order_suggestions"
  | "kb_article"
  | "internal_note";

export type GaugeDraftLineItem = {
  lineType: string;
  description: string;
  quantity: number;
  unitPrice: number | null;
  taxable: boolean;
  rationale?: string | null;
};

export type GaugeDraftReviewItem = {
  label: string;
  value: string;
};

export type GaugeDraftArtifact = {
  id: string;
  kind: GaugeDraftKind;
  title: string;
  summary: string;
  body: string;
  format: "text" | "markdown";
  relatedHref?: string | null;
  relatedLabel?: string | null;
  reviewItems?: GaugeDraftReviewItem[];
  lineItems?: GaugeDraftLineItem[];
  metadata?: Record<string, JsonLike> | null;
};

export type GaugeDraftEnvelope = {
  drafts: GaugeDraftArtifact[];
};

export function createDraftArtifact(
  draft: Omit<GaugeDraftArtifact, "id"> & { id?: string },
): GaugeDraftArtifact {
  return {
    ...draft,
    id: draft.id ?? buildDraftId(draft.kind, draft.title),
    reviewItems: draft.reviewItems ?? [],
    lineItems: draft.lineItems ?? [],
    metadata: draft.metadata ?? null,
  };
}

export function createDraftEnvelope(drafts: Array<Omit<GaugeDraftArtifact, "id"> & { id?: string }>) {
  return {
    drafts: drafts.map(createDraftArtifact),
  } satisfies GaugeDraftEnvelope;
}

export function extractGaugeDrafts(value: unknown): GaugeDraftArtifact[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const drafts = record.drafts;

  if (!Array.isArray(drafts)) {
    return [];
  }

  return drafts
    .filter((draft): draft is Record<string, unknown> => !!draft && typeof draft === "object" && !Array.isArray(draft))
    .flatMap((draft) => {
      const kind = typeof draft.kind === "string" ? draft.kind : null;
      const title = typeof draft.title === "string" ? draft.title : null;
      const summary = typeof draft.summary === "string" ? draft.summary : null;
      const body = typeof draft.body === "string" ? draft.body : null;
      const format = draft.format === "markdown" ? "markdown" : draft.format === "text" ? "text" : null;

      if (!kind || !title || !summary || !body || !format) {
        return [];
      }

      return [
        createDraftArtifact({
          id: typeof draft.id === "string" ? draft.id : undefined,
          kind: kind as GaugeDraftKind,
          title,
          summary,
          body,
          format,
          relatedHref: typeof draft.relatedHref === "string" ? draft.relatedHref : null,
          relatedLabel: typeof draft.relatedLabel === "string" ? draft.relatedLabel : null,
          reviewItems: Array.isArray(draft.reviewItems)
            ? draft.reviewItems
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
          lineItems: Array.isArray(draft.lineItems)
            ? draft.lineItems
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
            draft.metadata && typeof draft.metadata === "object" && !Array.isArray(draft.metadata)
              ? (draft.metadata as Record<string, JsonLike>)
              : null,
        }),
      ];
    });
}

function buildDraftId(kind: GaugeDraftKind, title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48);

  return `${kind}:${slug || "draft"}`;
}
