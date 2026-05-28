import type { BatchMatchItem, BatchMatchResult, ColumnMapping, RowObject } from "../types";
import {
  normalizeWhitespace, stripPunctuation,
  cleanDomain, coreName, makeAcronym, extractTokens,
  generateSuffixVariants, looksLikeAcronym, acronymPunctKey,
} from "./normalize";

// Ordered longest-first so multi-word phrases replace before single words.
// Both the full form and abbreviation normalize to the same canonical short form.
const ABBREV_PAIRS: [RegExp, string][] = [
  [/\blimited liability company\b/g, "llc"],
  [/\blimited liability partnership\b/g, "llp"],
  [/\blimited partnership\b/g, "lp"],
  [/\bcorporation\b/g, "corp"],
  [/\bincorporated\b/g, "inc"],
  [/\blimited\b/g, "ltd"],
  [/\bcompany\b/g, "co"],
  [/\binternational\b/g, "intl"],
  [/\bmanagement\b/g, "mgmt"],
  [/\bassociates\b/g, "assoc"],
  [/\bassociation\b/g, "assoc"],
  [/\bgroup\b/g, "grp"],
  [/\bservices\b/g, "svcs"],
  [/\bservice\b/g, "svc"],
  [/\bmanufacturing\b/g, "mfg"],
  [/\bnational\b/g, "natl"],
  [/\bdepartment\b/g, "dept"],
];

export function normalizeBatchName(input: any): string {
  let s = normalizeWhitespace(stripPunctuation(String(input ?? "").toLowerCase()));
  for (const [pattern, replacement] of ABBREV_PAIRS) {
    s = s.replace(pattern, replacement);
  }
  return normalizeWhitespace(s);
}

export function runBatchMatch(
  maRows: RowObject[],
  hubRows: RowObject[],
  mapping: ColumnMapping,
): BatchMatchResult {
  const hubIndex = new Map<string, number[]>();
  for (let i = 0; i < hubRows.length; i++) {
    const key = normalizeBatchName(hubRows[i]?.[mapping.hubName]);
    if (!key) continue;
    const arr = hubIndex.get(key);
    if (!arr) hubIndex.set(key, [i]);
    else arr.push(i);
  }

  const matched: BatchMatchItem[] = [];
  let ambiguousCount = 0;
  let noMatchCount = 0;

  for (let i = 0; i < maRows.length; i++) {
    const key = normalizeBatchName(maRows[i]?.[mapping.maName]);
    const hits = key ? (hubIndex.get(key) ?? []) : [];

    if (hits.length === 0) {
      noMatchCount++;
    } else if (hits.length === 1) {
      matched.push({
        maIndex: i,
        hubIndex: hits[0],
        maRow: maRows[i],
        hubRow: hubRows[hits[0]],
      });
    } else {
      ambiguousCount++;
    }
  }

  return { matched, ambiguousCount, noMatchCount };
}

export function previewZeroCandidateCount(
  maRows: RowObject[],
  hubRows: RowObject[],
  mapping: ColumnMapping,
): number {
  // Build lookup indexes from HubSpot rows (mirrors hasAnyCandidates in the worker)
  const domainSet = new Set<string>();
  const coreSet = new Set<string>();
  const acrMap = new Map<string, number>(); // acr → hit count (respects the ≤40 guard)
  const acrPunctSet = new Set<string>();
  const tokenSet = new Set<string>();

  for (const row of hubRows) {
    const name = String(row?.[mapping.hubName] ?? "");

    const dom = mapping.hubDomain ? cleanDomain(row?.[mapping.hubDomain]) : "";
    if (dom) domainSet.add(dom);

    const c = coreName(name);
    if (c) coreSet.add(c);

    const acr = makeAcronym(name);
    if (acr) acrMap.set(acr, (acrMap.get(acr) ?? 0) + 1);
    if (looksLikeAcronym(name)) {
      const raw = name.replace(/[^A-Za-z]/g, "").toUpperCase();
      if (raw.length >= 2) acrMap.set(raw, (acrMap.get(raw) ?? 0) + 1);
    }

    const ap = acronymPunctKey(name);
    if (ap) acrPunctSet.add(ap);

    for (const t of extractTokens(name)) tokenSet.add(t);
  }

  let count = 0;
  for (const row of maRows) {
    const maName = String(row?.[mapping.maName] ?? "");
    const maDom = mapping.maDomain ? cleanDomain(row?.[mapping.maDomain]) : "";

    if (maDom && domainSet.has(maDom)) continue;

    const variants = generateSuffixVariants(maName);
    if (variants.some((v) => { const k = coreName(v.variant); return !!k && coreSet.has(k); })) continue;

    const maAcr = makeAcronym(maName);
    if (maAcr) {
      const hits = acrMap.get(maAcr) ?? 0;
      if (hits > 0 && hits <= 40) continue;
    }
    if (looksLikeAcronym(maName)) {
      const raw = maName.replace(/[^A-Za-z]/g, "").toUpperCase();
      if ((acrMap.get(raw) ?? 0) > 0) continue;
    }

    const maAcrPunct = acronymPunctKey(maName);
    if (maAcrPunct && acrPunctSet.has(maAcrPunct)) continue;

    const toks = extractTokens(maName).sort((a, b) => b.length - a.length).slice(0, 6);
    if (toks.some((t) => tokenSet.has(t))) continue;

    count++;
  }
  return count;
}
