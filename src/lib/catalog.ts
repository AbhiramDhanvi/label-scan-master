import { supabase } from "@/integrations/supabase/client";
import type { Verdict } from "@/data/lmpc";

export type CatalogProduct = {
  id: string;
  code: string;
  product: string;
  category: string;
  mrp: number;
  netQuantity: string;
  quantityBase: number;
  unitSymbol: string;
  imported: boolean;
  labelImageUrl: string | null;
  verdict: Verdict;
  note: string;
  flagged: string[];
  createdAt: string;
};

export type CatalogLimit = {
  id: string;
  code: string;
  kind: string;
  title: string;
  requirement: string;
  minHeightMm: number | null;
  maxQuantityBase: number | null;
  toleranceValue: number | null;
  tolerancePercent: number | null;
  citation: string | null;
};

export type CatalogUnit = {
  id: string;
  symbol: string;
  label: string;
  kind: string;
  baseFactor: number;
};

export const fetchProducts = async (): Promise<CatalogProduct[]> => {
  const { data, error } = await supabase
    .from("lm_products")
    .select("*")
    .order("code", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    product: row.product,
    category: row.category,
    mrp: Number(row.mrp),
    netQuantity: row.net_quantity,
    quantityBase: Number(row.quantity_base),
    unitSymbol: row.unit_symbol,
    imported: row.imported,
    labelImageUrl: row.label_image_url,
    verdict: row.verdict as Verdict,
    note: row.note,
    flagged: row.flagged ?? [],
    createdAt: row.created_at,
  }));
};

export const fetchLimits = async (): Promise<CatalogLimit[]> => {
  const { data, error } = await supabase
    .from("lm_limits")
    .select("*")
    .order("code", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    kind: row.kind,
    title: row.title,
    requirement: row.requirement,
    minHeightMm: row.min_height_mm === null ? null : Number(row.min_height_mm),
    maxQuantityBase: row.max_quantity_base === null ? null : Number(row.max_quantity_base),
    toleranceValue: row.tolerance_value === null ? null : Number(row.tolerance_value),
    tolerancePercent: row.tolerance_percent === null ? null : Number(row.tolerance_percent),
    citation: row.citation,
  }));
};

export const fetchUnits = async (): Promise<CatalogUnit[]> => {
  const { data, error } = await supabase
    .from("lm_units")
    .select("*")
    .order("kind", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    symbol: row.symbol,
    label: row.label,
    kind: row.kind,
    baseFactor: Number(row.base_factor),
  }));
};

export type NewProduct = {
  code: string;
  product: string;
  category: string;
  mrp: number;
  netQuantity: string;
  quantityBase: number;
  unitSymbol: string;
  imported: boolean;
  labelImageUrl?: string | null;
};

export const addProduct = async (input: NewProduct) => {
  const { error } = await supabase.from("lm_products").insert({
    code: input.code,
    product: input.product,
    category: input.category,
    mrp: input.mrp,
    net_quantity: input.netQuantity,
    quantity_base: input.quantityBase,
    unit_symbol: input.unitSymbol,
    imported: input.imported,
    label_image_url: input.labelImageUrl ?? null,
    verdict: "REVIEW",
    note: "Awaiting first inspection.",
    flagged: [],
  });
  if (error) throw error;
};

export const addLimit = async (input: {
  code: string;
  kind: string;
  title: string;
  requirement: string;
  minHeightMm?: number | null;
  maxQuantityBase?: number | null;
  citation?: string | null;
}) => {
  const { error } = await supabase.from("lm_limits").insert({
    code: input.code,
    kind: input.kind,
    title: input.title,
    requirement: input.requirement,
    min_height_mm: input.minHeightMm ?? null,
    max_quantity_base: input.maxQuantityBase ?? null,
    citation: input.citation ?? null,
  });
  if (error) throw error;
};

export const addUnit = async (input: { symbol: string; label: string; kind: string; baseFactor: number }) => {
  const { error } = await supabase.from("lm_units").insert({
    symbol: input.symbol,
    label: input.label,
    kind: input.kind,
    base_factor: input.baseFactor,
  });
  if (error) throw error;
};

export type CatalogInspection = {
  id: string;
  localUid: string | null;
  productCode: string;
  inspectedOn: string;
  officer: string;
  site: string;
  batchNo: string;
  lotSize: string;
  verdict: Verdict;
  note: string;
  flagged: string[];
  status: string;
  labelImageUrl: string | null;
  faces: FacePhoto[];
  fields: StoredField[];
  findings: StoredFinding[];
  declaredBase: number | null;
  measuredBase: number | null;
  numeralHeightMm: number | null;
  measuredSource: string;
};

export type FacePhoto = { face: string; url: string | null; quality: number; regions: number };
export type StoredField = { key: string; label: string; value: string | null; confidence: number; language: string; face: string | null; detection: string };
export type StoredFinding = { code: string; declaration: string; status: string; detected: string; expected: string; reason: string; confidence: number; face: string | null };

