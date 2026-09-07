import { bandForQuantity, declarations, type FontBand, type Verdict } from "@/data/lmpc";
import type { Box, FaceKey, FaceReading, FieldKey } from "@/lib/ocr.functions";

/** Assessment status used by the rule engine. It is mapped onto the stored
 *  PASS / REVIEW / FAIL verdicts so existing records stay readable. */
export type Status = "COMPLIANT" | "POTENTIAL" | "REVIEW" | "NA";

export const statusVerdict = (status: Status): Verdict =>
  status === "COMPLIANT" ? "PASS" : status === "POTENTIAL" ? "FAIL" : status === "REVIEW" ? "REVIEW" : "PASS";

export const statusLabel = (status: Status) =>
  status === "COMPLIANT" ? "COMPLIANT" : status === "POTENTIAL" ? "POTENTIAL NON-COMPLIANT" : status === "REVIEW" ? "NEEDS REVIEW" : "NOT APPLICABLE";

export const statusClass = (status: Status) =>
  status === "COMPLIANT" ? "text-pass" : status === "POTENTIAL" ? "text-destructive" : status === "REVIEW" ? "text-warning" : "text-muted-foreground";

export const LOW_CONFIDENCE = 70;

export type ExtractedField = {
  key: FieldKey;
  label: string;
  value: string | null;
  confidence: number;
  language: string;
  face: FaceKey | null;
  box: Box | null;
  detection: "DETECTED" | "LOW CONFIDENCE" | "NOT DETECTED";
};

export type Finding = {
  code: string;
  declaration: string;
  requirement: string;
  detected: string;
  expected: string;
  status: Status;
  reason: string;
  confidence: number;
  face: FaceKey | null;
  box: Box | null;
};

export type Measurement = {
  declaredBase: number | null;
  measuredBase: number | null;
  unit: string;
  difference: number | null;
  toleranceBase: number | null;
  status: Status;
  source: "MANUAL MEASUREMENT" | "NOT MEASURED";
  note: string;
};

export type InspectionResult = {
  fields: ExtractedField[];
  findings: Finding[];
  band: FontBand | null;
  heightStatus: Status;
  heightReason: string;
  measurement: Measurement;
  status: Status;
  verdict: Verdict;
  regionCount: number;
  languages: string[];
  facesRead: FaceKey[];
  qualityWarnings: string[];
};

const FIELD_LABELS: Record<FieldKey, string> = {
  genericName: "Generic / common name",
  netQuantity: "Net quantity",
  mrp: "Maximum retail price",
  taxClause: "Inclusive of all taxes wording",
  manufacturer: "Manufacturer name and address",
  packer: "Packer name and address",
  importer: "Importer name and address",
  manufactureDate: "Month and year of manufacture / packing / import",
  consumerCare: "Consumer care detail",
  countryOfOrigin: "Country of origin",
};

const FIELD_ORDER = Object.keys(FIELD_LABELS) as FieldKey[];

/** Parses "1 kg", "500 ml", "250g", "2 L" into grams or millilitres. */
export const parseQuantity = (value: string | null): number | null => {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/([\d.]+)\s*(kg|g|gm|grams?|l|ltr|litres?|ml)\b/i);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]!);
  if (Number.isNaN(amount)) return null;
  const unit = match[2]!.toLowerCase();
  if (unit === "kg" || unit === "l" || unit === "ltr" || unit.startsWith("lit")) return amount * 1000;
  return amount;
};

export const quantityUnit = (value: string | null): string =>
  value && /ml|l\b|ltr|litre/i.test(value) ? "ml" : "g";

/** Maximum permissible error bands (Rule 2011 read with the Third Schedule),
 *  expressed against the declared quantity in g or ml. */
export const toleranceFor = (declaredBase: number): number => {
  if (declaredBase <= 50) return declaredBase * 0.09;
  if (declaredBase <= 100) return 4.5;
  if (declaredBase <= 200) return declaredBase * 0.045;
  if (declaredBase <= 300) return 9;
  if (declaredBase <= 500) return declaredBase * 0.03;
  if (declaredBase <= 1000) return 15;
  return declaredBase * 0.015;
};

/** Merges every captured face into one field set. A declaration is only ever
 *  reported as missing after all captured faces have been searched. */
