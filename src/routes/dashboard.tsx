import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { bandForQuantity, declarations, products, verdictClass } from "@/data/lmpc";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [
    { title: "Compliance Dashboard | Metrograph" },
    { name: "description", content: "Compliance status for every packaged commodity, past inspection history and the label declarations currently flagged." },
    { property: "og:title", content: "Compliance Dashboard | Metrograph" },
    { property: "og:description", content: "Per-product compliance status, inspection history and flagged label declarations under the 2011 rules." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Dashboard,
});

const label = (code: string) => declarations.find((d) => d.code === code)?.declaration ?? code;

const order = { FAIL: 0, REVIEW: 1, PASS: 2 } as const;

function Dashboard() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | "PASS" | "REVIEW" | "FAIL">("ALL");
  const [sort, setSort] = useState<"severity" | "recent" | "product" | "mrp">("severity");
  const rows = useMemo(() => {
    const latest = (p: (typeof products)[number]) => p.inspections[0]?.date ?? "";
    return products
      .filter((p) => `${p.code} ${p.product} ${p.category}`.toLowerCase().includes(query.toLowerCase()))
      .filter((p) => status === "ALL" || p.verdict === status)
      .slice()
      .sort((a, b) =>
        sort === "recent" ? latest(b).localeCompare(latest(a))
        : sort === "product" ? a.product.localeCompare(b.product)
        : sort === "mrp" ? b.mrp - a.mrp
        : order[a.verdict] - order[b.verdict],
      );
  }, [query, status, sort]);
  const counts = {
    PASS: products.filter((p) => p.verdict === "PASS").length,
    FAIL: products.filter((p) => p.verdict === "FAIL").length,
    REVIEW: products.filter((p) => p.verdict === "REVIEW").length,
  };
  const history = products
    .flatMap((p) => p.inspections.map((i) => ({ ...i, product: p.product, code: p.code })))
    .sort((a, b) => b.date.localeCompare(a.date));
  const flagged = products.filter((p) => p.flagged.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-7xl px-5 py-10">
        <p className="font-mono text-[11px] text-muted-foreground">RULES 2011 / PORTFOLIO STATUS</p>
        <h1 className="mt-1 font-mono text-2xl font-semibold">Compliance dashboard</h1>

        <div className="mt-6 grid grid-cols-3 gap-4">
          {(["PASS", "REVIEW", "FAIL"] as const).map((key) => (
            <div key={key} className="bg-card px-4 py-3 outline outline-border">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">{key}</p>
              <p className={`mt-1 font-mono text-2xl font-semibold ${verdictClass(key)}`}>{counts[key]}</p>
              <p className="text-[11px] text-muted-foreground">of {products.length} products</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section className="bg-card outline outline-border lg:col-span-8">
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5">
              <h2 className="font-mono text-xs font-semibold">STATUS BY PRODUCT</h2>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code, product, category" className="w-56 bg-background px-2.5 py-1 text-[12px] outline outline-border" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead><tr className="border-b border-border text-left font-mono text-[10px] uppercase text-muted-foreground"><th className="px-4 py-2">Code</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Net qty</th><th className="px-3 py-2">MRP</th><th className="px-3 py-2">Min numeral</th><th className="px-4 py-2">Status</th></tr></thead>
                <tbody>{rows.map((p) => (
                  <tr key={p.code} className="border-b border-border/70 align-top hover:bg-background">
                    <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                    <td className="px-3 py-3"><p className="font-medium">{p.product}</p><p className="text-xs text-muted-foreground">{p.note}</p></td>
                    <td className="px-3 py-3 text-muted-foreground">{p.category}</td>
                    <td className="px-3 py-3 font-mono">{p.netQuantity}</td>
                    <td className="px-3 py-3 font-mono">₹{p.mrp.toFixed(2)}</td>
                    <td className="px-3 py-3 font-mono text-muted-foreground">{bandForQuantity(p.quantityBase).minHeightMm} mm</td>
                    <td className={`px-4 py-3 font-mono text-[11px] font-semibold ${verdictClass(p.verdict)}`}><span className="mr-1.5 inline-block size-2 bg-current" />{p.verdict}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-col gap-5 lg:col-span-4">
            <section className="bg-card outline outline-border">
              <div className="border-b border-border px-4 py-2.5"><h2 className="font-mono text-xs font-semibold">FLAGGED DECLARATIONS</h2></div>
              <ul className="divide-y divide-border/70">{flagged.map((p) => (
                <li key={p.code} className="px-4 py-3">
                  <p className="text-[13px] font-medium">{p.product}</p>
                  {p.flagged.map((code) => (
                    <p key={code} className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
                      <span className={`border border-current px-1.5 py-0.5 font-mono text-[10px] ${verdictClass(p.verdict)}`}>{code}</span>
                      {label(code)}
                    </p>
                  ))}
                </li>
              ))}</ul>
            </section>

            <section className="bg-card outline outline-border">
              <div className="border-b border-border px-4 py-2.5"><h2 className="font-mono text-xs font-semibold">INSPECTION HISTORY</h2></div>
              <ul className="divide-y divide-border/70 text-[13px]">{history.map((h, index) => (
                <li key={`${h.code}-${h.date}-${index}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span><span className="font-mono text-[11px] text-muted-foreground">{h.date}</span> <span className="ml-2">{h.product}</span><span className="block text-[11px] text-muted-foreground">Officer {h.officer}</span></span>
                  <span className={`font-mono text-[10px] font-semibold ${verdictClass(h.verdict)}`}>{h.verdict}</span>
                </li>
              ))}</ul>
            </section>
          </div>
        </div>

        <p className="mt-8 font-mono text-[11px]"><Link to="/" className="text-muted-foreground hover:text-foreground">Back to inspection console</Link> · <Link to="/rules" className="text-muted-foreground hover:text-foreground">Legal limits</Link></p>
      </main>
    </div>
  );
}
