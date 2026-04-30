import {
  WorkOrderLineStatus,
  WorkOrderLineType,
  WorkOrderPriority,
  WorkOrderStatus,
  type WorkOrderLineStatus as WorkOrderLineStatusValue,
  type WorkOrderStatus as WorkOrderStatusValue,
  type WorkOrderPriority as WorkOrderPriorityValue,
  type WorkOrderLineType as WorkOrderLineTypeValue,
  InspectionType,
  InspectionItemResult,
 
} from "@/generated/prisma/client";
import {
  ValidationError,
  parseEnum,
  readOptionalBoolean,
  readOptionalDate,
  readOptionalDecimal,
  readOptionalInteger,
  readOptionalString,
  readRequiredString,
  requireRecord,
} from "@/lib/core/validators";
import { lineTotal, toNumber } from "@/lib/core/money";

const SHOP_NUMBER_PATTERNS = {
  workOrderNumber: /^WO-\d{6}-\d{4}$/,
  estimateNumber: /^EST-\d{6}-\d{4}$/,
  changeOrderNumber: /^CO-\d{6}-\d{4}$/,
} as const;

type InspectionParentInput = {
  customerId?: string | null;
  vehicleId?: string | null;
  workOrderId?: string | null;
};

export type NormalizedWorkOrderInput = {
  customerId: string;
  vehicleId: string | null;
  opportunityId: string | null;
  quoteId: string | null;
  bayId: string | null;
  serviceWriterUserId: string | null;
  assignedTechUserId: string | null;
  status: WorkOrderStatusValue;
  priority: WorkOrderPriorityValue;
  title: string;
  complaint: string | null;
  internalNotes: string | null;
  odometerIn: number | null;
  odometerOut: number | null;
  promisedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  closedAt: Date | null;
};

export type NormalizedWorkOrderLineInput = {
  productId: string | null;
  partId: string | null;
  lineType: WorkOrderLineTypeValue;
  status: WorkOrderLineStatusValue;
  description: string;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  lineTotal: number;
  taxable: boolean;
  displayOrder: number;
  completedAt: Date | null;
};

export type NormalizedBayInput = {
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
};

export function parseBayInput(input: unknown): NormalizedBayInput {
  const record = requireRecord(input);

  return {
    name: readRequiredString(record, "name"),
    description: readOptionalString(record, "description"),
    active: readOptionalBoolean(record, "active", true),
    sortOrder: readOptionalInteger(record, "sortOrder", { min: 0 }) ?? 0,
  };
}

export function parseWorkOrderInput(input: unknown): NormalizedWorkOrderInput {
  const record = requireRecord(input);
  const odometerIn = readOptionalInteger(record, "odometerIn", { min: 0 });
  const odometerOut = readOptionalInteger(record, "odometerOut", { min: 0 });

  if (odometerIn != null && odometerOut != null && odometerOut < odometerIn) {
    throw new ValidationError(["odometerOut must be greater than or equal to odometerIn."]);
  }

  return {
    customerId: readRequiredString(record, "customerId"),
    vehicleId: readOptionalString(record, "vehicleId"),
    opportunityId: readOptionalString(record, "opportunityId"),
    quoteId: readOptionalString(record, "quoteId"),
    bayId: readOptionalString(record, "bayId"),
    serviceWriterUserId: readOptionalString(record, "serviceWriterUserId"),
    assignedTechUserId: readOptionalString(record, "assignedTechUserId"),
    status: parseEnum(record.status, WorkOrderStatus, "status", WorkOrderStatus.OPEN),
    priority: parseEnum(record.priority, WorkOrderPriority, "priority", WorkOrderPriority.NORMAL),
    title: readRequiredString(record, "title"),
    complaint: readOptionalString(record, "complaint"),
    internalNotes: readOptionalString(record, "internalNotes"),
    odometerIn,
    odometerOut,
    promisedAt: readOptionalDate(record, "promisedAt"),
    startedAt: readOptionalDate(record, "startedAt"),
    completedAt: readOptionalDate(record, "completedAt"),
    closedAt: readOptionalDate(record, "closedAt"),
  };
}

