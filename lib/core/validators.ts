import {
  AddressType,
  CustomerType,
  VendorType,
  VehicleNoteType,
  type AddressType as AddressTypeValue,
  type CustomerType as CustomerTypeValue,
  type VendorType as VendorTypeValue,
  type VehicleNoteType as VehicleNoteTypeValue,
} from "@/generated/prisma/client";
import {
  buildDisplayName,
  normalizeEmail,
  normalizeLicensePlate,
  normalizeOptionalText,
  normalizePhone,
  normalizeRequiredText,
  normalizeVin,
  validateNormalizedVin,
} from "@/lib/core/normalize";

export type RecordValue = Record<string, unknown>;

export class ValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join(" "));
    this.name = "ValidationError";
  }
}

export type NormalizedCustomerInput = {
  customerType: CustomerTypeValue;
  displayName: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  taxExempt: boolean;
  taxExemptId: string | null;
  defaultPaymentTerms: string | null;
  isWalkIn: boolean;
  notes: string | null;
};

export type NormalizedContactInput = {
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  notes: string | null;
};

export type NormalizedAddressInput = {
  type: AddressTypeValue;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
  isPrimary: boolean;
};

export type NormalizedVehicleInput = {
  vin: string | null;
  normalizedVin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  unitNumber: string | null;
  licensePlate: string | null;
  licenseState: string | null;
  currentMileage: number | null;
  color: string | null;
  notes: string | null;
};

export type NormalizedVehicleNoteInput = {
  type: VehicleNoteTypeValue;
  body: string;
};

export type NormalizedVehicleMileageInput = {
  value: number;
  source: string;
  recordedAt: Date;
  note: string | null;
};

export type NormalizedVendorInput = {
  vendorType: VendorTypeValue;
  name: string;
  accountNumber: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  defaultPaymentTerms: string | null;
  taxId: string | null;
  notes: string | null;
};

export function parseCustomerInput(input: unknown): NormalizedCustomerInput {
  const record = requireRecord(input);
  const customerType = parseEnum(record.customerType, CustomerType, "customerType", CustomerType.BUSINESS);
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
    customerType,
    displayName,
    companyName,
    firstName,
    lastName,
    email,
    phone,
    website: readOptionalString(record, "website"),
    taxExempt: readOptionalBoolean(record, "taxExempt", false),
    taxExemptId: readOptionalString(record, "taxExemptId"),
    defaultPaymentTerms: readOptionalString(record, "defaultPaymentTerms"),
    isWalkIn: readOptionalBoolean(record, "isWalkIn", false),
    notes: readOptionalString(record, "notes"),
  };
}

export function parseContactInput(input: unknown): NormalizedContactInput {
  const record = requireRecord(input);
  const firstName = readOptionalString(record, "firstName");
  const lastName = readOptionalString(record, "lastName");
  const email = normalizeEmail(readOptionalString(record, "email"));
  const phone = normalizePhone(readOptionalString(record, "phone"));
  const mobile = normalizePhone(readOptionalString(record, "mobile"));
  const displayName = buildDisplayName({
    displayName: readOptionalString(record, "displayName"),
    firstName,
    lastName,
    email,
    phone: mobile ?? phone,
  });

  return {
    firstName,
    lastName,
    displayName,
    title: readOptionalString(record, "title"),
    email,
    phone,
    mobile,
    isPrimary: readOptionalBoolean(record, "isPrimary", false),
    notes: readOptionalString(record, "notes"),
  };
}

export function parseAddressInput(input: unknown): NormalizedAddressInput {
  const record = requireRecord(input);

  return {
    type: parseEnum(record.type, AddressType, "type", AddressType.OTHER),
    label: readOptionalString(record, "label"),
    line1: readRequiredString(record, "line1"),
    line2: readOptionalString(record, "line2"),
    city: readRequiredString(record, "city"),
    state: readOptionalString(record, "state")?.toUpperCase() ?? null,
    postalCode: readOptionalString(record, "postalCode"),
    country: readOptionalString(record, "country")?.toUpperCase() ?? "US",
    isPrimary: readOptionalBoolean(record, "isPrimary", false),
  };
}

export function parseVehicleInput(input: unknown): NormalizedVehicleInput {
  const record = requireRecord(input);
  const vin = readOptionalString(record, "vin");
  const normalizedVin = validateVin(vin);

  return {
    vin,
    normalizedVin,
    year: readOptionalInteger(record, "year", { min: 1886, max: 2100 }),
    make: readOptionalString(record, "make"),
    model: readOptionalString(record, "model"),
    trim: readOptionalString(record, "trim"),
    unitNumber: readOptionalString(record, "unitNumber"),
    licensePlate: normalizeLicensePlate(readOptionalString(record, "licensePlate")),
    licenseState: readOptionalString(record, "licenseState")?.toUpperCase() ?? null,
    currentMileage: readOptionalInteger(record, "currentMileage", { min: 0 }),
    color: readOptionalString(record, "color"),
    notes: readOptionalString(record, "notes"),
  };
}

export function parseVehicleNoteInput(input: unknown): NormalizedVehicleNoteInput {
  const record = requireRecord(input);

  return {
    type: parseEnum(record.type, VehicleNoteType, "type", VehicleNoteType.GENERAL),
    body: readRequiredString(record, "body"),
  };
}

