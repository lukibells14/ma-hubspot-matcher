export type RowObject = Record<string, any>;

export type ColumnMapping = {
  maName: string;
  maDomain?: string;

  hubName: string;
  hubDomain?: string;
  hubUniqueCode?: string;
};

export type DisplayFieldSelection = {
  maFields: string[];
  hubFields: string[];
  showHubFoundBy?: boolean;
};

export type FoundBy =
  | "domain_exact"
  | "exact_core"
  | "suffix_variant_added"
  | "suffix_variant_removed"
  | "acronym_match"
  | "token_block"
  | "fuzzy_scored"
  | "acronym_punct"
  | "batch_exact";

export type Candidate = {
  hubIndex: number;
  score: number; // 0-100
  foundBy: FoundBy[];
};

export type CandidateDisplay = Candidate & {
  hubRow: RowObject; // original hubspot row for display
};

export type Operator =
  | "=" | "!=" | ">" | ">=" | "<" | "<="
  | "contains" | "not_contains" | "starts_with"
  | "is_empty" | "is_not_empty";

export type Condition = {
  column: string;
  operator: Operator;
  value: string;
};

export type ColumnRule = {
  id: string;
  logic: "ALL" | "ANY";
  conditions: Condition[];
  output: string;
};

export type CustomColumn = {
  id: string;
  name: string;
  rules: ColumnRule[];
  defaultValue: string;
};

export type BatchMatchItem = {
  maIndex: number;
  hubIndex: number;
  maRow: RowObject;
  hubRow: RowObject;
};

export type BatchMatchResult = {
  matched: BatchMatchItem[];
  ambiguousCount: number;
  noMatchCount: number;
};

export type SelectionRow = {
  maIndex: number;
  maRow: RowObject;

  selectionType: "hubspot" | "no_match";

  hubIndex?: number;
  hubRow?: RowObject;

  score?: number;
  foundBy?: FoundBy[];
};
