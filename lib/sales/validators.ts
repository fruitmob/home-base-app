import {
  ActivityStatus,
  ActivityType,
  CasePriority,
  CaseStatus,
  LeadSource,
  LeadStatus,
  OpportunityStage,
  QuoteStatus,
  type ActivityStatus as ActivityStatusValue,
  type ActivityType as ActivityTypeValue,
  type CasePriority as CasePriorityValue,
  type CaseStatus as CaseStatusValue,
  type LeadSource as LeadSourceValue,
  type LeadStatus as LeadStatusValue,
  type OpportunityStage as OpportunityStageValue,
  type QuoteStatus as QuoteStatusValue,
} from "@/generated/prisma/client";
import {
  ValidationError,
  parseEnum,
  readOptionalBoolean,
  readOptionalDate,
  readOptionalDecimal,
  readOptionalInteger,
  readOptionalString,
  readRequiredDecimal,
  readRequiredString,
  requireRecord,
} from "@/lib/core/validators";
import {
  buildDisplayName,
  normalizeEmail,
  normalizePhone,
} from "@/lib/core/normalize";
import { lineTotal } from "@/lib/core/money";
import { normalizePeriod, normalizeSku, stripQuoteNumber } from "@/lib/sales/normalize";

export type NormalizedLeadInput = {
  status: LeadStatusValue;
  source: LeadSourceValue;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  interest: string | null;
  estimatedValue: number | null;
  notes: string | null;
  ownerUserId: string | null;
  customerId: string | null;
};

export type NormalizedLeadConvertInput = {
  customerId: string | null;
  createCustomer: boolean;
  opportunityName: string;
  opportunityAmount: number;
  opportunityStage: OpportunityStageValue;
  opportunityOwnerUserId: string | null;
  opportunityExpectedCloseDate: Date | null;
  opportunityNotes: string | null;
};

export type NormalizedOpportunityInput = {
  customerId: string;
  vehicleId: string | null;
  ownerUserId: string | null;
  name: string;
  stage: OpportunityStageValue;
  amount: number;
  probability: number;
  expectedCloseDate: Date | null;
  notes: string | null;
};

export type NormalizedStageTransitionInput = {
  stage: OpportunityStageValue;
  lossReason: string | null;
};

export type NormalizedActivityInput = {
  type: ActivityTypeValue;
  status: ActivityStatusValue;
  subject: string;
  body: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  ownerUserId: string | null;
  leadId: string | null;
  opportunityId: string | null;
  customerId: string | null;
  vehicleId: string | null;
  caseId: string | null;
};

export type NormalizedCaseInput = {
  customerId: string;
  vehicleId: string | null;
  openedByUserId: string | null;
  assignedUserId: string | null;
  status: CaseStatusValue;
  priority: CasePriorityValue;
  subject: string;
  description: string | null;
};

export type NormalizedCaseResolveInput = {
  resolutionNotes: string | null;
};

export type NormalizedProductInput = {
  sku: string;
  name: string;
  description: string | null;
  family: string | null;
  isLabor: boolean;
  taxable: boolean;
  active: boolean;
  defaultUnitPrice: number;
  defaultCost: number | null;
};

export type NormalizedPricebookInput = {
  name: string;
  description: string | null;
  isDefault: boolean;
  active: boolean;
};

export type NormalizedPricebookEntryInput = {
  productId: string;
  unitPrice: number;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
};

export type NormalizedQuoteInput = {
  customerId: string;
  vehicleId: string | null;
  opportunityId: string | null;
  pricebookId: string | null;
  validUntil: Date | null;
  notes: string | null;
};

export type NormalizedQuoteLineInput = {
  productId: string | null;
  sku: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxable: boolean;
  displayOrder: number;
};

export type NormalizedQuoteStatusInput = {
  status: QuoteStatusValue;
  issuedAt: Date | null;
};

export type NormalizedQuoteTemplateInput = {
  name: string;
  description: string | null;
  active: boolean;
};

export type NormalizedQuoteTemplateLineInput = {
  productId: string | null;
  sku: string | null;
  description: string;
  quantity: number;
  unitPrice: number | null;
  taxable: boolean;
  displayOrder: number;
};

export type NormalizedSalesGoalInput = {
  userId: string;
  period: string;
  targetAmount: number;
  notes: string | null;
};

