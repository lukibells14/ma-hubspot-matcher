import * as XLSX from "xlsx";
import type { RowObject, SelectionRow } from "../types";

export function exportSelectionsToXlsx(
  selections: SelectionRow[],
  maFields: string[],
  hubFields: string[],
  filename = "ma_hubspot_matches.xlsx"
) {
  const rows = selections.map((sel) => {
    const out: Record<string, any> = {};

    out["match_status"] = sel.selectionType === "no_match" ? "No Match" : "Matched";
    out["match_score"] = sel.score ?? "";
    out["found_by"] = sel.foundBy?.join(", ") ?? "";

    for (const f of maFields) out[`ma.${f}`] = sel.maRow?.[f] ?? "";

    if (sel.selectionType === "hubspot") {
      for (const f of hubFields) out[`hub.${f}`] = sel.hubRow?.[f] ?? "";
    } else {
      for (const f of hubFields) out[`hub.${f}`] = "";
    }

    return out;
  });

  // ✅ Force ALL columns to exist in the sheet (and in a stable order)
  const header = [
    "match_status",
    "match_score",
    "found_by",
    ...maFields.map((f) => `ma.${f}`),
    ...hubFields.map((f) => `hub.${f}`),
  ];

  const ws = XLSX.utils.json_to_sheet(rows, {
    header,
    skipHeader: false,
  });

  // (Optional) ensure header row is written even if rows is empty
  if (rows.length === 0) {
    XLSX.utils.sheet_add_aoa(ws, [header], { origin: "A1" });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Matches");
  XLSX.writeFile(wb, filename);
}

export function exportRemainingToCsv(rows: RowObject[], columns: string[], filename = "remaining_ma.csv") {
  const escape = (v: any) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const lines = [
    columns.map(escape).join(","),
    ...rows.map((row) => columns.map((c) => escape(row[c])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}