import { useEffect, useMemo, useState } from "react";
import type { CandidateDisplay, RowObject } from "../types";
import { Input } from "./ui";

export function MatchViewer({
  maRow,
  maFields,
  hubFields,
  candidates,
  onSelectHub,
  onSelectNoMatch,
  showFoundBy = true,
}: {
  maRow: RowObject;
  maFields: string[];
  hubFields: string[];
  candidates: CandidateDisplay[];
  onSelectHub: (c: CandidateDisplay) => void;
  onSelectNoMatch: () => void;
  showFoundBy?: boolean;
}) {
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const noMatch = {
      hubIndex: -1,
      score: 0,
      foundBy: [] as any[],
      hubRow: { __label: "No Match" },
    } as CandidateDisplay;
    return [noMatch, ...candidates];
  }, [candidates]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    const terms = q.split(/\s+/).filter(Boolean);
    const nameField = hubFields[0];

    return items.filter((c, idx) => {
      if (idx === 0) return true;
      const title = String(c.hubRow?.[nameField] ?? "(blank)").toLowerCase();
      return terms.every((t) => title.includes(t));
    });
  }, [items, query, hubFields]);

  useEffect(() => setActive(0), [maRow]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(filteredItems.length - 1, 0)));
  }, [filteredItems.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filteredItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredItems[active];
        if (!selected) return;
        if (selected.hubIndex === -1) onSelectNoMatch();
        else onSelectHub(selected);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, filteredItems, onSelectHub, onSelectNoMatch]);

  const totalMatches = items.length - 1;
  const shownMatches = Math.max(filteredItems.length - 1, 0);

  const nameField = hubFields[0];
  const extraFields = hubFields.slice(1);

  const colScore = "80px";
  const colExtra = "240px";
  const colCompany = "minmax(320px, 1.3fr)";
  const gridCols = `${colCompany} ${colScore} ${extraFields.map(() => colExtra).join(" ")}`;

  return (
    <div className="ds-grid-2" style={{ gridTemplateColumns: "0.8fr 2.2fr", alignItems: "stretch" }}>
      <div className="ds-card" style={{ minWidth: 0, height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="ds-kicker" style={{ marginBottom: "0.6rem" }}>
          M&A Company
        </div>

        <div style={{ display: "grid", gap: "0.55rem" }}>
          {maFields.map((f) => (
            <div key={f}>
              <div className="ds-meta ds-muted">{f}</div>
              <div style={{ fontWeight: 700 }}>{String(maRow?.[f] ?? "")}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="ds-card" style={{ minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="ds-kicker">HubSpot Possible Matches</div>
          <div className="ds-meta ds-muted">Use UP/DOWN then Enter</div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.6rem" }}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by company name..." />
          {query.trim() && (
            <button className="ds-linklike" onClick={() => setQuery("")}>
              Clear
            </button>
          )}
        </div>

        <div className="ds-meta ds-muted" style={{ marginBottom: "0.5rem" }}>
          Showing <strong style={{ color: "var(--foreground)" }}>{shownMatches}</strong> of <strong style={{ color: "var(--foreground)" }}>{totalMatches}</strong>
        </div>

        <div
          className="ds-table-wrap"
          style={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            overflowY: "auto",
            overflowX: "auto",
            maxHeight: 660,
            minHeight: 360,
          }}
        >
          <div style={{ width: "max-content", minWidth: "100%" }}>
            <div
              style={{
                position: "sticky",
                top: 0,
                background: "#fff",
                zIndex: 2,
                borderBottom: "var(--line-medium)",
                display: "grid",
                gridTemplateColumns: gridCols,
                padding: "10px 8px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                alignItems: "center",
              }}
            >
              <div>Company</div>
              <div style={{ textAlign: "right" }}>Score</div>
              {extraFields.map((f) => (
                <div key={f} title={f} style={{ paddingLeft: 10 }}>
                  {f}
                </div>
              ))}
            </div>

            {filteredItems.map((c, index) => {
              const isActive = index === active;
              const isNoMatch = c.hubIndex === -1;

              const title = isNoMatch ? "No Match" : String(c.hubRow?.[nameField] ?? "(blank)");
              const foundByText = !isNoMatch ? (c.foundBy ?? []).join(", ") : "";

              return (
                <div
                  key={`${c.hubIndex}-${index}`}
                  onClick={() => {
                    setActive(index);
                    if (isNoMatch) onSelectNoMatch();
                    else onSelectHub(c);
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridCols,
                    padding: "10px 8px",
                    borderBottom: "var(--line-hairline)",
                    cursor: "pointer",
                    background: isActive ? "var(--foreground)" : "var(--background)",
                    color: isActive ? "var(--background)" : "var(--foreground)",
                    outline: isActive ? "2px solid var(--foreground)" : "none",
                    outlineOffset: -2,
                    alignItems: "center",
                    fontSize: 13,
                    transition: "background-color 100ms linear, color 100ms linear",
                  }}
                >
                  <div style={{ minWidth: 0, paddingRight: 10 }}>
                    <div title={title} style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {title}
                    </div>

                    {isNoMatch ? (
                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Select if none of the candidates match.</div>
                    ) : (
                      showFoundBy && (
                        <div
                          title={foundByText}
                          style={{
                            fontSize: 11,
                            opacity: 0.65,
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {foundByText}
                        </div>
                      )
                    )}
                  </div>

                  <div style={{ textAlign: "right", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{!isNoMatch ? c.score : ""}</div>

                  {extraFields.map((f) => {
                    const v = !isNoMatch ? String(c.hubRow?.[f] ?? "") : "";
                    return (
                      <div
                        key={f}
                        title={v}
                        style={{
                          paddingLeft: 10,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 600,
                        }}
                      >
                        {v || (isNoMatch ? "" : "-")}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div style={{ padding: 12, fontSize: 12, color: "var(--muted-foreground)" }}>No matches found for this filter.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
