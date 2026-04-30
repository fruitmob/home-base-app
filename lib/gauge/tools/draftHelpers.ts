import type { GaugeDraftLineItem } from "@/lib/gauge/drafts";

type DraftLineType = "estimate" | "change_order";

type ThemeKey =
  | "brake"
  | "electrical"
  | "cooling"
  | "leak"
  | "tire"
  | "inspection"
  | "default";

type ThemeDefinition = {
  estimate: GaugeDraftLineItem[];
  change_order: GaugeDraftLineItem[];
};

const themeDefinitions: Record<ThemeKey, ThemeDefinition> = {
  brake: {
    estimate: [
      {
        lineType: "LABOR",
        description: "Brake system diagnosis, road test, and repair verification",
        quantity: 2,
        unitPrice: null,
        taxable: false,
        rationale: "Covers technician inspection, brake bedding check, and final confirmation drive.",
      },
      {
        lineType: "PART",
        description: "Brake service parts package (pads, hardware, or related wear items as needed)",
        quantity: 1,
        unitPrice: null,
        taxable: true,
        rationale: "Captures the likely repair parts without posting a final part pick yet.",
      },
      {
        lineType: "NOTE",
        description: "Confirm exact brake parts and pricing after inspection approval.",
        quantity: 0,
        unitPrice: 0,
        taxable: false,
        rationale: "Keeps the draft honest while waiting for the final technician recommendation.",
      },
    ],
    change_order: [
      {
        lineType: "LABOR",
        description: "Additional brake repair labor beyond original scope",
        quantity: 1.5,
        unitPrice: null,
        taxable: false,
        rationale: "Useful when teardown or test drive uncovered more brake work than expected.",
      },
      {
        lineType: "PART",
        description: "Additional brake wear items or hardware discovered during service",
        quantity: 1,
        unitPrice: null,
        taxable: true,
        rationale: "Change-order placeholder for the newly identified parts.",
      },
    ],
  },
  electrical: {
    estimate: [
      {
        lineType: "LABOR",
        description: "Electrical system diagnosis and circuit verification",
        quantity: 2,
        unitPrice: null,
        taxable: false,
        rationale: "Covers trace, meter testing, and post-repair verification.",
      },
      {
        lineType: "PART",
        description: "Electrical repair materials or replacement component",
        quantity: 1,
        unitPrice: null,
        taxable: true,
        rationale: "Placeholder for the actual failed component once confirmed.",
      },
    ],
    change_order: [
      {
        lineType: "LABOR",
        description: "Additional electrical troubleshooting required after initial findings",
        quantity: 1.5,
        unitPrice: null,
        taxable: false,
        rationale: "Captures added diagnostic time discovered during the job.",
      },
      {
        lineType: "PART",
        description: "Unexpected electrical component or harness repair",
        quantity: 1,
        unitPrice: null,
        taxable: true,
        rationale: "Keeps approval moving while final parts are confirmed.",
      },
    ],
  },
  cooling: {
    estimate: [
      {
        lineType: "LABOR",
        description: "Cooling system pressure test, diagnosis, and verification",
        quantity: 2,
        unitPrice: null,
        taxable: false,
        rationale: "Covers leak isolation and post-repair heat cycle checks.",
      },
      {
        lineType: "PART",
        description: "Cooling system replacement parts and fluids as needed",
        quantity: 1,
        unitPrice: null,
        taxable: true,
        rationale: "Placeholder for hose, thermostat, radiator, or related cooling parts.",
      },
    ],
    change_order: [
      {
        lineType: "LABOR",
        description: "Additional cooling system repair labor",
        quantity: 1.5,
        unitPrice: null,
        taxable: false,
        rationale: "Use when a deeper cooling issue was found after the original approval.",
      },
      {
        lineType: "PART",
        description: "Additional cooling system parts or fluid discovered during teardown",
        quantity: 1,
        unitPrice: null,
        taxable: true,
        rationale: "Change-order coverage for parts outside the first estimate.",
      },
    ],
  },
  leak: {
    estimate: [
      {
        lineType: "LABOR",
        description: "Leak diagnosis, source confirmation, and cleanup verification",
        quantity: 2,
        unitPrice: null,
        taxable: false,
        rationale: "Supports tracing the leak and validating the repair afterward.",
      },
      {
        lineType: "PART",
        description: "Seals, gaskets, or related leak repair materials",
        quantity: 1,
        unitPrice: null,
        taxable: true,
        rationale: "Broad enough for a draft while the exact repair scope is finalized.",
      },
    ],
    change_order: [
      {
        lineType: "LABOR",
        description: "Additional leak repair labor after further inspection",
        quantity: 1.5,
        unitPrice: null,
        taxable: false,
        rationale: "For leak paths that were not visible until parts were removed.",
      },
      {
        lineType: "PART",
        description: "Additional sealing materials or replacement parts",
        quantity: 1,
        unitPrice: null,
        taxable: true,
        rationale: "Captures the unexpected repair items discovered in progress.",
      },
    ],
  },
  tire: {
    estimate: [
      {
        lineType: "LABOR",
        description: "Tire and wheel inspection, mounting/balancing, and final verification",
        quantity: 1.5,
        unitPrice: null,
        taxable: false,
        rationale: "Covers tire-related service and finish checks.",
      },
      {
        lineType: "PART",
        description: "Tire, wheel-end, or related service parts as required",
        quantity: 1,
        unitPrice: null,
        taxable: true,
        rationale: "Keeps the draft open for the exact tire or hardware choice.",
      },
    ],
    change_order: [
      {
        lineType: "LABOR",
        description: "Additional tire or wheel-end labor outside original scope",
        quantity: 1,
        unitPrice: null,
        taxable: false,
        rationale: "Useful for damage or wear discovered after the job began.",
      },
      {
        lineType: "PART",
        description: "Additional tire-related parts or hardware",
        quantity: 1,
        unitPrice: null,
        taxable: true,
        rationale: "Placeholder for unexpected wheel-end materials.",
      },
    ],
  },
  inspection: {
    estimate: [
      {
        lineType: "LABOR",
        description: "Comprehensive inspection and technician findings summary",
        quantity: 1,
        unitPrice: null,
        taxable: false,
        rationale: "Useful when the draft is mainly about documenting findings before a larger quote.",
      },
      {
        lineType: "NOTE",
        description: "Convert confirmed findings into final repair lines after customer approval.",
        quantity: 0,
        unitPrice: 0,
        taxable: false,
        rationale: "Keeps the estimate in draft form while the shop finalizes the scope.",
      },
    ],
    change_order: [
      {
        lineType: "NOTE",
        description: "Additional issues were identified during inspection and need approval before proceeding.",
        quantity: 0,
        unitPrice: 0,
        taxable: false,
        rationale: "Clear customer-facing note for an approval change.",
      },
    ],
  },
  default: {
    estimate: [
      {
        lineType: "LABOR",
        description: "Technician diagnosis, repair work, and final verification",
        quantity: 2,
        unitPrice: null,
        taxable: false,
        rationale: "Baseline labor draft when the shop still needs to refine the exact scope.",
      },
      {
        lineType: "PART",
        description: "Repair materials or replacement parts as required",
        quantity: 1,
        unitPrice: null,
        taxable: true,
        rationale: "Generic placeholder while pricing and exact parts are being reviewed.",
      },
      {
        lineType: "NOTE",
        description: "Review final parts list, pricing, and approvals before posting.",
        quantity: 0,
        unitPrice: 0,
        taxable: false,
        rationale: "Makes it explicit that this is still a human-reviewed draft.",
      },
    ],
    change_order: [
      {
        lineType: "LABOR",
        description: "Additional repair labor discovered after work began",
        quantity: 1.5,
        unitPrice: null,
        taxable: false,
        rationale: "Catch-all change-order labor suggestion.",
      },
      {
        lineType: "PART",
        description: "Additional parts or materials required after inspection",
        quantity: 1,
        unitPrice: null,
        taxable: true,
        rationale: "Catch-all change-order parts suggestion.",
      },
    ],
  },
};

