type DecimalLike = { toNumber(): number } | number | string | null | undefined;

const MONEY_SCALE = 4;
const MONEY_EPSILON = 0.5 / 10 ** MONEY_SCALE;

export function toNumber(value: DecimalLike): number {
  if (value == null || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === "object" && typeof value.toNumber === "function") {
    const parsed = value.toNumber();

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function round(value: DecimalLike, decimals = MONEY_SCALE): number {
  const raw = toNumber(value);
  const factor = 10 ** decimals;
  const shifted = raw * factor;
  const rounded = shifted >= 0 ? Math.floor(shifted + 0.5) : -Math.floor(-shifted + 0.5);

  return rounded / factor;
}

export function sum(values: readonly DecimalLike[]): number {
  let total = 0;

  for (let i = 0; i < values.length; i += 1) {
    total += toNumber(values[i]);
  }

  return round(total);
}

export function lineTotal(quantity: DecimalLike, unitPrice: DecimalLike): number {
  return round(toNumber(quantity) * toNumber(unitPrice));
}

export function formatCurrency(value: DecimalLike, locale = "en-US", currency = "USD"): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(round(value, 2));
}

export function isNonNegative(value: DecimalLike): boolean {
  return toNumber(value) >= -MONEY_EPSILON;
}

export function isPositive(value: DecimalLike): boolean {
  return toNumber(value) > MONEY_EPSILON;
}
