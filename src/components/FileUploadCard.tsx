import { useRef } from "react";
import type React from "react";
import { Button, Card } from "./ui";

export function FileUploadCard({
  title,
  subtitle,
  onFile,
  right,
  disabled,
  filename,
}: {
  title: string;
  subtitle: string;
  onFile: (file: File) => void;
  right?: React.ReactNode;
  disabled?: boolean;
  filename?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div className="ds-card-title" style={{ fontSize: "1.7rem", marginBottom: "0.25rem" }}>
            {title}
          </div>
          <div className="ds-muted">{subtitle}</div>
        </div>
        {right}
      </div>

      <div style={{ marginTop: "0.9rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <Button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>
          Choose File
        </Button>

        <div className="ds-meta ds-muted">
          {filename ? (
            <>
              Selected: <strong style={{ color: "var(--foreground)" }}>{filename}</strong>
            </>
          ) : (
            "No file selected"
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        disabled={disabled}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
    </Card>
  );
}