export const fetchInspections = async (): Promise<CatalogInspection[]> => {
  const { data, error } = await supabase
    .from("lm_inspections")
    .select("*")
    .order("inspected_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    localUid: row.local_uid ?? null,
    productCode: row.product_code,
    inspectedOn: row.inspected_on,
    officer: row.officer,
    site: row.site,
    batchNo: row.batch_no,
    lotSize: row.lot_size,
    verdict: row.verdict as Verdict,
    note: row.note,
    flagged: row.flagged ?? [],
    status: row.status ?? "CLOSED",
    labelImageUrl: row.label_image_url,
    faces: (row.faces as FacePhoto[] | null) ?? [],
    fields: (row.fields as StoredField[] | null) ?? [],
    findings: (row.findings as StoredFinding[] | null) ?? [],
    declaredBase: row.declared_base === null ? null : Number(row.declared_base),
    measuredBase: row.measured_base === null ? null : Number(row.measured_base),
    numeralHeightMm: row.numeral_height_mm === null ? null : Number(row.numeral_height_mm),
    measuredSource: row.measured_source ?? "none",
  }));
};

/** Everything one inspection holds. Stored locally first, then synced. */
export type InspectionPayload = {
  uid: string;
  code: string;
  verdict: Verdict;
  note: string;
  flagged: string[];
  inspectedOn: string;
  officer: string;
  site: string;
  batchNo: string;
  lotSize: string;
  labelImageUrl: string | null;
  faces: FacePhoto[];
  fields: StoredField[];
  findings: StoredFinding[];
  declaredBase: number | null;
  measuredBase: number | null;
  numeralHeightMm: number | null;
  measuredSource: string;
  status: string;
  instrumentId: string | null;
  resolutionMm: number | null;
  resolutionG: number | null;
};

/** Pushes one inspection to the server. Safe to retry: the local UID is unique. */
export const pushInspection = async (input: InspectionPayload) => {
  const { error } = await supabase.from("lm_inspections").upsert(
    {
      local_uid: input.uid,
      product_code: input.code,
      inspected_on: input.inspectedOn || new Date().toISOString().slice(0, 10),
      officer: input.officer,
      site: input.site,
      batch_no: input.batchNo,
      lot_size: input.lotSize,
      verdict: input.verdict,
      note: input.note,
      flagged: input.flagged,
      label_image_url: input.labelImageUrl,
      faces: input.faces,
      fields: input.fields,
      findings: input.findings,
      declared_base: input.declaredBase,
      measured_base: input.measuredBase,
      numeral_height_mm: input.numeralHeightMm,
      measured_source: input.measuredSource,
      status: input.status,
    },
    { onConflict: "local_uid" },
  );
  if (error) throw error;

  const { data: known } = await supabase.from("lm_products").select("code").eq("code", input.code).maybeSingle();
  if (known) {
    const { error: updateError } = await supabase
      .from("lm_products")
      .update({
        verdict: input.verdict,
        note: input.note,
        flagged: input.flagged,
        ...(input.labelImageUrl ? { label_image_url: input.labelImageUrl } : {}),
      })
      .eq("code", input.code);
    if (updateError) throw updateError;
  }
};

export type Reinspection = {
  id: string;
  inspectionId: string | null;
  productCode: string;
  action: string;
  dueOn: string;
  state: string;
  note: string;
};

export const fetchReinspections = async (): Promise<Reinspection[]> => {
  const { data, error } = await supabase.from("lm_reinspections").select("*").order("due_on", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    inspectionId: row.inspection_id,
    productCode: row.product_code,
    action: row.action,
    dueOn: row.due_on,
    state: row.state,
    note: row.note,
  }));
};

export const createReinspection = async (input: { productCode: string; action: string; dueOn: string; note?: string }) => {
  const { error } = await supabase.from("lm_reinspections").insert({
    product_code: input.productCode,
    action: input.action,
    due_on: input.dueOn,
    note: input.note ?? "",
    state: "PENDING",
  });
  if (error) throw error;
};

export const setReinspectionState = async (id: string, state: string) => {
  const { error } = await supabase.from("lm_reinspections").update({ state }).eq("id", id);
  if (error) throw error;
};

// Stores one package-face photograph and returns a viewable link for it.
export const uploadLabelPhoto = async (file: File, code: string, face = "FACE") => {
  const key = `${code || "unassigned"}/${face}-${Date.now()}-${file.name.replace(/[^\w.-]+/g, "-")}`;
  const { error } = await supabase.storage.from("label-photos").upload(key, file, { upsert: false });
  if (error) throw error;
  const { data } = await supabase.storage.from("label-photos").createSignedUrl(key, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? null;
};

export const bandFor = (limits: CatalogLimit[], quantityBase: number) => {
  const bands = limits
    .filter((l) => l.kind === "font_band")
    .sort((a, b) => (a.maxQuantityBase ?? Infinity) - (b.maxQuantityBase ?? Infinity));
  return bands.find((b) => quantityBase <= (b.maxQuantityBase ?? Infinity)) ?? bands[bands.length - 1];
};
