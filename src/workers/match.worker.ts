import type { ColumnMapping, RowObject, Candidate, FoundBy, BatchMatchResult } from "../types";
import {
  cleanDomain,
  coreName,
  makeAcronym,
  extractTokens,
  generateSuffixVariants,
  diceSimilarity,
  looksLikeAcronym,
  acronymPunctKey,
} from "../utils/normalize";
import { runBatchMatch } from "../utils/batchMatch";

type InitMsg = { type: "INIT"; hubRows: RowObject[]; mapping: ColumnMapping };
type StartMsg = { type: "START"; maRows: RowObject[] };
type GetCandidatesMsg = { type: "GET_CANDIDATES"; maIndex: number; maxCandidates?: number };
type PrescreenMsg = { type: "PRESCREEN" };
type BatchMatchMsg = { type: "BATCH_MATCH" };
type HubspotSearchMsg = { type: "HUBSPOT_SEARCH"; query: string; maxResults: number };
type ScanZeroCandidatesMsg = { type: "SCAN_ZERO_CANDIDATES" };
type WorkerMsg = InitMsg | StartMsg | GetCandidatesMsg | PrescreenMsg | BatchMatchMsg | HubspotSearchMsg | ScanZeroCandidatesMsg;

type WorkerOut =
  | { type: "INDEX_PROGRESS"; done: number; total: number }
  | { type: "READY"; hubCount: number; maCount: number }
  | { type: "CANDIDATES"; maIndex: number; candidates: Candidate[] }
  | { type: "PRESCREEN_DONE"; hundredPct: number[]; highScore: number[]; rest: number[] }
  | { type: "BATCH_MATCH_DONE"; result: BatchMatchResult }
  | { type: "HUBSPOT_SEARCH_RESULTS"; hubIndexes: number[]; overflow: boolean }
  | { type: "ZERO_CANDIDATES_DONE"; zeroIndexes: number[] }
  | { type: "ERROR"; message: string };

let HUB: RowObject[] = [];
let MA: RowObject[] = [];
let mapping: ColumnMapping | null = null;

let domainIndex = new Map<string, number>();     // domain -> first hubIndex
let coreNameIndex = new Map<string, number[]>(); // core -> hubIndexes
let acronymIndex = new Map<string, number[]>();  // acronym -> hubIndexes
let tokenIndex = new Map<string, number[]>();    // token -> hubIndexes
let acrPunctIndex = new Map<string, number[]>();

let hubCore: string[] = [];
let hubAcr: string[] = [];
let hubDomain: string[] = [];
let hubAcrPunct: string[] = [];

interface SearchRow { hubIndex: number; values: string[] }
let HUB_SEARCH_INDEX: SearchRow[] = [];

function buildSearchIndex(rows: RowObject[], map: ColumnMapping) {
  HUB_SEARCH_INDEX = rows.map((row, i) => ({
    hubIndex: i,
    values: [String(row[map.hubName] ?? "").toLowerCase()],
  }));
}

function pushIndex(map: Map<string, number[]>, key: string, idx: number) {
  if (!key) return;
  const arr = map.get(key);
  if (!arr) map.set(key, [idx]);
  else arr.push(idx);
}

function pushToken(token: string, idx: number) {
  if (!token) return;
  const CAP = 5000; // prevent massive lists for generic tokens
  const arr = tokenIndex.get(token);
  if (!arr) tokenIndex.set(token, [idx]);
  else if (arr.length < CAP) arr.push(idx);
}

