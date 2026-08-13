export type PrintBox = {
  /** Width in percent (e.g. 100 = 100%) */
  width: number;
  /** Offset from top in px */
  top: number;
  /** Offset from left in px */
  left: number;
};

export type PrintLayout = {
  cover: PrintBox;
  result: PrintBox;
};

export type PrintBoxCss = {
  width: string;
  top: string;
  left: string;
};

export type PrintLayoutCss = {
  cover: PrintBoxCss;
  result: PrintBoxCss;
};

export const DEFAULT_PRINT_BOX: PrintBox = {
  width: 100,
  top: 0,
  left: 0,
};

export const DEFAULT_PRINT_LAYOUT: PrintLayout = {
  cover: { ...DEFAULT_PRINT_BOX },
  result: { ...DEFAULT_PRINT_BOX },
};

const STORAGE_KEY = "zyn-print-layout-v2";

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return fallback;

  const match = value.trim().match(/^-?\d+(\.\d+)?/);
  if (!match) return fallback;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizePrintBox(
  input: Partial<PrintBox> | Record<string, unknown> | undefined,
  fallback: PrintBox = DEFAULT_PRINT_BOX,
): PrintBox {
  return {
    width: parseNumber(input?.width, fallback.width),
    top: parseNumber(input?.top, fallback.top),
    left: parseNumber(input?.left, fallback.left),
  };
}

export function normalizePrintLayout(
  input:
    | Partial<{ cover: Partial<PrintBox>; result: Partial<PrintBox> }>
    | null
    | undefined,
  fallback: PrintLayout = DEFAULT_PRINT_LAYOUT,
): PrintLayout {
  return {
    cover: normalizePrintBox(input?.cover, fallback.cover),
    result: normalizePrintBox(input?.result, fallback.result),
  };
}

/** Fixed units for print CSS: width %, top/left px */
export function toPrintLayoutCss(layout: PrintLayout): PrintLayoutCss {
  const normalized = normalizePrintLayout(layout);
  return {
    cover: {
      width: `${normalized.cover.width}%`,
      top: `${normalized.cover.top}px`,
      left: `${normalized.cover.left}px`,
    },
    result: {
      width: `${normalized.result.width}%`,
      top: `${normalized.result.top}px`,
      left: `${normalized.result.left}px`,
    },
  };
}

export function loadPrintLayoutOverride(): PrintLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizePrintLayout(JSON.parse(raw) as Partial<PrintLayout>);
  } catch {
    return null;
  }
}

export function savePrintLayoutOverride(layout: PrintLayout): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(normalizePrintLayout(layout)),
  );
}

export function clearPrintLayoutOverride(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
