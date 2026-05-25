import { useEffect, useMemo, useRef, useState } from "react";
import type { RowObject, ColumnMapping, DisplayFieldSelection, CandidateDisplay, SelectionRow, BatchMatchItem, BatchMatchResult, CustomColumn } from "./types";

import { parseCsvFile } from "./utils/csv";
import { loadHubspotCache, saveHubspotCache, clearHubspotCache } from "./utils/storage";
import { exportSelectionsToXlsx, exportRemainingToCsv } from "./utils/export";
import { applyCustomColumns } from "./utils/customColumns";
import { runBatchMatch } from "./utils/batchMatch";

import { FileUploadCard } from "./components/FileUploadCard";
import { ExportModal } from "./components/ExportModal";
import { SummaryModal } from "./components/SummaryModal";
import { BatchReviewModal } from "./components/BatchReviewModal";
import { CustomColumnBuilder } from "./components/CustomColumnBuilder";
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
  | { type: "PRESCREEN_DONE"; hundredPct: number[]; rest: number[] }
  | { type: "BATCH_MATCH_DONE"; result: BatchMatchResult }
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

  const [matchingQueue, setMatchingQueue] = useState<number[]>([]);
  const [currentQueuePos, setCurrentQueuePos] = useState(0);
  const [maxCandidates, setMaxCandidates] = useState(100);
  const [candidates, setCandidates] = useState<CandidateDisplay[]>([]);
  const [selections, setSelections] = useState<SelectionRow[]>([]);

  const [exportModalOpen, setExportModalOpen] = useState(false);

  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [customColBuilderOpen, setCustomColBuilderOpen] = useState(false);
  const customColumnsRef = useRef<CustomColumn[]>([]);
  useEffect(() => {
    customColumnsRef.current = customColumns;
    // Re-augment currently displayed candidates so edits reflect immediately
    setCandidates((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((c) => {
        const baseRow = hubRows[c.hubIndex] ?? c.hubRow;
        const hubRow = customColumns.length > 0
          ? { ...baseRow, ...applyCustomColumns(baseRow, customColumns) }
          : baseRow;
        return { ...c, hubRow };
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customColumns]);

  const [enableBatchMode, setEnableBatchMode] = useState(false);
  const [batchReviewOpen, setBatchReviewOpen] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchMatchResult | null>(null);
  const [batchAutoCount, setBatchAutoCount] = useState(0);
  const batchConfirmedSetRef = useRef<Set<number>>(new Set());

  const workerRef = useRef<Worker | null>(null);
  const maxCandidatesRef = useRef(maxCandidates);
  useEffect(() => { maxCandidatesRef.current = maxCandidates; }, [maxCandidates]);

  const currentIndex = matchingQueue[currentQueuePos] ?? 0;

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
        const cols = customColumnsRef.current;
        const mapped = msg.candidates
          .filter((c) => c.hubIndex >= 0)
          .map((c) => {
            const baseRow = hubRows[c.hubIndex];
            const hubRow = cols.length > 0
              ? { ...baseRow, ...applyCustomColumns(baseRow, cols) }
              : baseRow;
            return { hubIndex: c.hubIndex, score: c.score, foundBy: c.foundBy as any[], hubRow };
          }) as CandidateDisplay[];

        setCandidates(mapped);
      } else if (msg.type === "BATCH_MATCH_DONE") {
        setBatchResult(msg.result);
        setBatchReviewOpen(true);
        setStatus(`Auto-match scan complete. Found ${msg.result.matched.length.toLocaleString()} exact matches.`);
      } else if (msg.type === "PRESCREEN_DONE") {
        const confirmed = batchConfirmedSetRef.current;
        const queue = [...msg.hundredPct, ...msg.rest].filter((i) => !confirmed.has(i));
        setMatchingQueue(queue);
        setCurrentQueuePos(0);
        if (queue.length > 0) {
          workerRef.current?.postMessage({ type: "GET_CANDIDATES", maIndex: queue[0], maxCandidates: maxCandidatesRef.current });
        } else {
          setStage("done");
          setStatus("Finished matching.");
        }
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
    if (stage === "matching" && matchingQueue.length > 0) {
      const autoNote = batchAutoCount > 0 ? ` · ${batchAutoCount.toLocaleString()} auto-matched` : "";
      setStatus(`Manual review: ${(currentQueuePos + 1).toLocaleString()}/${matchingQueue.length.toLocaleString()}${autoNote}`);
    }
  }, [currentQueuePos, matchingQueue.length, stage, batchAutoCount]);

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

  const hubColsWithCustom = useMemo(
    () => [...hubCols, ...customColumns.filter((c) => c.name).map((c) => c.name)],
    [hubCols, customColumns],
  );

  const batchPreviewCount = useMemo(() => {
    if (!maRows.length || !hubRows.length || !mapping.maName || !mapping.hubName) return null;
    return runBatchMatch(maRows, hubRows, mapping).matched.length;
  }, [maRows, hubRows, mapping]);

  const maDisplayFields = fields.maFields.length ? fields.maFields : defaultMaFields;
  const hubDisplayFields = fields.hubFields.length ? fields.hubFields : defaultHubFields;

  const startMatching = () => {
    setSelections([]);
    setCurrentQueuePos(0);
    setMatchingQueue([]);
    setBatchAutoCount(0);
    batchConfirmedSetRef.current = new Set();
    setStage("matching");
    setStatus("Indexing HubSpot...");

    workerRef.current?.postMessage({ type: "INIT", hubRows, mapping });
    workerRef.current?.postMessage({ type: "START", maRows });

    if (enableBatchMode) {
      setStatus("Indexing HubSpot... then running auto-match scan.");
      workerRef.current?.postMessage({ type: "BATCH_MATCH" });
    } else {
      workerRef.current?.postMessage({ type: "PRESCREEN" });
    }
  };

  const handleBatchConfirm = (confirmedItems: BatchMatchItem[]) => {
    batchConfirmedSetRef.current = new Set(confirmedItems.map((i) => i.maIndex));
    setBatchAutoCount(confirmedItems.length);

    const autoSelections: SelectionRow[] = confirmedItems.map((item) => ({
      maIndex: item.maIndex,
      maRow: item.maRow,
      selectionType: "hubspot",
      hubIndex: item.hubIndex,
      hubRow: item.hubRow,
      score: 100,
      foundBy: ["batch_exact"],
    }));

    setSelections(autoSelections);
    setBatchReviewOpen(false);
    setBatchResult(null);
    setStatus("Running prescreen for manual review queue...");
    workerRef.current?.postMessage({ type: "PRESCREEN" });
  };

  const handleBatchCancel = () => {
    setBatchReviewOpen(false);
    setBatchResult(null);
    setSelections([]);
    setMatchingQueue([]);
    batchConfirmedSetRef.current = new Set();
    setStage("ready");
    setStatus("Cancelled auto-match. Adjust settings and try again.");
  };

  const applySelection = (sel: SelectionRow) => {
    setSelections((prev) => {
      const existingIdx = prev.findIndex((s) => s.maIndex === sel.maIndex);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = sel;
        return next;
      }
      return [...prev, sel];
    });

    const nextQueuePos = currentQueuePos + 1;
    if (nextQueuePos >= matchingQueue.length) {
      setStage("done");
      setCandidates([]);
      setStatus("Finished matching.");
      return;
    }

    setCurrentQueuePos(nextQueuePos);
    workerRef.current?.postMessage({ type: "GET_CANDIDATES", maIndex: matchingQueue[nextQueuePos], maxCandidates });
  };

  const goBack = () => {
    if (stage === "done") {
      const lastQueuePos = matchingQueue.length - 1;
      if (lastQueuePos < 0) return;
      setCurrentQueuePos(lastQueuePos);
      setStage("matching");
      setCandidates([]);
      workerRef.current?.postMessage({ type: "GET_CANDIDATES", maIndex: matchingQueue[lastQueuePos], maxCandidates });
      return;
    }
    if (currentQueuePos === 0) return;
    const prevQueuePos = currentQueuePos - 1;
    setCurrentQueuePos(prevQueuePos);
    setCandidates([]);
    workerRef.current?.postMessage({ type: "GET_CANDIDATES", maIndex: matchingQueue[prevQueuePos], maxCandidates });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft") return;
      if (stage !== "matching" && stage !== "done") return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return;

      e.preventDefault();

      if (stage === "done") {
        const lastQueuePos = matchingQueue.length - 1;
        if (lastQueuePos < 0) return;
        setCurrentQueuePos(lastQueuePos);
        setStage("matching");
        setCandidates([]);
        workerRef.current?.postMessage({ type: "GET_CANDIDATES", maIndex: matchingQueue[lastQueuePos], maxCandidates });
        return;
      }

      if (currentQueuePos === 0) return;
      const prevQueuePos = currentQueuePos - 1;
      setCurrentQueuePos(prevQueuePos);
      setCandidates([]);
      workerRef.current?.postMessage({ type: "GET_CANDIDATES", maIndex: matchingQueue[prevQueuePos], maxCandidates });
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stage, currentQueuePos, matchingQueue, maxCandidates]);

  const currentMaRow = maRows[currentIndex];
  const previousSelection = selections.find((s) => s.maIndex === currentIndex);

  const handleExport = (xlsxName: string, csvName: string) => {
    exportSelectionsToXlsx(selections, maCols, hubCols, `${xlsxName}.xlsx`, customColumns);

    if (stage !== "done") {
      const reviewedIndices = new Set(selections.map((s) => s.maIndex));
      const remainingRows = maRows.filter((_, i) => !reviewedIndices.has(i));
      exportRemainingToCsv(remainingRows, maCols, `${csvName}.csv`);
    }

    setExportModalOpen(false);
  };

  return (
    <main className="ds-shell">
      <ExportModal
        open={exportModalOpen}
        isFinished={stage === "done"}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />

      <CustomColumnBuilder
        open={customColBuilderOpen}
        hubCols={hubCols}
        hubRows={hubRows}
        columns={customColumns}
        onChange={setCustomColumns}
        onClose={() => setCustomColBuilderOpen(false)}
      />

      <BatchReviewModal
        open={batchReviewOpen}
        result={batchResult}
        maCols={maCols}
        hubCols={hubCols}
        defaultMaCols={defaultMaFields}
        defaultHubCols={defaultHubFields}
        customColumns={customColumns}
        onConfirm={handleBatchConfirm}
        onCancel={handleBatchCancel}
      />

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

      {hubCols.length > 0 && (
        <>
          <div className="ds-rule" />
          <section>
            <div className="ds-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <div className="ds-card-title" style={{ fontSize: "1.1rem", marginBottom: 0 }}>Custom Columns</div>
                  <span className="ds-pill" style={{ fontSize: "0.65rem" }}>OPTIONAL</span>
                  {customColumns.length > 0 && (
                    <span className="ds-pill" style={{ fontSize: "0.65rem", background: "var(--foreground)", color: "var(--background)" }}>
                      {customColumns.length} defined
                    </span>
                  )}
                </div>
                <p className="ds-meta ds-muted" style={{ margin: 0 }}>
                  Build computed columns from HubSpot data using IF/ELSE rules. Included in your Excel export.
                  {customColumns.length > 0 && <> Columns: {customColumns.map((c) => c.name || "Unnamed").join(", ")}.</>}
                </p>
              </div>
              <Button onClick={() => setCustomColBuilderOpen(true)}>
                {customColumns.length > 0 ? "Edit Custom Columns" : "+ Add Custom Columns"}
              </Button>
            </div>
          </section>
        </>
      )}

      {stage === "ready" && (
        <>
          <div className="ds-rule" />
          <section>
            <div className="ds-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <div className="ds-card-title" style={{ fontSize: "1.1rem", marginBottom: 0 }}>Batch Options</div>
                  <span className="ds-pill" style={{ fontSize: "0.65rem" }}>OPTIONAL</span>
                </div>
                <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", cursor: "pointer", marginTop: "0.5rem" }}>
                  <input
                    type="checkbox"
                    checked={enableBatchMode}
                    onChange={(e) => setEnableBatchMode(e.target.checked)}
                    style={{ marginTop: "0.15rem", flexShrink: 0 }}
                  />
                  <div>
                    <span style={{ fontFamily: "var(--font-body)", fontWeight: 600 }}>Auto-match exact names before manual review</span>
                    <p className="ds-meta ds-muted" style={{ marginTop: "0.2rem", marginBottom: 0 }}>
                      Automatically confirms 1-to-1 exact name matches (e.g. "Acme Corp" = "Acme Corporation") and
                      lets you review them in a preview before starting manual review. Ambiguous (2+ matches) and
                      unmatched records always proceed to manual review.
                    </p>
                  </div>
                </label>
                {batchPreviewCount !== null && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.65rem" }}>
                    <span
                      className="ds-pill"
                      style={{ background: "var(--foreground)", color: "var(--background)", fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}
                    >
                      {batchPreviewCount.toLocaleString()} exact match{batchPreviewCount !== 1 ? "es" : ""} found
                    </span>
                    <span className="ds-meta ds-muted">preview based on current name mapping</span>
                  </div>
                )}
              </div>
            </div>
          </section>

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
                allFields={hubColsWithCustom}
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
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.8rem", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                <FieldSelectorDropdown
                  label="M&A fields (left)"
                  allFields={maCols}
                  selected={maDisplayFields}
                  onChange={(next) => setFields((f) => ({ ...f, maFields: next }))}
                />
                <FieldSelectorDropdown
                  label="HubSpot fields (right)"
                  allFields={hubColsWithCustom}
                  selected={hubDisplayFields}
                  onChange={(next) => setFields((f) => ({ ...f, hubFields: next }))}
                  showFoundBy={fields.showHubFoundBy ?? true}
                  onToggleFoundBy={(next) => setFields((f) => ({ ...f, showHubFoundBy: next }))}
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span className="ds-meta ds-muted">Max candidates</span>
                  <input
                    type="number"
                    value={maxCandidates}
                    min={10}
                    max={1000}
                    onChange={(e) => setMaxCandidates(Math.max(10, Math.min(1000, parseInt(e.target.value) || 100)))}
                    style={{ width: 70, border: "2px solid var(--foreground)", padding: "0.2rem 0.4rem", background: "var(--background)", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}
                  />
                </div>
                <div className="ds-meta ds-muted">UP/DOWN + Enter. ← Go back.</div>
                <Button onClick={goBack} disabled={currentQueuePos === 0}>← Go Back</Button>
              </div>
            </div>

            <MatchViewer
              maRow={currentMaRow}
              maFields={maDisplayFields}
              hubFields={hubDisplayFields}
              showFoundBy={fields.showHubFoundBy ?? true}
              candidates={candidates}
              previousSelection={previousSelection}
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
        <ResultsTable selections={selections} maFields={maDisplayFields} hubFields={hubDisplayFields} customColumns={customColumns} />
      </section>

      <div className="ds-rule" />
      <section className="ds-card ds-card-invert" style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <Button disabled={!selections.length} onClick={() => setExportModalOpen(true)} variant="primary">
            9) Export to Excel
          </Button>
          <Button onClick={goBack} disabled={matchingQueue.length === 0}>
            ← Go Back
          </Button>
          {hubCols.length > 0 && (
            <Button onClick={() => setCustomColBuilderOpen(true)}>
              Custom Columns {customColumns.length > 0 ? `(${customColumns.length})` : ""}
            </Button>
          )}
        </div>
        {stage === "done" && <div className="ds-card-title" style={{ fontSize: "1.6rem", marginBottom: 0 }}>Finished. Export your table.</div>}
      </section>
    </main>
  );
}
