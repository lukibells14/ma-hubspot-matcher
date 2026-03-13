import { Button } from "./ui";

export function SummaryModal({
  open,
  title,
  rowCount,
  columns,
  sampleRows,
  onClose,
}: {
  open: boolean;
  title: string;
  rowCount: number;
  columns: string[];
  sampleRows: Record<string, any>[];
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(255,255,255,0.92)",
        border: "10px solid var(--foreground)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div className="ds-card" style={{ width: "min(960px, 100%)", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ paddingBottom: "0.8rem", borderBottom: "var(--line-medium)", display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div className="ds-card-title" style={{ fontSize: "2rem" }}>
              {title}
            </div>
            <div className="ds-meta ds-muted">
              {rowCount.toLocaleString()} rows | {columns.length} columns
            </div>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>

        <div style={{ marginTop: "0.9rem" }}>
          <div className="ds-kicker" style={{ marginBottom: "0.55rem" }}>
            Columns
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginBottom: "0.9rem" }}>
            {columns.slice(0, 40).map((c) => (
              <span key={c} className="ds-pill">
                {c}
              </span>
            ))}
            {columns.length > 40 && <span className="ds-meta ds-muted">...and {columns.length - 40} more</span>}
          </div>

          <div className="ds-kicker" style={{ marginBottom: "0.55rem" }}>
            Preview (first {sampleRows.length})
          </div>
          <div className="ds-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {columns.slice(0, 8).map((c) => (
                    <th key={c} style={{ textAlign: "left", padding: 8, borderBottom: "var(--line-medium)", fontFamily: "var(--font-mono)" }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((r, i) => (
                  <tr key={i}>
                    {columns.slice(0, 8).map((c) => (
                      <td key={c} style={{ padding: 8, borderBottom: "var(--line-hairline)" }}>
                        {String(r?.[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ds-meta ds-muted" style={{ marginTop: "0.7rem" }}>
            Tip: For 200K+ HubSpot rows, caching is recommended so you only upload once.
          </div>
        </div>
      </div>
    </div>
  );
}
