import type { BatchMatchItem, BatchMatchResult, ColumnMapping, RowObject } from "../types";
import { normalizeWhitespace, stripPunctuation } from "./normalize";

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
