import { createFileRoute, Link } from "@tanstack/react-router";
import { amendments, declarations, fontBands, penalties } from "@/data/lmpc";

export const Route = createFileRoute("/rules")({
  head: () => ({ meta: [
    { title: "Legal Limits and Rule Codes | Metrograph" },
    { name: "description", content: "Rule 6 mandatory declarations, Rule 7 minimum numeral heights in mm, amendments and penalty limits under the Packaged Commodities Rules, 2011." },
    { property: "og:title", content: "Legal Limits and Rule Codes | Metrograph" },
    { property: "og:description", content: "Mandatory declarations, minimum numeral heights, amendments and compounding fines used to check packaged commodity labels." },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Rules,
});

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

const th = "px-4 py-2 text-left font-mono text-[10px] uppercase text-muted-foreground";
const td = "px-4 py-3 align-top";

function Rules() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-5 py-10">
        <p className="font-mono text-[11px] text-muted-foreground">RULES 2011 / LEGAL LIMITS</p>
        <h1 className="mt-1 font-mono text-2xl font-semibold">Legal limits and rule codes</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Every inspection is compared against the values on this page. Figures follow the Legal Metrology (Packaged Commodities) Rules, 2011 and its amendments; verify against the current Gazette notification before enforcement action.</p>

        <div className="mt-8 flex flex-col gap-6">
          <Section title="RULE 6 / MANDATORY DECLARATIONS" meta={`${declarations.length} CHECKS`}>
            <table className="w-full min-w-[640px] text-[13px]">
              <thead><tr className="border-b border-border"><th className={th}>Rule code</th><th className={th}>Declaration</th><th className={th}>Requirement</th></tr></thead>
              <tbody>{declarations.map((row) => (
                <tr key={row.code} className="border-b border-border/70">
                  <td className={`${td} font-mono text-xs`}>{row.code}</td>
                  <td className={`${td} font-medium`}>{row.declaration}</td>
                  <td className={`${td} text-muted-foreground`}>{row.requirement}</td>
                </tr>
              ))}</tbody>
            </table>
          </Section>

          <Section title="RULE 7 / MINIMUM NUMERAL HEIGHT" meta="MILLIMETRES">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead><tr className="border-b border-border"><th className={th}>Net quantity band</th><th className={th}>Minimum height</th><th className={th}>Rule code</th></tr></thead>
              <tbody>{fontBands.map((band) => (
                <tr key={band.code} className="border-b border-border/70">
                  <td className={td}>{band.band}</td>
                  <td className={`${td} font-mono`}>{band.minHeightMm} mm</td>
                  <td className={`${td} font-mono text-xs`}>{band.code}</td>
                </tr>
              ))}</tbody>
            </table>
            <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Heights are measured by calibrating against a reference card of fixed width 85.6 mm to obtain a pixel-to-millimetre ratio. With no reference object in frame, the field is routed to review rather than given a pass or fail.</p>
          </Section>

          <Section title="AMENDMENTS" meta="VERSIONING BASIS">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead><tr className="border-b border-border"><th className={th}>Rule code</th><th className={th}>Amendment</th><th className={th}>Effective</th><th className={th}>Citation</th></tr></thead>
              <tbody>{amendments.map((row) => (
                <tr key={row.code + row.effective} className="border-b border-border/70">
                  <td className={`${td} font-mono text-xs`}>{row.code}</td>
                  <td className={td}>{row.amendment}</td>
                  <td className={`${td} font-mono`}>{row.effective}</td>
                  <td className={`${td} text-muted-foreground`}>{row.citation}</td>
                </tr>
              ))}</tbody>
            </table>
          </Section>

          <Section title="LIMITS AND PENALTIES">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead><tr className="border-b border-border"><th className={th}>Provision</th><th className={th}>Limit</th></tr></thead>
              <tbody>{penalties.map((row) => (
                <tr key={row.provision} className="border-b border-border/70">
                  <td className={`${td} font-medium`}>{row.provision}</td>
                  <td className={`${td} text-muted-foreground`}>{row.limit}</td>
                </tr>
              ))}</tbody>
            </table>
          </Section>
        </div>

        <p className="mt-8 font-mono text-[11px]"><Link to="/" className="text-muted-foreground hover:text-foreground">Back to inspection console</Link></p>
      </main>
    </div>
  );
}