export function buildSuggestedLines({
  draftType,
  contextText,
  existingDescriptions,
}: {
  draftType: DraftLineType;
  contextText: string;
  existingDescriptions: string[];
}) {
  const theme = detectTheme(contextText);
  const candidateLines = themeDefinitions[theme][draftType === "estimate" ? "estimate" : "change_order"];
  const usedDescriptions = new Set(existingDescriptions.map((description) => description.toLowerCase()));

  return candidateLines.filter(
    (line) => !usedDescriptions.has(line.description.toLowerCase()),
  );
}

export function buildLineDraftBody(lines: GaugeDraftLineItem[]) {
  return lines
    .map((line, index) => {
      const quantity = line.lineType === "NOTE" ? "" : `Qty ${line.quantity} • `;
      const price = line.unitPrice == null ? "Price review needed" : `$${line.unitPrice.toFixed(2)}`;

      return `${index + 1}. ${line.lineType}: ${line.description}\n${quantity}${price}${
        line.rationale ? ` • ${line.rationale}` : ""
      }`;
    })
    .join("\n\n");
}

function detectTheme(text: string): ThemeKey {
  const normalized = text.toLowerCase();

  if (/\bbrake|rotor|pad|caliper|stopping\b/.test(normalized)) return "brake";
  if (/\belectrical|battery|starter|alternator|wiring|circuit\b/.test(normalized)) return "electrical";
  if (/\bcoolant|radiator|thermostat|overheat|cooling\b/.test(normalized)) return "cooling";
  if (/\bleak|oil|seal|gasket|drip|fluid\b/.test(normalized)) return "leak";
  if (/\btire|wheel|alignment|vibration\b/.test(normalized)) return "tire";
  if (/\binspection|checklist|findings|walkaround|review\b/.test(normalized)) return "inspection";

  return "default";
}
