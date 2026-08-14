"use client";

import {
  normalizePrintBox,
  type PrintBox,
} from "@/lib/print-layout";

export function PrintLayoutFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PrintBox;
  onChange: (next: PrintBox) => void;
}) {
  const fields = [
    { key: "width" as const, fieldLabel: "Width", unit: "%" },
    { key: "top" as const, fieldLabel: "Top", unit: "px" },
    { key: "left" as const, fieldLabel: "Left", unit: "px" },
  ];

  return (
    <div className="print-layout-block">
      <div
        className="mb-1.5 text-[11px] uppercase tracking-[0.14em]"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </div>
      <div className="print-layout-grid">
        {fields.map(({ key, fieldLabel, unit }) => (
          <label key={key} className="print-layout-field">
            <span>
              {fieldLabel} ({unit})
            </span>
            <div className="print-layout-input">
              <input
                type="number"
                inputMode="decimal"
                step={1}
                value={Number.isFinite(value[key]) ? value[key] : 0}
                onChange={(event) => {
                  const n = Number(event.target.value);
                  onChange(
                    normalizePrintBox({
                      ...value,
                      [key]: Number.isFinite(n) ? n : 0,
                    }),
                  );
                }}
              />
              <span className="print-layout-unit">{unit}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
