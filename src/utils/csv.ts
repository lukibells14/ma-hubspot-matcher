import * as Papa from "papaparse";
import type { RowObject } from "../types";

function parseWithDelimiter(
  file: File,
  delimiter: string | undefined
): Promise<{ rows: RowObject[]; columns: string[]; errors: Papa.ParseError[] }> {
  return new Promise((resolve) => {
    Papa.parse<RowObject>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      worker: true,
      delimiter: delimiter, // undefined = autodetect
      complete: (results) => {
        const rows = (results.data ?? []).filter((r) => r && Object.keys(r).length > 0);
        const columns = results.meta.fields ?? Object.keys(rows[0] ?? {});
        resolve({ rows, columns, errors: results.errors ?? [] });
      },
    });
  });
}

export async function parseCsvFile(
  file: File
): Promise<{ rows: RowObject[]; columns: string[] }> {
  // Try auto first
  let res = await parseWithDelimiter(file, undefined);

  const hasUndetectableDelimiter = res.errors.some((e) => e.code === "UndetectableDelimiter");

  // If delimiter couldn't be detected, retry common delimiters
  if (hasUndetectableDelimiter) {
    const candidates: Array<string> = [",", "\t", ";", "|"];

    for (const d of candidates) {
      const attempt = await parseWithDelimiter(file, d);

      // Accept first attempt that yields rows+columns and no delimiter error
      const stillBad = attempt.errors.some((e) => e.code === "UndetectableDelimiter");
      if (!stillBad && (attempt.columns.length > 0 || attempt.rows.length > 0)) {
        res = attempt;
        break;
      }
    }
  }

  // If we still got 0 columns, it's probably not a real CSV (or has bad quotes)
  if (!res.columns.length) {
    const errSummary = (res.errors ?? [])
      .slice(0, 5)
      .map((e) => `${e.code}: ${e.message}`)
      .join(" | ");

    throw new Error(
      `Could not parse CSV. Please confirm the file is a valid CSV with a header row. Details: ${errSummary || "No parse details."}`
    );
  }

  // NOTE: we do NOT fail the whole parse on non-critical errors anymore.
  // We'll just proceed with best-effort rows/columns.
  return { rows: res.rows, columns: res.columns };
}