function buildIndexes(rows: RowObject[], map: ColumnMapping) {
  domainIndex = new Map();
  coreNameIndex = new Map();
  acronymIndex = new Map();
  tokenIndex = new Map();
  acrPunctIndex = new Map();

  hubCore = new Array(rows.length);
  hubAcr = new Array(rows.length);
  hubDomain = new Array(rows.length);
  hubAcrPunct = new Array(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    const name = String(r?.[map.hubName] ?? "");

    const ap = acronymPunctKey(name);
    hubAcrPunct[i] = ap;
    if (ap) pushIndex(acrPunctIndex, ap, i);

    const c = coreName(name);
    hubCore[i] = c;

    const acr = makeAcronym(name);
    if (looksLikeAcronym(name)) {
        const raw = name.replace(/[^A-Za-z]/g, "").toUpperCase();
        if (raw.length >= 2) pushIndex(acronymIndex, raw, i);
    }
    hubAcr[i] = acr;

    const dom = map.hubDomain ? cleanDomain(r?.[map.hubDomain]) : "";
    hubDomain[i] = dom;

    if (dom && !domainIndex.has(dom)) domainIndex.set(dom, i);
    pushIndex(coreNameIndex, c, i);
    if (acr) pushIndex(acronymIndex, acr, i);

    const toks = extractTokens(name);
    for (const t of toks) pushToken(t, i);

    if (i % 2000 === 0) (self as any).postMessage({ type: "INDEX_PROGRESS", done: i, total: rows.length } satisfies WorkerOut);
  }
  (self as any).postMessage({ type: "INDEX_PROGRESS", done: rows.length, total: rows.length } satisfies WorkerOut);
}

function uniq(arr: number[]): number[] {
  return Array.from(new Set(arr));
}

function tokenOverlapCount(aName: string, bName: string): number {
  const a = new Set(extractTokens(aName));
  const b = new Set(extractTokens(bName));
  let overlap = 0;
  for (const t of a) if (b.has(t)) overlap++;
  return overlap;
}

function passesAcronymGate(maName: string, hubName: string): boolean {
  const sim = diceSimilarity(coreName(maName), coreName(hubName));
  if (sim >= 0.50) return true;           // strong fuzzy similarity

  const overlap = tokenOverlapCount(maName, hubName);
  if (overlap >= 1) return true;          // shares at least 1 meaningful token

  return false;
}

function addCandidate(
  bag: Map<number, { foundBy: Set<FoundBy>; scoreHint?: number }>,
  idx: number,
  reason: FoundBy,
  scoreHint?: number
) {
  const existing = bag.get(idx);
  if (!existing) bag.set(idx, { foundBy: new Set([reason]), scoreHint });
  else {
    existing.foundBy.add(reason);
    if (typeof scoreHint === "number") existing.scoreHint = Math.max(existing.scoreHint ?? 0, scoreHint);
  }
}

