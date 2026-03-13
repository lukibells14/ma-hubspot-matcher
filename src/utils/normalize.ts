const SUFFIXES = [
  "inc", "incorporated",
  "ltd", "limited",
  "llc",
  "corp", "corporation",
  "co", "company",
  "group", "holdings", "holding",
  "plc", "lp", "llp", "pa","pc"
];

const STOPWORDS = new Set(["the", "and", "&", "of", "for", "a", "an"]);

export function cleanDomain(input: any): string {
  const s = String(input ?? "").trim().toLowerCase();
  if (!s) return "";
  return s.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
}

export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function stripPunctuation(s: string): string {
  return s.replace(/[^a-z0-9\s]/gi, " ");
}

export function normalizeNameRaw(input: any): string {
  return normalizeWhitespace(stripPunctuation(String(input ?? "")).toLowerCase());
}

export function removeSuffixTokens(name: string): string {
  const tokens = name.split(" ").filter(Boolean);
  const filtered = tokens.filter(t => !SUFFIXES.includes(t));
  return normalizeWhitespace(filtered.join(" "));
}

export function coreName(name: any): string {
  return removeSuffixTokens(normalizeNameRaw(name));
}

export function extractTokens(name: string): string[] {
  return normalizeNameRaw(name)
    .split(" ")
    .filter(Boolean)
    .filter(t => !STOPWORDS.has(t))
    .filter(t => !SUFFIXES.includes(t));
}

const ACRONYM_BLOCKWORDS = new Set([
  "ASSOCIATE", "ASSOCIATES",
  "CPA", "CPAS",
  "PA", "PC",
]);

const ACRONYM_IGNORE_WORDS = new Set([
  "SERVICES", "SERVICE",
  "SOLUTIONS", "SOLUTION",
  "GROUP",
  "HOLDINGS", "HOLDING",
  "PARTNERS", "PARTNER",
  "CONSULTING", "CONSULTANTS", "CONSULTANT",
  "MANAGEMENT",
  "ADVISORS", "ADVISER", "ADVISORY",
]);

export function makeAcronym(name: string): string {
  const raw = String(name ?? "").trim();
  if (!raw) return "";

  // Keep user-provided acronyms, but require >= 3 letters to avoid "SH"/"ST" collisions
  const cleanedOnlyLetters = raw.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (looksLikeAcronym(raw) && cleanedOnlyLetters.length >= 3) return cleanedOnlyLetters;

  const stop = new Set(["OF", "AND", "THE", "A", "AN"]);

  const words = raw
    .replace(/&/g, " AND ")
    .split(/[\s\-\/]+/)
    .map(w => w.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
    .filter(Boolean);

  // hard block if name contains any of these words
  for (const w of words) {
    if (ACRONYM_BLOCKWORDS.has(w)) return "";
  }

  // remove stopwords, suffixes, and generic business words
  const meaningful = words
    .filter(w => !stop.has(w))
    .filter(w => !SUFFIXES.includes(w.toLowerCase()))
    .filter(w => !ACRONYM_IGNORE_WORDS.has(w));

  // require >= 3 meaningful words to generate acronym
  if (meaningful.length < 3) return "";

  const acr = meaningful.map(w => w[0]).join("");

  // never allow 2-letter acronyms
  if (acr.length < 3) return "";

  return acr.slice(0, 10);
}

export function looksLikeAcronym(name: string): boolean {
  const s = String(name ?? "").trim();
  return /^[A-Z]{2,8}(\s*,\s*(INC|LLC|LTD|CORP)\.?)?$/i.test(s);
}

export function acronymPunctKey(name: string): string {
  // coreName already trims company suffixes + normalizes punctuation/case
  const c = coreName(name);
  return c.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * For matching only:
 * - try raw core
 * - try removing suffixes
 * - try adding common suffixes if none exist
 * Note: display uses original HubSpot name regardless.
 */
export function generateSuffixVariants(name: any): { variant: string; foundBy: "exact_core" | "suffix_variant_removed" | "suffix_variant_added" }[] {
  const raw = normalizeNameRaw(name);
  const core = removeSuffixTokens(raw);

  const out: { variant: string; foundBy: any }[] = [];
  out.push({ variant: raw, foundBy: "exact_core" });

  if (core && core !== raw) out.push({ variant: core, foundBy: "suffix_variant_removed" });

  const hasSuffix = raw.split(" ").some(t => SUFFIXES.includes(t));
  if (!hasSuffix && core) {
    out.push({ variant: `${core} inc`, foundBy: "suffix_variant_added" });
    out.push({ variant: `${core} llc`, foundBy: "suffix_variant_added" });
    out.push({ variant: `${core} ltd`, foundBy: "suffix_variant_added" });
    out.push({ variant: `${core} corp`, foundBy: "suffix_variant_added" });
  }

  const seen = new Set<string>();
  return out.filter(v => (seen.has(v.variant) ? false : (seen.add(v.variant), true)));
}

export function diceSimilarity(a: string, b: string): number {
  a = normalizeNameRaw(a);
  b = normalizeNameRaw(b);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const bigrams = (s: string) => {
    const out: string[] = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  };

  const aa = bigrams(a);
  const bb = bigrams(b);

  const freq = new Map<string, number>();
  for (const x of aa) freq.set(x, (freq.get(x) ?? 0) + 1);

  let matches = 0;
  for (const x of bb) {
    const n = freq.get(x) ?? 0;
    if (n > 0) {
      matches++;
      freq.set(x, n - 1);
    }
  }
  return (2 * matches) / (aa.length + bb.length);
}