export function parseWorkOrderLineInput(input: unknown): NormalizedWorkOrderLineInput {
  const record = requireRecord(input);
  const lineType = parseEnum(record.lineType, WorkOrderLineType, "lineType", WorkOrderLineType.LABOR);
  const quantity = readOptionalDecimal(record, "quantity", { min: 0 }) ?? (lineType === WorkOrderLineType.NOTE ? 0 : 1);
  const unitPrice = readOptionalDecimal(record, "unitPrice", { min: 0 }) ?? 0;

  return {
    productId: readOptionalString(record, "productId"),
    partId: readOptionalString(record, "partId"),
    lineType,
    status: parseEnum(record.status, WorkOrderLineStatus, "status", WorkOrderLineStatus.OPEN),
    description: readRequiredString(record, "description"),
    quantity,
    unitPrice,
    unitCost: readOptionalDecimal(record, "unitCost", { min: 0 }),
    lineTotal: lineTotal(quantity, unitPrice),
    taxable: readOptionalBoolean(record, "taxable", true),
    displayOrder: readOptionalInteger(record, "displayOrder", { min: 0 }) ?? 0,
    completedAt: readOptionalDate(record, "completedAt"),
  };
}

export function normalizeShopNumber(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim().toUpperCase();

  return trimmed.length > 0 ? trimmed : null;
}

export function validateWorkOrderNumber(value: string | null | undefined): string | null {
  return validateShopNumber(value, "workOrderNumber", "WO-YYYYMM-####");
}

export function validateEstimateNumber(value: string | null | undefined): string | null {
  return validateShopNumber(value, "estimateNumber", "EST-YYYYMM-####");
}

export function validateChangeOrderNumber(value: string | null | undefined): string | null {
  return validateShopNumber(value, "changeOrderNumber", "CO-YYYYMM-####");
}

export function validatePositiveQuantity(value: unknown, field = "quantity"): number {
  const parsed = toNumberLike(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ValidationError([`${field} must be greater than zero.`]);
  }

  return parsed;
}

export function validateNonNegativeQuantity(value: unknown, field = "quantity"): number {
  const parsed = toNumberLike(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError([`${field} must be zero or greater.`]);
  }

  return parsed;
}

export function validateNonNegativeMinutes(value: unknown, field = "minutes"): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ValidationError([`${field} must be a non-negative whole number of minutes.`]);
  }

  return value;
}

export function validateInspectionParent(input: InspectionParentInput): Required<InspectionParentInput> {
  const customerId = normalizeRequiredId(input.customerId, "customerId");
  const vehicleId = normalizeRequiredId(input.vehicleId, "vehicleId");
  const workOrderId = normalizeOptionalId(input.workOrderId);

  return { customerId, vehicleId, workOrderId };
}

function validateShopNumber(
  value: string | null | undefined,
  field: keyof typeof SHOP_NUMBER_PATTERNS,
  formatName: string,
): string | null {
  const normalized = normalizeShopNumber(value);

  if (!normalized) {
    return null;
  }

  if (!SHOP_NUMBER_PATTERNS[field].test(normalized)) {
    throw new ValidationError([`${field} must match ${formatName}.`]);
  }

  return normalized;
}

function normalizeRequiredId(value: string | null | undefined, field: string): string {
  const normalized = normalizeOptionalId(value);

  if (!normalized) {
    throw new ValidationError([`${field} is required.`]);
  }

  return normalized;
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function toNumberLike(value: unknown): number {
  if (typeof value === "number" || typeof value === "string" || value == null) {
    return toNumber(value);
  }

  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    return toNumber(value as { toNumber(): number });
  }

  return Number.NaN;
}

