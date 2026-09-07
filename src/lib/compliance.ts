import { bandForQuantity as staticBandForQuantity, declarations, type FontBand, type Verdict } from "@/data/lmpc";
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
export const MIN_REGIONS_PER_FACE = 3;

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
  uncertaintyG: number | null;
  uncertaintyMm: number | null;
  status: Status;
  source: string;
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
  conflicts: Conflict[];
  instrumentId: string | null;
  measurementSource: string;
};

export type LimitRow = {
  code: string;
  kind: string;
  title?: string;
  minHeightMm: number | null;
  maxQuantityBase: number | null;
  toleranceValue: number | null;
  tolerancePercent: number | null;
};

export type ParsedQuantity = {
  value: number | null;
  unit: "g" | "ml" | "count" | null;
  raw: string | null;
  approx: boolean;
  compound: boolean;
  note: string;
};

export type Conflict = {
  key: FieldKey;
  label: string;
  readings: { face: FaceKey; value: string; confidence: number }[];
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

const normalizeText = (value: string | null) =>
  (value ?? "")
    .toLowerCase()
    .replace(/[\s,\-_./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Parses "1 kg", "500 ml", "250g", "2 L", "5 pcs", "2 x 1 L", "~1 kg",
 *  "500 g + 50 g free" into grams, millilitres or counts. */
export const parseQuantity = (value: string | null): ParsedQuantity => {
  if (!value) return { value: null, unit: null, raw: null, approx: false, compound: false, note: "Not detected." };
  const raw = value.trim();
  const approx = /\b(approx|approximately|~|about|around|nearly)\b/i.test(raw);

  // Compound: "2 x 1 L" or "2 * 1 kg" or "500 g + 50 g free".
  const compoundMatch = raw.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*([\d.,]+)\s*(kg|g|gm|grams?|l|ltr|litres?|ml|pcs?|pieces?|units?)/i);
  if (compoundMatch) {
    const count = Number.parseFloat(compoundMatch[1]!);
    const amount = Number.parseFloat(compoundMatch[2]!.replace(/,/g, ""));
    const unit = compoundMatch[3]!.toLowerCase();
    const base = unit.startsWith("kg") || unit.startsWith("l") || unit.startsWith("ltr") || unit.startsWith("lit") ? amount * 1000 : amount;
    const total = count * base;
    const isCount = /pcs?|pieces?|units?|n\b/.test(unit);
    return {
      value: total,
      unit: isCount ? "count" : /ml|l\b|ltr|litre/.test(unit) ? "ml" : "g",
      raw,
      approx,
      compound: true,
      note: `Compound quantity: ${count} × ${amount} ${unit} = ${total} ${isCount ? "pcs" : unit}.`,
    };
  }

  const plusMatch = raw.match(/([\d.,]+)\s*(kg|g|gm|grams?|l|ltr|litres?|ml|pcs?|pieces?|units?)\s*\+\s*([\d.,]+)\s*(kg|g|gm|grams?|l|ltr|litres?|ml|pcs?|pieces?|units?)/i);
  if (plusMatch) {
    const amount1 = Number.parseFloat(plusMatch[1]!.replace(/,/g, ""));
    const unit1 = plusMatch[2]!.toLowerCase();
    const amount2 = Number.parseFloat(plusMatch[3]!.replace(/,/g, ""));
    const unit2 = plusMatch[4]!.toLowerCase();
    const toBase = (u: string, a: number) => (u.startsWith("kg") || u.startsWith("l") || u.startsWith("ltr") || u.startsWith("lit") ? a * 1000 : a);
    const base1 = toBase(unit1, amount1);
    const base2 = toBase(unit2, amount2);
    const total = base1 + base2;
    const isCount = /pcs?|pieces?|units?|n\b/.test(unit1);
    return {
      value: total,
      unit: isCount ? "count" : /ml|l\b|ltr|litre/.test(unit1) ? "ml" : "g",
      raw,
      approx,
      compound: true,
      note: `Compound quantity: ${amount1} ${unit1} + ${amount2} ${unit2} = ${total}.`,
    };
  }

  const match = raw.replace(/,/g, "").match(/([\d.]+)\s*(kg|g|gm|grams?|l|ltr|litres?|ml|pcs?|pieces?|units?|n)\b/i);
  if (!match) return { value: null, unit: null, raw, approx, compound: false, note: "No quantity pattern recognised." };
  const amount = Number.parseFloat(match[1]!);
  if (Number.isNaN(amount)) return { value: null, unit: null, raw, approx, compound: false, note: "Numeric part could not be parsed." };
  const unit = match[2]!.toLowerCase();
  const isCount = /pcs?|pieces?|units?|n\b/.test(unit);
  if (isCount) return { value: amount, unit: "count", raw, approx, compound: false, note: `Count unit: ${amount} pcs.` };
  const base = unit.startsWith("kg") || unit === "l" || unit.startsWith("ltr") || unit.startsWith("lit") ? amount * 1000 : amount;
  return {
    value: base,
    unit: /ml|l\b|ltr|litre/.test(unit) ? "ml" : "g",
    raw,
    approx,
    compound: false,
    note: `${amount} ${unit} = ${base} ${/ml|l\b|ltr|litre/.test(unit) ? "ml" : "g"}.`,
  };
};

export const quantityUnit = (value: string | null): string => {
  const parsed = parseQuantity(value);
  if (parsed.unit) return parsed.unit;
  return value && /ml|l\b|ltr|litre/i.test(value) ? "ml" : "g";
};

/** Parses an Indian MRP string such as "₹125", "Rs. 1,25,000/-", "2500/-" into a number. */
export const parseMRP = (value: string | null): number | null => {
  if (!value) return null;
  const cleaned = value.replace(/[₹,Rs.\s\-/]+/gi, "").replace(/,/g, "");
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]!);
  return Number.isNaN(amount) ? null : amount;
};

