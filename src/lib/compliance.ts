import { bandForQuantity, declarations, type Verdict } from "@/data/lmpc";
import type { LabelReading } from "@/lib/ocr.functions";

export type FieldResult = {
  code: string;
  declaration: string;
  requirement: string;
  read: string;
  verdict: Verdict;
  reason: string;
};

// Parse "1 kg", "500 ml", "250g" into a grams/millilitres base value.
export const parseQuantity = (value: string | null): number | null => {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/([\d.]+)\s*(kg|g|gm|grams?|l|ltr|litres?|ml)/i);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]!);
  if (Number.isNaN(amount)) return null;
  const unit = match[2]!.toLowerCase();
  if (unit === "kg" || unit.startsWith("l")) return amount * 1000;
  if (unit === "ml") return amount;
  return amount;
};

const present = (value: string | null): boolean => Boolean(value && value.trim().length > 1);

export function evaluateLabel(reading: LabelReading, opts: { imported: boolean; measuredMm?: number | undefined }): {
  fields: FieldResult[];
  verdict: Verdict;
  band: ReturnType<typeof bandForQuantity> | null;
  heightVerdict: Verdict;
} {
  const base = parseQuantity(reading.netQuantity);
  const band = base === null ? null : bandForQuantity(base);

  const make = (code: string, read: string | null, ok: boolean, failReason: string): FieldResult => {
    const meta = declarations.find((d) => d.code === code)!;
    const verdict: Verdict = ok ? "PASS" : present(read) ? "REVIEW" : "FAIL";
    return {
      code,
      declaration: meta.declaration,
      requirement: meta.requirement,
      read: present(read) ? read!.trim() : "not read",
      verdict,
      reason: ok ? "Declaration present and legible." : failReason,
    };
  };

  const fields: FieldResult[] = [
    make("LMPC-R6-MFR", reading.manufacturer, present(reading.manufacturer), "Manufacturer, packer or importer name and address not read on the label."),
    make("LMPC-R6-QTY", reading.netQuantity, base !== null, "Net quantity not read as a numeral with a standard unit."),
    make("LMPC-R6-MRP", reading.mrp, present(reading.mrp) && reading.taxClausePresent, present(reading.mrp) ? "MRP printed without the \"inclusive of all taxes\" clause." : "MRP not read on the label."),
    make("LMPC-R6-DATE", reading.manufactureDate, /\d{1,2}\s*[/\-.]\s*\d{2,4}/.test(reading.manufactureDate ?? ""), "Month and year of manufacture, packing or import not read in MM/YYYY form."),
    make("LMPC-R6-CARE", reading.consumerCare, present(reading.consumerCare), "Consumer care name, address and phone or email not read."),
    make("LMPC-R6-GEN", reading.genericName, present(reading.genericName), "Common or generic name of the commodity not read."),
  ];

  if (opts.imported) {
    fields.push(make("LMPC-R6-COO", reading.countryOfOrigin, present(reading.countryOfOrigin), "Country of origin not read; mandatory for imported pre-packaged commodities."));
  }

  const heightVerdict: Verdict =
    band === null || opts.measuredMm === undefined || Number.isNaN(opts.measuredMm)
      ? "REVIEW"
      : opts.measuredMm >= band.minHeightMm
        ? "PASS"
        : "FAIL";

  const verdict: Verdict = fields.some((f) => f.verdict === "FAIL") || heightVerdict === "FAIL"
    ? "FAIL"
    : fields.some((f) => f.verdict === "REVIEW") || heightVerdict === "REVIEW"
      ? "REVIEW"
      : "PASS";

  return { fields, verdict, band, heightVerdict };
}

export type ReportInput = {
  batch: { productCode: string; batchNo: string; lotSize: string; site: string; officer: string; date: string; imported: boolean; measuredMm: string };
  reading: LabelReading;
  result: ReturnType<typeof evaluateLabel>;
};

export function buildReport({ batch, reading, result }: ReportInput): string {
  const lines: string[] = [
    "METROGRAPH COMPLIANCE REPORT",
    "Standard: Legal Metrology (Packaged Commodities) Rules, 2011",
    "",
    "1. INSPECTION DETAILS",
    `Product code       : ${batch.productCode || reading.productCode || "not recorded"}`,
    `Product            : ${reading.productName ?? "not read"}`,
    `Batch / lot number : ${batch.batchNo || "not recorded"}`,
    `Lot size           : ${batch.lotSize || "not recorded"}`,
    `Inspection site    : ${batch.site || "not recorded"}`,
    `Officer            : ${batch.officer || "not recorded"}`,
    `Date               : ${batch.date}`,
    `Imported goods     : ${batch.imported ? "yes" : "no"}`,
    "",
    "2. OVERALL STATUS",
    `Verdict: ${result.verdict}`,
    "",
    "3. FIELD BY FIELD COMPARISON",
  ];

  for (const field of result.fields) {
    lines.push(
      `[${field.verdict}] ${field.code} — ${field.declaration}`,
      `        legal requirement : ${field.requirement}`,
      `        read from label   : ${field.read}`,
      `        finding           : ${field.reason}`,
    );
  }

  lines.push(
    "",
    "4. RULE 7 NUMERAL HEIGHT",
    result.band
      ? `Band ${result.band.code} — ${result.band.band}: minimum ${result.band.minHeightMm} mm`
      : "Band not determined because net quantity could not be read.",
    `Measured numeral height: ${batch.measuredMm ? `${batch.measuredMm} mm` : "not measured"}`,
    `Verdict: ${result.heightVerdict}`,
    "",
    "5. FLAGGED FIELDS",
    result.fields.filter((f) => f.verdict !== "PASS").map((f) => `${f.code} (${f.verdict}) — ${f.declaration}`).join("\n") || "None.",
    "",
    "6. TEXT READ FROM LABEL",
    reading.rawText || "No text captured.",
    "",
    "This report is indicative and requires verification by an authorised officer against the original package before any enforcement action.",
  );

  return lines.join("\n");
}
