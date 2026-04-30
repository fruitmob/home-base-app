type NameParts = {
  displayName?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
};

const VIN_DISALLOWED_CHARACTERS = /[IOQ]/;

export function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeOptionalText(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const normalized = normalizeWhitespace(value);

  return normalized.length > 0 ? normalized : null;
}

export function normalizeRequiredText(value: string, field: string) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    throw new Error(`${field} is required.`);
  }

  return normalized;
}

export function normalizeEmail(value: string | null | undefined) {
  return normalizeOptionalText(value)?.toLowerCase() ?? null;
}

export function normalizePhone(value: string | null | undefined) {
  return normalizeOptionalText(value);
}

export function normalizeVin(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, "").toUpperCase() ?? "";

  return normalized.length > 0 ? normalized : null;
}

export function validateNormalizedVin(value: string | null) {
  if (value == null) {
    return null;
  }

  if (value.length !== 17) {
    throw new Error("VIN must be 17 characters.");
  }

  if (!/^[A-Z0-9]+$/.test(value)) {
    throw new Error("VIN can only contain letters and numbers.");
  }

  if (VIN_DISALLOWED_CHARACTERS.test(value)) {
    throw new Error("VIN cannot contain I, O, or Q.");
  }

  return value;
}

export function normalizeLicensePlate(value: string | null | undefined) {
  return normalizeOptionalText(value)?.toUpperCase() ?? null;
}

export function buildDisplayName(parts: NameParts, fallback = "Unnamed record") {
  const explicit = normalizeOptionalText(parts.displayName);

  if (explicit) {
    return explicit;
  }

  const company = normalizeOptionalText(parts.companyName);

  if (company) {
    return company;
  }

  const personName = [parts.firstName, parts.lastName]
    .map((part) => normalizeOptionalText(part))
    .filter(Boolean)
    .join(" ");

  if (personName) {
    return personName;
  }

  return normalizeOptionalText(parts.email) ?? normalizeOptionalText(parts.phone) ?? fallback;
}
