import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { verdictClass } from "@/data/lmpc";
import { fetchInspections, fetchLimits, fetchProducts, fetchReinspections, setReinspectionState } from "@/lib/catalog";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [
    { title: "Compliance Dashboard | DharmaLens Legal Metrology" },
    { name: "description", content: "Compliance status for every stored packaged commodity, its recorded inspection history and the label declarations currently flagged." },
    { property: "og:title", content: "Compliance Dashboard | DharmaLens Legal Metrology" },
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
  const [sort, setSort] = useState<"severity" | "recent" | "product">("severity");

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

  const kpis = [
    { label: "Compliant", value: counts.PASS, tone: "text-pass" },
    { label: "Needs review", value: counts.REVIEW, tone: "text-warning" },
    { label: "Violations", value: counts.FAIL, tone: "text-destructive" },
  ];

  const mark = async (id: string, state: string) => {
    await setReinspectionState(id, state);
    await reinspectionsQuery.refetch();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-7xl px-5 py-10">
        <h1 className="font-mono text-2xl font-semibold">Compliance</h1>
        {productsQuery.isError && <p className="mt-3 text-[13px] text-destructive">The product records could not be loaded.</p>}

        <div className="mt-6 grid grid-cols-3 gap-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-card px-4 py-3 outline outline-border">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">{kpi.label}</p>
              <p className={`mt-1 font-mono text-2xl font-semibold ${kpi.tone}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section className="bg-card outline outline-border lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <h2 className="font-mono text-xs font-semibold">PRODUCTS</h2>
              <div className="flex flex-wrap items-center gap-2">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product" className="w-44 bg-background px-2.5 py-1 text-[12px] outline outline-border" />
                <div className="flex">{(["ALL", "FAIL", "REVIEW", "PASS"] as const).map((key) => (
                  <button key={key} type="button" onClick={() => setStatus(key)} className={`px-2 py-1 font-mono text-[10px] outline outline-border ${status === key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>{key}</button>
                ))}</div>
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="bg-background px-2 py-1 font-mono text-[10px] outline outline-border">
                  <option value="severity">Sort: severity</option>
                  <option value="recent">Sort: most recent</option>
                  <option value="product">Sort: product name</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead><tr className="border-b border-border text-left font-mono text-[10px] uppercase text-muted-foreground"><th className="px-4 py-2">Product</th><th className="px-3 py-2">Net qty</th><th className="px-4 py-2">Status</th></tr></thead>
                <tbody>{rows.map((p) => (
                  <tr key={p.code} className="border-b border-border/70 align-top hover:bg-background">
                    <td className="px-4 py-3"><p className="font-medium">{p.product}</p><p className="font-mono text-[11px] text-muted-foreground">{p.code}</p></td>
                    <td className="px-3 py-3 font-mono">{p.netQuantity}</td>
                    <td className={`px-4 py-3 font-mono text-[11px] font-semibold ${verdictClass(p.verdict)}`}>{p.verdict}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">{productsQuery.isLoading ? "Loading products." : "No matching products."}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-col gap-5 lg:col-span-4">
            <section className="bg-card outline outline-border">
              <div className="border-b border-border px-4 py-2.5"><h2 className="font-mono text-xs font-semibold">FLAGGED</h2></div>
              <ul className="divide-y divide-border/70">{flagged.map((p) => (
                <li key={p.code} className="px-4 py-3">
                  <p className="text-[13px] font-medium">{p.product}</p>
                  {p.flagged.map((code) => (
                    <p key={code} className="mt-1 text-xs text-muted-foreground">{label(code)}</p>
                  ))}
                </li>
              ))}
              {flagged.length === 0 && <li className="px-4 py-6 text-center text-xs text-muted-foreground">Nothing flagged.</li>}
              </ul>
            </section>

            {reinspections.length > 0 && (
              <section className="bg-card outline outline-border">
                <div className="border-b border-border px-4 py-2.5"><h2 className="font-mono text-xs font-semibold">REINSPECTIONS</h2></div>
                <ul className="divide-y divide-border/70 text-[13px]">{reinspections.map((r) => (
                  <li key={r.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-medium">{nameFor(r.productCode)}</span>
                        <span className="block text-xs text-muted-foreground">Due {r.dueOn}{r.dueOn < today && r.state === "PENDING" ? " · overdue" : ""}</span>
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
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
