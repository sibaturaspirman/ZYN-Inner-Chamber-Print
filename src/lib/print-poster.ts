import type { PrintLayout } from "@/lib/print-layout";
import {
  DEFAULT_PRINT_LAYOUT,
  normalizePrintLayout,
  toPrintLayoutCss,
} from "@/lib/print-layout";

const COVER_URL = "/cover-fix.png";
const RESULT_WRAP_URL = "/cover-result.png";
/** Target print aspect from cover-result.png */
const RESULT_ASPECT = "645 / 990";

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
 * Kiosk print only — 2 pages:
 * 1) cover (`/cover-fix.png`)
 * 2) API poster wrapped in `/cover-result.png`
 */
export function printCoverAndPoster(
  posterObjectUrl: string,
  layoutInput?: Partial<PrintLayout>,
): Promise<void> {
  const layout = toPrintLayoutCss(
    normalizePrintLayout(layoutInput, DEFAULT_PRINT_LAYOUT),
  );

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
    const coverWidth = escapeAttr(layout.cover.width);
    const coverTop = escapeAttr(layout.cover.top);
    const coverLeft = escapeAttr(layout.cover.left);
    const resultWidth = escapeAttr(layout.result.width);
    const resultTop = escapeAttr(layout.result.top);
    const resultLeft = escapeAttr(layout.result.left);

    frame.srcdoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Print cover + poster</title>
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

      .page-cover > img {
        position: absolute;
        top: ${coverTop};
        left: ${coverLeft};
        width: ${coverWidth};
        height: auto;
        display: block;
        object-fit: contain;
      }

      .result-wrap {
        position: absolute;
        top: ${resultTop};
        left: ${resultLeft};
        width: ${resultWidth};
        aspect-ratio: ${RESULT_ASPECT};
        overflow: hidden;
      }

      .result-wrap .result-frame,
      .result-wrap .result-poster {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
        margin: 0;
      }

      .result-wrap .result-frame {
        object-fit: fill;
        z-index: 0;
      }

      .result-wrap .result-poster {
        object-fit: contain;
        object-position: center;
        z-index: 1;
      }
    </style>
  </head>
  <body>
    <section class="page page-cover" aria-label="Cover">
      <img src="${coverSrc}" alt="Cover" />
    </section>
    <section class="page page-result" aria-label="Poster">
      <div class="result-wrap">
        <img class="result-frame" src="${wrapSrc}" alt="" />
        <img class="result-poster" src="${escapeAttr(posterObjectUrl)}" alt="Poster" />
      </div>
    </section>
  </body>
</html>`;

    document.body.appendChild(frame);
  });
}