/** Maximum permissible error bands (Rule 2011 read with the Third Schedule),
 *  expressed against the declared quantity in g or ml. Falls back to stored
 *  legal limits when they are supplied. */
export const toleranceFor = (declaredBase: number, limits?: LimitRow[]): number => {
  if (limits?.length) {
    const rows = limits
      .filter((l) => l.kind === "tolerance")
      .sort((a, b) => (a.maxQuantityBase ?? Infinity) - (b.maxQuantityBase ?? Infinity));
    const row = rows.find((r) => declaredBase <= (r.maxQuantityBase ?? Infinity)) ?? rows[rows.length - 1];
    if (row) {
      if (row.toleranceValue !== null && row.toleranceValue !== undefined) return row.toleranceValue;
      if (row.tolerancePercent !== null && row.tolerancePercent !== undefined) return declaredBase * row.tolerancePercent;
    }
  }
  if (declaredBase <= 50) return declaredBase * 0.09;
  if (declaredBase <= 100) return 4.5;
  if (declaredBase <= 200) return declaredBase * 0.045;
  if (declaredBase <= 300) return 9;
  if (declaredBase <= 500) return declaredBase * 0.03;
  if (declaredBase <= 1000) return 15;
  return declaredBase * 0.015;
};

/** Selects the Rule 7 numeral-height band from stored limits when available. */
export const bandForQuantity = (grammesOrMl: number, limits?: LimitRow[]): FontBand => {
  if (limits?.length) {
    const rows = limits
      .filter((l) => l.kind === "font_band")
      .sort((a, b) => (a.maxQuantityBase ?? Infinity) - (b.maxQuantityBase ?? Infinity));
    const row = rows.find((r) => grammesOrMl <= (r.maxQuantityBase ?? Infinity)) ?? rows[rows.length - 1];
    if (row) {
      return {
        code: row.code,
        band: row.title ?? row.code,
        minHeightMm: row.minHeightMm ?? 0,
        maxQuantity: row.maxQuantityBase ?? Infinity,
      };
    }
  }
  return staticBandForQuantity(grammesOrMl);
};

/** Detects conflicting values for the same declaration across captured faces. */
export function findConflicts(readings: FaceReading[]): Conflict[] {
  const conflicts: Conflict[] = [];
  for (const key of FIELD_ORDER) {
    const values = readings
      .filter((r) => r.fields[key]?.value)
      .map((r) => ({ face: r.face, value: r.fields[key]!.value.trim(), confidence: r.fields[key]!.confidence }));
    if (values.length < 2) continue;
    const normalized = values.map((v) => normalizeText(v.value));
    const distinct = Array.from(new Set(normalized));
    if (distinct.length > 1) {
      conflicts.push({ key, label: FIELD_LABELS[key], readings: values });
    }
  }
  return conflicts;
}

/** Merges every captured face into one field set. A declaration is only ever
 *  reported as missing after all captured faces have been searched. */
