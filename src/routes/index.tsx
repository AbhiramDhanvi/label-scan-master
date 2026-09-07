import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DharmaLens | Legal Metrology Inspection" },
      { name: "description", content: "Inspect packaged commodity labels against the Legal Metrology (Packaged Commodities) Rules, 2011. Upload label photos, extract declarations, compare quantities, and generate compliance reports." },
      { property: "og:title", content: "DharmaLens | Legal Metrology Inspection" },
      { property: "og:description", content: "Inspect packaged commodity labels against the Legal Metrology (Packaged Commodities) Rules, 2011." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-5 text-center">
      <div className="relative mb-8 size-24 animate-fade-in">
        <span className="absolute inset-0 outline outline-border" />
        <span className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-semibold">LM</span>
        <span className="absolute left-0 right-0 top-0 h-px bg-primary animate-scan" />
      </div>

      <h1 className="animate-fade-in animation-delay-150 font-mono text-3xl font-semibold tracking-tight">
        DHARMALENS
      </h1>
      <p className="mt-3 max-w-md animate-fade-in animation-delay-150 text-sm text-muted-foreground">
        Inspect packaged commodity labels against the Legal Metrology (Packaged Commodities) Rules, 2011.
      </p>

      <div className="mt-8 animate-fade-in animation-delay-300">
        <Link
          to="/inspection"
          className="inline-flex items-center gap-2 bg-foreground px-6 py-3 text-sm font-medium text-background transition-transform duration-200 hover:scale-105 hover:bg-foreground/90"
        >
          Enter inspection
        </Link>
      </div>

      <p className="mt-6 max-w-sm animate-fade-in animation-delay-300 text-[11px] text-muted-foreground">
        Upload label photos, extract declarations, compare quantities, and download compliance reports.
      </p>
    </main>
  );
}