export function parseEstimateInput(input: unknown) {
  const record = requireRecord(input);
  return {
    customerId: readRequiredString(record, "customerId"),
    vehicleId: readOptionalString(record, "vehicleId"),
    opportunityId: readOptionalString(record, "opportunityId"),
    quoteId: readOptionalString(record, "quoteId"),
    title: readRequiredString(record, "title"),
    notes: readOptionalString(record, "notes"),
    validUntil: readOptionalDate(record, "validUntil"),
  };
}

export function parseChangeOrderInput(input: unknown) {
  const record = requireRecord(input);
  return {
    workOrderId: readRequiredString(record, "workOrderId"),
    title: readRequiredString(record, "title"),
    reason: readOptionalString(record, "reason"),
  };
}


export type NormalizedEstimateLineInput = {
  productId: string | null;
  partId: string | null;
  lineType: WorkOrderLineTypeValue;
  description: string;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  lineTotal: number;
  taxable: boolean;
  displayOrder: number;
};

export function parseEstimateLineInput(input: unknown) {
  const record = requireRecord(input);
  const lineType = parseEnum(record.lineType, WorkOrderLineType, "lineType", WorkOrderLineType.LABOR);
  const quantity = readOptionalDecimal(record, "quantity", { min: 0 }) ?? (lineType === WorkOrderLineType.NOTE ? 0 : 1);
  const unitPrice = readOptionalDecimal(record, "unitPrice", { min: 0 }) ?? 0;
  return {
    productId: readOptionalString(record, "productId"),
    partId: readOptionalString(record, "partId"),
    lineType,
    description: readRequiredString(record, "description"),
    quantity,
    unitPrice,
    unitCost: readOptionalDecimal(record, "unitCost", { min: 0 }),
    lineTotal: lineTotal(quantity, unitPrice),
    taxable: readOptionalBoolean(record, "taxable", true),
    displayOrder: readOptionalInteger(record, "displayOrder", { min: 0 }) ?? 0,
  };
}


export const parseChangeOrderLineInput = parseEstimateLineInput;


export function parseTemplateLineInput(input: unknown) {
  const record = requireRecord(input);
  const lineType = parseEnum(record.lineType, WorkOrderLineType, "lineType", WorkOrderLineType.LABOR);
  const quantity = readOptionalDecimal(record, "quantity", { min: 0 }) ?? (lineType === WorkOrderLineType.NOTE ? 0 : 1);
  const unitPrice = readOptionalDecimal(record, "unitPrice", { min: 0 });
  return {
    productId: readOptionalString(record, "productId"),
    partId: readOptionalString(record, "partId"),
    lineType,
    description: readRequiredString(record, "description"),
    quantity,
    unitPrice,
    taxable: readOptionalBoolean(record, "taxable", true),
    displayOrder: readOptionalInteger(record, "displayOrder", { min: 0 }) ?? 0,
  };
}


export function parseArrivalInspectionInput(input: unknown) {
  const record = requireRecord(input);
  return {
    customerId: readRequiredString(record, "customerId"),
    vehicleId: readRequiredString(record, "vehicleId"),
    workOrderId: readOptionalString(record, "workOrderId"),
    type: parseEnum(record.type, InspectionType, "type", InspectionType.ARRIVAL),
    notes: readOptionalString(record, "notes"),
  };
}

export function parseInspectionItemInput(input: unknown) {
  const record = requireRecord(input);
  return {
    label: readRequiredString(record, "label"),
    category: readOptionalString(record, "category"),
    result: parseEnum(record.result, InspectionItemResult, "result", InspectionItemResult.NOT_APPLICABLE),
    notes: readOptionalString(record, "notes"),
  };
}

export function parseWarrantyClaimInput(input: unknown) {
  const record = requireRecord(input);
  return {
    workOrderId: readRequiredString(record, "workOrderId"),
    sourceWorkOrderId: readOptionalString(record, "sourceWorkOrderId"),
    vendorId: readOptionalString(record, "vendorId"),
    caseId: readOptionalString(record, "caseId"),
    title: readRequiredString(record, "title"),
    description: readOptionalString(record, "description"),
    claimNumber: readOptionalString(record, "claimNumber"),
  };
}