export function mergeFaces(readings: FaceReading[]): ExtractedField[] {
  return FIELD_ORDER.map((key) => {
    let best: { read: NonNullable<FaceReading["fields"][FieldKey]>; face: FaceKey } | null = null;
    for (const reading of readings) {
      const read = reading.fields[key];
      if (!read) continue;
      if (!best || read.confidence > (best.read.confidence ?? 0)) best = { read, face: reading.face };
    }
    const value = best?.read.value ?? null;
    const confidence = best?.read.confidence ?? 0;
    return {
      key,
      label: FIELD_LABELS[key],
      value,
      confidence,
      language: best?.read.language ?? "—",
      face: best?.face ?? null,
      box: best?.read.box ?? null,
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
  resolutionMm?: number | undefined;
  resolutionG?: number | undefined;
  measurementSource?: string | undefined;
  instrumentId?: string | undefined;
  limits?: LimitRow[] | undefined;
}): InspectionResult {
  const fields = mergeFaces(input.readings);
  const get = (key: FieldKey) => fields.find((f) => f.key === key)!;

  const parsedQty = parseQuantity(get("netQuantity").value);
  const declaredBase = parsedQty.value;
  const unit = parsedQty.unit ?? "g";
  const band = declaredBase === null ? null : bandForQuantity(declaredBase, input.limits);
  const conflicts = findConflicts(input.readings);

  const findings: Finding[] = [];

  const push = (code: string, source: ExtractedField, expected: string, ok: boolean, failReason: string, extra?: { status?: Status; detected?: string }) => {
    const meta = ruleMeta(code);
    const lowConfidence = source.detection === "LOW CONFIDENCE";
    const conflict = conflicts.find((c) => c.key === code as FieldKey);
    let status: Status =
      extra?.status ??
      (source.value === null ? "POTENTIAL" : !ok ? "POTENTIAL" : lowConfidence ? "REVIEW" : "COMPLIANT");
    if (conflict && status === "COMPLIANT") status = "REVIEW";
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
            ? conflict
              ? `Conflicting values across faces: ${conflict.readings.map((r) => `${r.face}=${r.value}`).join(", ")}. Verify against the package.`
              : `Read at ${source.confidence}% confidence. Verify against the package.`
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
    parsedQty.note?.includes("No quantity pattern")
      ? "Net quantity not detected as a numeral with a standard unit."
      : `Net quantity parsed as ${declaredBase ?? "—"} ${unit}. ${parsedQty.note}`,
    declaredBase !== null && parsedQty.approx ? { status: "REVIEW", detected: `${get("netQuantity").value} (approximate)` } : undefined,
  );

  const mrp = get("mrp");
  const tax = get("taxClause");
  const mrpAmount = parseMRP(mrp.value);
  push(
    "LMPC-R6-MRP",
    mrp,
    "Single retail sale price with the wording \"inclusive of all taxes\"",
    mrp.value !== null && tax.value !== null && mrpAmount !== null,
    mrp.value === null
      ? "Retail sale price not detected on any captured face."
      : mrpAmount === null
        ? "Retail sale price detected but could not be read as a number."
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

  // Rule 7 numeral height with instrument uncertainty.
  const measuredMm = input.measuredMm;
  const resolutionMm = input.resolutionMm;
  const uncertaintyMm = typeof resolutionMm === "number" && !Number.isNaN(resolutionMm) ? resolutionMm / 2 : 0.5;
  const heightStatus: Status =
    band === null || measuredMm === undefined || Number.isNaN(measuredMm)
      ? "REVIEW"
      : measuredMm - uncertaintyMm >= band.minHeightMm
        ? "COMPLIANT"
        : measuredMm + uncertaintyMm < band.minHeightMm
          ? "POTENTIAL"
          : "REVIEW";
  const heightReason =
    band === null
      ? "Band cannot be selected because the net quantity was not detected."
      : measuredMm === undefined || Number.isNaN(measuredMm)
        ? "Numeral height not measured. Measure with a calibrated gauge or the reference card."
        : measuredMm - uncertaintyMm >= band.minHeightMm
          ? `Measured ${measuredMm}±${uncertaintyMm} mm against a minimum of ${band.minHeightMm} mm.`
          : measuredMm + uncertaintyMm < band.minHeightMm
            ? `Measured ${measuredMm}±${uncertaintyMm} mm against a minimum of ${band.minHeightMm} mm.`
            : `Measured ${measuredMm}±${uncertaintyMm} mm is within the instrument uncertainty of the ${band.minHeightMm} mm minimum.`;

  // Physical quantity verification with uncertainty.
  const measuredQuantity = input.measuredQuantity;
  const resolutionG = input.resolutionG;
  const uncertaintyG = typeof resolutionG === "number" && !Number.isNaN(resolutionG) ? resolutionG / 2 : null;
  const tolerance = declaredBase === null ? null : toleranceFor(declaredBase, input.limits);
  const difference = declaredBase !== null && measuredQuantity !== undefined && !Number.isNaN(measuredQuantity) ? measuredQuantity - declaredBase : null;
  const source = input.measurementSource && input.measurementSource !== "NOT MEASURED" ? input.measurementSource : "NOT MEASURED";

  let measurementStatus: Status;
  let measurementNote: string;
  if (difference === null || tolerance === null || measuredQuantity === undefined || Number.isNaN(measuredQuantity) || declaredBase === null) {
    measurementStatus = "REVIEW";
    measurementNote = "Actual quantity not measured, so the maximum permissible error could not be applied.";
  } else {
    const lowerBound = uncertaintyG !== null ? measuredQuantity - uncertaintyG : measuredQuantity;
    const upperBound = uncertaintyG !== null ? measuredQuantity + uncertaintyG : measuredQuantity;
    if (lowerBound < declaredBase - tolerance) {
      measurementStatus = "POTENTIAL";
      measurementNote = `Shortfall of ${Math.abs(difference).toFixed(1)} ${unit} exceeds the permissible error of ${tolerance.toFixed(1)} ${unit}.`;
    } else if (upperBound >= declaredBase - tolerance) {
      measurementStatus = "COMPLIANT";
      measurementNote = `Within the permissible error of ${tolerance.toFixed(1)} ${unit}.`;
    } else {
      measurementStatus = "REVIEW";
      measurementNote = `Measured value is within the instrument uncertainty band around the tolerance limit.`;
    }
  }

  const measurement: Measurement = {
    declaredBase,
    measuredBase: measuredQuantity !== undefined && !Number.isNaN(measuredQuantity) ? measuredQuantity : null,
    unit,
    difference,
    toleranceBase: tolerance,
    uncertaintyG,
    uncertaintyMm: typeof resolutionMm === "number" && !Number.isNaN(resolutionMm) ? resolutionMm / 2 : null,
    source,
    status: measurementStatus,
    note: measurementNote,
  };

  // Unit consistency check between declared and measured quantities.
  if (measuredQuantity !== undefined && !Number.isNaN(measuredQuantity) && declaredBase !== null && unit) {
    const measuredLabel = unit === "ml" ? "millilitres" : unit === "g" ? "grams" : "count";
    const expectedLabel = unit === "ml" ? "millilitres" : unit === "g" ? "grams" : "count";
    if (measuredLabel !== expectedLabel) {
      findings.push({
        code: "LMPC-QTY-UNIT",
        declaration: "Quantity unit consistency",
        requirement: `Measured unit must match declared unit (${expectedLabel})`,
        detected: measuredLabel,
        expected: expectedLabel,
        status: "REVIEW",
        reason: "The unit used for the manual measurement does not match the declared quantity unit.",
        confidence: 0,
        face: null,
        box: null,
      });
    }
  }

  const qualityWarnings = input.readings
    .filter((r) => r.quality.blurred || r.quality.glare || r.quality.score < LOW_CONFIDENCE || r.regions.length < MIN_REGIONS_PER_FACE)
    .map((r) => `${r.face}: ${[r.quality.blurred ? "blurred" : null, r.quality.glare ? "glare" : null, r.quality.score < LOW_CONFIDENCE ? `quality ${r.quality.score}%` : null, r.regions.length < MIN_REGIONS_PER_FACE ? `only ${r.regions.length} regions` : null].filter(Boolean).join(", ")}${r.quality.note ? ` (${r.quality.note})` : ""}`);

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
    conflicts,
    instrumentId: input.instrumentId ?? null,
    measurementSource: source,
  };
}

export function buildReport(input: {
  inspectionId: string;
  batch: { productCode: string; batchNo: string; lotSize: string; site: string; officer: string; date: string; imported: boolean; measuredMm: string; measuredQuantity: string; instrumentId: string; measurementSource: string };
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
    `Instrument ID     : ${batch.instrumentId || "not recorded"}`,
    `Measurement source: ${batch.measurementSource || "not recorded"}`,
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
    `Tolerance: ${result.measurement.toleranceBase === null ? "—" : `${result.measurement.toleranceBase.toFixed(1)} ${result.measurement.unit}`}`,
    `Uncertainty: ${result.measurement.uncertaintyG === null ? "—" : `±${result.measurement.uncertaintyG.toFixed(2)} ${result.measurement.unit}`}`,
    `Status: ${statusLabel(result.measurement.status)} — ${result.measurement.note}`,
    "",
    "8. IMAGE QUALITY WARNINGS",
    result.qualityWarnings.join("\n") || "None.",
    "",
    "9. CROSS-FACE CONFLICTS",
    result.conflicts.length === 0
      ? "None."
      : result.conflicts.map((c) => `${c.label}: ${c.readings.map((r) => `${r.face}=${r.value}`).join(", ")}`).join("\n"),
    "",
    "10. TEXT READ FROM THE PACKAGE",
    ...input.readings.map((r) => `--- ${r.face} ---\n${r.rawText || "No text captured."}`),
    "",
    "This report is machine assisted. Final verification by an authorised officer is required before any enforcement action.",
  );

  return lines.filter((line) => line !== "").join("\n");
}
