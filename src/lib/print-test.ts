/**
 * Standalone print helpers for `/print` test page.
 * Intentionally separate from kiosk `print-poster.ts` (no cover-result wrap).
 */

export type TestPrintBox = {
  /** Width in percent */
  width: number;
  /** Offset from top in px */
  top: number;
  /** Offset from left in px */
  left: number;
};

export const DEFAULT_TEST_PRINT_BOX: TestPrintBox = {
  width: 100,
  top: 0,
  left: 0,
};

export const TEST_RESULT_IMAGES = [
  "/cover-fix.png",
  "/test-result-1-v2.png",
  "/test-result-2-v2.png",
  "/test-result-3-v2.png",
  "/test-result-4-v2.png",
] as const;

export const TEST_RESULT_LABELS = [
  "Cover",
  "Result 1",
  "Result 2",
  "Result 3",
  "Result 4",
] as const;

const STORAGE_KEY = "zyn-test-print-layout-v1";

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return fallback;
  const match = value.trim().match(/^-?\d+(\.\d+)?/);
  if (!match) return fallback;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeTestPrintBox(
  input: Partial<TestPrintBox> | Record<string, unknown> | undefined,
  fallback: TestPrintBox = DEFAULT_TEST_PRINT_BOX,
): TestPrintBox {
  return {
    width: parseNumber(input?.width, fallback.width),
    top: parseNumber(input?.top, fallback.top),
    left: parseNumber(input?.left, fallback.left),
  };
}

export function loadTestPrintBox(): TestPrintBox | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeTestPrintBox(JSON.parse(raw) as Partial<TestPrintBox>);
  } catch {
    return null;
  }
}

export function saveTestPrintBox(box: TestPrintBox): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(normalizeTestPrintBox(box)),
  );
}

export function clearTestPrintBox(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function waitForImage(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load print image"));
  });
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Print selected images as-is (no wrap), one page each. */
export function printTestImages(
  imageUrls: string[],
  layoutInput?: Partial<TestPrintBox>,
): Promise<void> {
  if (imageUrls.length === 0) {
    return Promise.reject(new Error("No images to print"));
  }

  const box = normalizeTestPrintBox(layoutInput);
  const width = escapeAttr(`${box.width}%`);
  const top = escapeAttr(`${box.top}px`);
  const left = escapeAttr(`${box.left}px`);

  const pages = imageUrls
    .map((url, index) => {
      const src = new URL(url, window.location.origin).href;
      return `
        <section class="page" aria-label="Result ${index + 1}">
          <img src="${escapeAttr(src)}" alt="Result ${index + 1}" />
        </section>
      `;
    })
    .join("\n");

  const srcdoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Test print</title>
    <style>
      @page {
        margin: 0;
        size: auto;
      }

      * {
        box-sizing: border-box;
      }

      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .page {
        position: relative;
        width: 100vw;
        height: 100vh;
        margin: 0;
        padding: 0;
        overflow: hidden;
        page-break-after: always;
        break-after: page;
      }

      .page:last-child {
        page-break-after: auto;
        break-after: auto;
      }

      .page img {
        position: absolute;
        top: ${top};
        left: ${left};
        width: ${width};
        height: auto;
        display: block;
        object-fit: contain;
      }
    </style>
  </head>
  <body>
    ${pages}
  </body>
</html>`;

  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.style.opacity = "0";
    frame.style.pointerEvents = "none";

    const cleanup = () => {
      frame.remove();
    };

    frame.onload = () => {
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!doc || !win) {
        cleanup();
        reject(new Error("Print frame unavailable"));
        return;
      }

      const images = Array.from(doc.querySelectorAll("img"));
      if (images.length < imageUrls.length) {
        cleanup();
        reject(new Error("Print images missing"));
        return;
      }

      Promise.all(images.map((img) => waitForImage(img)))
        .then(() => {
          try {
            win.focus();
            win.print();
            resolve();
          } catch (error) {
            reject(error instanceof Error ? error : new Error("Print failed"));
          } finally {
            window.setTimeout(cleanup, 1000);
          }
        })
        .catch((error) => {
          cleanup();
          reject(
            error instanceof Error ? error : new Error("Print load failed"),
          );
        });
    };

    frame.srcdoc = srcdoc;
    document.body.appendChild(frame);
  });
}
