import { createFileRoute, Link } from "@tanstack/react-router";
import { ChangeEvent, useMemo, useState } from "react";
import { FileDown, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bandForQuantity, declarations, products, verdictClass } from "@/data/lmpc";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Metrograph | Packaged Commodity Inspections" },
    { name: "description", content: "Scan labels, compare declarations against the legal limits of the Packaged Commodities Rules, 2011 and prepare inspection reports." },
    { property: "og:title", content: "Metrograph | Packaged Commodity Inspections" },
    { property: "og:description", content: "Scan labels, compare declarations against the legal limits of the Packaged Commodities Rules, 2011 and prepare inspection reports." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

function Index() {
  const [imageUrl, setImageUrl] = useState<string>();
  const [query, setQuery] = useState("");
  const [scanned, setScanned] = useState(false);
  const [selectedCode, setSelectedCode] = useState(products[0]!.code);
  const [measuredMm, setMeasuredMm] = useState("");

  const selected = products.find((p) => p.code === selectedCode)!;
  const band = bandForQuantity(selected.quantityBase);
  const measured = Number.parseFloat(measuredMm);
  const heightVerdict = !measuredMm || Number.isNaN(measured) ? "REVIEW" : measured >= band.minHeightMm ? "PASS" : "FAIL";

  const filtered = useMemo(
    () => products.filter((row) => `${row.code} ${row.product} ${row.category}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  const onImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setScanned(false);
  };

  const downloadReport = () => {
    const body = [
      "METROGRAPH COMPLIANCE REVIEW",
      "Standard: Legal Metrology (Packaged Commodities) Rules, 2011",
      "",
      `Product code: ${selected.code}`,
      `Product: ${selected.product} (${selected.category})`,
      `Net quantity: ${selected.netQuantity}`,
      `MRP: ₹${selected.mrp.toFixed(2)}`,
      `Status: ${selected.verdict}`,
      `Finding: ${selected.note}`,
      "",
      `Rule 7 band: ${band.code} — minimum numeral height ${band.minHeightMm} mm`,
      `Measured numeral height: ${measuredMm ? `${measuredMm} mm` : "not measured"}`,
      `Numeral height verdict: ${heightVerdict}`,
      `Flagged declarations: ${selected.flagged.join(", ") || "none"}`,
      "",
      "This automated finding is indicative and requires verification by an authorised officer.",
    ].join("\n");
    const href = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `metrograph-${selected.code.toLowerCase()}.txt`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main id="console" className="mx-auto max-w-7xl px-5 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><p className="font-mono text-[11px] text-muted-foreground">RULES 2011 / INSPECTION CONSOLE</p><h1 className="mt-1 font-mono text-2xl font-semibold">Label Compliance Review</h1></div>
          <Button onClick={downloadReport}><FileDown className="mr-2 size-4" />Generate report</Button>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section id="queue" className="bg-card outline outline-border lg:col-span-8">
            <PanelTitle title="INSPECTION QUEUE" meta={`${filtered.length} SHOWN`} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead><tr className="border-b border-border text-left font-mono text-[10px] uppercase text-muted-foreground"><th className="px-4 py-2">Code</th><th className="px-3 py-2">Commodity</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Net qty</th><th className="px-3 py-2">MRP</th><th className="px-3 py-2">Min numeral</th><th className="px-4 py-2">Status</th></tr></thead>
                <tbody>{filtered.map((row) => (
                  <tr key={row.code} onClick={() => setSelectedCode(row.code)} className={`cursor-pointer border-b border-border/70 hover:bg-background ${row.code === selectedCode ? "bg-background" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                    <td className="px-3 py-3 font-medium">{row.product}</td>
                    <td className="px-3 py-3 text-muted-foreground">{row.category}</td>
                    <td className="px-3 py-3 font-mono">{row.netQuantity}</td>
                    <td className="px-3 py-3 font-mono">₹{row.mrp.toFixed(2)}</td>
                    <td className="px-3 py-3 font-mono text-muted-foreground">{bandForQuantity(row.quantityBase).minHeightMm} mm</td>
                    <td className={`px-4 py-3 font-mono text-[11px] font-semibold ${verdictClass(row.verdict)}`}><span className="mr-1.5 inline-block size-2 bg-current" />{row.verdict}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-col gap-5 lg:col-span-4">
            <section className="bg-card outline outline-border">
              <PanelTitle title="SCAN / UPLOAD LABEL" meta={selected.code} />
              <div className="p-4">
                <label className="grid aspect-[16/9] cursor-pointer place-items-center overflow-hidden bg-background outline outline-border hover:bg-muted">
                  {imageUrl ? <img src={imageUrl} alt={`Scanned label for ${selected.product}`} className="h-full w-full object-contain" /> : <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><Upload className="size-4" />SELECT LABEL IMAGE</span>}
                  <input className="sr-only" type="file" accept="image/*" onChange={onImage} />
                </label>
                <div className="mt-3 grid grid-cols-2 items-center gap-2">
                  <label className="font-mono text-[10px] uppercase text-muted-foreground" htmlFor="measured">Measured numeral</label>
                  <input id="measured" inputMode="decimal" value={measuredMm} onChange={(e) => setMeasuredMm(e.target.value)} placeholder="mm" className="bg-background px-2.5 py-1.5 text-[13px] outline outline-border" />
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">Legal minimum</span>
                  <span className="px-2.5 font-mono text-[13px]">{band.minHeightMm} mm · {band.code}</span>
                </div>
                <Button variant="ink" className="mt-3 w-full" disabled={!imageUrl} onClick={() => setScanned(true)}>{scanned ? "Label read complete" : "Compare against legal limits"}</Button>
                {scanned && (
                  <p className={`mt-3 font-mono text-[11px] font-semibold ${verdictClass(heightVerdict as "PASS")}`}>NUMERAL HEIGHT: {heightVerdict}{heightVerdict === "REVIEW" ? " — enter a calibrated measurement" : ""}</p>
                )}
              </div>
            </section>

            <section className="bg-card outline outline-border">
              <PanelTitle title="DECLARATION CHECKLIST" meta={scanned ? `${declarations.length - selected.flagged.length} / ${declarations.length}` : "NOT SCANNED"} />
              <ul className="divide-y divide-border/70 text-[13px]">{declarations.map((item) => {
                const isFlagged = selected.flagged.includes(item.code);
                return (
                  <li key={item.code} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`grid size-5 place-items-center border border-current font-mono text-[9px] ${scanned ? (isFlagged ? (selected.verdict === "FAIL" ? "text-destructive" : "text-warning") : "text-pass") : "text-muted-foreground"}`}>{scanned ? (isFlagged ? (selected.verdict === "FAIL" ? "NO" : "?") : "OK") : "·"}</span>
                    <span>{item.declaration}<span className="ml-2 font-mono text-[10px] text-muted-foreground">{item.code}</span></span>
                  </li>
                );
              })}</ul>
            </section>
          </div>

          <section id="findings" className="bg-card outline outline-border lg:col-span-8">
            <PanelTitle title="VIOLATION SUMMARY" meta={scanned ? `${selected.flagged.length} ITEMS` : "AWAITING SCAN"} />
            <div className="divide-y divide-border/70">
              {!scanned ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">Upload a label image and compare it against the legal limits to create findings.</p>
              ) : selected.flagged.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">No Rule 6 declaration is missing for {selected.product}.</p>
              ) : (
                selected.flagged.map((code) => (
                  <Finding key={code} rule={code} text={`${declarations.find((d) => d.code === code)?.declaration ?? code}: ${selected.note}`} />
                ))
              )}
            </div>
          </section>

          <section id="history" className="bg-card outline outline-border lg:col-span-4">
            <PanelTitle title="PAST INSPECTIONS" meta={selected.code} />
            <div className="relative px-4 py-3">
              <Search className="absolute left-6 top-5 size-4 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-background py-1.5 pl-8 pr-2.5 text-[13px] outline outline-border" placeholder="Search code, commodity, category" />
            </div>
            <ul className="divide-y divide-border/70 text-[13px]">{selected.inspections.map((entry) => (
              <li key={entry.date} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-mono text-xs">{entry.date}<span className="ml-2 text-muted-foreground">Officer {entry.officer}</span></span>
                <span className={`font-mono text-[10px] font-semibold ${verdictClass(entry.verdict)}`}>{entry.verdict}</span>
              </li>
            ))}</ul>
            <p className="border-t border-border px-4 py-3 font-mono text-[11px]"><Link to="/dashboard" className="text-muted-foreground hover:text-foreground">Full dashboard</Link></p>
          </section>
        </div>
      </main>

      <footer className="mt-2 border-t border-border"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5"><p className="text-[11px] text-muted-foreground">Output is indicative and is not a legally definitive determination of compliance.</p><div className="flex gap-4 font-mono text-[11px]"><Link to="/rules" className="text-muted-foreground hover:text-foreground">Legal limits</Link><Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link><Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms and Conditions</Link></div></div></footer>
    </div>
  );
}

function PanelTitle({ title, meta }: { title: string; meta?: string }) { return <div className="flex items-center justify-between border-b border-border px-4 py-2.5"><h2 className="font-mono text-xs font-semibold">{title}</h2>{meta && <span className="font-mono text-[10px] text-muted-foreground">{meta}</span>}</div>; }
function Finding({ rule, text }: { rule: string; text: string }) { return <div className="flex items-start gap-3 px-4 py-3"><span className="mt-0.5 border border-destructive px-2 py-0.5 font-mono text-[10px] font-semibold text-destructive">{rule}</span><div><p className="text-[13px] font-medium">{text}</p><p className="mt-0.5 text-xs text-muted-foreground">Verify against the original package before enforcement action.</p></div></div>; }
