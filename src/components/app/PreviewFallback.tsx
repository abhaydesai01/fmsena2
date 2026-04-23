import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level safety net. If anything inside the app throws during render
 * (before TanStack Router's per-route errorComponent can catch it), we
 * show a friendly fallback with troubleshooting steps instead of a
 * blank preview pane.
 */
export class PreviewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[PreviewErrorBoundary]", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    return <PreviewFallback error={this.state.error} onRetry={this.reset} />;
  }
}

export function PreviewFallback({
  error,
  onRetry,
}: {
  error?: Error | string | null;
  onRetry?: () => void;
}) {
  const message =
    typeof error === "string" ? error : error?.message ?? "The preview failed to render.";

  return (
    <div
      role="alert"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: "hsl(var(--background, 0 0% 100%))",
        color: "hsl(var(--foreground, 222 47% 11%))",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: 540, width: "100%" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(220, 38, 38, 0.08)",
            color: "rgb(185, 28, 28)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "rgb(220, 38, 38)",
            }}
          />
          Preview unavailable
        </div>
        <h1 style={{ marginTop: 16, fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
          The preview couldn't render
        </h1>
        <p style={{ marginTop: 8, fontSize: 14, opacity: 0.75 }}>
          The app crashed before it could mount, or a runtime error stopped rendering.
          Try the steps below.
        </p>

        <ol
          style={{
            marginTop: 20,
            paddingLeft: 20,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 14,
          }}
        >
          <li>
            <strong>Hard reload</strong> the preview pane (Cmd/Ctrl + Shift + R) to
            discard cached chunks.
          </li>
          <li>
            <strong>Check the browser console</strong> in DevTools for the underlying
            error — it usually points at a specific file.
          </li>
          <li>
            <strong>Open a known route</strong> directly, such as <code>/login</code> or{" "}
            <code>/dashboard</code>, to rule out a single broken page.
          </li>
          <li>
            <strong>Ask Lovable to fix it.</strong> Paste the console error into chat —
            most blank-preview issues are a missing import, a router typo, or a stale
            session.
          </li>
        </ol>

        {message && (
          <pre
            style={{
              marginTop: 20,
              padding: 12,
              borderRadius: 8,
              background: "rgba(0,0,0,0.05)",
              fontSize: 12,
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 160,
              overflow: "auto",
              color: "rgb(185, 28, 28)",
            }}
          >
            {message}
          </pre>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              if (onRetry) onRetry();
              else if (typeof window !== "undefined") window.location.reload();
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: 0,
              background: "hsl(var(--primary, 222 47% 11%))",
              color: "hsl(var(--primary-foreground, 0 0% 100%))",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a
            href="/login"
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.15)",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            Go to login
          </a>
        </div>
      </div>
    </div>
  );
}