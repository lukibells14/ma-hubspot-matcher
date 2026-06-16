# MA HubSpot Matcher — Codebase Handoff

## What It Is

A TypeScript/React single-page application for high-volume company name matching between M&A acquisition lists (CSV) and HubSpot CRM datasets. No backend — fully browser-based. Designed for large datasets (200K+ rows) with a keyboard-first review workflow.

---

## Workflow (The User Journey)

```
Upload M&A CSV
    → Upload HubSpot CSV (or load from cache)
        → Configure column mappings
            → (Optional) Build custom computed columns
                → (Optional) Enable batch auto-match → review preview dialog
                    → Manual review candidates keyboard-first
                        → Export to Excel + remaining CSV
```

---

## Project Structure

```
src/
├── App.tsx                        # Main component: state, workflow, keyboard events
├── types.ts                       # All TypeScript types/interfaces
├── main.tsx                       # React DOM entry point
├── hooks/
│   └── useResizable.ts            # Shared drag-to-resize hook for all modals
├── utils/
│   ├── csv.ts                     # CSV parsing (PapaParse, auto-delimiter)
│   ├── storage.ts                 # IndexedDB caching for HubSpot (idb-keyval)
│   ├── normalize.ts               # String normalization + matching algorithms
│   ├── export.ts                  # XLSX/CSV export (xlsx library)
│   ├── batchMatch.ts              # Exact-name batch matching logic
│   └── customColumns.ts           # Custom column rule evaluation
├── workers/
│   └── match.worker.ts            # Web Worker: indexing + candidate generation + batch match
└── components/
    ├── ui.tsx                     # Reusable primitives (Button, Card, Input, Select)
    ├── FileUploadCard.tsx         # File drop zone
    ├── ColumnMapper.tsx           # Column selection (M&A name/domain, HubSpot name/domain/code)
    ├── MatchViewer.tsx            # Keyboard-controlled candidate viewer (main UI)
    ├── ResultsTable.tsx           # Live table of all selections made
    ├── ProgressHeader.tsx         # Progress bar + status text
    ├── FieldSelectorDropdown.tsx  # Dynamic field display selector
    ├── ExportModal.tsx            # Export dialog with custom filenames
    ├── SummaryModal.tsx           # File preview (columns, row count, sample data)
    ├── BatchReviewModal.tsx       # Batch auto-match preview and confirmation dialog
    ├── CustomColumnBuilder.tsx    # IF/ELSE computed column builder with live preview
    ├── MatchingInfoModal.tsx      # Info dialog listing all matching strategies with examples
    └── LoadingOverlay.tsx         # Full-screen blocking overlay for all async loading phases
```

---

## Current Functionalities

### 1. CSV Parsing
- Handles any delimiter (`,` `\t` `;` `|`) via auto-detection
- Filters empty rows, returns typed `RowObject[]`
- File: `src/utils/csv.ts`

### 2. HubSpot Dataset Caching
- Stores the HubSpot CSV in **IndexedDB** (survives page reloads)
- UI actions: **Use Cached**, **Save Cache**, **Clear Cache**
- Lets users upload HubSpot once and reuse it across multiple M&A sessions
- File: `src/utils/storage.ts`

### 3. Column Mapping
- User selects which column = company name, domain, unique code for both CSVs
- Auto-guesses columns with regex patterns (`/company.*name/i`, `/domain|website/i`)
- File: `src/components/ColumnMapper.tsx`

### 4. Intelligent Multi-Strategy Matching (Web Worker)
Runs in a background thread to avoid blocking the UI. Uses multiple matching strategies, in priority order:

