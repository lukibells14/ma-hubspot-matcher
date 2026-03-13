import type { ColumnMapping } from "../types";
import { Card, Select } from "./ui";

export function ColumnMapper({
  maColumns,
  hubColumns,
  mapping,
  setMapping,
}: {
  maColumns: string[];
  hubColumns: string[];
  mapping: ColumnMapping;
  setMapping: (m: ColumnMapping) => void;
}) {
  const select = (value: string) => (value === "__none__" ? undefined : value);

  return (
    <Card>
      <div className="ds-card-title" style={{ fontSize: "2rem" }}>
        3) Select Columns for Matching
      </div>

      <div className="ds-grid-2" style={{ marginTop: "1rem" }}>
        <div>
          <div className="ds-kicker" style={{ marginBottom: "0.5rem" }}>
            M&A
          </div>

          <label className="ds-control-label">
            Company Name (required)
            <Select value={mapping.maName} onChange={(e) => setMapping({ ...mapping, maName: e.target.value })}>
              {maColumns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>

          <label className="ds-control-label">
            Domain (optional)
            <Select value={mapping.maDomain ?? "__none__"} onChange={(e) => setMapping({ ...mapping, maDomain: select(e.target.value) })}>
              <option value="__none__">None</option>
              {maColumns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div>
          <div className="ds-kicker" style={{ marginBottom: "0.5rem" }}>
            HubSpot
          </div>

          <label className="ds-control-label">
            Company Name (required)
            <Select value={mapping.hubName} onChange={(e) => setMapping({ ...mapping, hubName: e.target.value })}>
              {hubColumns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>

          <label className="ds-control-label">
            Domain (optional)
            <Select value={mapping.hubDomain ?? "__none__"} onChange={(e) => setMapping({ ...mapping, hubDomain: select(e.target.value) })}>
              <option value="__none__">None</option>
              {hubColumns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>

          <label className="ds-control-label" style={{ marginBottom: 0 }}>
            Unique Code (optional)
            <Select
              value={mapping.hubUniqueCode ?? "__none__"}
              onChange={(e) => setMapping({ ...mapping, hubUniqueCode: select(e.target.value) })}
            >
              <option value="__none__">None</option>
              {hubColumns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>
    </Card>
  );
}
