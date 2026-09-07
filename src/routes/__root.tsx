import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Measure | Legal Metrology Compliance" },
      { name: "description", content: "Inspect packaged commodity labels against Legal Metrology declaration requirements." },
      { name: "author", content: "Measure" },
      { property: "og:title", content: "Measure | Legal Metrology Compliance" },
      { property: "og:description", content: "Inspect packaged commodity labels against Legal Metrology declaration requirements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-2.5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center bg-foreground font-mono text-[11px] font-semibold text-background">LM</span>
          <div className="leading-tight">
            <p className="font-mono text-[11px] font-semibold">METROGRAPH<span className="text-primary">.</span></p>
            <p className="text-[10px] text-muted-foreground">Legal Metrology Inspection Console</p>
          </div>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: "bg-foreground text-background px-2.5 py-1.5 text-xs font-medium" }}
            inactiveProps={{ className: "text-muted-foreground hover:text-foreground px-2.5 py-1.5 text-xs font-medium" }}
          >
            New inspection
          </Link>
          <Link
            to="/dashboard"
            activeProps={{ className: "bg-foreground text-background px-2.5 py-1.5 text-xs font-medium" }}
            inactiveProps={{ className: "text-muted-foreground hover:text-foreground px-2.5 py-1.5 text-xs font-medium" }}
          >
            Dashboard
          </Link>
          <Link
            to="/rules"
            activeProps={{ className: "bg-foreground text-background px-2.5 py-1.5 text-xs font-medium" }}
            inactiveProps={{ className: "text-muted-foreground hover:text-foreground px-2.5 py-1.5 text-xs font-medium" }}
          >
            Legal limits
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <span className="grid size-7 place-items-center bg-background font-mono text-[10px] outline outline-border">AO</span>
        </div>
      </div>
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Header />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
