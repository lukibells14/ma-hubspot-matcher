import { useEffect, useMemo, useRef, useState } from "react";
import type { RowObject, ColumnMapping, DisplayFieldSelection, CandidateDisplay, SelectionRow } from "./types";

import { parseCsvFile } from "./utils/csv";
import { loadHubspotCache, saveHubspotCache, clearHubspotCache } from "./utils/storage";
import { exportSelectionsToXlsx } from "./utils/export";

import { FileUploadCard } from "./components/FileUploadCard";
import { SummaryModal } from "./components/SummaryModal";
import { ColumnMapper } from "./components/ColumnMapper";
import { ProgressHeader } from "./components/ProgressHeader";
import { FieldSelectorDropdown } from "./components/FieldSelectorDropdown";
import { MatchViewer } from "./components/MatchViewer";
import { ResultsTable } from "./components/ResultsTable";
import { Button } from "./components/ui";

type WorkerOut =
  | { type: "INDEX_PROGRESS"; done: number; total: number }
  | { type: "READY"; hubCount: number; maCount: number }
  | { type: "CANDIDATES"; maIndex: number; candidates: { hubIndex: number; score: number; foundBy: any[] }[] }
  | { type: "ERROR"; message: string };

export default function App() {
  const [maRows, setMaRows] = useState<RowObject[]>([]);
  const [maCols, setMaCols] = useState<string[]>([]);
  const [hubRows, setHubRows] = useState<RowObject[]>([]);
  const [hubCols, setHubCols] = useState<string[]>([]);
  const [hubCacheInfo, setHubCacheInfo] = useState<string>("");

  const [mapping, setMapping] = useState<ColumnMapping>({ maName: "", hubName: "" });
  const [fields, setFields] = useState<DisplayFieldSelection>({ maFields: [], hubFields: [], showHubFoundBy: true });

  const [status, setStatus] = useState("Waiting for files...");
  const [indexProgress, setIndexProgress] = useState<{ done: number; total: number } | null>(null);

  const [stage, setStage] = useState<"upload" | "ready" | "matching" | "done">("upload");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalRowCount, setModalRowCount] = useState(0);
  const [modalColumns, setModalColumns] = useState<string[]>([]);
  const [modalSample, setModalSample] = useState<RowObject[]>([]);
  const [maFilename, setMaFilename] = useState<string>("");
  const [hubFilename, setHubFilename] = useState<string>("");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [candidates, setCandidates] = useState<CandidateDisplay[]>([]);
  const [selections, setSelections] = useState<SelectionRow[]>([]);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const w = new Worker(new URL("./workers/match.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;

    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const msg = e.data;
      if (msg.type === "INDEX_PROGRESS") {
        setIndexProgress({ done: msg.done, total: msg.total });
        setStatus(`Indexing HubSpot... ${msg.done.toLocaleString()}/${msg.total.toLocaleString()}`);
      } else if (msg.type === "READY") {
        setStatus(`Ready. HubSpot: ${msg.hubCount.toLocaleString()} rows | M&A: ${msg.maCount.toLocaleString()} rows`);
      } else if (msg.type === "CANDIDATES") {
        const mapped = msg.candidates
          .filter((c) => c.hubIndex >= 0)
          .map((c) => ({
            hubIndex: c.hubIndex,
            score: c.score,
            foundBy: c.foundBy as any[],
            hubRow: hubRows[c.hubIndex],
          })) as CandidateDisplay[];

        setCandidates(mapped);
        setStatus(`Matching: ${(msg.maIndex + 1).toLocaleString()}/${maRows.length.toLocaleString()}`);
      } else if (msg.type === "ERROR") {
        setStatus(`Error: ${msg.message}`);
      }
    };

    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, [hubRows, maRows.length]);

  useEffect(() => {
    (async () => {
      const cache = await loadHubspotCache();
      if (cache?.rows?.length) {
        setHubCacheInfo(`Cached HubSpot: ${cache.rows.length.toLocaleString()} rows (saved ${new Date(cache.savedAt).toLocaleString()})`);
      }
    })();
  }, []);

  const canStart = useMemo(() => {
    return maRows.length > 0 && hubRows.length > 0 && mapping.maName && mapping.hubName;
  }, [maRows.length, hubRows.length, mapping.maName, mapping.hubName]);

  const openSummary = (title: string, rows: RowObject[], cols: string[]) => {
    setModalTitle(title);
    setModalRowCount(rows.length);
    setModalColumns(cols);
    setModalSample(rows.slice(0, 5));
    setModalOpen(true);
  };

  const defaultMaFields = useMemo(() => {
    const base = [mapping.maName].filter(Boolean);
    if (mapping.maDomain) base.push(mapping.maDomain);
    return base;
  }, [mapping.maName, mapping.maDomain]);

  const defaultHubFields = useMemo(() => {
    const base = [mapping.hubName].filter(Boolean);
    if (mapping.hubDomain) base.push(mapping.hubDomain);
    if (mapping.hubUniqueCode) base.push(mapping.hubUniqueCode);
    return base;
  }, [mapping.hubName, mapping.hubDomain, mapping.hubUniqueCode]);

  const maDisplayFields = fields.maFields.length ? fields.maFields : defaultMaFields;
  const hubDisplayFields = fields.hubFields.length ? fields.hubFields : defaultHubFields;

  const startMatching = () => {
    setSelections([]);
    setCurrentIndex(0);
    setStage("matching");

    workerRef.current?.postMessage({ type: "INIT", hubRows, mapping });
    workerRef.current?.postMessage({ type: "START", maRows });
    workerRef.current?.postMessage({ type: "GET_CANDIDATES", maIndex: 0 });
  };

  const applySelection = (sel: SelectionRow) => {
    setSelections((prev) => [...prev, sel]);

    const next = currentIndex + 1;
    if (next >= maRows.length) {
      setStage("done");
      setCandidates([]);
      setStatus("Finished matching.");
      return;
    }

    setCurrentIndex(next);
    workerRef.current?.postMessage({ type: "GET_CANDIDATES", maIndex: next });
  };

  const currentMaRow = maRows[currentIndex];

  return (
    <main className="ds-shell">
      <SummaryModal
        open={modalOpen}
        title={modalTitle}
        rowCount={modalRowCount}
        columns={modalColumns}
        sampleRows={modalSample}
        onClose={() => setModalOpen(false)}
      />

      <section className="ds-hero">
        <div className="ds-kicker">M&A to HubSpot</div>
        <h1 className="ds-display">MATCHER</h1>
        <p className="ds-lead">
          Single page workflow for high-volume CSV matching with cached HubSpot datasets, keyboard-first candidate selection,
          and direct export.
        </p>
        <div className="ds-rule-hero" />
      </section>

      <div className="ds-rule" />

      <section className="ds-grid-2" aria-label="Upload files">
        <FileUploadCard
          title="1) Upload M&A CSV (5K+)"
          subtitle="Company name, domain, addresses, etc."
          filename={maFilename}
          onFile={async (file) => {
            setMaFilename(file.name);
            setStatus("Parsing M&A CSV...");
            const parsed = await parseCsvFile(file);

            setMaRows(parsed.rows);
            setMaCols(parsed.columns);

            const nameGuess = parsed.columns.find((c) => /company.*name|name/i.test(c)) ?? parsed.columns[0] ?? "";
            const domainGuess = parsed.columns.find((c) => /domain|website/i.test(c));

            setMapping((m) => ({ ...m, maName: m.maName || nameGuess, maDomain: m.maDomain ?? domainGuess }));
            setFields((f) => ({ ...f, maFields: f.maFields.length ? f.maFields : [nameGuess, ...(domainGuess ? [domainGuess] : [])] }));

            openSummary("M&A file summary", parsed.rows, parsed.columns);
            setStatus(`M&A loaded: ${parsed.rows.length.toLocaleString()} rows`);
            setStage(hubRows.length ? "ready" : "upload");
          }}
        />

        <FileUploadCard
          title="2) Upload HubSpot CSV (200K+)"
          subtitle="Company name, domain, unique code, addresses, etc."
          filename={hubFilename}
          onFile={async (file) => {
            setHubFilename(file.name);
            setStatus("Parsing HubSpot CSV... (200K+ may take time)");
            const parsed = await parseCsvFile(file);

            setHubRows(parsed.rows);
            setHubCols(parsed.columns);

            const nameGuess = parsed.columns.find((c) => /company.*name|name/i.test(c)) ?? parsed.columns[0] ?? "";
            const domainGuess = parsed.columns.find((c) => /domain|website/i.test(c));
            const idGuess = parsed.columns.find((c) => /unique|code|id/i.test(c));

            setMapping((m) => ({
              ...m,
              hubName: m.hubName || nameGuess,
              hubDomain: m.hubDomain ?? domainGuess,
              hubUniqueCode: m.hubUniqueCode ?? idGuess,
            }));

            setFields((f) => ({
              ...f,
              hubFields: f.hubFields.length ? f.hubFields : [nameGuess, ...(domainGuess ? [domainGuess] : []), ...(idGuess ? [idGuess] : [])],
            }));

            openSummary("HubSpot file summary", parsed.rows, parsed.columns);
            setStatus(`HubSpot loaded: ${parsed.rows.length.toLocaleString()} rows`);
            setStage(maRows.length ? "ready" : "upload");
          }}
          right={
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button
                onClick={async () => {
                  setHubFilename("HubSpot (cached)");
                  const cache = await loadHubspotCache();
                  if (!cache?.rows?.length) return setStatus("No cached HubSpot dataset found.");
                  setHubRows(cache.rows);
                  setHubCols(cache.columns);
                  setHubCacheInfo(`Cached HubSpot: ${cache.rows.length.toLocaleString()} rows (saved ${new Date(cache.savedAt).toLocaleString()})`);
                  setStatus(`Loaded cached HubSpot: ${cache.rows.length.toLocaleString()} rows`);
                  setStage(maRows.length ? "ready" : "upload");
                }}
              >
                Use Cached
              </Button>

              <Button
                onClick={async () => {
                  if (!hubRows.length) return setStatus("Upload HubSpot first, then Save Cache.");
                  await saveHubspotCache({ savedAt: Date.now(), columns: hubCols, rows: hubRows });
                  setHubCacheInfo(`Cached HubSpot: ${hubRows.length.toLocaleString()} rows (saved ${new Date().toLocaleString()})`);
                  setStatus("Saved HubSpot dataset to cache (IndexedDB).");
                }}
              >
                Save Cache
              </Button>

              <Button
                onClick={async () => {
                  setHubFilename("");
                  await clearHubspotCache();
                  setHubCacheInfo("");
                  setStatus("Cleared HubSpot cache.");
                }}
              >
                Clear Cache
              </Button>
            </div>
          }
        />
      </section>

      {hubCacheInfo && (
        <div className="ds-card-muted" style={{ marginTop: "1rem" }}>
          <span className="ds-meta">{hubCacheInfo}</span>
        </div>
      )}

      {(maRows.length > 0 && hubRows.length > 0) && (
        <>
          <div className="ds-rule" />
          <section>
            <ColumnMapper maColumns={maCols} hubColumns={hubCols} mapping={mapping} setMapping={setMapping} />
          </section>
        </>
      )}

      {stage === "ready" && (
        <>
          <div className="ds-rule" />
          <section style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
              <FieldSelectorDropdown
                label="M&A fields to display"
                allFields={maCols}
                selected={maDisplayFields}
                onChange={(next) => setFields((f) => ({ ...f, maFields: next }))}
              />
              <FieldSelectorDropdown
                label="HubSpot fields to display"
                allFields={hubCols}
                selected={hubDisplayFields}
                onChange={(next) => setFields((f) => ({ ...f, hubFields: next }))}
              />
            </div>

            <Button disabled={!canStart} onClick={startMatching} variant="primary">
              Start Matching
            </Button>
          </section>
        </>
      )}

      <div className="ds-rule" />
      <section>
        <ProgressHeader
          done={selections.length}
          total={maRows.length}
          status={indexProgress ? `${status} (index ${indexProgress.done.toLocaleString()}/${indexProgress.total.toLocaleString()})` : status}
        />
      </section>

      {stage === "matching" && currentMaRow && (
        <>
          <div className="ds-rule" />
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
              <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                <FieldSelectorDropdown
                  label="M&A fields (left)"
                  allFields={maCols}
                  selected={maDisplayFields}
                  onChange={(next) => setFields((f) => ({ ...f, maFields: next }))}
                />
                <FieldSelectorDropdown
                  label="HubSpot fields (right)"
                  allFields={hubCols}
                  selected={hubDisplayFields}
                  onChange={(next) => setFields((f) => ({ ...f, hubFields: next }))}
                  showFoundBy={fields.showHubFoundBy ?? true}
                  onToggleFoundBy={(next) => setFields((f) => ({ ...f, showHubFoundBy: next }))}
                />
              </div>
              <div className="ds-meta ds-muted">Use UP/DOWN then Enter. "No Match" appears first.</div>
            </div>

            <MatchViewer
              maRow={currentMaRow}
              maFields={maDisplayFields}
              hubFields={hubDisplayFields}
              showFoundBy={fields.showHubFoundBy ?? true}
              candidates={candidates}
              onSelectHub={(c) =>
                applySelection({
                  maIndex: currentIndex,
                  maRow: currentMaRow,
                  selectionType: "hubspot",
                  hubIndex: c.hubIndex,
                  hubRow: c.hubRow,
                  score: c.score,
                  foundBy: c.foundBy as any[],
                })
              }
              onSelectNoMatch={() =>
                applySelection({
                  maIndex: currentIndex,
                  maRow: currentMaRow,
                  selectionType: "no_match",
                })
              }
            />
          </section>
        </>
      )}

      <div className="ds-rule" />
      <section>
        <ResultsTable selections={selections} maFields={maDisplayFields} hubFields={hubDisplayFields} />
      </section>

      <div className="ds-rule" />
      <section className="ds-card ds-card-invert" style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <Button disabled={!selections.length} onClick={() => exportSelectionsToXlsx(selections, maCols, hubCols)} variant="primary">
          9) Export to Excel
        </Button>

        {stage === "done" && <div className="ds-card-title" style={{ fontSize: "1.6rem", marginBottom: 0 }}>Finished. Export your table.</div>}
      </section>
    </main>
  );
}
