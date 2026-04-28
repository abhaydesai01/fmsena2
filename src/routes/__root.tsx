import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth";
import { CampusProvider } from "@/lib/campus";
import { Toaster } from "@/components/ui/sonner";
import { PreviewErrorBoundary } from "@/components/app/PreviewFallback";

import appCss from "../styles.css?url";

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
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Tuition Mate is a comprehensive fees payment and management system for educational institutions." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Tuition Mate is a comprehensive fees payment and management system for educational institutions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "Tuition Mate is a comprehensive fees payment and management system for educational institutions." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7fbc735b-45df-4c58-874e-a3609bf79205/id-preview-ca98d133--8f8aa172-d1a3-4808-a0cd-f2bf4925d42a.lovable.app-1776932635073.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7fbc735b-45df-4c58-874e-a3609bf79205/id-preview-ca98d133--8f8aa172-d1a3-4808-a0cd-f2bf4925d42a.lovable.app-1776932635073.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          // Last-resort safety net: if React never mounts (e.g. a chunk fails
          // to load), show a fallback message after 8s instead of a blank pane.
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('load',function(){setTimeout(function(){var r=document.getElementById('preview-mount-watchdog');if(r&&!r.dataset.mounted){r.style.display='flex';}},8000);});`,
          }}
        />
      </head>
      <body>
        <div
          id="preview-mount-watchdog"
          style={{
            display: "none",
            position: "fixed",
            inset: 0,
            zIndex: 2147483647,
            background: "#fff",
            color: "#111",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Preview didn't load
            </h1>
            <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
              The app didn't finish mounting. Try a hard reload (Cmd/Ctrl+Shift+R) or
              check the browser console for errors.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: 0,
                background: "#111",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
        {children}
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `var w=document.getElementById('preview-mount-watchdog');if(w){w.dataset.mounted='1';}`,
          }}
        />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  }));
  return (
    <PreviewErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CampusProvider>
            <Outlet />
            <Toaster richColors position="top-right" />
          </CampusProvider>
        </AuthProvider>
      </QueryClientProvider>
    </PreviewErrorBoundary>
  );
}
