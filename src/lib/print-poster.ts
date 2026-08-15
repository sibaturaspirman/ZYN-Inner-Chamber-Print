import type { PrintLayout } from "@/lib/print-layout";
import {
  DEFAULT_PRINT_LAYOUT,
  normalizePrintLayout,
} from "@/lib/print-layout";

const COVER_URL = "/cover-fix.png";
const RESULT_WRAP_URL = "/cover-result.png";

/** Portrait 645×990 → landscape strip after -90° is 990×645 */
const STRIP_H_OVER_W = 645 / 990;

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

/**
 * Convert layout length to CSS that is reliable in print:
 * - bare number / px → px
 * - % → vw (print % of page width is unstable with nested %)
 */
function toPrintLength(value: number, kind: "width" | "offset"): string {
  if (kind === "width") {
    return `${value}vw`;
  }
  return `${value}px`;
}

/**
 * Kiosk print — 1 page:
 * Cover & result di atas, dempetan, rotate -90°.
 * top/left/width dari config (width = % halaman → vw).
 */
export function printCoverAndPoster(
  posterObjectUrl: string,
  layoutInput?: Partial<PrintLayout>,
): Promise<void> {
  const layout = normalizePrintLayout(layoutInput, DEFAULT_PRINT_LAYOUT);

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
      if (images.length < 3) {
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

    const coverSrc = new URL(COVER_URL, window.location.origin).href;
    const wrapSrc = new URL(RESULT_WRAP_URL, window.location.origin).href;

    const coverW = toPrintLength(layout.cover.width, "width");
    const coverTop = toPrintLength(layout.cover.top, "offset");
    const coverLeft = toPrintLength(layout.cover.left, "offset");
    const resultW = toPrintLength(layout.result.width, "width");
    const resultTop = toPrintLength(layout.result.top, "offset");
    const resultLeft = toPrintLength(layout.result.left, "offset");

    // Strip height from width (vw → vw), avoids aspect-ratio print bugs.
    const coverH = `${layout.cover.width * STRIP_H_OVER_W}vw`;
    const resultH = `${layout.result.width * STRIP_H_OVER_W}vw`;

    frame.srcdoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Print cover + poster (1 page)</title>
    <style>
      @page { margin: 0; }

      * { box-sizing: border-box; }

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
        overflow: hidden;
      }

      .stack {
        position: absolute;
        top: ${escapeAttr(coverTop)};
        left: ${escapeAttr(coverLeft)};
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0;
        line-height: 0;
      }

      .panel {
        position: relative;
        overflow: hidden;
        flex-shrink: 0;
        line-height: 0;
      }

      .panel-cover {
        width: ${escapeAttr(coverW)};
        height: ${escapeAttr(coverH)};
      }

      .panel-result {
        width: ${escapeAttr(resultW)};
        height: ${escapeAttr(resultH)};
        margin-top: ${escapeAttr(resultTop)};
        margin-left: ${escapeAttr(resultLeft)};
      }

      /*
       * Rotate -90° filler:
       * box size swaps so portrait art fills the landscape strip.
       */
      .rot {
        position: absolute;
        left: 50%;
        top: 50%;
        width: ${escapeAttr(coverH)};
        height: ${escapeAttr(coverW)};
        transform: translate(-50%, -50%) rotate(-90deg);
        overflow: hidden;
      }

      .panel-result .rot {
        width: ${escapeAttr(resultH)};
        height: ${escapeAttr(resultW)};
      }

      .rot .cover-img,
      .rot .result-frame,
      .rot .result-poster {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
        margin: 0;
      }

      .rot .cover-img {
        object-fit: contain;
        object-position: center;
      }

      .rot .result-frame {
        object-fit: fill;
        z-index: 0;
      }

      .rot .result-poster {
        object-fit: contain;
        object-position: center;
        z-index: 1;
      }
    </style>
  </head>
  <body>
    <section class="page" aria-label="Cover and poster">
      <div class="stack">
        <div class="panel panel-cover">
          <div class="rot">
            <img class="cover-img" src="${coverSrc}" alt="Cover" />
          </div>
        </div>
        <div class="panel panel-result">
          <div class="rot">
            <img class="result-frame" src="${wrapSrc}" alt="" />
            <img class="result-poster" src="${escapeAttr(posterObjectUrl)}" alt="Poster" />
          </div>
        </div>
      </div>
    </section>
  </body>
</html>`;

    document.body.appendChild(frame);
  });
}
