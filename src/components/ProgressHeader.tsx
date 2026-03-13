import { Card } from "./ui";

export function ProgressHeader({
  done,
  total,
  status,
}: {
  done: number;
  total: number;
  status: string;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <div className="ds-card-title" style={{ fontSize: "1.8rem", marginBottom: 0 }}>
          4) Progress
        </div>
        <div className="ds-meta ds-muted">{status}</div>
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        <div style={{ height: 12, border: "1px solid var(--border)", background: "var(--background)" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "var(--foreground)", transition: "width 100ms linear" }} />
        </div>
        <div className="ds-meta ds-muted" style={{ marginTop: "0.45rem" }}>
          {done.toLocaleString()} / {total.toLocaleString()} ({pct}%)
        </div>
      </div>
    </Card>
  );
}
