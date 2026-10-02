"use client";

/** Last-resort error page (errors in the root layout). Kept dependency-free. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f8f9fb", color: "#1f2330", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Something went wrong / Algo salió mal</h1>
          <p style={{ fontSize: 14, color: "#5b6070" }}>
            The CRM couldn&apos;t load. Please try again in a moment. An administrator can open <a href="/api/health?db=1">/api/health?db=1</a> to see what&apos;s wrong.
          </p>
          <button onClick={() => reset()} style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, border: "1px solid #ccd", background: "white", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
