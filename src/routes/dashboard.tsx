import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { verdictClass } from "@/data/lmpc";
import { bandFor, fetchInspections, fetchLimits, fetchProducts, fetchReinspections, setReinspectionState } from "@/lib/catalog";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [
    { title: "Compliance Dashboard | Metrograph" },
    { name: "description", content: "Compliance status for every stored packaged commodity, its recorded inspection history and the label declarations currently flagged." },
    { property: "og:title", content: "Compliance Dashboard | Metrograph" },
    { property: "og:description", content: "Per-product compliance status, inspection history and flagged label declarations under the 2011 rules." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Dashboard,
});

const order = { FAIL: 0, REVIEW: 1, PASS: 2 } as const;

function Dashboard() {
  const productsQuery = useQuery({ queryKey: ["lm_products"], queryFn: fetchProducts });
  const limitsQuery = useQuery({ queryKey: ["lm_limits"], queryFn: fetchLimits });
  const historyQuery = useQuery({ queryKey: ["lm_inspections"], queryFn: fetchInspections });
  const reinspectionsQuery = useQuery({ queryKey: ["lm_reinspections"], queryFn: fetchReinspections });

  const products = productsQuery.data ?? [];
  const limits = limitsQuery.data ?? [];
  const history = historyQuery.data ?? [];

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | "PASS" | "REVIEW" | "FAIL">("ALL");
  const [sort, setSort] = useState<"severity" | "recent" | "product" | "mrp">("severity");

  const label = (code: string) => limits.find((l) => l.code === code)?.title ?? code;

  const rows = useMemo(() => {
    const latest = (code: string) => history.find((h) => h.productCode === code)?.inspectedOn ?? "";
    return products
      .filter((p) => `${p.code} ${p.product} ${p.category}`.toLowerCase().includes(query.toLowerCase()))
      .filter((p) => status === "ALL" || p.verdict === status)
      .slice()
      .sort((a, b) =>
        sort === "recent" ? latest(b.code).localeCompare(latest(a.code))
        : sort === "product" ? a.product.localeCompare(b.product)
        : sort === "mrp" ? b.mrp - a.mrp
        : order[a.verdict] - order[b.verdict],
      );
  }, [products, history, query, status, sort]);

  const counts = {
    PASS: products.filter((p) => p.verdict === "PASS").length,
    FAIL: products.filter((p) => p.verdict === "FAIL").length,
    REVIEW: products.filter((p) => p.verdict === "REVIEW").length,
  };
  const flagged = products.filter((p) => p.flagged.length > 0);
  const nameFor = (code: string) => products.find((p) => p.code === code)?.product ?? code;
  const today = new Date().toISOString().slice(0, 10);

  const reinspections = reinspectionsQuery.data ?? [];

  const topViolations = useMemo(() => {
    const tally = new Map<string, number>();
    for (const record of history) for (const code of record.flagged) tally.set(code, (tally.get(code) ?? 0) + 1);
    return Array.from(tally.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [history]);

  const highRisk = useMemo(() => {
    const byCode = new Map<string, { code: string; total: number; violations: number; last: string }>();
    for (const record of history) {
      const row = byCode.get(record.productCode) ?? { code: record.productCode, total: 0, violations: 0, last: "" };
      row.total += 1;
      if (record.verdict !== "PASS") row.violations += 1;
      if (record.inspectedOn > row.last) row.last = record.inspectedOn;
      byCode.set(record.productCode, row);
    }
    return Array.from(byCode.values())
      .filter((row) => row.violations >= 2 || (row.violations > 0 && row.violations === row.total && row.total > 1))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 6);
  }, [history]);

  const kpis = [
    { label: "Total inspections", value: history.length, tone: "" },
    { label: "Compliant", value: history.filter((h) => h.verdict === "PASS").length, tone: "text-pass" },
    { label: "Potential violations", value: history.filter((h) => h.verdict === "FAIL").length, tone: "text-destructive" },
    { label: "Needs review", value: history.filter((h) => h.verdict === "REVIEW").length, tone: "text-warning" },
    { label: "Pending reinspection", value: reinspections.filter((r) => r.state === "PENDING").length, tone: "text-warning" },
  ];

  const alerts = [
    ...history.filter((h) => h.verdict === "FAIL").slice(0, 3).map((h) => `Potential violation: ${nameFor(h.productCode)} on ${h.inspectedOn}`),
    ...highRisk.slice(0, 2).map((row) => `Repeat violations: ${nameFor(row.code)} (${row.violations})`),
    ...reinspections.filter((r) => r.state === "PENDING" && r.dueOn < today).slice(0, 2).map((r) => `Reinspection overdue: ${nameFor(r.productCode)} (due ${r.dueOn})`),
    ...history.filter((h) => h.verdict === "REVIEW").slice(0, 2).map((h) => `Needs officer review: ${nameFor(h.productCode)} on ${h.inspectedOn}`),
  ].slice(0, 6);

  const mark = async (id: string, state: string) => {
    await setReinspectionState(id, state);
    await reinspectionsQuery.refetch();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-7xl px-5 py-10">
        <p className="font-mono text-[11px] text-muted-foreground">RULES 2011 / PORTFOLIO STATUS</p>
        <h1 className="mt-1 font-mono text-2xl font-semibold">Compliance dashboard</h1>
        {productsQuery.isError && <p className="mt-3 text-[13px] text-destructive">The product records could not be loaded.</p>}

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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <h2 className="font-mono text-xs font-semibold">STATUS BY PRODUCT</h2>
              <div className="flex flex-wrap items-center gap-2">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code, product, category" className="w-52 bg-background px-2.5 py-1 text-[12px] outline outline-border" />
                <div className="flex">{(["ALL", "FAIL", "REVIEW", "PASS"] as const).map((key) => (
                  <button key={key} type="button" onClick={() => setStatus(key)} className={`px-2 py-1 font-mono text-[10px] outline outline-border ${status === key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>{key}</button>
                ))}</div>
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="bg-background px-2 py-1 font-mono text-[10px] outline outline-border">
                  <option value="severity">Sort: severity</option>
                  <option value="recent">Sort: most recent</option>
                  <option value="product">Sort: product name</option>
                  <option value="mrp">Sort: highest MRP</option>
                </select>
              </div>
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
                    <td className="px-3 py-3 font-mono text-muted-foreground">{bandFor(limits, p.quantityBase)?.minHeightMm ?? "—"} mm</td>
                    <td className={`px-4 py-3 font-mono text-[11px] font-semibold ${verdictClass(p.verdict)}`}><span className="mr-1.5 inline-block size-2 bg-current" />{p.verdict}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">{productsQuery.isLoading ? "Loading product records." : "No products match this filter."}</td></tr>}
                </tbody>
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
              ))}
              {flagged.length === 0 && <li className="px-4 py-6 text-center text-xs text-muted-foreground">Nothing flagged.</li>}
              </ul>
            </section>

            <section className="bg-card outline outline-border">
              <div className="border-b border-border px-4 py-2.5"><h2 className="font-mono text-xs font-semibold">INSPECTION HISTORY</h2></div>
              <ul className="divide-y divide-border/70 text-[13px]">{history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span><span className="font-mono text-[11px] text-muted-foreground">{h.inspectedOn}</span> <span className="ml-2">{nameFor(h.productCode)}</span><span className="block text-[11px] text-muted-foreground">{h.officer ? `Officer ${h.officer}` : h.productCode}</span></span>
                  <span className={`font-mono text-[10px] font-semibold ${verdictClass(h.verdict)}`}>{h.verdict}</span>
                </li>
              ))}
              {history.length === 0 && <li className="px-4 py-6 text-center text-xs text-muted-foreground">No inspections recorded yet.</li>}
              </ul>
            </section>

            <section className="bg-card outline outline-border">
              <div className="border-b border-border px-4 py-2.5"><h2 className="font-mono text-xs font-semibold">MOST COMMON VIOLATIONS</h2></div>
              <ul className="divide-y divide-border/70 text-[13px]">{topViolations.map(([code, count]) => (
                <li key={code} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px]">{code}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{count}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{label(code)}</p>
                  <span className="mt-1 block h-1 bg-border"><span className="block h-1 bg-foreground" style={{ width: `${(count / topViolations[0]![1]) * 100}%` }} /></span>
                </li>
              ))}
              {topViolations.length === 0 && <li className="px-4 py-6 text-center text-xs text-muted-foreground">No violations recorded yet.</li>}
              </ul>
            </section>

            <section className="bg-card outline outline-border">
              <div className="border-b border-border px-4 py-2.5"><h2 className="font-mono text-xs font-semibold">HIGH-RISK PRODUCTS</h2></div>
              <ul className="divide-y divide-border/70 text-[13px]">{highRisk.map((row) => (
                <li key={row.code} className="px-4 py-2.5">
                  <p className="font-medium">{nameFor(row.code)}</p>
                  <p className="text-xs text-muted-foreground">{row.violations} of {row.total} inspections non-compliant · last {row.last || "—"}</p>
                </li>
              ))}
              {highRisk.length === 0 && <li className="px-4 py-6 text-center text-xs text-muted-foreground">No repeat violations.</li>}
              </ul>
            </section>

            <section className="bg-card outline outline-border">
              <div className="border-b border-border px-4 py-2.5"><h2 className="font-mono text-xs font-semibold">REINSPECTION TRACKING</h2></div>
              <ul className="divide-y divide-border/70 text-[13px]">{reinspections.map((r) => (
                <li key={r.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-medium">{nameFor(r.productCode)}</span>
                      <span className="block text-xs text-muted-foreground">Due {r.dueOn}{r.dueOn < today && r.state === "PENDING" ? " · overdue" : ""} · {r.action}</span>
                    </span>
                    <span className={`font-mono text-[10px] ${r.state === "RESOLVED" ? "text-pass" : r.state === "STILL NON-COMPLIANT" ? "text-destructive" : "text-warning"}`}>{r.state}</span>
                  </div>
                  {r.state === "PENDING" && (
                    <div className="mt-2 flex gap-2">
                      <button className="px-2 py-1 font-mono text-[10px] outline outline-border hover:bg-muted" onClick={() => void mark(r.id, "RESOLVED")}>MARK RESOLVED</button>
                      <button className="px-2 py-1 font-mono text-[10px] outline outline-border hover:bg-muted" onClick={() => void mark(r.id, "STILL NON-COMPLIANT")}>STILL NON-COMPLIANT</button>
                    </div>
                  )}
                </li>
              ))}
              {reinspections.length === 0 && <li className="px-4 py-6 text-center text-xs text-muted-foreground">No reinspections scheduled.</li>}
              </ul>
            </section>
          </div>
        </div>

        <p className="mt-8 font-mono text-[11px]"><Link to="/" className="text-muted-foreground hover:text-foreground">New inspection</Link> · <Link to="/rules" className="text-muted-foreground hover:text-foreground">Legal limits</Link></p>
      </main>
    </div>
  );
}
