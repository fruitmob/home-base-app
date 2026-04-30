import type { DashboardMetric, DashboardRow } from "./dashboard";

const CRLF = "\r\n";

export type CsvCellValue = string | number | Date | boolean | null | undefined;

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => CsvCellValue;
};

export type CsvReportSectionRow = {
  label: string;
  value: string;
  detail?: string;
};

export type CsvReportSection = {
  title: string;
  description?: string;
  rows: readonly CsvReportSectionRow[];
};

export function formatCsvCell(value: CsvCellValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  const raw =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "number"
        ? Number.isFinite(value)
          ? String(value)
          : ""
        : typeof value === "boolean"
          ? value
            ? "true"
            : "false"
          : value;

  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }

  return raw;
}

function formatRow(cells: readonly CsvCellValue[]): string {
  return cells.map(formatCsvCell).join(",");
}

export function rowsToCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
): string {
  const headerLine = formatRow(columns.map((c) => c.header));
  const bodyLines = rows.map((row) => formatRow(columns.map((c) => c.value(row))));
  return [headerLine, ...bodyLines].join(CRLF) + CRLF;
}

export function sectionsToCsv(
  reportTitle: string,
  generatedAt: Date,
  sections: readonly CsvReportSection[],
): string {
  const lines: string[] = [];
  lines.push(formatRow(["Report", reportTitle]));
  lines.push(formatRow(["Generated", generatedAt]));
  lines.push("");

  for (const section of sections) {
    lines.push(formatRow([section.title]));
    if (section.description) {
      lines.push(formatRow([section.description]));
    }
    lines.push(formatRow(["Label", "Value", "Detail"]));
    if (section.rows.length === 0) {
      lines.push(formatRow(["(no rows)"]));
    } else {
      for (const row of section.rows) {
        lines.push(formatRow([row.label, row.value, row.detail ?? ""]));
      }
    }
    lines.push("");
  }

  return lines.join(CRLF);
}

export function csvFilename(slug: string, generatedAt: Date): string {
  return exportFilename(slug, generatedAt, "csv");
}

export function pdfFilename(slug: string, generatedAt: Date): string {
  return exportFilename(slug, generatedAt, "pdf");
}

function exportFilename(slug: string, generatedAt: Date, extension: string): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = generatedAt.getUTCFullYear();
  const mo = pad(generatedAt.getUTCMonth() + 1);
  const d = pad(generatedAt.getUTCDate());
  const h = pad(generatedAt.getUTCHours());
  const mi = pad(generatedAt.getUTCMinutes());
  const safeSlug = slug.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `homebase-${safeSlug}-${y}${mo}${d}-${h}${mi}.${extension}`;
}

export function dashboardItemsToRows(
  items: readonly (DashboardMetric | DashboardRow)[],
): CsvReportSectionRow[] {
  return items.map((item) => ({
    label: item.label,
    value: item.value,
    detail: item.detail,
  }));
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