export function mergeFaces(readings: FaceReading[]): ExtractedField[] {
  return FIELD_ORDER.map((key) => {
    let best: { read: FaceReading["fields"][FieldKey]; face: FaceKey } | null = null;
    for (const reading of readings) {
      const read = reading.fields[key];
      if (!read) continue;
      if (!best || read.confidence > (best.read?.confidence ?? 0)) best = { read, face: reading.face };
    }
    const value = best?.read?.value ?? null;
    const confidence = best?.read?.confidence ?? 0;
    return {
      key,
      label: FIELD_LABELS[key],
      value,
      confidence,
      language: best?.read?.language ?? "—",
      face: best?.face ?? null,
      box: best?.read?.box ?? null,
      detection: value === null ? "NOT DETECTED" : confidence < LOW_CONFIDENCE ? "LOW CONFIDENCE" : "DETECTED",
    } satisfies ExtractedField;
  });
}

const ruleMeta = (code: string) => declarations.find((d) => d.code === code);

export function evaluateInspection(input: {
  readings: FaceReading[];
  imported: boolean;
  measuredMm?: number | undefined;
  measuredQuantity?: number | undefined;
}): InspectionResult {
  const fields = mergeFaces(input.readings);
  const get = (key: FieldKey) => fields.find((f) => f.key === key)!;

  const declaredBase = parseQuantity(get("netQuantity").value);
  const unit = quantityUnit(get("netQuantity").value);
  const band = declaredBase === null ? null : bandForQuantity(declaredBase);

  const findings: Finding[] = [];

  const push = (code: string, source: ExtractedField, expected: string, ok: boolean, failReason: string, extra?: { status?: Status; detected?: string }) => {
    const meta = ruleMeta(code);
    const lowConfidence = source.detection === "LOW CONFIDENCE";
    const status: Status =
      extra?.status ??
      (source.value === null ? "POTENTIAL" : !ok ? "POTENTIAL" : lowConfidence ? "REVIEW" : "COMPLIANT");
    findings.push({
      code,
      declaration: meta?.declaration ?? source.label,
      requirement: meta?.requirement ?? expected,
      detected: extra?.detected ?? source.value ?? "not detected on any captured face",
      expected,
      status,
      reason:
        status === "COMPLIANT"
          ? "Declaration detected and legible."
          : status === "REVIEW"
            ? `Read at ${source.confidence}% confidence. Verify against the package.`
            : source.value === null
              ? failReason
              : failReason,
      confidence: source.confidence,
      face: source.face,
      box: source.box,
    });
  };

  const responsible = [get("manufacturer"), get("packer"), get("importer")]
    .filter((f) => f.value !== null)
    .sort((a, b) => b.confidence - a.confidence)[0] ?? get("manufacturer");
  push(
    "LMPC-R6-MFR",
    responsible,
    "Full name and complete address of the manufacturer, packer or importer",
    responsible.value !== null && responsible.value.length > 5,
    "Name and address of the manufacturer, packer or importer not detected on any captured face.",
  );

  push(
    "LMPC-R6-QTY",
    get("netQuantity"),
    "Net quantity as a numeral with a standard unit (g, kg, ml, L or count)",
    declaredBase !== null,
    "Net quantity not detected as a numeral with a standard unit.",
  );

  const mrp = get("mrp");
  const tax = get("taxClause");
  push(
    "LMPC-R6-MRP",
    mrp,
    "Single retail sale price with the wording \"inclusive of all taxes\"",
    mrp.value !== null && tax.value !== null,
    mrp.value === null
      ? "Retail sale price not detected on any captured face."
      : "\"Inclusive of all taxes\" wording not detected next to the printed price.",
    mrp.value !== null && tax.value === null ? { status: "POTENTIAL", detected: `${mrp.value} (tax wording not detected)` } : undefined,
  );

  const date = get("manufactureDate");
  push(
    "LMPC-R6-DATE",
    date,
    "Month and year of manufacture, packing or import, MM/YYYY at minimum",
    /\d{1,2}\s*[/\-.]\s*\d{2,4}/.test(date.value ?? "") || /[a-z]{3,}\s*\d{4}/i.test(date.value ?? ""),
    "Month and year of manufacture, packing or import not detected in a readable date form.",
  );

  push(
    "LMPC-R6-CARE",
    get("consumerCare"),
    "Name, address and telephone or email of consumer care",
    (get("consumerCare").value ?? "").length > 5,
    "Consumer care name, address and telephone or email not detected on any captured face.",
  );

  push(
    "LMPC-R6-GEN",
    get("genericName"),
    "Common or generic name of the commodity",
    (get("genericName").value ?? "").length > 1,
    "Common or generic name of the commodity not detected on any captured face.",
  );

  const coo = get("countryOfOrigin");
  if (input.imported) {
    push("LMPC-R6-COO", coo, "Country of origin, mandatory for imported pre-packaged commodities", coo.value !== null, "Country of origin not detected; mandatory for imported pre-packaged commodities.");
  } else {
    findings.push({
      code: "LMPC-R6-COO",
      declaration: ruleMeta("LMPC-R6-COO")?.declaration ?? "Country of origin",
      requirement: "Applies to imported pre-packaged commodities only",
      detected: coo.value ?? "not applicable",
      expected: "Not applicable to domestically packed goods",
      status: "NA",
      reason: "The package was not recorded as imported, so this rule does not apply.",
      confidence: coo.confidence,
      face: coo.face,
      box: coo.box,
    });
  }

  // Rule 7 numeral height.
  const measuredMm = input.measuredMm;
  const heightStatus: Status =
    band === null || measuredMm === undefined || Number.isNaN(measuredMm)
      ? "REVIEW"
      : measuredMm >= band.minHeightMm
        ? "COMPLIANT"
        : "POTENTIAL";
  const heightReason =
    band === null
      ? "Band cannot be selected because the net quantity was not detected."
      : measuredMm === undefined || Number.isNaN(measuredMm)
        ? "Numeral height not measured. Measure with a calibrated gauge or the reference card."
        : measuredMm >= band.minHeightMm
          ? `Measured ${measuredMm} mm against a minimum of ${band.minHeightMm} mm.`
          : `Measured ${measuredMm} mm against a minimum of ${band.minHeightMm} mm.`;

  // Physical quantity verification.
  const measuredQuantity = input.measuredQuantity;
  const tolerance = declaredBase === null ? null : toleranceFor(declaredBase);
  const difference = declaredBase !== null && measuredQuantity !== undefined && !Number.isNaN(measuredQuantity) ? measuredQuantity - declaredBase : null;
  const measurement: Measurement = {
    declaredBase,
    measuredBase: measuredQuantity !== undefined && !Number.isNaN(measuredQuantity) ? measuredQuantity : null,
    unit,
    difference,
    toleranceBase: tolerance,
    source: difference === null ? "NOT MEASURED" : "MANUAL MEASUREMENT",
    status:
      difference === null || tolerance === null
        ? "REVIEW"
        : difference < -tolerance
          ? "POTENTIAL"
          : "COMPLIANT",
    note:
      difference === null || tolerance === null
        ? "Actual quantity not measured, so the maximum permissible error could not be applied."
        : difference < -tolerance
          ? `Shortfall of ${Math.abs(difference).toFixed(1)} ${unit} exceeds the permissible error of ${tolerance.toFixed(1)} ${unit}.`
          : `Within the permissible error of ${tolerance.toFixed(1)} ${unit}.`,
  };

  const qualityWarnings = input.readings
    .filter((r) => r.quality.blurred || r.quality.glare || r.quality.score < LOW_CONFIDENCE)
    .map((r) => `${r.face}: ${[r.quality.blurred ? "blurred" : null, r.quality.glare ? "glare" : null, r.quality.score < LOW_CONFIDENCE ? `quality ${r.quality.score}%` : null].filter(Boolean).join(", ")}${r.quality.note ? ` (${r.quality.note})` : ""}`);

  const all: Status[] = [...findings.map((f) => f.status), heightStatus, measurement.status];
  const status: Status = all.includes("POTENTIAL") ? "POTENTIAL" : all.includes("REVIEW") || qualityWarnings.length > 0 ? "REVIEW" : "COMPLIANT";

  const languages = Array.from(
    new Set(input.readings.flatMap((r) => r.regions.map((region) => region.language)).filter((l) => l && l !== "—")),
  );

  return {
    fields,
    findings,
    band,
    heightStatus,
    heightReason,
    measurement,
    status,
    verdict: statusVerdict(status),
    regionCount: input.readings.reduce((sum, r) => sum + r.regions.length, 0),
    languages,
    facesRead: input.readings.map((r) => r.face),
    qualityWarnings,
  };
}

