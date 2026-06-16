export type OverlayState =
  | { phase: "csv"; filename: string }
  | { phase: "indexing"; done: number; total: number }
  | { phase: "scanning"; labels: string[] }
  | { phase: "prescreen"; done: number; total: number };

export function LoadingOverlay({ state }: { state: OverlayState | null }) {
  if (!state) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(255, 255, 255, 0.82)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "all",
      }}
    >
      <style>{`
        @keyframes ds-spin {
          to { transform: rotate(360deg); }
        }
        .ds-overlay-spinner {
          width: 34px;
          height: 34px;
          border: 3px solid #e5e5e5;
          border-top-color: #000;
          border-radius: 50% !important;
          animation: ds-spin 0.9s linear infinite;
          flex-shrink: 0;
        }
        .ds-overlay-progress-track {
          width: 100%;
          height: 6px;
          border: 2px solid #000;
          background: #fff;
        }
        .ds-overlay-progress-fill {
          height: 100%;
          background: #000;
          transition: width 0.12s ease;
        }
      `}</style>

      <div
        style={{
          background: "#fff",
          border: "2px solid #000",
          padding: "2.5rem 3rem",
          minWidth: 360,
          maxWidth: 480,
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <Content state={state} />
      </div>
    </div>
  );
}

function Content({ state }: { state: OverlayState }) {
  const titleStyle = {
    fontFamily: "var(--font-display)",
    fontSize: "1.5rem",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1,
  };

  const subtitleStyle = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    color: "var(--muted-foreground)",
    marginTop: "0.4rem",
  };

  const countStyle = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    color: "var(--muted-foreground)",
  };

  if (state.phase === "csv") {
    return (
      <>
        <div className="ds-overlay-spinner" />
        <div>
          <div style={titleStyle}>Parsing CSV</div>
          <div style={subtitleStyle}>{state.filename}</div>
        </div>
      </>
    );
  }

  if (state.phase === "indexing") {
    const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
    return (
      <>
        <div style={titleStyle}>Indexing HubSpot</div>
        <div style={{ width: "100%" }}>
          <div className="ds-overlay-progress-track">
            <div className="ds-overlay-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div style={countStyle}>
          {state.done.toLocaleString()} / {state.total.toLocaleString()}
        </div>
      </>
    );
  }

  if (state.phase === "scanning") {
    return (
      <>
        <div className="ds-overlay-spinner" />
        <div>
          <div style={titleStyle}>Scanning Records</div>
          {state.labels.length > 0 && (
            <div style={subtitleStyle}>{state.labels.join(" · ")}</div>
          )}
        </div>
      </>
    );
  }

  // prescreen
  const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
  return (
    <>
      <div style={titleStyle}>Preparing Review Queue</div>
      {state.total > 0 ? (
        <>
          <div style={{ width: "100%" }}>
            <div className="ds-overlay-progress-track">
              <div className="ds-overlay-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div style={countStyle}>
            {state.done.toLocaleString()} / {state.total.toLocaleString()}
          </div>
        </>
      ) : (
        <div className="ds-overlay-spinner" />
      )}
    </>
  );
}
