"use client";

import { useEffect, useState } from "react";
import { PrintLayoutFields } from "@/components/PrintLayoutFields";
import {
  clearTestPrintBox,
  DEFAULT_TEST_PRINT_BOX,
  loadTestPrintBox,
  normalizeTestPrintBox,
  printTestImages,
  saveTestPrintBox,
  TEST_RESULT_IMAGES,
  type TestPrintBox,
} from "@/lib/print-test";

export function TestPrintPage() {
  const [debugUi, setDebugUi] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Siap print 4 hasil");
  const [printBox, setPrintBox] = useState<TestPrintBox>(DEFAULT_TEST_PRINT_BOX);
  const [selected, setSelected] = useState<boolean[]>(() =>
    TEST_RESULT_IMAGES.map(() => true),
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        setDebugUi((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setPrintBox(loadTestPrintBox() ?? DEFAULT_TEST_PRINT_BOX);
  }, []);

  const updateBox = (next: TestPrintBox) => {
    const normalized = normalizeTestPrintBox(next);
    setPrintBox(normalized);
    saveTestPrintBox(normalized);
  };

  const resetBox = () => {
    clearTestPrintBox();
    setPrintBox(DEFAULT_TEST_PRINT_BOX);
  };

  const selectedUrls = TEST_RESULT_IMAGES.filter((_, i) => selected[i]);

  const runPrint = async () => {
    if (busy || selectedUrls.length === 0) return;
    setBusy(true);
    setMessage(`Mencetak ${selectedUrls.length} halaman…`);
    try {
      await printTestImages([...selectedUrls], printBox);
      setMessage(`${selectedUrls.length} halaman dikirim ke printer`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Print gagal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="test-print-shell" data-debug={debugUi ? "on" : "off"}>
      <button
        type="button"
        className="kiosk-hotzone"
        aria-label="Toggle config"
        title="Toggle config (Ctrl+C)"
        onClick={() => setDebugUi((v) => !v)}
      />

      {debugUi ? (
        <header className="kiosk-header">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold tracking-wide">
              Test Print · 4 hasil
            </div>
            <div className="truncate text-xs" style={{ color: "var(--muted)" }}>
              /print · logic terpisah dari kiosk · tanpa wrap
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void runPrint()}
              disabled={busy || selectedUrls.length === 0}
              className="rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              style={{
                background: "var(--accent)",
                color: "#111",
                border: "1px solid var(--accent)",
              }}
            >
              {busy ? "Printing…" : `Print ${selectedUrls.length} halaman`}
            </button>
          </div>
        </header>
      ) : null}

      <div className="test-print-body">
        <main className="test-print-grid">
          {TEST_RESULT_IMAGES.map((src, index) => {
            const on = selected[index];
            return (
              <button
                key={src}
                type="button"
                className="test-print-card"
                data-on={on ? "1" : "0"}
                onClick={() =>
                  setSelected((prev) => {
                    const next = [...prev];
                    next[index] = !next[index];
                    return next;
                  })
                }
              >
                <div className="test-print-thumb-plain">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Result ${index + 1}`} />
                </div>
                <div className="test-print-card-meta">
                  <span>#{index + 1}</span>
                  <span>{on ? "ON" : "OFF"}</span>
                </div>
              </button>
            );
          })}
        </main>

        {debugUi ? (
          <aside className="kiosk-aside">
            <div>
              <div
                className="mb-1 text-[11px] uppercase tracking-[0.14em]"
                style={{ color: "var(--muted)" }}
              >
                Status
              </div>
              <p className="text-sm leading-relaxed">{message}</p>
            </div>

            <div className="print-layout-panel">
              <div
                className="mb-2 text-[11px] uppercase tracking-[0.14em]"
                style={{ color: "var(--muted)" }}
              >
                Print layout (/print only)
              </div>

              <PrintLayoutFields
                label="Gambar (width % / top-left px)"
                value={printBox}
                onChange={updateBox}
              />

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void runPrint()}
                  disabled={busy || selectedUrls.length === 0}
                  className="rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  style={{
                    background: "var(--accent)",
                    color: "#111",
                    border: "1px solid var(--accent)",
                  }}
                >
                  Print selected
                </button>
                <button
                  type="button"
                  onClick={resetBox}
                  className="rounded px-3 py-1.5 text-xs font-medium"
                  style={{
                    background: "transparent",
                    color: "var(--text)",
                    border: "1px solid var(--line)",
                  }}
                >
                  Reset default
                </button>
              </div>

              <p
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                Config terpisah dari kiosk (localStorage sendiri). Gambar
                dicetak apa adanya, tanpa wrap.
              </p>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
