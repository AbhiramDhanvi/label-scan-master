import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChangeEvent, useEffect, useState } from "react";
import { FileDown, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { products, verdictClass } from "@/data/lmpc";
import { readLabel, type LabelReading } from "@/lib/ocr.functions";
import { buildReport, evaluateLabel } from "@/lib/compliance";

export const Route = createFileRoute("/inspect")({
  head: () => ({ meta: [
    { title: "New Inspection | Metrograph" },
    { name: "description", content: "Upload a label photograph, record batch details and read declarations from the image to check them against the 2011 legal limits." },
    { property: "og:title", content: "New Inspection | Metrograph" },
    { property: "og:description", content: "Upload a label photograph, record batch details and compare read declarations against the legal limits." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Inspect,
});

const field = "bg-background px-2.5 py-1.5 text-[13px] outline outline-border";
const legend = "font-mono text-[10px] uppercase text-muted-foreground";

function Inspect() {
  const runOcr = useServerFn(readLabel);
  const [imageUrl, setImageUrl] = useState<string>();
  const [dataUrl, setDataUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState<LabelReading>();
  const [batch, setBatch] = useState({
    productCode: "",
    batchNo: "",
    lotSize: "",
    site: "",
    officer: "",
    date: "",
    imported: false,
    measuredMm: "",
  });

  useEffect(() => {
    setBatch((prev) => (prev.date ? prev : { ...prev, date: new Date().toISOString().slice(0, 10) }));
  }, []);

  const result = reading
    ? evaluateLabel(reading, { imported: batch.imported, measuredMm: batch.measuredMm ? Number.parseFloat(batch.measuredMm) : undefined })
    : undefined;

  const onImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(undefined);
    setReading(undefined);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!dataUrl) return;
    setBusy(true);
    setError(undefined);
    try {
      const value = await runOcr({ data: { imageDataUrl: dataUrl } });
      setReading(value);
      setBatch((prev) => ({ ...prev, productCode: prev.productCode || value.productCode || "" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The label could not be read. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!reading || !result) return;
    const body = buildReport({ batch, reading, result });
    const href = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `metrograph-report-${(batch.productCode || "inspection").replace(/\s+/g, "-").toLowerCase()}.txt`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl px-5 py-10">
        <p className="font-mono text-[11px] text-muted-foreground">RULES 2011 / NEW INSPECTION</p>
        <h1 className="mt-1 font-mono text-2xl font-semibold">Record an inspection</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Upload a photograph of the label, record the batch details, then read the printed declarations from the image and compare them against the legal limits.</p>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section className="bg-card outline outline-border lg:col-span-5">
            <Head title="LABEL IMAGE" />
            <div className="p-4">
              <label className="grid aspect-[16/9] cursor-pointer place-items-center overflow-hidden bg-background outline outline-border hover:bg-muted">
                {imageUrl ? <img src={imageUrl} alt="Uploaded packaged commodity label" className="h-full w-full object-contain" /> : <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><Upload className="size-4" />SELECT OR PHOTOGRAPH LABEL</span>}
                <input className="sr-only" type="file" accept="image/*" onChange={onImage} />
              </label>

              <div className="mt-4 grid grid-cols-2 items-center gap-2">
                <label className={legend} htmlFor="code">Product code</label>
                <input id="code" list="product-codes" className={field} value={batch.productCode} onChange={(e) => setBatch({ ...batch, productCode: e.target.value })} placeholder="LMPC-P-1001" />
                <datalist id="product-codes">{products.map((p) => <option key={p.code} value={p.code}>{p.product}</option>)}</datalist>
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
                <label className={legend} htmlFor="mm">Numeral height</label>
                <input id="mm" inputMode="decimal" className={field} value={batch.measuredMm} onChange={(e) => setBatch({ ...batch, measuredMm: e.target.value })} placeholder="mm, calibrated" />
                <label className={legend} htmlFor="imported">Imported goods</label>
                <span className="px-2.5"><input id="imported" type="checkbox" className="size-4 accent-primary" checked={batch.imported} onChange={(e) => setBatch({ ...batch, imported: e.target.checked })} /></span>
              </div>

              <Button variant="ink" className="mt-4 w-full" disabled={!dataUrl || busy} onClick={submit}>
                {busy ? <><Loader2 className="mr-2 size-4 animate-spin" />Reading label text</> : "Submit inspection"}
              </Button>
              {error && <p className="mt-3 text-[13px] text-destructive">{error}</p>}
            </div>
          </section>

          <div className="flex flex-col gap-5 lg:col-span-7">
            <section className="bg-card outline outline-border">
              <Head title="TEXT READ FROM LABEL" meta={reading ? "COMPLETE" : "AWAITING SUBMISSION"} />
              {reading ? (
                <>
                  <dl className="divide-y divide-border/70 text-[13px]">
                    {[["Product", reading.productName], ["Product code", reading.productCode], ["Generic name", reading.genericName], ["Net quantity", reading.netQuantity], ["MRP", reading.mrp], ["Tax clause", reading.taxClausePresent ? "inclusive of all taxes" : null], ["Manufacturer", reading.manufacturer], ["Manufacture date", reading.manufactureDate], ["Consumer care", reading.consumerCare], ["Country of origin", reading.countryOfOrigin]].map(([key, value]) => (
                      <div key={String(key)} className="grid grid-cols-3 gap-3 px-4 py-2">
                        <dt className={legend}>{key}</dt>
                        <dd className={`col-span-2 ${value ? "" : "text-muted-foreground"}`}>{value || "not read"}</dd>
                      </div>
                    ))}
                  </dl>
                  {reading.rawText && <p className="border-t border-border px-4 py-3 font-mono text-[11px] whitespace-pre-wrap text-muted-foreground">{reading.rawText}</p>}
                </>
              ) : (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">Upload a label image and submit the inspection to read the printed declarations.</p>
              )}
            </section>

            <section className="bg-card outline outline-border">
              <Head title="COMPARISON AGAINST LEGAL LIMITS" meta={result ? result.verdict : "NO RESULT"} />
              {result ? (
                <>
                  <table className="w-full text-[13px]">
                    <thead><tr className="border-b border-border text-left font-mono text-[10px] uppercase text-muted-foreground"><th className="px-4 py-2">Rule</th><th className="px-3 py-2">Legal requirement</th><th className="px-3 py-2">Read</th><th className="px-4 py-2">Status</th></tr></thead>
                    <tbody>{result.fields.map((f) => (
                      <tr key={f.code} className="border-b border-border/70 align-top">
                        <td className="px-4 py-2.5 font-mono text-xs">{f.code}</td>
                        <td className="px-3 py-2.5"><p className="font-medium">{f.declaration}</p><p className="text-xs text-muted-foreground">{f.requirement}</p></td>
                        <td className="px-3 py-2.5 text-muted-foreground">{f.read}</td>
                        <td className={`px-4 py-2.5 font-mono text-[11px] font-semibold ${verdictClass(f.verdict)}`}>{f.verdict}</td>
                      </tr>
                    ))}
                    <tr className="align-top">
                      <td className="px-4 py-2.5 font-mono text-xs">{result.band?.code ?? "LMPC-R7-FONT"}</td>
                      <td className="px-3 py-2.5"><p className="font-medium">Minimum numeral height</p><p className="text-xs text-muted-foreground">{result.band ? `${result.band.band}: minimum ${result.band.minHeightMm} mm` : "Band undetermined: net quantity not read."}</p></td>
                      <td className="px-3 py-2.5 text-muted-foreground">{batch.measuredMm ? `${batch.measuredMm} mm` : "not measured"}</td>
                      <td className={`px-4 py-2.5 font-mono text-[11px] font-semibold ${verdictClass(result.heightVerdict)}`}>{result.heightVerdict}</td>
                    </tr>
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground">Flagged: {result.fields.filter((f) => f.verdict !== "PASS").map((f) => f.code).join(", ") || "none"}</p>
                    <Button onClick={download}><FileDown className="mr-2 size-4" />Download report</Button>
                  </div>
                </>
              ) : (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">Findings appear here once the label has been read.</p>
              )}
            </section>
          </div>
        </div>

        <p className="mt-8 font-mono text-[11px]"><Link to="/" className="text-muted-foreground hover:text-foreground">Console</Link> · <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</Link> · <Link to="/rules" className="text-muted-foreground hover:text-foreground">Legal limits</Link></p>
        <p className="mt-3 text-[11px] text-muted-foreground">Readings are indicative. Verify every field against the original package before enforcement action.</p>
      </main>
    </div>
  );
}

function Head({ title, meta }: { title: string; meta?: string }) {
  return <div className="flex items-center justify-between border-b border-border px-4 py-2.5"><h2 className="font-mono text-xs font-semibold">{title}</h2>{meta && <span className="font-mono text-[10px] text-muted-foreground">{meta}</span>}</div>;
}
