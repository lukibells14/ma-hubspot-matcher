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
    └── CustomColumnBuilder.tsx    # IF/ELSE computed column builder with live preview
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
| `acronym_match` | Acronym lookup (e.g. "ABC Corp" → "ABC") |
| `acronym_punct` | Acronym + punctuation-stripped key |
| `token_block` | Top 6 longest tokens unioned, then fuzzy scored |
| `fuzzy_scored` | Dice bigram similarity on remaining candidates |

Builds 5 lookup indexes at startup: domain, core name, acronym, token, acronym+punct.

Files: `src/workers/match.worker.ts`, `src/utils/normalize.ts`

### 5. Batch Auto-Match (Optional)
An optional pre-step before manual review. Enabled via the **Batch Options** toggle on the ready screen.

- Runs **exact-name-only** matching (no fuzzy, no suffix/acronym strategies)
- Normalizes both sides with abbreviation canonicalization: `corporation→corp`, `incorporated→inc`, `limited liability company→llc`, etc. — so "Acme Corporation" matches "Acme Corp"
- **1-to-1 only**: if two HubSpot records match the same M&A name, both are sent to manual review instead
- Results open in **BatchReviewModal**: shows match counts (exact / ambiguous / no-match), column selectors for M&A and HubSpot fields, per-row checkboxes to uncheck incorrect matches
- Confirmed matches go directly to the Results table with `foundBy: ["batch_exact"]` and score 100
- Unchecked/rejected matches are added back to the manual review queue
- **Preview count**: even before running, the ready screen shows how many exact matches would be found based on the current name mapping

Files: `src/utils/batchMatch.ts`, `src/components/BatchReviewModal.tsx`

### 6. Prescreen Queue
Before review starts, rows are bucketed:
- **100% matches** (domain or core name exact) — reviewed first
- **Rest** — queued after
- Rows already confirmed by batch auto-match are excluded from the queue

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

### 12. File Preview Modal
Shows column list, row count, and first 5 rows when a CSV is uploaded, so users can verify the file before proceeding.

File: `src/components/SummaryModal.tsx`

### 13. Resizable Modals
All modals (ExportModal, SummaryModal, BatchReviewModal, CustomColumnBuilder) have a drag handle at the bottom-right corner. Uses the shared `useResizable` hook.

- Dragging outside the modal after resize does **not** trigger cancel — suppressed via a one-time capture-phase click listener
- Hook: `src/hooks/useResizable.ts`

---

## Key Types (`src/types.ts`)

```typescript
ColumnMapping          // maName, maDomain, hubName, hubDomain, hubUniqueCode
DisplayFieldSelection  // maFields[], hubFields[], showHubFoundBy
FoundBy                // "domain_exact" | "exact_core" | "suffix_variant_*" | "acronym_*"
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
{ type: "INDEX_PROGRESS";   done, total }
{ type: "READY";            hubCount, maCount }
{ type: "BATCH_MATCH_DONE"; result: BatchMatchResult }
{ type: "CANDIDATES";       maIndex, candidates }
{ type: "PRESCREEN_DONE";   hundredPct, rest }
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
