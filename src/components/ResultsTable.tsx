import React, { useMemo } from "react";
import type { CustomColumn, SelectionRow } from "../types";
import { evaluateCustomColumn } from "../utils/customColumns";
import { Card } from "./ui";

export function ResultsTable({
  selections,
  maFields,
  hubFields,
  customColumns,
}: {
  selections: SelectionRow[];
  maFields: string[];
  hubFields: string[];
  customColumns: CustomColumn[];
}) {
  const rows = useMemo(() => selections, [selections]);

  const headerStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "140px 110px 1fr 1fr",
    gap: 10,
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    padding: "10px 12px",
    borderBottom: "var(--line-medium)",
  };

  return (
    <Card>
      <div className="ds-card-title" style={{ fontSize: "1.8rem" }}>
        6-8) Selections
      </div>

      <div style={headerStyle}>
        <div>Status</div>
        <div>Score</div>
        <div>M&A</div>
        <div>HubSpot</div>
      </div>

      <div style={{ maxHeight: 320, overflow: "auto" }}>
        {rows.map((r, index) => {
          const maSummary = maFields.map((f) => `${f}: ${String(r.maRow?.[f] ?? "")}`).join(" | ");

          let hubSummary: string;
          if (r.selectionType === "no_match") {
            hubSummary = "No Match";
          } else {
            const stdParts = hubFields.map((f) => `${f}: ${String(r.hubRow?.[f] ?? "")}`);
            const customParts = customColumns
              .filter((c) => c.name)
              .map((c) => `${c.name}: ${r.hubRow ? evaluateCustomColumn(r.hubRow, c) : ""}`);
            hubSummary = [...stdParts, ...customParts].join(" | ");
          }

          return (
            <div
              key={`${r.maIndex}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 110px 1fr 1fr",
                gap: 10,
                padding: "10px 12px",
                borderBottom: "var(--line-hairline)",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                {r.selectionType === "no_match" ? "No Match" : "Matched"}
              </div>
              <div style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>{r.score ?? ""}</div>
              <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {maSummary}
              </div>
              <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {hubSummary}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