function getCandidatesFor(maRow: RowObject, maxCandidates = 100): Candidate[] {
  if (!mapping) return [];

  const maName = String(maRow?.[mapping.maName] ?? "");
  const maDom = mapping.maDomain ? cleanDomain(maRow?.[mapping.maDomain]) : "";

  const bag = new Map<number, { foundBy: Set<FoundBy>; scoreHint?: number }>();

  // A) Domain exact
  if (maDom) {
    const hit = domainIndex.get(maDom);
    if (typeof hit === "number") addCandidate(bag, hit, "domain_exact", 100);
  }

  // B) Exact + suffix variants (match-only)
  const variants = generateSuffixVariants(maName);
  for (const v of variants) {
    const k = coreName(v.variant);
    const hits = coreNameIndex.get(k);
    if (hits?.length) hits.forEach(idx => addCandidate(bag, idx, v.foundBy));
  }

  // C) Acronym matching
  const maAcr = makeAcronym(maName);
if (maAcr) {
  const hits = acronymIndex.get(maAcr);
  // ignore super-common acronyms (ATS, ST, etc.)
  if (hits?.length && hits.length <= 40) {
    hits.forEach(idx => addCandidate(bag, idx, "acronym_match"));
  }
}

  if (looksLikeAcronym(maName)) {
    const acr = maName.replace(/[^A-Za-z]/g, "").toUpperCase();
    const hits = acronymIndex.get(acr);
    if (hits?.length) hits.forEach(idx => addCandidate(bag, idx, "acronym_match"));
  }

  const maAcrPunct = acronymPunctKey(maName);
  if (maAcrPunct) {
   const hits = acrPunctIndex.get(maAcrPunct);
   if (hits?.length) hits.forEach(idx => addCandidate(bag, idx, "acronym_punct", 92));
  }

  // D) Token blocking
  const toks = extractTokens(maName);
  const top = toks.sort((a, b) => b.length - a.length).slice(0, 6);

  const tokenHits: number[] = [];
  for (const t of top) {
    const ids = tokenIndex.get(t);
    if (ids?.length) tokenHits.push(...ids);
  }

  const pool = uniq(tokenHits).slice(0, 1200);
  for (const idx of pool) addCandidate(bag, idx, "token_block");

  // Score (fuzzy) in reduced pool
  const maCore = coreName(maName);

  const scored: Candidate[] = [];
  for (const [idx, meta] of bag.entries()) {
    let score = 0;

    const hubName = String(HUB[idx]?.[mapping.hubName] ?? "");

    // base similarity on core name
    const sim = diceSimilarity(maCore, hubCore[idx] ?? "");
    score = Math.round(sim * 90);

    // exact core name → 100
    if (maCore && hubCore[idx] && maCore === hubCore[idx]) score = 100;

    // boost if domain exact
    if (maDom && hubDomain[idx] && maDom === hubDomain[idx]) score = 100;

    // boost if acronym exact
    // boost if acronym exact ONLY when similarity is already decent
    if (maAcr && hubAcr[idx] && maAcr === hubAcr[idx]) {
      if (sim >= 0.55) score = Math.max(score, 85);
      else if (sim >= 0.45) score = Math.max(score, 75);
      // else no boost
    }

    if (maAcrPunct && hubAcrPunct[idx] && maAcrPunct === hubAcrPunct[idx]) {
      score = Math.max(score, 92);
    }

    if (meta.scoreHint) score = Math.max(score, meta.scoreHint);

    meta.foundBy.add("fuzzy_scored");

    scored.push({
      hubIndex: idx,
      score,
      foundBy: Array.from(meta.foundBy),
    });

    const reasons = Array.from(meta.foundBy);

    // "acronym-only" = came from acronym match (and then fuzzy scoring is always added later)
    const acronymOnly =
      reasons.every(r => r === "acronym_match" || r === "fuzzy_scored");

    if (acronymOnly && !passesAcronymGate(maName, hubName)) {
      continue; // drop noisy acronym collisions like ATS -> Anthony T Sanders
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCandidates);
}

function hasAnyCandidates(row: RowObject): boolean {
  if (!mapping) return false;
  const maName = String(row[mapping.maName] ?? "");
  const maDom = mapping.maDomain ? cleanDomain(row[mapping.maDomain]) : "";

  if (maDom && domainIndex.has(maDom)) return true;

  const variants = generateSuffixVariants(maName);
  for (const v of variants) {
    const k = coreName(v.variant);
    if (k && coreNameIndex.has(k)) return true;
  }

  const maAcr = makeAcronym(maName);
  if (maAcr) {
    const hits = acronymIndex.get(maAcr);
    if (hits?.length && hits.length <= 40) return true;
  }

  if (looksLikeAcronym(maName)) {
    const acr = maName.replace(/[^A-Za-z]/g, "").toUpperCase();
    const hits = acronymIndex.get(acr);
    if (hits?.length) return true;
  }

  const maAcrPunct = acronymPunctKey(maName);
  if (maAcrPunct && acrPunctIndex.has(maAcrPunct)) return true;

  const toks = extractTokens(maName).sort((a, b) => b.length - a.length).slice(0, 6);
  for (const t of toks) {
    if (tokenIndex.has(t)) return true;
  }

  return false;
}

self.onmessage = (e: MessageEvent<WorkerMsg>) => {
  try {
    const msg = e.data;

    if (msg.type === "INIT") {
      HUB = msg.hubRows;
      mapping = msg.mapping;
      buildIndexes(HUB, msg.mapping);
      buildSearchIndex(HUB, msg.mapping);
      (self as any).postMessage({ type: "READY", hubCount: HUB.length, maCount: MA.length } satisfies WorkerOut);
      return;
    }

    if (msg.type === "START") {
      MA = msg.maRows;
      (self as any).postMessage({ type: "READY", hubCount: HUB.length, maCount: MA.length } satisfies WorkerOut);
      return;
    }

    if (msg.type === "GET_CANDIDATES") {
      const row = MA[msg.maIndex];
      const candidates = row ? getCandidatesFor(row, msg.maxCandidates) : [];
      (self as any).postMessage({ type: "CANDIDATES", maIndex: msg.maIndex, candidates } satisfies WorkerOut);
      return;
    }

    if (msg.type === "BATCH_MATCH") {
      if (!mapping) return;
      const result = runBatchMatch(MA, HUB, mapping);
      (self as any).postMessage({ type: "BATCH_MATCH_DONE", result } satisfies WorkerOut);
      return;
    }

    if (msg.type === "HUBSPOT_SEARCH") {
      const q = (msg.query ?? "").trim().toLowerCase();
      if (!q) {
        (self as any).postMessage({ type: "HUBSPOT_SEARCH_RESULTS", hubIndexes: [], overflow: false } satisfies WorkerOut);
        return;
      }
      const max = msg.maxResults ?? 100;
      const hubIndexes: number[] = [];
      let overflow = false;
      for (const row of HUB_SEARCH_INDEX) {
        if (row.values.some(v => v.includes(q))) {
          if (hubIndexes.length >= max) { overflow = true; break; }
          hubIndexes.push(row.hubIndex);
        }
      }
      (self as any).postMessage({ type: "HUBSPOT_SEARCH_RESULTS", hubIndexes, overflow } satisfies WorkerOut);
      return;
    }

    if (msg.type === "SCAN_ZERO_CANDIDATES") {
      const zeroIndexes: number[] = [];
      for (let i = 0; i < MA.length; i++) {
        const row = MA[i];
        if (row && !hasAnyCandidates(row)) zeroIndexes.push(i);
      }
      (self as any).postMessage({ type: "ZERO_CANDIDATES_DONE", zeroIndexes } satisfies WorkerOut);
      return;
    }

    if (msg.type === "PRESCREEN") {
      if (!mapping) return;
      const hundredPct: number[] = [];
      const highScore: number[] = [];
      const rest: number[] = [];

      for (let i = 0; i < MA.length; i++) {
        const row = MA[i];
        if (!row) { rest.push(i); continue; }

        const maDom = mapping.maDomain ? cleanDomain(row[mapping.maDomain]) : "";
        const maCore = coreName(String(row[mapping.maName] ?? ""));

        const hasDomainHit = !!maDom && domainIndex.has(maDom);
        const hasCoreHit = !!maCore && coreNameIndex.has(maCore);

        if (hasDomainHit || hasCoreHit) {
          hundredPct.push(i);
          continue;
        }

        // Lightweight heuristic using index lookups only — no scoring, no worker blocking
        const maName = String(row[mapping.maName] ?? "");
        const variants = generateSuffixVariants(maName);
        const maAcrPunct = acronymPunctKey(maName);

        let isHighScore = false;
        for (const v of variants) {
          const k = coreName(v.variant);
          if (k && coreNameIndex.has(k)) { isHighScore = true; break; }
        }
        if (!isHighScore && maAcrPunct && acrPunctIndex.has(maAcrPunct)) isHighScore = true;

        if (isHighScore) highScore.push(i);
        else rest.push(i);
      }

      (self as any).postMessage({ type: "PRESCREEN_DONE", hundredPct, highScore, rest } satisfies WorkerOut);
      return;
    }

  } catch (err: any) {
    (self as any).postMessage({ type: "ERROR", message: err?.message ?? String(err) } satisfies WorkerOut);
  }
};
