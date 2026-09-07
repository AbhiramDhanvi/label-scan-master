import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { addLimit, addProduct, addUnit, fetchLimits, fetchProducts, fetchUnits } from "@/lib/catalog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/rules")({
  head: () => ({ meta: [
    { title: "Legal Limits, Units and Products | Pramana Legal Metrology" },
    { name: "description", content: "Stored mandatory declarations, minimum numeral heights in mm, measurement units and product records used to check packaged commodity labels under the 2011 rules." },
    { property: "og:title", content: "Legal Limits, Units and Products | Pramana Legal Metrology" },
    { property: "og:description", content: "Stored declarations, numeral-height bands, units and products, with new entries added straight to the database." },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Rules,
});

const th = "px-4 py-2 text-left font-mono text-[10px] uppercase text-muted-foreground";
const td = "px-4 py-3 align-top";
const field = "bg-background px-2.5 py-1.5 text-[13px] outline outline-border";
const legend = "font-mono text-[10px] uppercase text-muted-foreground";

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card outline outline-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="font-mono text-xs font-semibold">{title}</h2>
        {meta && <span className="font-mono text-[10px] text-muted-foreground">{meta}</span>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function Rules() {
  const limits = useQuery({ queryKey: ["lm_limits"], queryFn: fetchLimits });
  const units = useQuery({ queryKey: ["lm_units"], queryFn: fetchUnits });
  const productsQuery = useQuery({ queryKey: ["lm_products"], queryFn: fetchProducts });

  const declarations = (limits.data ?? []).filter((l) => l.kind === "declaration");
  const bands = (limits.data ?? [])
    .filter((l) => l.kind === "font_band")
    .sort((a, b) => (a.maxQuantityBase ?? Infinity) - (b.maxQuantityBase ?? Infinity));

  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [product, setProduct] = useState({ code: "", product: "", category: "", mrp: "", netQuantity: "", quantityBase: "", unitSymbol: "g", imported: false });
  const [limit, setLimit] = useState({ code: "", kind: "declaration", title: "", requirement: "", minHeightMm: "", maxQuantityBase: "", citation: "" });
  const [unit, setUnit] = useState({ symbol: "", label: "", kind: "mass", baseFactor: "1" });

  const run = async (action: () => Promise<void>, message: string, after: () => void) => {
    setError(undefined);
    setStatus(undefined);
    try {
      await action();
      setStatus(message);
      after();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The record could not be saved.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-5 py-10">
        <p className="font-mono text-[11px] text-muted-foreground">RULES 2011 / LEGAL LIMITS</p>
        <h1 className="mt-1 font-mono text-2xl font-semibold">Legal limits, units and products</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Reference data used for every inspection. Add products, units or limits below.</p>

        {status && <p className="mt-4 text-[13px] text-muted-foreground">{status}</p>}
        {error && <p className="mt-4 text-[13px] text-destructive">{error}</p>}

        <div className="mt-8 flex flex-col gap-6">
          <Section title="PRODUCTS ON RECORD" meta={`${productsQuery.data?.length ?? 0} PRODUCTS`}>
            <table className="w-full min-w-[680px] text-[13px]">
              <thead><tr className="border-b border-border"><th className={th}>Code</th><th className={th}>Product</th><th className={th}>Category</th><th className={th}>Net quantity</th><th className={th}>MRP</th></tr></thead>
              <tbody>{(productsQuery.data ?? []).map((row) => (
                <tr key={row.code} className="border-b border-border/70">
                  <td className={`${td} font-mono text-xs`}>{row.code}</td>
                  <td className={`${td} font-medium`}>{row.product}</td>
                  <td className={`${td} text-muted-foreground`}>{row.category}</td>
                  <td className={`${td} font-mono`}>{row.netQuantity}</td>
                  <td className={`${td} font-mono`}>₹{row.mrp.toFixed(2)}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="grid grid-cols-1 gap-2 border-t border-border p-4 sm:grid-cols-2">
              <Field id="p-code" label="Product code" value={product.code} onChange={(v) => setProduct({ ...product, code: v })} placeholder="LMPC-P-1007" />
              <Field id="p-name" label="Product" value={product.product} onChange={(v) => setProduct({ ...product, product: v })} />
              <Field id="p-cat" label="Category" value={product.category} onChange={(v) => setProduct({ ...product, category: v })} />
              <Field id="p-mrp" label="MRP" value={product.mrp} onChange={(v) => setProduct({ ...product, mrp: v })} placeholder="189" />
              <Field id="p-qty" label="Net quantity" value={product.netQuantity} onChange={(v) => setProduct({ ...product, netQuantity: v })} placeholder="500 g" />
              <Field id="p-base" label="Quantity in g or ml" value={product.quantityBase} onChange={(v) => setProduct({ ...product, quantityBase: v })} placeholder="500" />
              <div className="grid grid-cols-2 items-center gap-2">
                <label className={legend} htmlFor="p-unit">Unit</label>
                <select id="p-unit" className={field} value={product.unitSymbol} onChange={(e) => setProduct({ ...product, unitSymbol: e.target.value })}>
                  {(units.data ?? []).map((u) => <option key={u.symbol} value={u.symbol}>{u.symbol} — {u.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 items-center gap-2">
                <label className={legend} htmlFor="p-imp">Imported goods</label>
                <span className="px-2.5"><input id="p-imp" type="checkbox" className="size-4 accent-primary" checked={product.imported} onChange={(e) => setProduct({ ...product, imported: e.target.checked })} /></span>
              </div>
              <div className="sm:col-span-2">
                <Button
                  variant="ink"
                  disabled={!product.code || !product.product || !product.netQuantity}
                  onClick={() => run(
                    () => addProduct({
                      code: product.code.trim(),
                      product: product.product.trim(),
                      category: product.category.trim() || "Uncategorised",
                      mrp: Number.parseFloat(product.mrp) || 0,
                      netQuantity: product.netQuantity.trim(),
                      quantityBase: Number.parseFloat(product.quantityBase) || 0,
                      unitSymbol: product.unitSymbol,
                      imported: product.imported,
                    }),
                    "Product added to the database.",
                    () => {
                      setProduct({ code: "", product: "", category: "", mrp: "", netQuantity: "", quantityBase: "", unitSymbol: "g", imported: false });
                      void productsQuery.refetch();
                    },
                  )}
                >
                  Add product
                </Button>
              </div>
            </div>
          </Section>

          <Section title="RULE 6 / MANDATORY DECLARATIONS" meta={`${declarations.length} CHECKS`}>
            <table className="w-full min-w-[640px] text-[13px]">
              <thead><tr className="border-b border-border"><th className={th}>Rule code</th><th className={th}>Declaration</th><th className={th}>Requirement</th></tr></thead>
              <tbody>{declarations.map((row) => (
                <tr key={row.code} className="border-b border-border/70">
                  <td className={`${td} font-mono text-xs`}>{row.code}</td>
                  <td className={`${td} font-medium`}>{row.title}</td>
                  <td className={`${td} text-muted-foreground`}>{row.requirement}</td>
                </tr>
              ))}</tbody>
            </table>
          </Section>

          <Section title="RULE 7 / MINIMUM NUMERAL HEIGHT" meta="MILLIMETRES">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead><tr className="border-b border-border"><th className={th}>Net quantity band</th><th className={th}>Minimum height</th><th className={th}>Rule code</th></tr></thead>
              <tbody>{bands.map((band) => (
                <tr key={band.code} className="border-b border-border/70">
                  <td className={td}>{band.title}</td>
                  <td className={`${td} font-mono`}>{band.minHeightMm} mm</td>
                  <td className={`${td} font-mono text-xs`}>{band.code}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="grid grid-cols-1 gap-2 border-t border-border p-4 sm:grid-cols-2">
              <Field id="l-code" label="Rule code" value={limit.code} onChange={(v) => setLimit({ ...limit, code: v })} placeholder="LMPC-R6-XXX" />
              <div className="grid grid-cols-2 items-center gap-2">
                <label className={legend} htmlFor="l-kind">Kind</label>
                <select id="l-kind" className={field} value={limit.kind} onChange={(e) => setLimit({ ...limit, kind: e.target.value })}>
                  <option value="declaration">declaration</option>
                  <option value="font_band">font band</option>
                </select>
              </div>
              <Field id="l-title" label="Title" value={limit.title} onChange={(v) => setLimit({ ...limit, title: v })} />
              <Field id="l-req" label="Requirement" value={limit.requirement} onChange={(v) => setLimit({ ...limit, requirement: v })} />
              <Field id="l-mm" label="Min height mm" value={limit.minHeightMm} onChange={(v) => setLimit({ ...limit, minHeightMm: v })} placeholder="font band only" />
              <Field id="l-max" label="Band ceiling g/ml" value={limit.maxQuantityBase} onChange={(v) => setLimit({ ...limit, maxQuantityBase: v })} placeholder="font band only" />
              <Field id="l-cite" label="Citation" value={limit.citation} onChange={(v) => setLimit({ ...limit, citation: v })} />
              <div className="sm:col-span-2">
                <Button
                  variant="ink"
                  disabled={!limit.code || !limit.title || !limit.requirement}
                  onClick={() => run(
                    () => addLimit({
                      code: limit.code.trim(),
                      kind: limit.kind,
                      title: limit.title.trim(),
                      requirement: limit.requirement.trim(),
                      minHeightMm: limit.minHeightMm ? Number.parseFloat(limit.minHeightMm) : null,
                      maxQuantityBase: limit.maxQuantityBase ? Number.parseFloat(limit.maxQuantityBase) : null,
                      citation: limit.citation.trim() || null,
                    }),
                    "Legal limit added to the database.",
                    () => {
                      setLimit({ code: "", kind: "declaration", title: "", requirement: "", minHeightMm: "", maxQuantityBase: "", citation: "" });
                      void limits.refetch();
                    },
                  )}
                >
                  Add legal limit
                </Button>
              </div>
            </div>
          </Section>

          <Section title="UNITS OF MEASUREMENT" meta={`${units.data?.length ?? 0} UNITS`}>
            <table className="w-full min-w-[520px] text-[13px]">
              <thead><tr className="border-b border-border"><th className={th}>Symbol</th><th className={th}>Unit</th><th className={th}>Kind</th><th className={th}>In base unit</th></tr></thead>
              <tbody>{(units.data ?? []).map((row) => (
                <tr key={row.symbol} className="border-b border-border/70">
                  <td className={`${td} font-mono`}>{row.symbol}</td>
                  <td className={td}>{row.label}</td>
                  <td className={`${td} text-muted-foreground`}>{row.kind}</td>
                  <td className={`${td} font-mono`}>{row.baseFactor}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="grid grid-cols-1 gap-2 border-t border-border p-4 sm:grid-cols-2">
              <Field id="u-sym" label="Symbol" value={unit.symbol} onChange={(v) => setUnit({ ...unit, symbol: v })} placeholder="mg" />
              <Field id="u-lab" label="Unit name" value={unit.label} onChange={(v) => setUnit({ ...unit, label: v })} placeholder="milligram" />
              <Field id="u-kind" label="Kind" value={unit.kind} onChange={(v) => setUnit({ ...unit, kind: v })} placeholder="mass" />
              <Field id="u-base" label="In base unit" value={unit.baseFactor} onChange={(v) => setUnit({ ...unit, baseFactor: v })} placeholder="0.001" />
              <div className="sm:col-span-2">
                <Button
                  variant="ink"
                  disabled={!unit.symbol || !unit.label}
                  onClick={() => run(
                    () => addUnit({ symbol: unit.symbol.trim(), label: unit.label.trim(), kind: unit.kind.trim() || "mass", baseFactor: Number.parseFloat(unit.baseFactor) || 1 }),
                    "Unit added to the database.",
                    () => {
                      setUnit({ symbol: "", label: "", kind: "mass", baseFactor: "1" });
                      void units.refetch();
                    },
                  )}
                >
                  Add unit
                </Button>
              </div>
            </div>
          </Section>

        </div>

        <p className="mt-8 font-mono text-[11px]"><Link to="/" className="text-muted-foreground hover:text-foreground">New inspection</Link> · <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</Link></p>
      </main>
    </div>
  );
}

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="grid grid-cols-2 items-center gap-2">
      <label className={legend} htmlFor={id}>{label}</label>
      <input id={id} className={field} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