export function parseLeadInput(input: unknown): NormalizedLeadInput {
  const record = requireRecord(input);
  const companyName = readOptionalString(record, "companyName");
  const firstName = readOptionalString(record, "firstName");
  const lastName = readOptionalString(record, "lastName");
  const email = normalizeEmail(readOptionalString(record, "email"));
  const phone = normalizePhone(readOptionalString(record, "phone"));
  const displayName = buildDisplayName({
    displayName: readOptionalString(record, "displayName"),
    companyName,
    firstName,
    lastName,
    email,
    phone,
  });

  return {
    status: parseEnum(record.status, LeadStatus, "status", LeadStatus.NEW),
    source: parseEnum(record.source, LeadSource, "source", LeadSource.OTHER),
    companyName,
    firstName,
    lastName,
    displayName,
    email,
    phone,
    interest: readOptionalString(record, "interest"),
    estimatedValue: readOptionalDecimal(record, "estimatedValue", { min: 0 }),
    notes: readOptionalString(record, "notes"),
    ownerUserId: readOptionalString(record, "ownerUserId"),
    customerId: readOptionalString(record, "customerId"),
  };
}

export function parseLeadConvertInput(input: unknown): NormalizedLeadConvertInput {
  const record = requireRecord(input);

  return {
    customerId: readOptionalString(record, "customerId"),
    createCustomer: readOptionalBoolean(record, "createCustomer", false),
    opportunityName: readRequiredString(record, "opportunityName"),
    opportunityAmount: readOptionalDecimal(record, "opportunityAmount", { min: 0 }) ?? 0,
    opportunityStage: parseEnum(
      record.opportunityStage,
      OpportunityStage,
      "opportunityStage",
      OpportunityStage.NEW,
    ),
    opportunityOwnerUserId: readOptionalString(record, "opportunityOwnerUserId"),
    opportunityExpectedCloseDate: readOptionalDate(record, "opportunityExpectedCloseDate"),
    opportunityNotes: readOptionalString(record, "opportunityNotes"),
  };
}

export function parseOpportunityInput(input: unknown): NormalizedOpportunityInput {
  const record = requireRecord(input);

  return {
    customerId: readRequiredString(record, "customerId"),
    vehicleId: readOptionalString(record, "vehicleId"),
    ownerUserId: readOptionalString(record, "ownerUserId"),
    name: readRequiredString(record, "name"),
    stage: parseEnum(record.stage, OpportunityStage, "stage", OpportunityStage.NEW),
    amount: readOptionalDecimal(record, "amount", { min: 0 }) ?? 0,
    probability: readOptionalInteger(record, "probability", { min: 0, max: 100 }) ?? 0,
    expectedCloseDate: readOptionalDate(record, "expectedCloseDate"),
    notes: readOptionalString(record, "notes"),
  };
}

export function parseStageTransitionInput(input: unknown): NormalizedStageTransitionInput {
  const record = requireRecord(input);
  const stage = parseEnum(record.stage, OpportunityStage, "stage", OpportunityStage.NEW);

  return {
    stage,
    lossReason: stage === OpportunityStage.LOST ? readOptionalString(record, "lossReason") : null,
  };
}

export function parseActivityInput(input: unknown): NormalizedActivityInput {
  const record = requireRecord(input);
  const leadId = readOptionalString(record, "leadId");
  const opportunityId = readOptionalString(record, "opportunityId");
  const customerId = readOptionalString(record, "customerId");
  const vehicleId = readOptionalString(record, "vehicleId");
  const caseId = readOptionalString(record, "caseId");
  const parentCount = [leadId, opportunityId, customerId, vehicleId, caseId].filter(Boolean).length;

  if (parentCount !== 1) {
    throw new ValidationError([
      "Activity must have exactly one parent (leadId, opportunityId, customerId, vehicleId, or caseId).",
    ]);
  }

  return {
    type: parseEnum(record.type, ActivityType, "type", ActivityType.NOTE),
    status: parseEnum(record.status, ActivityStatus, "status", ActivityStatus.OPEN),
    subject: readRequiredString(record, "subject"),
    body: readOptionalString(record, "body"),
    dueAt: readOptionalDate(record, "dueAt"),
    completedAt: readOptionalDate(record, "completedAt"),
    ownerUserId: readOptionalString(record, "ownerUserId"),
    leadId,
    opportunityId,
    customerId,
    vehicleId,
    caseId,
  };
}

export function parseCaseInput(input: unknown): NormalizedCaseInput {
  const record = requireRecord(input);

  return {
    customerId: readRequiredString(record, "customerId"),
    vehicleId: readOptionalString(record, "vehicleId"),
    openedByUserId: readOptionalString(record, "openedByUserId"),
    assignedUserId: readOptionalString(record, "assignedUserId"),
    status: parseEnum(record.status, CaseStatus, "status", CaseStatus.OPEN),
    priority: parseEnum(record.priority, CasePriority, "priority", CasePriority.NORMAL),
    subject: readRequiredString(record, "subject"),
    description: readOptionalString(record, "description"),
  };
}

export function parseCaseResolveInput(input: unknown): NormalizedCaseResolveInput {
  const record = requireRecord(input);

  return {
    resolutionNotes: readOptionalString(record, "resolutionNotes"),
  };
}

