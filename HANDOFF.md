# MA HubSpot Matcher — Codebase Handoff

## What It Is

A TypeScript/React single-page application for high-volume company name matching between M&A acquisition lists (CSV) and HubSpot CRM datasets. No backend — fully browser-based. Designed for large datasets (200K+ rows) with a keyboard-first review workflow.

---

## Workflow (The User Journey)

```
Upload M&A CSV
    → Upload HubSpot CSV (or load from cache)
        → Configure column mappings
            → Start matching (Worker indexes HubSpot)
                → Review candidates keyboard-first
                    → Export to Excel + remaining CSV
```

---

## Project Structure

```
src/
├── App.tsx                        # Main component: state, workflow, keyboard events
├── types.ts                       # All TypeScript types/interfaces
├── main.tsx                       # React DOM entry point
├── utils/
│   ├── csv.ts                     # CSV parsing (PapaParse, auto-delimiter)
│   ├── storage.ts                 # IndexedDB caching for HubSpot (idb-keyval)
│   ├── normalize.ts               # String normalization + matching algorithms
│   └── export.ts                  # XLSX/CSV export (xlsx library)
├── workers/
│   └── match.worker.ts            # Web Worker: indexing + candidate generation
└── components/
    ├── ui.tsx                     # Reusable primitives (Button, Card, Input, Select)
    ├── FileUploadCard.tsx         # File drop zone
    ├── ColumnMapper.tsx           # Column selection (M&A name/domain, HubSpot name/domain/code)
    ├── MatchViewer.tsx            # Keyboard-controlled candidate viewer (main UI)
    ├── ResultsTable.tsx           # Live table of all selections made
    ├── ProgressHeader.tsx         # Progress bar + status text
    ├── FieldSelectorDropdown.tsx  # Dynamic field display selector
    ├── ExportModal.tsx            # Export dialog with custom filenames
    └── SummaryModal.tsx           # File preview (columns, row count, sample data)
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

### 5. Prescreen Queue
Before review starts, rows are bucketed:
- **100% matches** (domain or core name exact) — reviewed first
- **Rest** — queued after

### 6. Keyboard-First Review UI
| Key | Action |
|---|---|
| `↑` / `↓` | Navigate candidates |
| `Enter` | Select highlighted candidate |
| `←` | Go back to previous M&A row |
| Type to search | Filter candidates by name |

Also shows: match score, which strategy found the match (`foundBy`), and a previous selection indicator.

File: `src/components/MatchViewer.tsx`

### 7. Display Field Customization
User selects which M&A and HubSpot fields to display during review. Includes a toggle for showing the `Found By` reason under each company name.

File: `src/components/FieldSelectorDropdown.tsx`

### 8. Live Results Table
Shows all made selections in real-time as the user reviews. Columns: Status | Score | M&A Summary | HubSpot Summary.

File: `src/components/ResultsTable.tsx`

### 9. Export
- **Excel (XLSX)**: One row per selection, columns prefixed `ma.*` / `hub.*`, plus `match_status`, `match_score`, `found_by`
- **Remaining CSV**: Unreviewed M&A rows (only exported if the session is not yet complete)
- **ExportModal**: User provides custom filenames before downloading

Files: `src/utils/export.ts`, `src/components/ExportModal.tsx`

### 10. File Preview Modal
Shows column list, row count, and first 5 rows when a CSV is uploaded, so users can verify the file before proceeding.

File: `src/components/SummaryModal.tsx`

---

## Key Types (`src/types.ts`)

```typescript
ColumnMapping          // maName, maDomain, hubName, hubDomain, hubUniqueCode
DisplayFieldSelection  // maFields[], hubFields[], showHubFoundBy
FoundBy                // "domain_exact" | "exact_core" | "suffix_variant_*" | "acronym_*" | "token_block" | "fuzzy_scored"
Candidate              // hubIndex, score (0–100), foundBy[]
SelectionRow           // maIndex, maRow, selectionType ("hubspot" | "no_match"), hubRow, score, foundBy
```

---

## App State Stages

```
"upload" → "ready" → "matching" → "done"
```

Centralized in `src/App.tsx` using plain React `useState` (no Redux/Zustand).

---

## Worker Communication

**Main → Worker:**
```typescript
{ type: "INIT";         hubRows, mapping }
{ type: "START";        maRows }
{ type: "GET_CANDIDATES"; maIndex, maxCandidates }
{ type: "PRESCREEN" }
```

**Worker → Main:**
```typescript
{ type: "INDEX_PROGRESS"; done, total }
{ type: "READY";           hubCount, maCount }
{ type: "CANDIDATES";      maIndex, candidates }
{ type: "PRESCREEN_DONE";  hundredPct, rest }
{ type: "ERROR";           message }
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

---

## What's Not There Yet

- Headless/batch mode (auto-match all without keyboard review)
- Fuzzy threshold customization (currently hardcoded in algorithm)
- Session resume (in-progress matching is lost on page refresh)
- Dark mode toggle
- Real HubSpot API integration (currently CSV upload only)
- Undo/redo for selections