export function buildReport(input: {
  inspectionId: string;
  batch: { productCode: string; batchNo: string; lotSize: string; site: string; officer: string; date: string; imported: boolean; measuredMm: string };
  result: InspectionResult;
  readings: FaceReading[];
  synced: boolean;
}) {
  const { batch, result } = input;
  const lines = [
    "PRAMANA — SMART LEGAL METROLOGY INSPECTION REPORT",
    "Legal Metrology (Packaged Commodities) Rules, 2011",
    "",
    "1. INSPECTION",
    `Inspection ID     : ${input.inspectionId}`,
    `Product code      : ${batch.productCode || "not recorded"}`,
    `Batch / lot no.   : ${batch.batchNo || "not recorded"}`,
    `Lot size          : ${batch.lotSize || "not recorded"}`,
    `Site              : ${batch.site || "not recorded"}`,
    `Officer           : ${batch.officer || "not recorded"}`,
    `Date              : ${batch.date || "not recorded"}`,
    `Imported goods    : ${batch.imported ? "yes" : "no"}`,
    `Record state      : ${input.synced ? "synced to the server" : "held locally, pending sync"}`,
    "",
    "2. PACKAGE FACES SCANNED",
    ...input.readings.map((r) => `${r.face.padEnd(6)} quality ${r.quality.score}%${r.quality.blurred ? ", blurred" : ""}${r.quality.glare ? ", glare" : ""} — ${r.regions.length} text regions`),
    input.readings.length === 0 ? "None captured." : "",
    "3. OVERALL ASSESSMENT",
    `Status            : ${statusLabel(result.status)}`,
    `Stored verdict    : ${result.verdict}`,
    `Text regions      : ${result.regionCount}`,
    `Languages read    : ${result.languages.join(", ") || "not determined"}`,
    "",
    "4. EXTRACTED DECLARATIONS",
    ...result.fields.map((f) => `[${f.detection}] ${f.label}: ${f.value ?? "—"} (confidence ${f.confidence}%, face ${f.face ?? "—"}, ${f.language})`),
    "",
    "5. RULE VALIDATION",
  ];

  for (const finding of result.findings) {
    lines.push(
      `[${statusLabel(finding.status)}] ${finding.code} — ${finding.declaration}`,
      `        requirement : ${finding.requirement}`,
      `        detected    : ${finding.detected}`,
      `        expected    : ${finding.expected}`,
      `        evidence    : ${finding.face ? `${finding.face} face, confidence ${finding.confidence}%` : "no image evidence"}`,
      `        finding     : ${finding.reason}`,
    );
  }

  lines.push(
    "",
    "6. RULE 7 NUMERAL HEIGHT",
    result.band ? `Band ${result.band.code} — ${result.band.band}: minimum ${result.band.minHeightMm} mm` : "Band not selected.",
    `Measured: ${batch.measuredMm ? `${batch.measuredMm} mm` : "not measured"}`,
    `Status: ${statusLabel(result.heightStatus)} — ${result.heightReason}`,
    "",
    "7. PHYSICAL QUANTITY VERIFICATION",
    `Declared: ${result.measurement.declaredBase === null ? "not detected" : `${result.measurement.declaredBase} ${result.measurement.unit}`}`,
    `Measured: ${result.measurement.measuredBase === null ? "not measured" : `${result.measurement.measuredBase} ${result.measurement.unit} (${result.measurement.source})`}`,
    `Difference: ${result.measurement.difference === null ? "—" : `${result.measurement.difference > 0 ? "+" : ""}${result.measurement.difference.toFixed(1)} ${result.measurement.unit}`}`,
    `Status: ${statusLabel(result.measurement.status)} — ${result.measurement.note}`,
    "",
    "8. IMAGE QUALITY WARNINGS",
    result.qualityWarnings.join("\n") || "None.",
    "",
    "9. TEXT READ FROM THE PACKAGE",
    ...input.readings.map((r) => `--- ${r.face} ---\n${r.rawText || "No text captured."}`),
    "",
    "This report is machine assisted. Final verification by an authorised officer is required before any enforcement action.",
  );

  return lines.filter((line) => line !== "").join("\n");
}
