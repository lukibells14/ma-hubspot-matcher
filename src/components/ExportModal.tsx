import { useState } from "react";
import { Button, Input } from "./ui";

export function ExportModal({
  open,
  isFinished,
  onClose,
  onExport,
}: {
  open: boolean;
  isFinished: boolean;
  onClose: () => void;
  onExport: (xlsxName: string, csvName: string) => void;
}) {
  const [xlsxName, setXlsxName] = useState("ma_hubspot_matches");
  const [csvName, setCsvName] = useState("remaining_ma");

  if (!open) return null;

  const handleExport = () => {
    onExport(xlsxName.trim() || "ma_hubspot_matches", csvName.trim() || "remaining_ma");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        className="ds-card"
        style={{ width: 440, padding: "2rem", background: "var(--background)", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ds-card-title" style={{ fontSize: "1.6rem", marginBottom: "1.5rem" }}>
          Export Files
        </div>

        <label className="ds-control-label">
          Excel file name
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Input
              value={xlsxName}
              onChange={(e) => setXlsxName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleExport()}
            />
            <span className="ds-meta ds-muted" style={{ whiteSpace: "nowrap" }}>.xlsx</span>
          </div>
        </label>

        {!isFinished && (
          <label className="ds-control-label" style={{ marginTop: "1rem" }}>
            Remaining MA records file name
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Input
                value={csvName}
                onChange={(e) => setCsvName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleExport()}
              />
              <span className="ds-meta ds-muted" style={{ whiteSpace: "nowrap" }}>.csv</span>
            </div>
          </label>
        )}

        {!isFinished && (
          <div className="ds-card-muted" style={{ marginTop: "1rem", fontSize: "0.8rem" }}>
            <span className="ds-meta ds-muted">
              The CSV will contain only the MA records not yet reviewed.
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleExport}>Download</Button>
        </div>
      </div>
    </div>
  );
}
