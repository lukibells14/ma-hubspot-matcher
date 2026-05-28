import { useState } from "react";
import type { CustomColumn, ColumnRule, Condition, Operator, RowObject } from "../types";
import { evaluateCustomColumn } from "../utils/customColumns";
import { useResizable } from "../hooks/useResizable";
import { Button, Input, Select } from "./ui";

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

const OPERATORS: { value: Operator; label: string; needsValue: boolean }[] = [
  { value: "=",            label: "=",             needsValue: true  },
  { value: "!=",           label: "≠",             needsValue: true  },
  { value: ">=",           label: "≥",             needsValue: true  },
  { value: ">",            label: ">",             needsValue: true  },
  { value: "<=",           label: "≤",             needsValue: true  },
  { value: "<",            label: "<",             needsValue: true  },
  { value: "contains",     label: "contains",      needsValue: true  },
  { value: "not_contains", label: "not contains",  needsValue: true  },
  { value: "starts_with",  label: "starts with",   needsValue: true  },
  { value: "is_empty",     label: "is empty",      needsValue: false },
  { value: "is_not_empty", label: "is not empty",  needsValue: false },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function blankCondition(column: string): Condition {
  return { column, operator: "=", value: "" };
}

function blankRule(column: string): ColumnRule {
  return { id: uid(), logic: "ALL", conditions: [blankCondition(column)], output: "" };
}

function blankColumn(hubCols: string[]): CustomColumn {
  const firstCol = hubCols[0] ?? "";
  return { id: uid(), name: "", rules: [blankRule(firstCol)], defaultValue: "" };
}

// ── Condition row ────────────────────────────────────────────────────────────
function ConditionRow({
  cond,
  hubCols,
  onChange,
  onRemove,
  canRemove,
}: {
  cond: Condition;
  hubCols: string[];
  onChange: (c: Condition) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const opMeta = OPERATORS.find((o) => o.value === cond.operator);
  return (
    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.4rem" }}>
      <Select
        value={cond.column}
        onChange={(e) => onChange({ ...cond, column: e.target.value })}
        style={{ flex: "1 1 160px", minWidth: 0 }}
      >
        {hubCols.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>

      <Select
        value={cond.operator}
        onChange={(e) => onChange({ ...cond, operator: e.target.value as Operator, value: "" })}
        style={{ flex: "0 0 160px", minWidth: 0 }}
      >
        {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>

      {opMeta?.needsValue ? (
        <Input
          placeholder="value"
          value={cond.value}
          onChange={(e) => onChange({ ...cond, value: e.target.value })}
          style={{ flex: "1 1 100px", minWidth: 0 }}
        />
      ) : (
        <div style={{ flex: "1 1 100px", minWidth: 0 }} />
      )}

      {canRemove && (
        <Button variant="ghost" onClick={onRemove} style={{ padding: "0.2rem 0.5rem", flexShrink: 0 }}>✕</Button>
      )}
    </div>
  );
}

// ── Rule card ────────────────────────────────────────────────────────────────
function RuleCard({
  rule,
  index,
  hubCols,
  onChange,
  onRemove,
  canRemove,
}: {
  rule: ColumnRule;
  index: number;
  hubCols: string[];
  onChange: (r: ColumnRule) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const updateCond = (i: number, c: Condition) => {
    const next = [...rule.conditions];
    next[i] = c;
    onChange({ ...rule, conditions: next });
  };
  const removeCond = (i: number) => {
    onChange({ ...rule, conditions: rule.conditions.filter((_, idx) => idx !== i) });
  };
  const addCond = () => {
    onChange({ ...rule, conditions: [...rule.conditions, blankCondition(hubCols[0] ?? "")] });
  };

  return (
    <div
      className="ds-card-muted"
      style={{ marginBottom: "0.75rem", padding: "0.75rem 1rem", position: "relative" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="ds-kicker" style={{ fontSize: "0.65rem" }}>
            {index === 0 ? "IF" : "ELSE IF"}
          </span>
          <Select
            value={rule.logic}
            onChange={(e) => onChange({ ...rule, logic: e.target.value as "ALL" | "ANY" })}
            style={{ width: "auto", minWidth: 72 }}
          >
            <option value="ALL">ALL</option>
            <option value="ANY">ANY</option>
          </Select>
          <span className="ds-meta ds-muted">of these conditions are true:</span>
        </div>
        {canRemove && (
          <Button variant="ghost" onClick={onRemove} style={{ padding: "0.2rem 0.5rem" }}>Remove rule</Button>
        )}
      </div>

      {rule.conditions.map((cond, i) => (
        <ConditionRow
          key={i}
          cond={cond}
          hubCols={hubCols}
          onChange={(c) => updateCond(i, c)}
          onRemove={() => removeCond(i)}
          canRemove={rule.conditions.length > 1}
        />
      ))}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <Button variant="ghost" onClick={addCond} style={{ fontSize: "0.8rem" }}>+ Add Condition</Button>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="ds-meta">→ Output:</span>
          <Input
            placeholder="value if matched"
            value={rule.output}
            onChange={(e) => onChange({ ...rule, output: e.target.value })}
            style={{ width: 160 }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Preview table ────────────────────────────────────────────────────────────
function PreviewTable({
  col,
  hubRows,
}: {
  col: CustomColumn;
  hubRows: RowObject[];
}) {
  if (!col.name || hubRows.length === 0) return null;

  const sample = hubRows.slice(0, 8);
  const colsUsed = Array.from(
    new Set(col.rules.flatMap((r) => r.conditions.map((c) => c.column)))
  ).slice(0, 3);

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <div className="ds-kicker" style={{ marginBottom: "0.4rem" }}>Preview (first 8 HubSpot rows)</div>
      <div className="ds-table-wrap" style={{ maxHeight: 220, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
          <thead>
            <tr>
              {colsUsed.map((c) => (
                <th key={c} style={thStyle}>{c}</th>
              ))}
              <th style={{ ...thStyle, background: "var(--foreground)", color: "var(--background)" }}>
                {col.name || "Result"}
              </th>
            </tr>
          </thead>
          <tbody>
            {sample.map((row, i) => (
              <tr key={i}>
                {colsUsed.map((c) => (
                  <td key={c} style={tdStyle} title={String(row[c] ?? "")}>
                    {String(row[c] ?? "—")}
                  </td>
                ))}
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  {evaluateCustomColumn(row, col) || <span className="ds-muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.35rem 0.6rem",
  borderBottom: "2px solid var(--border)",
  fontSize: "0.72rem",
  position: "sticky",
  top: 0,
  background: "var(--background)",
  whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  padding: "0.3rem 0.6rem",
  borderBottom: "1px solid var(--border-light)",
  maxWidth: 180,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

// ── Column editor panel ──────────────────────────────────────────────────────
function ColumnEditor({
  col,
  hubCols,
  hubRows,
  onChange,
}: {
  col: CustomColumn;
  hubCols: string[];
  hubRows: RowObject[];
  onChange: (c: CustomColumn) => void;
}) {
  const updateRule = (i: number, r: ColumnRule) => {
    const next = [...col.rules];
    next[i] = r;
    onChange({ ...col, rules: next });
  };
  const removeRule = (i: number) => {
    onChange({ ...col, rules: col.rules.filter((_, idx) => idx !== i) });
  };
  const addRule = () => {
    onChange({ ...col, rules: [...col.rules, blankRule(hubCols[0] ?? "")] });
  };

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <span className="ds-kicker">Column Name</span>
        <Input
          placeholder="e.g. Prospect/Client"
          value={col.name}
          onChange={(e) => onChange({ ...col, name: e.target.value })}
        />
      </label>

      <div>
        <div className="ds-kicker" style={{ marginBottom: "0.5rem" }}>Rules (first match wins)</div>
        {col.rules.map((rule, i) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            index={i}
            hubCols={hubCols}
            onChange={(r) => updateRule(i, r)}
            onRemove={() => removeRule(i)}
            canRemove={col.rules.length > 1}
          />
        ))}
        <Button variant="ghost" onClick={addRule} style={{ fontSize: "0.85rem" }}>
          + Add Rule (ELSE IF)
        </Button>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span className="ds-kicker" style={{ whiteSpace: "nowrap" }}>Default value</span>
        <Input
          placeholder="value if no rules match"
          value={col.defaultValue}
          onChange={(e) => onChange({ ...col, defaultValue: e.target.value })}
        />
      </label>

      <PreviewTable col={col} hubRows={hubRows} />
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export function CustomColumnBuilder({
  open,
  hubCols,
  hubRows,
  columns,
  onChange,
  onClose,
}: {
  open: boolean;
  hubCols: string[];
  hubRows: RowObject[];
  columns: CustomColumn[];
  onChange: (cols: CustomColumn[]) => void;
  onClose: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { ref, size, onResizeMouseDown } = useResizable(600, 480);

  if (!open) return null;

  const activeCol = columns.find((c) => c.id === activeId) ?? columns[0] ?? null;

  const addColumn = () => {
    const col = blankColumn(hubCols);
    onChange([...columns, col]);
    setActiveId(col.id);
  };

  const updateColumn = (col: CustomColumn) => {
    onChange(columns.map((c) => (c.id === col.id ? col : c)));
  };

  const removeColumn = (id: string) => {
    const next = columns.filter((c) => c.id !== id);
    onChange(next);
    setActiveId(next[0]?.id ?? null);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        ref={ref}
        className="ds-card"
        style={{
          width: size ? size.width : "min(1100px, 100%)",
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
            <div className="ds-kicker">Export Enhancement</div>
            <div className="ds-card-title" style={{ fontSize: "1.6rem", marginBottom: 0 }}>Custom Columns</div>
          </div>
          <Button onClick={onClose} aria-label="Close">✕</Button>
        </div>

        <span className="ds-meta ds-muted" style={{ flexShrink: 0 }}>
          Define computed columns built from HubSpot data. They appear in your Excel export alongside matched records.
        </span>

        {/* Body: sidebar + editor */}
        <div style={{ display: "flex", gap: "1.25rem", flex: 1, minHeight: 0 }}>
          {/* Sidebar */}
          <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <div className="ds-kicker" style={{ marginBottom: "0.25rem" }}>Columns</div>
            {columns.length === 0 && (
              <span className="ds-meta ds-muted">No columns yet.</span>
            )}
            {columns.map((col) => (
              <div
                key={col.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.4rem 0.6rem",
                  cursor: "pointer",
                  background: activeCol?.id === col.id ? "var(--foreground)" : "var(--muted)",
                  color: activeCol?.id === col.id ? "var(--background)" : "var(--foreground)",
                  fontSize: "0.85rem",
                  fontFamily: "var(--font-mono)",
                  gap: "0.25rem",
                }}
                onClick={() => setActiveId(col.id)}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {col.name || <em style={{ opacity: 0.6 }}>Unnamed</em>}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeColumn(col.id); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "inherit", padding: "0 0.1rem", flexShrink: 0, opacity: 0.6,
                    fontSize: "0.75rem",
                  }}
                  aria-label="Remove column"
                >✕</button>
              </div>
            ))}
            <Button variant="ghost" onClick={addColumn} style={{ marginTop: "0.25rem", fontSize: "0.8rem" }}>
              + New Column
            </Button>
          </div>

          {/* Editor */}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
            {activeCol ? (
              <ColumnEditor
                col={activeCol}
                hubCols={hubCols}
                hubRows={hubRows}
                onChange={updateColumn}
              />
            ) : (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <span className="ds-meta ds-muted">Click "+ New Column" to get started.</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            borderTop: "var(--line-thin)",
            paddingTop: "0.75rem",
            flexShrink: 0,
          }}
        >
          <span className="ds-meta ds-muted" style={{ flex: 1, alignSelf: "center" }}>
            {columns.length} custom {columns.length === 1 ? "column" : "columns"} defined
          </span>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </div>

        <ResizeHandle onMouseDown={onResizeMouseDown} />
      </div>
    </div>
  );
}
