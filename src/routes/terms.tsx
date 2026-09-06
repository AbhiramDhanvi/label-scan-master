import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions | Measure" },
      { name: "description", content: "Terms for using the Measure legal metrology inspection console." },
      { property: "og:title", content: "Terms and Conditions | Measure" },
      { property: "og:description", content: "Terms for using the Measure legal metrology inspection console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

const sections = [
  ["Purpose", "Measure assists authorised users in reviewing packaged commodity declarations under the Legal Metrology (Packaged Commodities) Rules, 2011."],
  ["No legal determination", "Automated findings are indicative. They do not replace inspection, professional judgement or a determination by an authorised authority."],
  ["Permitted use", "Users must submit information they are authorised to process, protect their account and use the service only for lawful inspection and compliance activity."],
  ["Accuracy", "Optical recognition and rule checks may be incomplete or incorrect. Users must verify extracted text, measurements, cited provisions and supporting evidence before acting."],
  ["Reports", "Generated reports are working documents. The responsible officer must review and approve each report before official use."],
  ["Availability", "The service may change or become temporarily unavailable. No uninterrupted or error-free operation is promised."],
];

function Terms() {
  return <main className="min-h-screen bg-background px-5 py-12 text-foreground"><article className="mx-auto max-w-3xl"><Link to="/" className="font-mono text-xs text-primary hover:underline">← Return to console</Link><p className="mt-10 font-mono text-xs text-muted-foreground">EFFECTIVE 6 SEPTEMBER 2026</p><h1 className="mt-2 font-mono text-3xl font-semibold">Terms and Conditions</h1><p className="mt-5 border-l-2 border-primary pl-4 text-sm leading-6 text-muted-foreground">This draft is provided for product review and should be reviewed by qualified counsel before public launch.</p><div className="mt-10 divide-y divide-border border-y border-border">{sections.map(([heading, body]) => <section key={heading} className="py-6"><h2 className="font-mono text-sm font-semibold uppercase">{heading}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{body}</p></section>)}</div></article></main>;
}