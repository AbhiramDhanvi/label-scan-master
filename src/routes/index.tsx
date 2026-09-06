import { createFileRoute, Link } from "@tanstack/react-router";
import { ChangeEvent, useMemo, useState } from "react";
import { FileDown, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Measure | Packaged Commodity Inspections" },
    { name: "description", content: "Scan labels, review mandatory declarations and prepare packaged commodity compliance reports." },
    { property: "og:title", content: "Measure | Packaged Commodity Inspections" },
    { property: "og:description", content: "Scan labels, review mandatory declarations and prepare packaged commodity compliance reports." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

const inspections = [
  { sku: "SKU-4471", product: "Basmati Rice, Grade A", maker: "Agrifine Pvt Ltd", quantity: "10 kg", mrp: "₹950", date: "05/24 / 05/25", status: "PASS" },
  { sku: "SKU-4502", product: "Groundnut Oil", maker: "NutraVeda Foods", quantity: "1 L", mrp: "₹210", date: "08/24 / 02/25", status: "FAIL" },
  { sku: "SKU-4519", product: "Black Tea, CTC", maker: "Hillcrest Import Co", quantity: "250 g", mrp: "₹180", date: "11/24 / 11/26", status: "REVIEW" },
];

function Index() {
  const [imageUrl, setImageUrl] = useState<string>();
  const [query, setQuery] = useState("");
  const [scanned, setScanned] = useState(false);
  const filtered = useMemo(() => inspections.filter((row) => `${row.sku} ${row.product} ${row.maker}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const onImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setScanned(false);
  };
  const downloadReport = () => {
    const body = `MEASURE COMPLIANCE REVIEW\n\nStatus: Review required\nStandard: Legal Metrology (Packaged Commodities) Rules, 2011\n\nThis automated finding is indicative and requires verification by an authorised officer.`;
    const href = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const anchor = document.createElement("a"); anchor.href = href; anchor.download = "measure-compliance-report.txt"; anchor.click(); URL.revokeObjectURL(href);
  };
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-2.5">
          <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center bg-foreground font-mono text-[11px] font-semibold text-background">LM</span><div className="leading-tight"><p className="font-mono text-[11px] font-semibold">MEASURE<span className="text-primary">.</span></p><p className="text-[10px] text-muted-foreground">Legal Metrology Inspection Console</p></div></div>
          <nav className="ml-4 hidden items-center gap-1 md:flex"><a className="bg-foreground px-2.5 py-1.5 text-xs font-medium text-background" href="#console">Console</a><a className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground" href="#queue">Queue</a><a className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground" href="#findings">Findings</a><a className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground" href="#history">History</a></nav>
          <div className="ml-auto flex items-center gap-4"><span className="font-mono text-[10px] text-muted-foreground">DEMONSTRATION DATA</span><span className="grid size-7 place-items-center bg-background font-mono text-[10px] outline outline-border">AO</span></div>
        </div>
      </header>
      <main id="console" className="mx-auto max-w-7xl px-5 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[11px] text-muted-foreground">RULES 2011 / INSPECTION CONSOLE</p><h1 className="mt-1 font-mono text-2xl font-semibold">Label Compliance Review</h1></div><Button onClick={downloadReport}><FileDown className="mr-2 size-4" />Generate report</Button></div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section id="queue" className="bg-card outline outline-border lg:col-span-8"><PanelTitle title="INSPECTION QUEUE" meta={`${filtered.length} SHOWN`} /><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-[13px]"><thead><tr className="border-b border-border text-left font-mono text-[10px] uppercase text-muted-foreground"><th className="px-4 py-2">SKU</th><th className="px-3 py-2">Commodity</th><th className="px-3 py-2">Mfr / Packer / Imp</th><th className="px-3 py-2">Net Qty</th><th className="px-3 py-2">MRP</th><th className="px-3 py-2">Mfg / Exp</th><th className="px-4 py-2">Status</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.sku} className="border-b border-border/70 hover:bg-background"><td className="px-4 py-3 font-mono text-xs">{row.sku}</td><td className="px-3 py-3 font-medium">{row.product}</td><td className="px-3 py-3 text-muted-foreground">{row.maker}</td><td className="px-3 py-3 font-mono">{row.quantity}</td><td className="px-3 py-3 font-mono">{row.mrp}</td><td className="px-3 py-3 font-mono text-muted-foreground">{row.date}</td><td className={`px-4 py-3 font-mono text-[11px] font-semibold ${row.status === "PASS" ? "text-pass" : row.status === "FAIL" ? "text-destructive" : "text-warning"}`}><span className="mr-1.5 inline-block size-2 bg-current" />{row.status}</td></tr>)}</tbody></table></div></section>
          <div className="flex flex-col gap-5 lg:col-span-4">
            <section className="bg-card outline outline-border"><PanelTitle title="SCAN / UPLOAD ENTRY" /><div className="p-4"><label className="grid aspect-[16/9] cursor-pointer place-items-center overflow-hidden bg-background outline outline-border hover:bg-muted">{imageUrl ? <img src={imageUrl} alt="Uploaded packaged commodity label" className="h-full w-full object-contain" /> : <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><Upload className="size-4" />SELECT LABEL IMAGE</span>}<input className="sr-only" type="file" accept="image/*" onChange={onImage} /></label><div className="mt-3 grid grid-cols-2 items-center gap-2"><label className="font-mono text-[10px] uppercase text-muted-foreground">Net quantity</label><input className="bg-background px-2.5 py-1.5 text-[13px] outline outline-border" defaultValue="10 kg" /><label className="font-mono text-[10px] uppercase text-muted-foreground">Pack type</label><input className="bg-background px-2.5 py-1.5 text-[13px] outline outline-border" defaultValue="Bag" /></div><Button variant="ink" className="mt-3 w-full" disabled={!imageUrl} onClick={() => setScanned(true)}>{scanned ? "Label read complete" : "Scan and read label"}</Button></div></section>
            <section className="bg-card outline outline-border"><PanelTitle title="DECLARATION CHECKLIST" meta={scanned ? "4 / 6" : "NOT SCANNED"} /><ul className="divide-y divide-border/70 text-[13px]">{[["OK","Net quantity present","text-pass"],["OK","MRP printed","text-pass"],["NO","Month / year of manufacture","text-destructive"],["?","Consumer care details","text-warning"]].map(([mark,text,color]) => <li key={text} className="flex items-center gap-3 px-4 py-2.5"><span className={`grid size-5 place-items-center border border-current font-mono text-[9px] ${scanned ? color : "text-muted-foreground"}`}>{scanned ? mark : "·"}</span>{text}</li>)}</ul></section>
          </div>
          <section id="findings" className="bg-card outline outline-border lg:col-span-8"><PanelTitle title="VIOLATION SUMMARY" meta={scanned ? "2 ITEMS FOR REVIEW" : "AWAITING SCAN"} /><div className="divide-y divide-border/70">{scanned ? <><Finding rule="RULE 6" text="Month and year declaration could not be read with sufficient confidence." /><Finding rule="RULE 6(2)" text="Consumer care details require manual verification for completeness." /></> : <p className="px-4 py-8 text-center text-xs text-muted-foreground">Upload and scan a label to create findings.</p>}</div></section>
          <section id="history" className="bg-card outline outline-border lg:col-span-4"><PanelTitle title="HISTORY" /><div className="relative px-4 py-3"><Search className="absolute left-6 top-5 size-4 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-background py-1.5 pl-8 pr-2.5 text-[13px] outline outline-border" placeholder="Search SKU, commodity, packer" /></div><ul className="divide-y divide-border/70 text-[13px]">{filtered.slice(0,2).map((row) => <li key={row.sku} className="flex items-center justify-between px-4 py-2.5"><span className="font-mono text-xs">{row.sku}</span><span className="font-mono text-[10px] text-muted-foreground">{row.status}</span></li>)}</ul></section>
        </div>
      </main>
      <footer className="mt-2 border-t border-border"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5"><p className="text-[11px] text-muted-foreground">Output is indicative and is not a legally definitive determination of compliance.</p><div className="flex gap-4 font-mono text-[11px]"><Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link><Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms and Conditions</Link></div></div></footer>
    </div>
  );
}

function PanelTitle({ title, meta }: { title: string; meta?: string }) { return <div className="flex items-center justify-between border-b border-border px-4 py-2.5"><h2 className="font-mono text-xs font-semibold">{title}</h2>{meta && <span className="font-mono text-[10px] text-muted-foreground">{meta}</span>}</div>; }
function Finding({ rule, text }: { rule: string; text: string }) { return <div className="flex items-start gap-3 px-4 py-3"><span className="mt-0.5 border border-destructive px-2 py-0.5 font-mono text-[10px] font-semibold text-destructive">{rule}</span><div><p className="text-[13px] font-medium">{text}</p><p className="mt-0.5 text-xs text-muted-foreground">Verify against the original package before enforcement action.</p></div></div>; }
