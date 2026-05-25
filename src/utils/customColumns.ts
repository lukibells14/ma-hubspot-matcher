import type { Condition, ColumnRule, CustomColumn, RowObject } from "../types";

function evaluateCondition(row: RowObject, cond: Condition): boolean {
  const cell = String(row[cond.column] ?? "").trim();
  const val = cond.value.trim();
  const cellLower = cell.toLowerCase();
  const valLower = val.toLowerCase();

  switch (cond.operator) {
    case "=":            return cellLower === valLower;
    case "!=":           return cellLower !== valLower;
    case ">":            return parseFloat(cell) > parseFloat(val);
    case ">=":           return parseFloat(cell) >= parseFloat(val);
    case "<":            return parseFloat(cell) < parseFloat(val);
    case "<=":           return parseFloat(cell) <= parseFloat(val);
    case "contains":     return cellLower.includes(valLower);
    case "not_contains": return !cellLower.includes(valLower);
    case "starts_with":  return cellLower.startsWith(valLower);
    case "is_empty":     return cell === "";
    case "is_not_empty": return cell !== "";
    default:             return false;
  }
}

function evaluateRule(row: RowObject, rule: ColumnRule): boolean {
  if (rule.conditions.length === 0) return false;
  return rule.logic === "ALL"
    ? rule.conditions.every((c) => evaluateCondition(row, c))
    : rule.conditions.some((c) => evaluateCondition(row, c));
}

export function evaluateCustomColumn(row: RowObject, col: CustomColumn): string {
  for (const rule of col.rules) {
    if (evaluateRule(row, rule)) return rule.output;
  }
  return col.defaultValue;
}

export function applyCustomColumns(
  row: RowObject,
  cols: CustomColumn[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of cols) out[col.name] = evaluateCustomColumn(row, col);
  return out;
}