export function parseVehicleMileageInput(input: unknown): NormalizedVehicleMileageInput {
  const record = requireRecord(input);

  return {
    value: readRequiredInteger(record, "value", { min: 0 }),
    source: readRequiredString(record, "source"),
    recordedAt: readOptionalDate(record, "recordedAt") ?? new Date(),
    note: readOptionalString(record, "note"),
  };
}

export function parseVendorInput(input: unknown): NormalizedVendorInput {
  const record = requireRecord(input);
  const name = readRequiredString(record, "name");

  return {
    vendorType: parseEnum(record.vendorType, VendorType, "vendorType", VendorType.PARTS),
    name,
    accountNumber: readOptionalString(record, "accountNumber"),
    email: normalizeEmail(readOptionalString(record, "email")),
    phone: normalizePhone(readOptionalString(record, "phone")),
    website: readOptionalString(record, "website"),
    defaultPaymentTerms: readOptionalString(record, "defaultPaymentTerms"),
    taxId: readOptionalString(record, "taxId"),
    notes: readOptionalString(record, "notes"),
  };
}

function validateVin(vin: string | null) {
  try {
    return validateNormalizedVin(normalizeVin(vin));
  } catch (error) {
    throw new ValidationError([error instanceof Error ? error.message : "VIN is invalid."]);
  }
}

export function requireRecord(input: unknown): RecordValue {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError(["Request body must be a JSON object."]);
  }

  return input as RecordValue;
}

export function readOptionalString(record: RecordValue, field: string) {
  const value = record[field];

  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError([`${field} must be a string.`]);
  }

  return normalizeOptionalText(value);
}

export function readRequiredString(record: RecordValue, field: string) {
  const value = record[field];

  if (typeof value !== "string") {
    throw new ValidationError([`${field} is required.`]);
  }

  try {
    return normalizeRequiredText(value, field);
  } catch (error) {
    throw new ValidationError([error instanceof Error ? error.message : `${field} is required.`]);
  }
}

export function readOptionalBoolean(record: RecordValue, field: string, defaultValue: boolean) {
  const value = record[field];

  if (value == null) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw new ValidationError([`${field} must be a boolean.`]);
  }

  return value;
}

export function readOptionalInteger(
  record: RecordValue,
  field: string,
  options: { min?: number; max?: number } = {},
) {
  const value = record[field];

  if (value == null || value === "") {
    return null;
  }

  return validateInteger(value, field, options);
}

export function readRequiredInteger(
  record: RecordValue,
  field: string,
  options: { min?: number; max?: number } = {},
) {
  const value = record[field];

  if (value == null || value === "") {
    throw new ValidationError([`${field} is required.`]);
  }

  return validateInteger(value, field, options);
}

function validateInteger(value: unknown, field: string, options: { min?: number; max?: number }) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ValidationError([`${field} must be an integer.`]);
  }

  if (options.min != null && value < options.min) {
    throw new ValidationError([`${field} must be at least ${options.min}.`]);
  }

  if (options.max != null && value > options.max) {
    throw new ValidationError([`${field} must be no more than ${options.max}.`]);
  }

  return value;
}

export function readOptionalDecimal(
  record: RecordValue,
  field: string,
  options: { min?: number; max?: number } = {},
) {
  const value = record[field];

  if (value == null || value === "") {
    return null;
  }

  return validateDecimal(value, field, options);
}

export function readRequiredDecimal(
  record: RecordValue,
  field: string,
  options: { min?: number; max?: number } = {},
) {
  const value = record[field];

  if (value == null || value === "") {
    throw new ValidationError([`${field} is required.`]);
  }

  return validateDecimal(value, field, options);
}

function validateDecimal(value: unknown, field: string, options: { min?: number; max?: number }) {
  const parsed = coerceDecimal(value);

  if (!Number.isFinite(parsed)) {
    throw new ValidationError([`${field} must be a number.`]);
  }

  if (options.min != null && parsed < options.min) {
    throw new ValidationError([`${field} must be at least ${options.min}.`]);
  }

  if (options.max != null && parsed > options.max) {
    throw new ValidationError([`${field} must be no more than ${options.max}.`]);
  }

  return parsed;
}

function coerceDecimal(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: unknown }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }

  return Number.NaN;
}

export function readOptionalDate(record: RecordValue, field: string) {
  const value = record[field];

  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError([`${field} must be an ISO date string.`]);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError([`${field} must be a valid date.`]);
  }

  return date;
}

export function parseEnum<T extends Record<string, string>>(
  value: unknown,
  values: T,
  field: string,
  defaultValue: T[keyof T],
) {
  if (value == null || value === "") {
    return defaultValue;
  }

  if (typeof value !== "string") {
    throw new ValidationError([`${field} must be a string.`]);
  }

  const normalized = value.toUpperCase();
  const allowed = Object.values(values);

  if (!allowed.includes(normalized)) {
    throw new ValidationError([`${field} must be one of: ${allowed.join(", ")}.`]);
  }

  return normalized as T[keyof T];
}
