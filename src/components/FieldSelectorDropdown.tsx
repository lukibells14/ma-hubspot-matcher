import { useMemo, useState } from "react";
import { Button } from "./ui";

export function FieldSelectorDropdown({
  label,
  allFields,
  selected,
  onChange,
  showFoundBy,
  onToggleFoundBy,
}: {
  label: string;
  allFields: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  showFoundBy?: boolean;
  onToggleFoundBy?: (next: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(() => [...allFields].sort(), [allFields]);

  const toggle = (f: string) => {
    const has = selected.includes(f);
    onChange(has ? selected.filter((x) => x !== f) : [...selected, f]);
  };

  const isHubspot = label.toLowerCase().includes("hubspot");

  return (
    <div style={{ position: "relative" }}>
      <Button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {label}
      </Button>

      {open && (
        <div
          className="ds-card"
          style={{
            position: "absolute",
            top: "calc(100% + 0.35rem)",
            right: 0,
            zIndex: 25,
            width: 340,
            maxHeight: 360,
            overflow: "auto",
          }}
        >
          <div className="ds-card-title" style={{ fontSize: "1.5rem", marginBottom: "0.6rem" }}>
            {label}
          </div>

          {isHubspot && onToggleFoundBy && (
            <div className="ds-card-muted" style={{ marginBottom: "0.7rem" }}>
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={showFoundBy ?? true} onChange={(e) => onToggleFoundBy(e.target.checked)} />
                <span className="ds-meta">Show "Found By" under company name</span>
              </label>
            </div>
          )}

          {sorted.map((f) => (
            <label key={f} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.35rem" }}>
              <input type="checkbox" checked={selected.includes(f)} onChange={() => toggle(f)} />
              <span>{f}</span>
            </label>
          ))}

          <div style={{ marginTop: "0.65rem", display: "flex", justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
