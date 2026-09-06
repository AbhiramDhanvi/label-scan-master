import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Measure" },
      { name: "description", content: "Privacy policy for the Measure legal metrology inspection console." },
      { property: "og:title", content: "Privacy Policy | Measure" },
      { property: "og:description", content: "Privacy policy for the Measure legal metrology inspection console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return <PolicyPage title="Privacy Policy" effective="6 September 2026" sections={[
    ["Information we handle", "Measure processes account details, inspection records, uploaded product images, extracted label text and report activity needed to provide the service."],
    ["How information is used", "Information is used to analyse packaged commodity labels, preserve inspection history, prepare reports, secure accounts and improve reliability."],
    ["Storage and retention", "Inspection data is retained for the period required by the responsible organisation. Administrators should configure retention according to applicable law and departmental policy."],
    ["Sharing and security", "Information is not sold. Access should be limited to authorised personnel. Reasonable technical and organisational safeguards are used, but no system can guarantee absolute security."],
    ["Your choices", "Authorised users may request access, correction or deletion through their organisation, subject to legal record-keeping duties."],
  ]} />;
}

function PolicyPage({ title, effective, sections }: { title: string; effective: string; sections: string[][] }) {
  return <main className="min-h-screen bg-background px-5 py-12 text-foreground"><article className="mx-auto max-w-3xl"><Link to="/" className="font-mono text-xs text-primary hover:underline">← Return to console</Link><p className="mt-10 font-mono text-xs text-muted-foreground">EFFECTIVE {effective.toUpperCase()}</p><h1 className="mt-2 font-mono text-3xl font-semibold">{title}</h1><p className="mt-5 border-l-2 border-primary pl-4 text-sm leading-6 text-muted-foreground">This draft is provided for product review and should be reviewed by qualified counsel before public launch.</p><div className="mt-10 divide-y divide-border border-y border-border">{sections.map(([heading, body]) => <section key={heading} className="py-6"><h2 className="font-mono text-sm font-semibold uppercase">{heading}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{body}</p></section>)}</div></article></main>;
}