| Strategy | Description |
|---|---|
| `domain_exact` | Domain matched exactly (score: 100) |
| `exact_core` | Normalized company name matched exactly (score: 100) |
| `suffix_variant_removed` | Match after stripping Inc/LLC/Corp/Ltd |
| `suffix_variant_added` | Match after appending a common suffix |
| `and_ampersand_variant` | Treats `&` and `and` as equivalent (e.g. "Smith & Jones" ↔ "Smith and Jones") |
| `the_prefix_variant` | Ignores a leading "The" on either side (e.g. "The Harbor Trust" ↔ "Harbor Trust") |
| `trailing_s_variant` | Strips a trailing "s" from name tokens (e.g. "Jacksons" ↔ "Jackson") |
| `dba_variant` | Matches either side of a "dba" clause (e.g. MA: "Morning Fresh" ↔ HubSpot: "Sunrise Bakery dba Morning Fresh") |
| `acronym_match` | Acronym lookup (e.g. "ABC Corp" → "ABC") |
| `acronym_punct` | Acronym + punctuation-stripped key (e.g. "A.T.S." ↔ "ATS") |
| `token_block` | Top 6 longest tokens unioned, then fuzzy scored |
| `fuzzy_scored` | Dice bigram similarity on remaining candidates |

All variants can combine — e.g. "The Baker & Reeds LLC" can match "Baker and Reed Corp" via `the_prefix_variant` + `and_ampersand_variant` + `trailing_s_variant` + `suffix_variant_removed`.

Builds 6 lookup indexes at startup: domain, core name, acronym, token, acronym+punct, and DBA variants.

Files: `src/workers/match.worker.ts`, `src/utils/normalize.ts`

### 5. Batch Options (Optional)
Three optional pre-steps before manual review, enabled via the **Batch Options** section on the ready screen. Any combination can be enabled — steps open in sequence: exact → zero → low_confidence → summary (summary only appears when 2+ options are active).

**Auto-match exact names (`batch_exact`)**
- Runs exact-name-only matching (no fuzzy/suffix/acronym)
- Normalizes abbreviations: `corporation→corp`, `incorporated→inc`, etc.
- 1-to-1 only — ambiguous (2+) matches go to manual review
- Results in BatchReviewModal with per-row checkboxes to uncheck incorrect matches
- Preview count shown on ready screen

**Auto skip zero-candidate records (`batch_zero`)**
- Marks records with zero index hits as No Match before manual review
- No scoring required — index lookup only
- Preview count shown on ready screen

**Auto skip low-confidence records (`batch_low_confidence`)**
- Marks records as No Match when **both** conditions are true:
  1. Top candidate score < threshold (0–100, default 60, user-adjustable)
  2. First meaningful word of M&A name (skipping "The", "A", "An") returns 0 HubSpot search results
- Dialog shows live count that updates instantly as threshold is changed (0–100 range, all values valid)
- Skipped records appear in results table with `foundBy: ["batch_low_confidence"]`
- Progress bar and count updated immediately on confirm

All three options update the progress bar, results table, and manual review queue on confirm.

Files: `src/utils/batchMatch.ts`, `src/components/BatchReviewModal.tsx`

### 6. Prescreen Queue
Before review starts, rows are bucketed:
- **100% matches** (domain or core name exact) — reviewed first
- **High-score** (suffix/acronym-punct variant hits) — reviewed second
- **Rest** — sorted descending by top candidate score, reviewed last
- Rows already confirmed by batch auto-match are excluded from the queue

### 6a. Loading Overlays
A full-screen `LoadingOverlay` (white, blurred backdrop, 2px black card) blocks all interaction during async operations. Four phases:

| Phase | Trigger | UI |
|---|---|---|
| `csv` | File selected/dropped for M&A or HubSpot | Spinner + filename |
| `indexing` | `INIT` sent → `READY` received | Live progress bar driven by `INDEX_PROGRESS` |
| `scanning` | `READY` received with batch scans pending | Spinner + enabled scan labels |
| `prescreen` | `PRESCREEN` sent → `PRESCREEN_DONE` received | Live progress bar driven by `PRESCREEN_PROGRESS` |

Keyboard shortcuts (arrow keys) are also blocked while any overlay is active via `loadingOverlayRef`.

File: `src/components/LoadingOverlay.tsx`

