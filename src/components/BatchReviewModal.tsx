import { useEffect, useMemo, useRef, useState } from "react";
import type { BatchMatchItem, BatchMatchResult, CustomColumn } from "../types";
import { applyCustomColumns } from "../utils/customColumns";
import { useResizable } from "../hooks/useResizable";
import { Button } from "./ui";
import { FieldSelectorDropdown } from "./FieldSelectorDropdown";

const ResizeHandle = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
  <div
    onMouseDown={onMouseDown}
    title="Drag to resize"
    style={{
      position: "absolute", bottom: 0, right: 0,
      width: 20, height: 20, cursor: "nwse-resize",
      display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
      padding: "3px", opacity: 0.3, userSelect: "none", zIndex: 10,
    }}
  >
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </div>
);

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.4rem 0.6rem",
  borderBottom: "2px solid var(--border)",
  whiteSpace: "nowrap",
  fontSize: "0.72rem",
  fontFamily: "var(--font-mono)",
  position: "sticky",
  top: 0,
  background: "var(--background)",
};

const tdStyle: React.CSSProperties = {
  padding: "0.35rem 0.6rem",
  borderBottom: "1px solid var(--border-light)",
  maxWidth: 220,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "0.82rem",
  fontFamily: "var(--font-mono)",
};

export function BatchReviewModal({
  open,
  result,
  maCols,
  hubCols,
  defaultMaCols,
  defaultHubCols,
  customColumns,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  result: BatchMatchResult | null;
  maCols: string[];
  hubCols: string[];
  defaultMaCols: string[];
  defaultHubCols: string[];
  customColumns: CustomColumn[];
  onConfirm: (confirmed: BatchMatchItem[]) => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [selectedMaCols, setSelectedMaCols] = useState<string[]>(defaultMaCols);
  const [selectedHubCols, setSelectedHubCols] = useState<string[]>(defaultHubCols);
  const { ref, size, onResizeMouseDown } = useResizable(540, 400);

  const resultRef = useRef(result);
  resultRef.current = result;

  // HubSpot columns + any named custom columns
  const allHubCols = useMemo(
    () => [...hubCols, ...customColumns.filter((c) => c.name).map((c) => c.name)],
    [hubCols, customColumns],
  );

  // Reset state each time the modal opens with new results
  useEffect(() => {
    if (open && resultRef.current) {
      setChecked(new Set(resultRef.current.matched.map((i) => i.maIndex)));
      setSelectedMaCols(defaultMaCols.slice());
      setSelectedHubCols(defaultHubCols.slice());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !result) return null;

  const allChecked = result.matched.length > 0 && result.matched.every((i) => checked.has(i.maIndex));
  const confirmedCount = checked.size;
  const uncheckedCount = result.matched.length - confirmedCount;

  const toggleAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(result.matched.map((i) => i.maIndex)));
  };

  const toggleOne = (maIndex: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(maIndex)) next.delete(maIndex);
      else next.add(maIndex);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(result.matched.filter((i) => checked.has(i.maIndex)));
  };

  const maColsToShow = selectedMaCols.length > 0 ? selectedMaCols : defaultMaCols;
  const hubColsToShow = selectedHubCols.length > 0 ? selectedHubCols : defaultHubCols;

  // Augment a hubRow with custom column computed values
  const augment = (hubRow: Record<string, any>) =>
    customColumns.length > 0 ? { ...hubRow, ...applyCustomColumns(hubRow, customColumns) } : hubRow;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onCancel}
    >
      <div
        ref={ref}
        className="ds-card"
        style={{
          width: size ? size.width : "min(940px, 100%)",
          height: size ? size.height : undefined,
          maxHeight: size ? undefined : "90vh",
          background: "var(--background)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div>
            <div className="ds-kicker">Batch Auto-Match</div>
            <div className="ds-card-title" style={{ fontSize: "1.6rem", marginBottom: 0 }}>
              Auto-Match Preview
            </div>
          </div>
          <Button onClick={onCancel} aria-label="Close">✕</Button>
        </div>

        {/* Stats */}
        <div
          className="ds-card-muted"
          style={{ display: "flex", gap: "2rem", flexWrap: "wrap", padding: "0.75rem 1rem", flexShrink: 0 }}
        >
          <div>
            <div className="ds-kicker" style={{ marginBottom: "0.2rem" }}>Exact 1-to-1 matches</div>
            <div style={{ fontSize: "1.5rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
              {result.matched.length.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="ds-kicker" style={{ marginBottom: "0.2rem" }}>Ambiguous (2+) → manual</div>
            <div style={{ fontSize: "1.5rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
              {result.ambiguousCount.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="ds-kicker" style={{ marginBottom: "0.2rem" }}>No match → manual</div>
            <div style={{ fontSize: "1.5rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
              {result.noMatchCount.toLocaleString()}
            </div>
          </div>
        </div>

        <span className="ds-meta ds-muted" style={{ flexShrink: 0 }}>
          Review the matches below. Uncheck any that look incorrect — they will be sent to manual review.
        </span>

        {/* Column selectors — z-index keeps dropdowns above table */}
        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", position: "relative", zIndex: 50, flexShrink: 0 }}>
          <FieldSelectorDropdown
            label="M&A Columns"
            allFields={maCols}
            selected={selectedMaCols}
            onChange={setSelectedMaCols}
          />
          <FieldSelectorDropdown
            label="HubSpot Columns"
            allFields={allHubCols}
            selected={selectedHubCols}
            onChange={setSelectedHubCols}
          />
        </div>

        {/* Select all / count row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            <span className="ds-meta">{allChecked ? "Deselect All" : "Select All"}</span>
          </label>
          <span className="ds-meta ds-muted">
            {confirmedCount.toLocaleString()} / {result.matched.length.toLocaleString()} selected
          </span>
        </div>

        {/* Table — grows to fill modal when resized */}
        <div className="ds-table-wrap" style={{ flex: 1, minHeight: 120, overflowY: "auto" }}>
          {result.matched.length === 0 ? (
            <div className="ds-card-muted" style={{ padding: "2rem", textAlign: "center" }}>
              <span className="ds-meta ds-muted">No exact matches found. All records will proceed to manual review.</span>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 36, textAlign: "center" }}></th>
                  {maColsToShow.map((col) => (
                    <th key={`ma-${col}`} style={thStyle}>
                      <span className="ds-pill" style={{ fontSize: "0.6rem", marginRight: "0.3rem", padding: "0.1rem 0.3rem" }}>M&A</span>
                      {col}
                    </th>
                  ))}
                  {hubColsToShow.map((col) => (
                    <th key={`hub-${col}`} style={thStyle}>
                      <span className="ds-pill" style={{ fontSize: "0.6rem", marginRight: "0.3rem", padding: "0.1rem 0.3rem" }}>HUB</span>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.matched.map((item) => {
                  const isChecked = checked.has(item.maIndex);
                  const augRow = augment(item.hubRow);
                  return (
                    <tr
                      key={item.maIndex}
                      style={{
                        cursor: "pointer",
                        background: isChecked ? "var(--background)" : "var(--muted)",
                        opacity: isChecked ? 1 : 0.45,
                      }}
                      onClick={() => toggleOne(item.maIndex)}
                    >
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(item.maIndex)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      {maColsToShow.map((col) => (
                        <td key={`ma-${col}`} style={tdStyle} title={String(item.maRow[col] ?? "")}>
                          {String(item.maRow[col] ?? "—")}
                        </td>
                      ))}
                      {hubColsToShow.map((col) => (
                        <td key={`hub-${col}`} style={tdStyle} title={String(augRow[col] ?? "")}>
                          {String(augRow[col] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: "0.75rem",
            borderTop: "var(--line-thin)", paddingTop: "0.75rem", flexShrink: 0,
          }}
        >
          <span className="ds-meta ds-muted">
            <strong>{confirmedCount.toLocaleString()}</strong> confirmed
            {uncheckedCount > 0 && (
              <> · <strong>{uncheckedCount.toLocaleString()}</strong> unchecked → manual review</>
            )}
          </span>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={handleConfirm}>
              Confirm &amp; Start Manual Review →
            </Button>
          </div>
        </div>

        <ResizeHandle onMouseDown={onResizeMouseDown} />
      </div>
    </div>
  );
}
