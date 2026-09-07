"use client";

import { useEffect } from "react";

/**
 * Replaces the root layout when the layout itself fails, so it cannot rely on
 * globals.css having loaded — the styles here are inline on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f6fa",
          color: "#0f1c2e",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "34rem" }}>
          <p
            style={{
              margin: 0,
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              color: "#bd2930",
            }}
          >
            Error · Inboxproof failed to start
          </p>
          <h1
            style={{
              margin: "0.75rem 0 0",
              fontSize: "2rem",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            }}
          >
            The application did not load.
          </h1>
          <p style={{ margin: "1rem 0 0", lineHeight: 1.7, color: "#26364d" }}>
            Nothing about your domain has changed. Reload to try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.75rem",
              padding: "0.7rem 1.25rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#0f1c2e",
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