### 7. Keyboard-First Review UI
| Key | Action |
|---|---|
| `↑` / `↓` | Navigate candidates |
| `Enter` | Select highlighted candidate |
| `←` | Go back to previous M&A row |
| Type to search | Filter candidates by name |

Also shows: match score, which strategy found the match (`foundBy`), and a previous selection indicator.

File: `src/components/MatchViewer.tsx`

### 8. Display Field Customization
User selects which M&A and HubSpot fields to display during review. Custom column names are included in the HubSpot field dropdown. Includes a toggle for showing the `Found By` reason under each company name.

File: `src/components/FieldSelectorDropdown.tsx`

### 9. Custom Column Builder
Always-visible panel (shown as soon as HubSpot is loaded, across all stages). Lets users define computed columns from HubSpot data using IF/ELSE rules.

- **Rules**: multiple rules per column (first match wins / ELSE IF)
- **Conditions per rule**: multiple conditions with ALL/ANY logic
- **11 operators**: `=`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `not_contains`, `starts_with`, `is_empty`, `is_not_empty`
- **Default value**: used when no rule matches
- **Live preview**: shows computed result on first 8 HubSpot rows
- Custom columns appear in: **BatchReviewModal** column selector, **MatchViewer** candidate display, **ResultsTable** HubSpot summary, and **XLSX export**
- Accessed via the "Custom Columns" card above the ready stage, or the "Custom Columns" button in the export bar (available at all stages)

Files: `src/utils/customColumns.ts`, `src/components/CustomColumnBuilder.tsx`

### 10. Live Results Table
Shows all made selections in real-time as the user reviews. Columns: Status | Score | M&A Summary | HubSpot Summary (including custom column values).

File: `src/components/ResultsTable.tsx`

### 11. Export
- **Excel (XLSX)**: One row per selection, columns prefixed `ma.*` / `hub.*`, plus `match_status`, `match_score`, `found_by`, and any custom columns
- **Remaining CSV**: Unreviewed M&A rows (only exported if the session is not yet complete)
- **ExportModal**: User provides custom filenames before downloading

Files: `src/utils/export.ts`, `src/components/ExportModal.tsx`

### 12. Candidate Search Mode Toggle (Sticky)
The MatchViewer has two modes toggled by a button pair:
- **CANDIDATES** — shows pre-scored candidates from the worker pipeline
- **HUBSPOT SEARCH** — full-text search across the entire HubSpot dataset by company name (debounced 150ms)

The mode is **sticky**: when a selection is made, the mode used is remembered via `stickyModeRef`. The next M&A row opens in the same mode. Defaults to CANDIDATES on first load.

**AUTO-FILL toggle** (right-aligned, same row as mode buttons):
- When ON + in HUBSPOT SEARCH mode: automatically fills the search input with the first meaningful word of the M&A company name (skipping "The", "A", "An") and fires the search immediately on every row navigation
- When toggled ON while already in HUBSPOT SEARCH with empty input: auto-fills and fires immediately
- When switching to HUBSPOT SEARCH mode with AUTO-FILL ON and empty input: auto-fills immediately
- Persists across row navigation via `autoFillRef`
- No clear button — user deletes manually

File: `src/components/MatchViewer.tsx`

### 13. Matching Info Dialog
A **"? HOW MATCHING WORKS"** button in the top-right of the hero header opens a scrollable reference dialog listing all 14 matching strategies, each with a description and 2–3 examples (M&A Name / HubSpot Candidate / Why It Matched).

File: `src/components/MatchingInfoModal.tsx`

### 14. File Preview Modal
Shows column list, row count, and first 5 rows when a CSV is uploaded, so users can verify the file before proceeding.

File: `src/components/SummaryModal.tsx`

### 15. Resizable Modals
All modals (ExportModal, SummaryModal, BatchReviewModal, CustomColumnBuilder) have a drag handle at the bottom-right corner. Uses the shared `useResizable` hook.

- Dragging outside the modal after resize does **not** trigger cancel — suppressed via a one-time capture-phase click listener
- Hook: `src/hooks/useResizable.ts`