export function parseProductInput(input: unknown): NormalizedProductInput {
  const record = requireRecord(input);
  const sku = normalizeSku(readRequiredString(record, "sku"));

  if (!sku) {
    throw new ValidationError(["sku is required."]);
  }

  return {
    sku,
    name: readRequiredString(record, "name"),
    description: readOptionalString(record, "description"),
    family: readOptionalString(record, "family"),
    isLabor: readOptionalBoolean(record, "isLabor", false),
    taxable: readOptionalBoolean(record, "taxable", true),
    active: readOptionalBoolean(record, "active", true),
    defaultUnitPrice: readOptionalDecimal(record, "defaultUnitPrice", { min: 0 }) ?? 0,
    defaultCost: readOptionalDecimal(record, "defaultCost", { min: 0 }),
  };
}

export function parsePricebookInput(input: unknown): NormalizedPricebookInput {
  const record = requireRecord(input);

  return {
    name: readRequiredString(record, "name"),
    description: readOptionalString(record, "description"),
    isDefault: readOptionalBoolean(record, "isDefault", false),
    active: readOptionalBoolean(record, "active", true),
  };
}

export function parsePricebookEntryInput(input: unknown): NormalizedPricebookEntryInput {
  const record = requireRecord(input);

  return {
    productId: readRequiredString(record, "productId"),
    unitPrice: readRequiredDecimal(record, "unitPrice", { min: 0 }),
    effectiveFrom: readOptionalDate(record, "effectiveFrom"),
    effectiveTo: readOptionalDate(record, "effectiveTo"),
  };
}

export function parseQuoteInput(input: unknown): NormalizedQuoteInput {
  const record = requireRecord(input);

  return {
    customerId: readRequiredString(record, "customerId"),
    vehicleId: readOptionalString(record, "vehicleId"),
    opportunityId: readOptionalString(record, "opportunityId"),
    pricebookId: readOptionalString(record, "pricebookId"),
    validUntil: readOptionalDate(record, "validUntil"),
    notes: readOptionalString(record, "notes"),
  };
}

export function parseQuoteLineInput(input: unknown): NormalizedQuoteLineInput {
  const record = requireRecord(input);
  const quantity = readOptionalDecimal(record, "quantity", { min: 0 }) ?? 1;
  const unitPrice = readOptionalDecimal(record, "unitPrice", { min: 0 }) ?? 0;

  return {
    productId: readOptionalString(record, "productId"),
    sku: normalizeSku(readOptionalString(record, "sku")),
    description: readRequiredString(record, "description"),
    quantity,
    unitPrice,
    lineTotal: lineTotal(quantity, unitPrice),
    taxable: readOptionalBoolean(record, "taxable", true),
    displayOrder: readOptionalInteger(record, "displayOrder", { min: 0 }) ?? 0,
  };
}

export function parseQuoteStatusInput(input: unknown): NormalizedQuoteStatusInput {
  const record = requireRecord(input);
  const status = parseEnum(record.status, QuoteStatus, "status", QuoteStatus.DRAFT);

  return {
    status,
    issuedAt: status === QuoteStatus.SENT ? readOptionalDate(record, "issuedAt") ?? new Date() : null,
  };
}

export function parseQuoteTemplateInput(input: unknown): NormalizedQuoteTemplateInput {
  const record = requireRecord(input);

  return {
    name: readRequiredString(record, "name"),
    description: readOptionalString(record, "description"),
    active: readOptionalBoolean(record, "active", true),
  };
}

export function parseQuoteTemplateLineInput(input: unknown): NormalizedQuoteTemplateLineInput {
  const record = requireRecord(input);

  return {
    productId: readOptionalString(record, "productId"),
    sku: normalizeSku(readOptionalString(record, "sku")),
    description: readRequiredString(record, "description"),
    quantity: readOptionalDecimal(record, "quantity", { min: 0 }) ?? 1,
    unitPrice: readOptionalDecimal(record, "unitPrice", { min: 0 }),
    taxable: readOptionalBoolean(record, "taxable", true),
    displayOrder: readOptionalInteger(record, "displayOrder", { min: 0 }) ?? 0,
  };
}

export function parseSalesGoalInput(input: unknown): NormalizedSalesGoalInput {
  const record = requireRecord(input);
  const period = normalizePeriod(readRequiredString(record, "period"));

  if (!period) {
    throw new ValidationError(["period must be formatted as YYYY-MM."]);
  }

  return {
    userId: readRequiredString(record, "userId"),
    period,
    targetAmount: readRequiredDecimal(record, "targetAmount", { min: 0 }),
    notes: readOptionalString(record, "notes"),
  };
}

export function validateQuoteNumberFormat(quoteNumber: string | null): string | null {
  const normalized = stripQuoteNumber(quoteNumber);

  if (!normalized) {
    return null;
  }

  if (!/^Q-\d{6}-\d{4}$/.test(normalized)) {
    throw new ValidationError(["quoteNumber must match Q-YYYYMM-####."]);
  }

  return normalized;
}
