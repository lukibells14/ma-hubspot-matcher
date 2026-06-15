import { Button } from "./ui";

const STRATEGIES: {
  foundBy: string;
  label: string;
  description: string;
  examples: { ma: string; candidate: string; note: string }[];
}[] = [
  {
    foundBy: "domain_exact",
    label: "Domain Exact",
    description: "The website domain of the M&A company exactly matches the HubSpot company's domain. Highest confidence — always scores 100.",
    examples: [
      { ma: "Acme Corp (acme.com)", candidate: "Acme Corporation (acme.com)", note: "Same domain → score 100" },
      { ma: "Blue Sky Inc (bluesky.io)", candidate: "Blue Sky Holdings (bluesky.io)", note: "Name differs, domain matches → score 100" },
    ],
  },
  {
    foundBy: "exact_core",
    label: "Exact Core Name",
    description: "After stripping punctuation and legal suffixes (LLC, Inc, Corp, etc.), the core names match exactly.",
    examples: [
      { ma: "Acme LLC", candidate: "Acme Inc", note: "Core: 'acme' = 'acme' → score 100" },
      { ma: "Blue Sky, Corp.", candidate: "Blue Sky LLC", note: "Comma and periods stripped → core matches" },
    ],
  },
  {
    foundBy: "suffix_variant_removed",
    label: "Suffix Removed",
    description: "The M&A name has a legal suffix (LLC, Corp, etc.) that was stripped to find a HubSpot company without one.",
    examples: [
      { ma: "Sunrise Bakery LLC", candidate: "Sunrise Bakery", note: "LLC removed from MA → matches bare HubSpot name" },
      { ma: "Harbor Trust Corp", candidate: "Harbor Trust", note: "Corp removed → exact match" },
    ],
  },
  {
    foundBy: "suffix_variant_added",
    label: "Suffix Added",
    description: "The M&A name has no legal suffix, so common suffixes (Inc, LLC, Corp, Ltd) were tried to find a HubSpot match.",
    examples: [
      { ma: "Greenfield", candidate: "Greenfield Inc", note: "Inc added to MA → matches HubSpot" },
      { ma: "River Ridge", candidate: "River Ridge LLC", note: "LLC added to MA → matches HubSpot" },
    ],
  },
  {
    foundBy: "and_ampersand_variant",
    label: "And / & Variant",
    description: "One name uses 'and' while the other uses '&'. Both are treated as equivalent.",
    examples: [
      { ma: "Smith and Jones LLC", candidate: "Smith & Jones LLC", note: "'and' normalized to match '&'" },
      { ma: "Baker & Reed Corp", candidate: "Baker and Reed Corp", note: "'&' normalized to match 'and'" },
      { ma: "The Williams & Partners", candidate: "Williams and Partners LLC", note: "Combined with The prefix and suffix removal" },
    ],
  },
  {
    foundBy: "the_prefix_variant",
    label: "The Prefix Variant",
    description: "One name starts with 'The' while the other does not. The leading 'The' is ignored during matching.",
    examples: [
      { ma: "Grand Hotel Group", candidate: "The Grand Hotel Group", note: "'The' stripped from candidate" },
      { ma: "The Harbor Trust", candidate: "Harbor Trust LLC", note: "'The' stripped from MA, suffix removed from candidate" },
      { ma: "The Baker & Reed", candidate: "Baker and Reed Corp", note: "Combined: The prefix + & vs and" },
    ],
  },
  {
    foundBy: "trailing_s_variant",
    label: "Trailing S Variant",
    description: "A word in one name has a trailing 's' that the other does not (e.g. 'Jacksons' vs 'Jackson'). The trailing 's' is stripped for matching.",
    examples: [
      { ma: "Jackson Consulting", candidate: "Jacksons Consulting LLC", note: "Trailing 's' on 'Jacksons' stripped" },
      { ma: "Baker Street Partners", candidate: "Baker Street Partner Inc", note: "Trailing 's' on 'Partners' stripped" },
      { ma: "The Bryson and Benjamins LLC", candidate: "Bryson & Benjamin Corp", note: "Combined: The + and/& + trailing s" },
    ],
  },
  {
    foundBy: "dba_variant",
    label: "DBA (Doing Business As)",
    description: "A HubSpot company name contains 'dba' (doing business as). The matcher checks both the name before and after 'dba' against the M&A name, and vice versa.",
    examples: [
      { ma: "Morning Fresh", candidate: "Sunrise Bakery LLC dba Morning Fresh", note: "MA matches right side of dba" },
      { ma: "Sunrise Bakery", candidate: "Sunrise Bakery LLC dba Morning Fresh", note: "MA matches left side of dba" },
      { ma: "Williams & Reed LLC dba Premier Group", candidate: "Premier Group Inc", note: "MA contains dba, candidate matches right side" },
    ],
  },
  {
    foundBy: "acronym_match",
    label: "Acronym Match",
    description: "The initials of the M&A company name match the initials of the HubSpot company (e.g. 'Smith Baker Jones' → 'SBJ'). Only fires when names have 3+ meaningful words.",
    examples: [
      { ma: "Smith Baker Jones Group", candidate: "SBJ Group", note: "SBJ acronym matched" },
      { ma: "Pacific Northwest Holdings", candidate: "PNH LLC", note: "PNH acronym matched" },
    ],
  },
  {
    foundBy: "acronym_punct",
    label: "Acronym Punctuation",
    description: "Handles acronyms written with punctuation like 'A.T.S.' matching 'ATS'. Periods between letters are stripped.",
    examples: [
      { ma: "A.T.S. Corp", candidate: "ATS Corporation", note: "Periods stripped → ATS matches ATS" },
      { ma: "D.B.S. LLC", candidate: "DBS Inc", note: "Punctuated acronym normalized" },
    ],
  },
  {
    foundBy: "fuzzy_scored",
    label: "Fuzzy Scored",
    description: "After all index lookups narrow the candidate pool, every candidate is scored using Dice similarity on the core name. This label always appears alongside others — it is how the final score is calculated.",
    examples: [
      { ma: "The Jacksons Partner", candidate: "Jackson Partners LLC", note: "High dice similarity → score ~88" },
      { ma: "Bryson & Benjamins", candidate: "Bryson and Benjamin Corp", note: "After and/& and trailing-s normalization → high score" },
    ],
  },
  {
    foundBy: "token_block",
    label: "Token Block",
    description: "Shared meaningful words between the M&A and HubSpot names are used to build a candidate pool for fuzzy scoring. Catches names that don't match exactly but share key words.",
    examples: [
      { ma: "Pacific Realty Group", candidate: "Pacific Realty Holdings", note: "'pacific' and 'realty' tokens overlap" },
      { ma: "Grand Valley Medical", candidate: "Grand Valley Health", note: "'grand' and 'valley' tokens overlap" },
    ],
  },
  {
    foundBy: "batch_exact",
    label: "Batch Auto-Match",
    description: "During the batch auto-match run, the M&A name had exactly one unambiguous HubSpot match and was automatically selected without manual review.",
    examples: [
      { ma: "Acme LLC", candidate: "Acme LLC", note: "Only one match found → auto-selected in batch" },
    ],
  },
  {
    foundBy: "hubspot_search",
    label: "HubSpot Manual Search",
    description: "You switched to HUBSPOT SEARCH mode and typed a query. The result came from a full-text search of the entire HubSpot dataset, not the automated candidate pipeline.",
    examples: [
      { ma: "Acme Corp", candidate: "Acme Technologies Group", note: "Found by typing 'Acme' in HUBSPOT SEARCH mode" },
    ],
  },
];

