import { useEffect, useMemo, useRef, useState } from "react";
import type { CandidateDisplay, RowObject, SelectionRow } from "../types";
import { getFirstMeaningfulWord } from "../utils/normalize";
import { Input } from "./ui";

export function MatchViewer({
  maRow,
  maFields,
  hubFields,
  candidates,
  onSelectHub,
  onSelectNoMatch,
  showFoundBy = true,
  previousSelection,
  onHubspotSearch,
  hubspotResults,
  hubspotResultsOverflow,
}: {
  maRow: RowObject;
  maFields: string[];
  hubFields: string[];
  candidates: CandidateDisplay[];
  onSelectHub: (c: CandidateDisplay) => void;
  onSelectNoMatch: () => void;
  showFoundBy?: boolean;
  previousSelection?: SelectionRow;
  onHubspotSearch: (query: string) => void;
  hubspotResults: CandidateDisplay[];
  hubspotResultsOverflow: boolean;
}) {
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"candidates" | "hubspot">("candidates");
  const [autoFill, setAutoFill] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickyModeRef = useRef<"candidates" | "hubspot">("candidates");
  const autoFillRef = useRef(false);

  const noMatchItem = useMemo<CandidateDisplay>(
    () => ({ hubIndex: -1, score: 0, foundBy: [], hubRow: { __label: "No Match" } }),
    [],
  );

  // Reset everything when M&A row changes, but preserve mode and autofill state
  useEffect(() => {
    setActive(0);
    setSearchMode(stickyModeRef.current);
    if (autoFillRef.current && stickyModeRef.current === "hubspot") {
      const maName = String(maRow?.[maFields[0]] ?? "");
      const firstWord = getFirstMeaningfulWord(maName);
      setQuery(firstWord ? firstWord + " " : "");
      if (firstWord) onHubspotSearch(firstWord);
    } else {
      setQuery("");
    }
  }, [maRow]);

  // Debounced HubSpot dataset search
  useEffect(() => {
    if (searchMode !== "hubspot") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onHubspotSearch(query.trim()), 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, searchMode, onHubspotSearch]);

  const candidateItems = useMemo(() => {
    if (previousSelection?.selectionType === "hubspot" && previousSelection.hubRow) {
      const prevItem = {
        hubIndex: previousSelection.hubIndex!,
        score: previousSelection.score ?? 0,
        foundBy: (previousSelection.foundBy ?? []) as any[],
        hubRow: previousSelection.hubRow,
        __isPrevious: true,
      } as CandidateDisplay & { __isPrevious: boolean };
      return [noMatchItem, prevItem, ...candidates];
    }
    return [noMatchItem, ...candidates];
  }, [candidates, previousSelection, noMatchItem]);

  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidateItems;
    const terms = q.split(/\s+/).filter(Boolean);
    const nameField = hubFields[0];
    return candidateItems.filter((c, idx) => {
      if (idx === 0) return true;
      if ((c as any).__isPrevious) return true;
      const title = String(c.hubRow?.[nameField] ?? "(blank)").toLowerCase();
      return terms.every((t) => title.includes(t));
    });
  }, [candidateItems, query, hubFields]);

  const displayItems = useMemo<CandidateDisplay[]>(
    () => searchMode === "hubspot" ? [noMatchItem, ...hubspotResults] : filteredCandidates,
    [searchMode, hubspotResults, filteredCandidates, noMatchItem],
  );

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(displayItems.length - 1, 0)));
  }, [displayItems.length]);

  const handleSelectHub = (c: CandidateDisplay) => {
    stickyModeRef.current = searchMode;
    onSelectHub(c);
  };

  const handleSelectNoMatch = () => {
    stickyModeRef.current = searchMode;
    onSelectNoMatch();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, displayItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = displayItems[active];
        if (!selected) return;
        if (selected.hubIndex === -1) handleSelectNoMatch();
        else handleSelectHub(selected);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, displayItems, handleSelectHub, handleSelectNoMatch]);

  const prevOffset = candidateItems.some((c) => (c as any).__isPrevious) ? 1 : 0;
  const totalCandidates = candidateItems.length - 1 - prevOffset;
  const shownCandidates = Math.max(
    filteredCandidates.filter((c) => !(c as any).__isPrevious).length - 1,
    0,
  );

  const nameField = hubFields[0];
  const extraFields = hubFields.slice(1);
  const colScore = "80px";
  const colExtra = "240px";
  const colCompany = "minmax(320px, 1.3fr)";
  const gridCols = `${colCompany} ${colScore} ${extraFields.map(() => colExtra).join(" ")}`;

  const isHubMode = searchMode === "hubspot";
  const hubQuery = query.trim();

  const switchToHub = () => {
    setSearchMode("hubspot");
    if (autoFillRef.current && !query.trim()) {
      const maName = String(maRow?.[maFields[0]] ?? "");
      const firstWord = getFirstMeaningfulWord(maName);
      setQuery(firstWord ? firstWord + " " : "");
      onHubspotSearch(firstWord);
    } else {
      onHubspotSearch(query.trim());
    }
  };

  const handleToggleAutoFill = () => {
    const next = !autoFill;
    setAutoFill(next);
    autoFillRef.current = next;
    if (next && searchMode === "hubspot" && !query.trim()) {
      const maName = String(maRow?.[maFields[0]] ?? "");
      const firstWord = getFirstMeaningfulWord(maName);
      setQuery(firstWord ? firstWord + " " : "");
      if (firstWord) onHubspotSearch(firstWord);
    }
  };

  return (
    <div className="ds-grid-2" style={{ gridTemplateColumns: "0.8fr 2.2fr", alignItems: "stretch" }}>
      {/* Left: M&A record */}
      <div className="ds-card" style={{ minWidth: 0, height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="ds-kicker" style={{ marginBottom: "0.6rem" }}>M&A Company</div>
        <div style={{ display: "grid", gap: "0.55rem" }}>
          {maFields.map((f) => (
            <div key={f}>
              <div className="ds-meta ds-muted">{f}</div>
              <div style={{ fontWeight: 700 }}>{String(maRow?.[f] ?? "")}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: candidates / HubSpot search */}
      <div className="ds-card" style={{ minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="ds-kicker">HubSpot Possible Matches</div>
          <div className="ds-meta ds-muted">Use UP/DOWN then Enter</div>
        </div>

        {/* Mode toggle row + autofill toggle (right-aligned, hubspot only) */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "0.4rem" }}>
          <div style={{ display: "flex", border: "2px solid var(--foreground)", flexShrink: 0 }}>
            <button
              onClick={() => { setSearchMode("candidates"); setQuery(""); }}
              style={{
                padding: "0.25rem 0.65rem",
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                letterSpacing: "0.03em",
                cursor: "pointer",
                border: "none",
                background: !isHubMode ? "var(--foreground)" : "var(--background)",
                color: !isHubMode ? "var(--background)" : "var(--foreground)",
              }}
            >
              CANDIDATES
            </button>
            <button
              onClick={switchToHub}
              style={{
                padding: "0.25rem 0.65rem",
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                letterSpacing: "0.03em",
                cursor: "pointer",
                border: "none",
                borderLeft: "2px solid var(--foreground)",
                background: isHubMode ? "var(--foreground)" : "var(--background)",
                color: isHubMode ? "var(--background)" : "var(--foreground)",
              }}
            >
              HUBSPOT SEARCH
            </button>
          </div>
          <div style={{ flex: 1 }} />
          {isHubMode && (
            <button
              onClick={handleToggleAutoFill}
              title="Auto-fill search with first word of M&A name"
              style={{
                padding: "0.25rem 0.65rem",
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                letterSpacing: "0.03em",
                cursor: "pointer",
                border: "2px solid var(--foreground)",
                background: autoFill ? "var(--foreground)" : "var(--background)",
                color: autoFill ? "var(--background)" : "var(--foreground)",
                flexShrink: 0,
              }}
            >
              AUTO-FILL {autoFill ? "ON" : "OFF"}
            </button>
          )}
        </div>

        {/* Search / filter input */}
        <div style={{ marginBottom: "0.6rem" }}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isHubMode ? "Search by company name…" : "Filter by company name…"}
          />
        </div>

        {/* Count / status line */}
        <div className="ds-meta ds-muted" style={{ marginBottom: "0.5rem" }}>
          {isHubMode ? (
            hubQuery ? (
              <>
                <strong style={{ color: "var(--foreground)" }}>{hubspotResults.length.toLocaleString()}</strong>
                {" "}result{hubspotResults.length !== 1 ? "s" : ""}
                {hubspotResultsOverflow && (
                  <span style={{ marginLeft: "0.4rem" }}>
                    — showing top {hubspotResults.length.toLocaleString()}, more matches exist
                  </span>
                )}
              </>
            ) : (
              <span>Type to search the full HubSpot dataset</span>
            )
          ) : (
            <>
              Showing{" "}
              <strong style={{ color: "var(--foreground)" }}>{shownCandidates}</strong>
              {" "}of{" "}
              <strong style={{ color: "var(--foreground)" }}>{totalCandidates}</strong>
            </>
          )}
        </div>

        <div
          className="ds-table-wrap"
          style={{ width: "100%", maxWidth: "100%", minWidth: 0, overflowY: "auto", overflowX: "auto", maxHeight: 660, minHeight: 360 }}
        >
          <div style={{ width: "max-content", minWidth: "100%" }}>
            {/* Header */}
            <div
              style={{
                position: "sticky", top: 0, background: "#fff", zIndex: 2,
                borderBottom: "var(--line-medium)", display: "grid",
                gridTemplateColumns: gridCols, padding: "10px 8px",
                fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.03em",
                textTransform: "uppercase", alignItems: "center",
              }}
            >
              <div>Company</div>
              <div style={{ textAlign: "right" }}>Score</div>
              {extraFields.map((f) => (
                <div key={f} title={f} style={{ paddingLeft: 10 }}>{f}</div>
              ))}
            </div>

            {/* HubSpot search empty prompt */}
            {isHubMode && !hubQuery && (
              <div style={{ padding: "2rem", textAlign: "center", fontSize: 13, color: "var(--muted-foreground)", opacity: 0.6 }}>
                Search the entire HubSpot dataset by company name.
              </div>
            )}

            {/* Rows */}
            {displayItems.map((c, index) => {
              const isActive = index === active;
              const isNoMatch = c.hubIndex === -1;
              const isHubSearch = !isNoMatch && (c.foundBy as string[]).includes("hubspot_search");
              const title = isNoMatch ? "No Match" : String(c.hubRow?.[nameField] ?? "(blank)");
              const foundByText = !isNoMatch ? (c.foundBy ?? []).join(", ") : "";

              return (
                <div
                  key={`${c.hubIndex}-${index}`}
                  onClick={() => {
                    setActive(index);
                    if (isNoMatch) handleSelectNoMatch();
                    else handleSelectHub(c);
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridCols,
                    padding: "10px 8px",
                    borderBottom: "var(--line-hairline)",
                    cursor: "pointer",
                    background: isActive
                      ? "var(--foreground)"
                      : (c as any).__isPrevious
                        ? "#f5f5f5"
                        : !isNoMatch && !isHubSearch && c.score === 100
                          ? "#0d662c"
                          : !isNoMatch && !isHubSearch && c.score >= 86
                            ? "#a8f7c3"
                            : "var(--background)",
                    color: isActive
                      ? "var(--background)"
                      : !isNoMatch && !isHubSearch && c.score === 100 && !(c as any).__isPrevious
                        ? "#ffffff"
                        : "var(--foreground)",
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
                    ) : (c as any).__isPrevious ? (
                      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", opacity: isActive ? 1 : 0.7, marginTop: 2 }}>↩ CURRENT MATCH</div>
                    ) : (
                      showFoundBy && (
                        <div title={foundByText} style={{ fontSize: 11, opacity: 0.65, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {foundByText}
                        </div>
                      )
                    )}
                  </div>

                  <div style={{ textAlign: "right", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                    {!isNoMatch && !isHubSearch ? c.score : ""}
                  </div>

                  {extraFields.map((f) => {
                    const v = !isNoMatch ? String(c.hubRow?.[f] ?? "") : "";
                    return (
                      <div key={f} title={v} style={{ paddingLeft: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                        {v || (isNoMatch ? "" : "-")}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* No-results messages */}
            {isHubMode && hubQuery && hubspotResults.length === 0 && (
              <div style={{ padding: 12, fontSize: 12, color: "var(--muted-foreground)" }}>No results found.</div>
            )}
            {!isHubMode && query.trim() && filteredCandidates.length <= 1 && (
              <div style={{ padding: 12, fontSize: 12, color: "var(--muted-foreground)" }}>No matches found for this filter.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
