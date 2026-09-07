import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, FileDown, Loader2, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FACES, readFace, type Box, type FaceKey, type FaceReading } from "@/lib/ocr.functions";
import { buildReport, evaluateInspection, statusClass, statusLabel, type LimitRow } from "@/lib/compliance";
import {
  createReinspection,
  fetchLimits,
  fetchProducts,
  pushInspection,
  uploadLabelPhoto,
  type FacePhoto,
  type InspectionPayload,
} from "@/lib/catalog";
import { flushQueue, newId, pending, readQueue, saveLocal, type LocalInspection } from "@/lib/offline";
import { autoEnhance, preprocessImage, readOrientation } from "@/lib/image-preprocess";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "New Inspection | DharmaLens Legal Metrology" },
    { name: "description", content: "Scan every face of a pre-packaged commodity, extract the printed declarations, validate them against the Packaged Commodities Rules, 2011 and record the evidence, online or offline." },
    { property: "og:title", content: "New Inspection | DharmaLens Legal Metrology" },
    { property: "og:description", content: "Multi-face package scanning, declaration extraction, rule validation and image evidence for legal metrology inspections." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

const field = "bg-background px-2.5 py-1.5 text-[13px] outline outline-border";
const legend = "font-mono text-[10px] uppercase text-muted-foreground";
const select = `${field} appearance-none`;

const MEASUREMENT_SOURCES = [
  "NOT MEASURED",
  "CALIBRATED GAUGE",
  "WEIGHING SCALE",
  "REFERENCE CARD",
  "VISUAL ESTIMATE",
];

type Captured = {
  file: File;
  url: string;
  dataUrl: string;
  enhancedUrl?: string;
  enhancedDataUrl?: string;
  orientation?: number;
  enhance: boolean;
  corners?: { x: number; y: number }[];
};

function Index() {
  const runFace = useServerFn(readFace);
  const catalog = useQuery({ queryKey: ["lm_products"], queryFn: fetchProducts });
  const limits = useQuery({ queryKey: ["lm_limits"], queryFn: fetchLimits });

  const [uid, setUid] = useState("");
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<LocalInspection[]>([]);
  const [captures, setCaptures] = useState<Partial<Record<FaceKey, Captured>>>({});
  const [readings, setReadings] = useState<FaceReading[]>([]);
  const [progress, setProgress] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [evidence, setEvidence] = useState<{ face: FaceKey; box: Box | null; caption: string }>();
  const [savedUid, setSavedUid] = useState<string>();
  const [batch, setBatch] = useState({
    productCode: "",
    batchNo: "",
    lotSize: "",
    site: "",
    officer: "",
    date: "",
    imported: false,
    measuredMm: "",
    measuredQuantity: "",
    instrumentId: "",
    measurementSource: "NOT MEASURED",
    resolutionMm: "",
    resolutionG: "",
  });

  useEffect(() => {
    setUid(newId());
    setQueue(readQueue());
    setBatch((prev) => (prev.date ? prev : { ...prev, date: new Date().toISOString().slice(0, 10) }));
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const known = catalog.data?.find((p) => p.code === batch.productCode);

  const limitRows: LimitRow[] | undefined = useMemo(() => {
    if (!limits.data) return undefined;
    return limits.data.map((l) => ({
      code: l.code,
      kind: l.kind,
      title: l.title,
      minHeightMm: l.minHeightMm,
      maxQuantityBase: l.maxQuantityBase,
      toleranceValue: l.toleranceValue,
      tolerancePercent: l.tolerancePercent,
    }));
  }, [limits.data]);

  const result = useMemo(
    () =>
      readings.length > 0
        ? evaluateInspection({
            readings,
            imported: batch.imported,
            measuredMm: batch.measuredMm ? Number.parseFloat(batch.measuredMm) : undefined,
            measuredQuantity: batch.measuredQuantity ? Number.parseFloat(batch.measuredQuantity) : undefined,
            resolutionMm: batch.resolutionMm ? Number.parseFloat(batch.resolutionMm) : undefined,
            resolutionG: batch.resolutionG ? Number.parseFloat(batch.resolutionG) : undefined,
            measurementSource: batch.measurementSource,
            instrumentId: batch.instrumentId,
            limits: limitRows,
          })
        : undefined,
    [readings, batch, limitRows],
  );

  const capturedFaces = FACES.filter((face) => captures[face]);

  const ingest = async (face: FaceKey, picked: File) => {
    const url = URL.createObjectURL(picked);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("The image file could not be read."));
      reader.readAsDataURL(picked);
    });
    const orientation = await readOrientation(picked).catch(() => 1);
    setCaptures((prev) => ({
      ...prev,
      [face]: { file: picked, url, dataUrl, orientation, enhance: false },
    }));
    setReadings((prev) => prev.filter((r) => r.face !== face));
  };

  const onPick = (face: FaceKey) => async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    setError(undefined);
    setNotice(undefined);
    await ingest(face, picked);
  };

  /** Assigns several photographs at once, filling the empty face slots in
   *  FRONT, BACK, LEFT, RIGHT, TOP, BOTTOM order so a full package can be
   *  loaded in one step. */
  const onPickMany = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setError(undefined);
    const free = FACES.filter((face) => !captures[face]);
    const slots = free.length >= files.length ? free : FACES;
    let assigned = 0;
    for (const [index, file] of files.entries()) {
      const face = slots[index];
      if (!face) break;
      await ingest(face, file);
      assigned += 1;
    }
    setNotice(`${assigned} photograph${assigned === 1 ? "" : "s"} assigned to ${slots.slice(0, assigned).join(", ")}.`);
  };


  const toggleEnhance = async (face: FaceKey) => {
    const shot = captures[face];
    if (!shot) return;
    setBusy(true);
    setError(undefined);
    try {
      if (shot.enhance) {
        setCaptures((prev) => ({ ...prev, [face]: { ...shot, enhance: false, enhancedDataUrl: undefined, enhancedUrl: undefined } }));
      } else {
        const enhancedDataUrl = await autoEnhance(shot.file, shot.orientation);
        setCaptures((prev) => ({ ...prev, [face]: { ...shot, enhance: true, enhancedDataUrl } }));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image enhancement failed.");
    } finally {
      setBusy(false);
    }
  };

  const removeFace = (face: FaceKey) => {
    const existing = captures[face];
    if (existing) URL.revokeObjectURL(existing.url);
    setCaptures((prev) => ({ ...prev, [face]: undefined }));
    setReadings((prev) => prev.filter((r) => r.face !== face));
  };

  const runPipeline = async () => {
    if (capturedFaces.length === 0) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    setSavedUid(undefined);
    const collected: FaceReading[] = [];
    try {
      for (const face of capturedFaces) {
        setProgress(`Detecting declarations and running text recognition on the ${face} face`);
        const shot = captures[face]!;
        const imageDataUrl = shot.enhance && shot.enhancedDataUrl ? shot.enhancedDataUrl : shot.dataUrl;
        const reading = await runFace({ data: { face, imageDataUrl } });
        collected.push(reading);
        setReadings([...collected]);
      }
      setProgress(undefined);
      setNotice(`${collected.length} face${collected.length === 1 ? "" : "s"} processed. Review the extracted declarations below.`);
    } catch (cause) {
      setProgress(undefined);
      setError(cause instanceof Error ? cause.message : "The package could not be read. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const flush = useCallback(async () => {
    const outcome = await flushQueue(pushInspection);
    setQueue(readQueue());
    await catalog.refetch();
    return outcome;
  }, [catalog]);

  useEffect(() => {
    if (online && pending(queue).length > 0) void flush();
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!result) return;
    setSaving(true);
    setError(undefined);
    try {
      const facePhotos: FacePhoto[] = [];
      for (const reading of readings) {
        let url: string | null = null;
        if (online) {
          try {
            url = await uploadLabelPhoto(captures[reading.face]!.file, batch.productCode, reading.face);
          } catch {
            url = null;
          }
        }
        facePhotos.push({ face: reading.face, url, quality: reading.quality.score, regions: reading.regions.length });
      }

      const violations = result.findings.filter((f) => f.status === "POTENTIAL");
      const payload: InspectionPayload = {
        uid,
        code: batch.productCode || "UNASSIGNED",
        verdict: result.verdict,
        note: violations[0]?.reason ?? result.findings.find((f) => f.status === "REVIEW")?.reason ?? "All applicable declarations detected and legible.",
        flagged: result.findings.filter((f) => f.status !== "COMPLIANT" && f.status !== "NA").map((f) => f.code),
        inspectedOn: batch.date,
        officer: batch.officer,
        site: batch.site,
        batchNo: batch.batchNo,
        lotSize: batch.lotSize,
        labelImageUrl: facePhotos.find((f) => f.url)?.url ?? null,
        faces: facePhotos,
        fields: result.fields.map((f) => ({ key: f.key, label: f.label, value: f.value, confidence: f.confidence, language: f.language, face: f.face, detection: f.detection })),
        findings: result.findings.map((f) => ({ code: f.code, declaration: f.declaration, status: f.status, detected: f.detected, expected: f.expected, reason: f.reason, confidence: f.confidence, face: f.face })),
        declaredBase: result.measurement.declaredBase,
        measuredBase: result.measurement.measuredBase,
        numeralHeightMm: batch.measuredMm ? Number.parseFloat(batch.measuredMm) : null,
        measuredSource: result.measurement.source,
        status: violations.length > 0 ? "OPEN" : "CLOSED",
        instrumentId: batch.instrumentId || null,
        resolutionMm: batch.resolutionMm ? Number.parseFloat(batch.resolutionMm) : null,
        resolutionG: batch.resolutionG ? Number.parseFloat(batch.resolutionG) : null,
      };

      saveLocal(payload);
      setQueue(readQueue());
      setSavedUid(uid);

      if (online) {
        const outcome = await flush();
        setNotice(outcome.failed > 0 ? "Saved on this device. The server sync failed and will be retried." : "Inspection saved and synced to the server.");
      } else {
        setNotice("Offline: the inspection is stored on this device and will sync automatically when connectivity returns.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The inspection could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const scheduleReinspection = async () => {
    if (!result) return;
    try {
      const due = new Date();
      due.setDate(due.getDate() + 14);
      await createReinspection({
        productCode: batch.productCode || "UNASSIGNED",
        action: result.findings.filter((f) => f.status === "POTENTIAL").map((f) => f.code).join(", ") || "Corrective action",
        dueOn: due.toISOString().slice(0, 10),
        note: result.findings.find((f) => f.status === "POTENTIAL")?.reason ?? "",
      });
      setNotice(`Corrective action recorded. Reinspection due ${due.toISOString().slice(0, 10)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The reinspection could not be scheduled.");
    }
  };

  const download = () => {
    if (!result) return;
    const body = buildReport({
      inspectionId: uid,
      batch: {
        productCode: batch.productCode,
        batchNo: batch.batchNo,
        lotSize: batch.lotSize,
        site: batch.site,
        officer: batch.officer,
        date: batch.date,
        imported: batch.imported,
        measuredMm: batch.measuredMm,
        measuredQuantity: batch.measuredQuantity,
        instrumentId: batch.instrumentId,
        measurementSource: batch.measurementSource,
      },
      result,
      readings,
      synced: Boolean(savedUid) && online,
    });
    const href = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `dharmalens-report-${(batch.productCode || "inspection").replace(/\s+/g, "-").toLowerCase()}.txt`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  const queuePending = pending(queue);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl px-5 py-10">
        <p className="font-mono text-[11px] text-muted-foreground">RULES 2011 / INSPECTION {uid.slice(0, 8).toUpperCase()}</p>
        <h1 className="mt-1 font-mono text-2xl font-semibold">Scan, validate and record an inspection</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Capture every face of the package, read the printed declarations from all of them together, compare them against the stored legal limits, verify the actual quantity and keep the image evidence with the record.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase">
          <span className={`px-2 py-1 outline outline-border ${online ? "text-pass" : "text-warning"}`}>{online ? "ONLINE" : "OFFLINE MODE"}</span>
          <span className="px-2 py-1 outline outline-border text-muted-foreground">{capturedFaces.length} / 6 FACES CAPTURED</span>
          <span className="px-2 py-1 outline outline-border text-muted-foreground">{queuePending.length} PENDING SYNC</span>
          {queuePending.length > 0 && online && (
            <button className="flex items-center gap-1 px-2 py-1 outline outline-border hover:bg-muted" onClick={() => void flush()}>
              <RefreshCw className="size-3" />RETRY SYNC
            </button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="flex flex-col gap-5 lg:col-span-5">
            <section className="bg-card outline outline-border">
              <Head title="STEP 1 — INSPECTION DETAILS" />
              <div className="grid grid-cols-2 items-center gap-2 p-4">
                <label className={legend} htmlFor="code">Product code</label>
                <input id="code" list="product-codes" className={field} value={batch.productCode} onChange={(e) => setBatch({ ...batch, productCode: e.target.value })} placeholder="LMPC-P-1001" />
                <datalist id="product-codes">{(catalog.data ?? []).map((p) => <option key={p.code} value={p.code}>{p.product}</option>)}</datalist>
                <label className={legend} htmlFor="batchno">Batch / lot no.</label>
                <input id="batchno" className={field} value={batch.batchNo} onChange={(e) => setBatch({ ...batch, batchNo: e.target.value })} />
                <label className={legend} htmlFor="lot">Lot size</label>
                <input id="lot" className={field} value={batch.lotSize} onChange={(e) => setBatch({ ...batch, lotSize: e.target.value })} placeholder="240 packages" />
                <label className={legend} htmlFor="site">Inspection site</label>
                <input id="site" className={field} value={batch.site} onChange={(e) => setBatch({ ...batch, site: e.target.value })} />
                <label className={legend} htmlFor="officer">Officer</label>
                <input id="officer" className={field} value={batch.officer} onChange={(e) => setBatch({ ...batch, officer: e.target.value })} />
                <label className={legend} htmlFor="date">Date</label>
                <input id="date" type="date" className={field} value={batch.date} onChange={(e) => setBatch({ ...batch, date: e.target.value })} />
                <label className={legend} htmlFor="imported">Imported goods</label>
                <span className="px-2.5"><input id="imported" type="checkbox" className="size-4 accent-primary" checked={batch.imported} onChange={(e) => setBatch({ ...batch, imported: e.target.checked })} /></span>
                {known && <p className="col-span-2 text-[12px] text-muted-foreground">Registered: {known.product}, {known.netQuantity}, MRP ₹{known.mrp}.</p>}
              </div>
            </section>

            <section className="bg-card outline outline-border">
              <Head title="STEP 2 — SCAN PACKAGE FACES" meta={`${capturedFaces.length}/6`} />
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
                {FACES.map((face) => {
                  const shot = captures[face];
                  const reading = readings.find((r) => r.face === face);
                  return (
                    <div key={face} className="outline outline-border">
                      <label className="grid aspect-[4/3] cursor-pointer place-items-center overflow-hidden bg-background hover:bg-muted">
                        {shot ? <img src={shot.enhance && shot.enhancedDataUrl ? shot.enhancedDataUrl : shot.url} alt={`${face} face of the inspected package`} className="h-full w-full object-cover" /> : <Upload className="size-4 text-muted-foreground" />}
                        <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={onPick(face)} />
                      </label>
                      <div className="flex items-center justify-between gap-1 border-t border-border px-2 py-1.5">
                        <span className="font-mono text-[10px]">{face}</span>
                        <span className="flex items-center gap-1">
                          {reading && <span className="font-mono text-[10px] text-muted-foreground">{reading.quality.score}%</span>}
                          {shot && (
                            <>
                              <button aria-label={`Enhance the ${face} photograph`} onClick={() => void toggleEnhance(face)} title={shot.enhance ? "Use original" : "Enhance for OCR"}>
                                <span className={`text-[10px] ${shot.enhance ? "text-pass" : "text-muted-foreground"} hover:text-foreground`}>{shot.enhance ? "ENH" : "RAW"}</span>
                              </button>
                              <button aria-label={`Remove the ${face} photograph`} onClick={() => removeFace(face)}><Trash2 className="size-3 text-muted-foreground hover:text-destructive" /></button>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5">
                <label className="cursor-pointer font-mono text-[11px] text-muted-foreground outline outline-border px-2 py-1 hover:text-foreground">
                  ADD ALL FACES AT ONCE
                  <input className="sr-only" type="file" accept="image/*" multiple onChange={onPickMany} />
                </label>
                <span className="font-mono text-[11px] text-muted-foreground">{FACES.filter((f) => !captures[f]).length > 0 ? `MISSING: ${FACES.filter((f) => !captures[f]).join(", ")}` : "ALL SIX FACES CAPTURED"}</span>
              </div>
              <div className="border-t border-border p-4">
                <Button variant="ink" className="w-full" disabled={capturedFaces.length === 0 || busy} onClick={runPipeline}>
                  {busy ? <><Loader2 className="mr-2 size-4 animate-spin" />Processing package</> : `Step 3 — Read ${capturedFaces.length} face${capturedFaces.length === 1 ? "" : "s"} and merge`}
                </Button>
                {readings.length > 0 && (
                  <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                    MERGED FROM {readings.length} FACE{readings.length === 1 ? "" : "S"}: {readings.map((r) => `${r.face} ${r.regions.length} regions`).join(" · ")}
                  </p>
                )}
                {progress && <p className="mt-3 font-mono text-[11px] text-muted-foreground">{progress}…</p>}
                {notice && <p className="mt-3 text-[13px] text-muted-foreground">{notice}</p>}
                {error && <p className="mt-3 text-[13px] text-destructive">{error}</p>}
                {limits.isError && <p className="mt-3 text-[13px] text-destructive">The stored legal limits could not be loaded.</p>}
              </div>

            </section>

            <section className="bg-card outline outline-border">
              <Head title="STEP 6 — MEASUREMENT" meta={result?.measurement.source ?? "NOT MEASURED"} />
              <div className="grid grid-cols-2 items-center gap-2 p-4">
                <label className={legend} htmlFor="source">Measurement source</label>
                <select id="source" className={select} value={batch.measurementSource} onChange={(e) => setBatch({ ...batch, measurementSource: e.target.value })}>
                  {MEASUREMENT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <label className={legend} htmlFor="instrument">Instrument ID</label>
                <input id="instrument" className={field} value={batch.instrumentId} onChange={(e) => setBatch({ ...batch, instrumentId: e.target.value })} placeholder="gauge / scale ID" />
                <label className={legend} htmlFor="mm">Numeral height (mm)</label>
                <input id="mm" inputMode="decimal" className={field} value={batch.measuredMm} onChange={(e) => setBatch({ ...batch, measuredMm: e.target.value })} placeholder="calibrated gauge" />
                <label className={legend} htmlFor="resmm">Resolution (mm)</label>
                <input id="resmm" inputMode="decimal" className={field} value={batch.resolutionMm} onChange={(e) => setBatch({ ...batch, resolutionMm: e.target.value })} placeholder="smallest division" />
                <label className={legend} htmlFor="qty">Actual quantity ({result?.measurement.unit ?? "g"})</label>
                <input id="qty" inputMode="decimal" className={field} value={batch.measuredQuantity} onChange={(e) => setBatch({ ...batch, measuredQuantity: e.target.value })} placeholder="weighed value" />
                <label className={legend} htmlFor="resg">Resolution ({result?.measurement.unit ?? "g"})</label>
                <input id="resg" inputMode="decimal" className={field} value={batch.resolutionG} onChange={(e) => setBatch({ ...batch, resolutionG: e.target.value })} placeholder="smallest division" />
                <p className="col-span-2 text-[12px] text-muted-foreground">No scale is connected, so values are recorded as a manual measurement with instrument uncertainty.</p>
                {result && (
                  <dl className="col-span-2 mt-1 space-y-1 text-[13px]">
                    <Row label="Declared" value={result.measurement.declaredBase === null ? "not detected" : `${result.measurement.declaredBase} ${result.measurement.unit}`} />
                    <Row label="Measured" value={result.measurement.measuredBase === null ? "not measured" : `${result.measurement.measuredBase} ${result.measurement.unit}`} />
                    <Row label="Difference" value={result.measurement.difference === null ? "—" : `${result.measurement.difference > 0 ? "+" : ""}${result.measurement.difference.toFixed(1)} ${result.measurement.unit}`} />
                    <Row label="Uncertainty" value={result.measurement.uncertaintyG === null ? "—" : `±${result.measurement.uncertaintyG.toFixed(2)} ${result.measurement.unit}`} />
                    <Row label="Permissible error" value={result.measurement.toleranceBase === null ? "—" : `±${result.measurement.toleranceBase.toFixed(1)} ${result.measurement.unit}`} />
                    <div className="flex justify-between gap-3">
                      <dt className={legend}>Status</dt>
                      <dd className={`font-mono text-[11px] font-semibold ${statusClass(result.measurement.status)}`}>{statusLabel(result.measurement.status)}</dd>
                    </div>
                    <p className="text-[12px] text-muted-foreground">{result.measurement.note}</p>
                  </dl>
                )}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-5 lg:col-span-7">
            <section className="bg-card outline outline-border">
              <Head title="STEP 4 — EXTRACTED DECLARATIONS" meta={result ? `${result.regionCount} TEXT REGIONS` : "AWAITING SCAN"} />
              {result ? (
                <>
                  <div className="grid grid-cols-2 gap-3 border-b border-border px-4 py-3 text-[12px] sm:grid-cols-4">
                    <Kpi label="Faces scanned" value={String(result.facesRead.length)} />
                    <Kpi label="Text regions" value={String(result.regionCount)} />
                    <Kpi label="Declarations found" value={String(result.fields.filter((f) => f.value !== null).length)} />
                    <Kpi label="Languages" value={result.languages.length ? result.languages.join(", ") : "not determined"} />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead><tr className="border-b border-border text-left font-mono text-[10px] uppercase text-muted-foreground"><th className="px-4 py-2">Declaration</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Conf.</th><th className="px-3 py-2">Face</th><th className="px-4 py-2">State</th></tr></thead>
                      <tbody>
                        {result.fields.map((f) => (
                          <tr key={f.key} className="border-b border-border/70 align-top">
                            <td className="px-4 py-2.5">{f.label}</td>
                            <td className={`px-3 py-2.5 ${f.value ? "" : "text-muted-foreground"}`}>{f.value ?? "not detected"}<span className="block font-mono text-[10px] text-muted-foreground">{f.value ? f.language : ""}</span></td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{f.value ? `${f.confidence}%` : "—"}</td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                              {f.face ? (
                                <button className="underline hover:text-foreground" onClick={() => setEvidence({ face: f.face!, box: f.box, caption: `${f.label} — ${f.value ?? ""}` })}>{f.face}</button>
                              ) : "—"}
                            </td>
                            <td className={`px-4 py-2.5 font-mono text-[10px] ${f.detection === "DETECTED" ? "text-pass" : f.detection === "LOW CONFIDENCE" ? "text-warning" : "text-muted-foreground"}`}>{f.detection}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">Capture at least one package face and run the extraction to see the declarations.</p>
              )}
            </section>

            <section className="bg-card outline outline-border">
              <Head title="STEP 5 & 7 — VALIDATION AND DECISION" meta={result ? statusLabel(result.status) : "NO RESULT"} />
              {result ? (
                <>
                  <div className={`border-b border-border px-4 py-3 font-mono text-[11px] font-semibold ${statusClass(result.status)}`}>
                    {statusLabel(result.status)}
                    <span className="ml-2 font-normal text-muted-foreground">stored as {result.verdict}</span>
                  </div>
                  {result.conflicts.length > 0 && (
                    <p className="flex items-start gap-2 border-b border-border px-4 py-2.5 text-[12px] text-warning"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{result.conflicts.map((c) => `${c.label}: ${c.readings.map((r) => `${r.face}=${r.value}`).join(", ")}`).join(" · ")}</p>
                  )}
                  {result.qualityWarnings.length > 0 && (
                    <p className="flex items-start gap-2 border-b border-border px-4 py-2.5 text-[12px] text-warning"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{result.qualityWarnings.join(" · ")}</p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead><tr className="border-b border-border text-left font-mono text-[10px] uppercase text-muted-foreground"><th className="px-4 py-2">Rule</th><th className="px-3 py-2">Requirement</th><th className="px-3 py-2">Detected</th><th className="px-3 py-2">Status</th><th className="px-4 py-2">Evidence</th></tr></thead>
                      <tbody>
                        {result.findings.map((f) => (
                          <tr key={f.code} className="border-b border-border/70 align-top">
                            <td className="px-4 py-2.5 font-mono text-xs">{f.code}<span className="block text-[10px] text-muted-foreground">v2011.1</span></td>
                            <td className="px-3 py-2.5"><p className="font-medium">{f.declaration}</p><p className="text-xs text-muted-foreground">{f.expected}</p></td>
                            <td className="px-3 py-2.5 text-muted-foreground">{f.detected}<span className="block font-mono text-[10px]">{f.reason}</span></td>
                            <td className={`px-3 py-2.5 font-mono text-[10px] font-semibold ${statusClass(f.status)}`}>{statusLabel(f.status)}</td>
                            <td className="px-4 py-2.5">
                              {f.face && captures[f.face] ? (
                                <button className="font-mono text-[10px] underline text-muted-foreground hover:text-foreground" onClick={() => setEvidence({ face: f.face!, box: f.box, caption: `${f.code} — ${f.detected}` })}>VIEW</button>
                              ) : <span className="font-mono text-[10px] text-muted-foreground">NONE</span>}
                            </td>
                          </tr>
                        ))}
                        <tr className="align-top">
                          <td className="px-4 py-2.5 font-mono text-xs">{result.band?.code ?? "LMPC-R7-FONT"}</td>
                          <td className="px-3 py-2.5"><p className="font-medium">Minimum numeral height</p><p className="text-xs text-muted-foreground">{result.band ? `${result.band.band}: minimum ${result.band.minHeightMm} mm` : "Band undetermined: net quantity not detected."}</p></td>
                          <td className="px-3 py-2.5 text-muted-foreground">{batch.measuredMm ? `${batch.measuredMm} mm` : "not measured"}<span className="block font-mono text-[10px]">{result.heightReason}</span></td>
                          <td className={`px-3 py-2.5 font-mono text-[10px] font-semibold ${statusClass(result.heightStatus)}`}>{statusLabel(result.heightStatus)}</td>
                          <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">MANUAL</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground">Final verification by an authorised officer is required before enforcement action.</p>
                    <span className="flex flex-wrap gap-2">
                      <Button variant="ink" disabled={saving} onClick={save}>{saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving</> : online ? "Save and sync" : "Save on this device"}</Button>
                      <Button onClick={download}><FileDown className="mr-2 size-4" />Report</Button>
                      {result.findings.some((f) => f.status === "POTENTIAL") && <Button onClick={scheduleReinspection}>Schedule reinspection</Button>}
                    </span>
                  </div>
                </>
              ) : (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">Findings appear here once the captured faces have been read.</p>
              )}
            </section>

            <section className="bg-card outline outline-border">
              <Head title="SYNC QUEUE" meta={`${queuePending.length} PENDING`} />
              {queue.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">Saved inspections appear here with their sync state.</p>
              ) : (
                <ul className="divide-y divide-border/70 text-[13px]">
                  {queue.slice(0, 6).map((item) => (
                    <li key={item.uid} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="min-w-0"><span className="font-mono text-[11px]">{item.uid.slice(0, 8).toUpperCase()}</span> <span className="text-muted-foreground">{item.payload.code}</span>
                        {item.error && <span className="block text-[11px] text-destructive">{item.error}</span>}
                      </span>
                      <span className={`font-mono text-[10px] ${item.sync === "SYNCED" ? "text-pass" : item.sync === "FAILED" ? "text-destructive" : "text-warning"}`}>{item.sync}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <p className="mt-8 font-mono text-[11px]"><Link to="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</Link> · <Link to="/rules" className="text-muted-foreground hover:text-foreground">Legal limits</Link></p>
        <p className="mt-3 text-[11px] text-muted-foreground">Readings are machine assisted and indicative. Verify every declaration against the original package before enforcement action.</p>
      </main>

      {evidence && captures[evidence.face] && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/70 p-4" role="dialog" aria-label="Evidence image">
          <div className="w-full max-w-3xl bg-card outline outline-border">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <span className="font-mono text-xs">EVIDENCE — {evidence.face} FACE</span>
              <button aria-label="Close the evidence view" onClick={() => setEvidence(undefined)}><X className="size-4" /></button>
            </div>
            <div className="relative">
              <img src={captures[evidence.face]!.url} alt={`Evidence from the ${evidence.face} face`} className="max-h-[70vh] w-full object-contain" />
              {evidence.box && (
                <span
                  className="pointer-events-none absolute outline outline-2 outline-warning"
                  style={{ left: `${evidence.box.x * 100}%`, top: `${evidence.box.y * 100}%`, width: `${evidence.box.w * 100}%`, height: `${evidence.box.h * 100}%` }}
                />
              )}
            </div>
            <p className="border-t border-border px-4 py-2.5 text-[13px] text-muted-foreground">{evidence.caption}{evidence.box ? "" : " (no bounding box was returned for this reading)"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Head({ title, meta }: { title: string; meta?: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5"><h2 className="font-mono text-xs font-semibold">{title}</h2>{meta && <span className="font-mono text-[10px] text-muted-foreground">{meta}</span>}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className={legend}>{label}</dt><dd>{value}</dd></div>;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div><p className={legend}>{label}</p><p className="font-mono text-sm">{value}</p></div>;
}