---

## Key Types (`src/types.ts`)

```typescript
ColumnMapping          // maName, maDomain, hubName, hubDomain, hubUniqueCode
DisplayFieldSelection  // maFields[], hubFields[], showHubFoundBy
FoundBy                // "domain_exact" | "exact_core" | "suffix_variant_*" | "acronym_*"
                       // | "and_ampersand_variant" | "the_prefix_variant"
                       // | "trailing_s_variant" | "dba_variant"
                       // | "token_block" | "fuzzy_scored" | "batch_exact"
Candidate              // hubIndex, score (0–100), foundBy[]
CandidateDisplay       // extends Candidate with hubRow (may include synthetic custom col keys)
SelectionRow           // maIndex, maRow, selectionType ("hubspot" | "no_match"), hubRow, score, foundBy
BatchMatchItem         // maIndex, hubIndex, maRow, hubRow
BatchMatchResult       // matched: BatchMatchItem[], ambiguousCount, noMatchCount
Operator               // "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains" | "not_contains"
                       // | "starts_with" | "is_empty" | "is_not_empty"
Condition              // column, operator, value
ColumnRule             // id, logic ("ALL" | "ANY"), conditions[], output
CustomColumn           // id, name, rules[], defaultValue
```

---

## App State Stages

```
"upload" → "ready" → "matching" → "done"
```

Centralized in `src/App.tsx` using plain React `useState` (no Redux/Zustand).

Key derived state:
- `hubColsWithCustom` — real HubSpot columns + named custom column names (used in all dropdowns)
- `batchPreviewCount` — live count of exact matches (computed via `runBatchMatch` useMemo, always shown when data is loaded)
- `customColumnsRef` — ref kept in sync with `customColumns` state so the worker `onmessage` closure always reads the latest definitions

---

## Worker Communication

**Main → Worker:**
```typescript
{ type: "INIT";           hubRows, mapping }
{ type: "START";          maRows }
{ type: "BATCH_MATCH" }   // triggers exact-name batch scan
{ type: "GET_CANDIDATES"; maIndex, maxCandidates }
{ type: "PRESCREEN" }
```

**Worker → Main:**
```typescript
{ type: "INDEX_PROGRESS";    done, total }        // every 2000 rows during INIT
{ type: "PRESCREEN_PROGRESS"; done, total }      // every 100 rows during rest-bucket scoring
{ type: "READY";             hubCount, maCount }
{ type: "BATCH_MATCH_DONE";  result: BatchMatchResult }
{ type: "CANDIDATES";        maIndex, candidates }
{ type: "PRESCREEN_DONE";    hundredPct, highScore, rest }
{ type: "ERROR";            message }
```

---

## Tech Stack

| Package | Version | Role |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | 5.9 | Language |
| Vite | 7 | Build tool + dev server |
| PapaParse | 5.5 | CSV parsing |
| xlsx | 0.18 | Excel export |
| idb-keyval | 6.2 | IndexedDB wrapper |

---

## Dev Commands

```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # Type-check + bundle to dist/
npm run preview  # Serve dist/ locally
npm run lint     # ESLint
```

---

## Performance Notes

- HubSpot indexing runs in a **Web Worker** (non-blocking, no UI freeze)
- 200K+ rows: expect ~2–5s indexing time
- Token index capped at 5,000 entries per token (prevents memory bloat on common words)
- Fuzzy scoring runs on max 1,200 deduplicated token hits (not the entire HubSpot set)
- User can adjust max candidates per query (10–1000, default 100)
- Batch match preview count runs synchronously in the main thread (useMemo) — fast enough for typical dataset sizes (<100ms for 200K rows)

---

## What's Not There Yet

- Fuzzy threshold customization (currently hardcoded in algorithm)
- Session resume (in-progress matching is lost on page refresh)
- Dark mode toggle
- Real HubSpot API integration (currently CSV upload only)
- Undo/redo for selections