export function MatchingInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(255,255,255,0.92)",
        border: "10px solid var(--foreground)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, zIndex: 50,
      }}
    >
      <div
        className="ds-card"
        style={{
          width: "min(900px, 100%)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ paddingBottom: "0.8rem", borderBottom: "var(--line-medium)", display: "flex", justifyContent: "space-between", gap: 10, flexShrink: 0, alignItems: "flex-start" }}>
          <div>
            <div className="ds-card-title" style={{ fontSize: "1.6rem" }}>How Candidate Matching Works</div>
            <div className="ds-meta ds-muted" style={{ marginTop: 4 }}>
              Each candidate can be found by one or more strategies. Multiple labels can fire on the same match.
            </div>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: "0.9rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}>
          {STRATEGIES.map((s) => (
            <div key={s.foundBy} style={{ borderBottom: "var(--line-hairline)", paddingBottom: "1.2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
                <span className="ds-pill" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{s.foundBy}</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{s.label}</span>
              </div>
              <div className="ds-meta" style={{ marginBottom: "0.7rem", lineHeight: 1.5 }}>{s.description}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {s.examples.map((ex, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "0.5rem",
                      fontSize: 12,
                      background: "var(--background)",
                      border: "var(--line-hairline)",
                      padding: "0.5rem 0.7rem",
                    }}
                  >
                    <div>
                      <div className="ds-meta ds-muted" style={{ fontSize: 10, marginBottom: 2 }}>M&A Name</div>
                      <div style={{ fontWeight: 700 }}>{ex.ma}</div>
                    </div>
                    <div>
                      <div className="ds-meta ds-muted" style={{ fontSize: 10, marginBottom: 2 }}>HubSpot Candidate</div>
                      <div style={{ fontWeight: 700 }}>{ex.candidate}</div>
                    </div>
                    <div>
                      <div className="ds-meta ds-muted" style={{ fontSize: 10, marginBottom: 2 }}>Why It Matched</div>
                      <div style={{ fontStyle: "italic", opacity: 0.8 }}>{ex.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
