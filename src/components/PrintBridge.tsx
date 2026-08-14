"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PrintLayoutFields } from "@/components/PrintLayoutFields";
import {
  clearPrintLayoutOverride,
  DEFAULT_PRINT_LAYOUT,
  loadPrintLayoutOverride,
  normalizePrintLayout,
  savePrintLayoutOverride,
  type PrintLayout,
} from "@/lib/print-layout";
import { printCoverAndPoster } from "@/lib/print-poster";

type PollStatus =
  | "idle"
  | "waiting"
  | "printing"
  | "printed"
  | "unauthorized"
  | "error";

type Config = {
  kioskUrl: string;
  pollIntervalMs: number;
  printLayout: PrintLayout;
};

export function PrintBridge() {
  const [config, setConfig] = useState<Config | null>(null);
  const [monitoring, setMonitoring] = useState(true);
  const [debugUi, setDebugUi] = useState(false);
  const [status, setStatus] = useState<PollStatus>("idle");
  const [message, setMessage] = useState("Loading…");
  const [lastPrintedAt, setLastPrintedAt] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [printCount, setPrintCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [printLayout, setPrintLayout] =
    useState<PrintLayout>(DEFAULT_PRINT_LAYOUT);

  const busyRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);
  const printLayoutRef = useRef(printLayout);

  useEffect(() => {
    printLayoutRef.current = printLayout;
  }, [printLayout]);

  const setBusyBoth = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  };

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
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        const data = (await res.json()) as Config;
        if (!cancelled) {
          const serverLayout = normalizePrintLayout(
            data.printLayout,
            DEFAULT_PRINT_LAYOUT,
          );
          const localOverride = loadPrintLayoutOverride();
          setConfig({ ...data, printLayout: serverLayout });
          setPrintLayout(localOverride ?? serverLayout);
          setStatus("waiting");
          setMessage("Menunggu poster dari halaman result…");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Gagal memuat konfigurasi");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const updateLayout = (next: PrintLayout) => {
    const normalized = normalizePrintLayout(next);
    setPrintLayout(normalized);
    savePrintLayoutOverride(normalized);
  };

  const resetLayout = () => {
    clearPrintLayoutOverride();
    const serverLayout = config?.printLayout ?? DEFAULT_PRINT_LAYOUT;
    setPrintLayout(serverLayout);
  };

  const consumeAndPrint = useCallback(async (res: Response) => {
    setStatus("printing");
    setMessage("Poster diterima — mencetak cover + hasil…");

    // Persist bytes locally first (consume-on-read: cannot re-fetch).
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);

    await printCoverAndPoster(objectUrl, printLayoutRef.current);

    const stamped = new Date().toLocaleTimeString();
    setLastPrintedAt(stamped);
    setPrintCount((n) => n + 1);
    setStatus("printed");
    setMessage(`2 halaman dicetak pukul ${stamped} (cover + hasil)`);
  }, []);

  /** Returns ms until next poll (supports soft backoff on errors). */
  const pollOnce = useCallback(async (baseIntervalMs: number): Promise<number> => {
    if (busyRef.current) return baseIntervalMs;

    setBusyBoth(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const res = await fetch("/api/posters/latest", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      if (res.status === 404) {
        setStatus((prev) => (prev === "printed" ? prev : "waiting"));
        setMessage((prev) =>
          prev.startsWith("Berhasil") || prev.startsWith("2 halaman")
            ? prev
            : "Belum ada poster. Tetap polling…",
        );
        return baseIntervalMs;
      }

      if (res.status === 401) {
        setMonitoring(false);
        setStatus("unauthorized");
        setMessage("Token tidak valid. Polling dihentikan.");
        return baseIntervalMs;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setStatus("error");
        setMessage(body?.error ?? `Error ${res.status}`);
        // Soft backoff — jangan hammer mini PC / upstream saat error.
        return Math.min(baseIntervalMs * 2, 15_000);
      }

      await consumeAndPrint(res);
      return baseIntervalMs;
    } catch (error) {
      const aborted =
        error instanceof DOMException && error.name === "AbortError";
      setStatus("error");
      setMessage(
        aborted
          ? "Timeout polling (12s) — retry dengan jeda"
          : error instanceof Error
            ? error.message
            : "Gagal menghubungi poster API",
      );
      return Math.min(baseIntervalMs * 2, 15_000);
    } finally {
      window.clearTimeout(timeoutId);
      setBusyBoth(false);
    }
  }, [consumeAndPrint]);

  useEffect(() => {
    if (!monitoring || !config) return;

    let cancelled = false;
    let timerId = 0;
    const baseIntervalMs = config.pollIntervalMs;

    const loop = async () => {
      if (cancelled) return;
      // Satu request selesai dulu baru jadwal berikutnya — anti overlap/crash.
      const nextMs = await pollOnce(baseIntervalMs);
      if (cancelled) return;
      timerId = window.setTimeout(() => {
        void loop();
      }, nextMs);
    };

    void loop();

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [monitoring, config, pollOnce]);

  const statusColor =
    status === "printed" || status === "waiting"
      ? "var(--ok)"
      : status === "printing"
        ? "var(--accent)"
        : status === "unauthorized" || status === "error"
          ? "var(--err)"
          : "var(--muted)";

  const testPrint = async () => {
    if (busyRef.current) return;
    const src = previewUrl ?? "/cover-fix.png";
    setBusyBoth(true);
    setStatus("printing");
    setMessage("Test print layout…");
    try {
      await printCoverAndPoster(src, printLayout);
      setStatus("printed");
      setMessage("Test print dikirim (cover + sample/hasil)");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Test print gagal",
      );
    } finally {
      setBusyBoth(false);
    }
  };

  return (
    <div className="kiosk-shell" data-debug={debugUi ? "on" : "off"}>
      <button
        type="button"
        className="kiosk-hotzone"
        aria-label="Toggle debug UI"
        title="Toggle debug (Ctrl+C)"
        onClick={() => setDebugUi((v) => !v)}
      />

      {debugUi ? (
        <header className="kiosk-header">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold tracking-wide">
              ZYN Inner Chamber Print
            </div>
            <div className="truncate text-xs" style={{ color: "var(--muted)" }}>
              Debug UI · Ctrl+C hide · print width/top/left configurable
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded px-2 py-1 text-xs"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: statusColor,
                border: `1px solid ${statusColor}`,
              }}
            >
              {monitoring ? "MONITOR ON" : "MONITOR OFF"} ·{" "}
              {status.toUpperCase()}
            </span>

            <button
              type="button"
              onClick={() => setMonitoring((v) => !v)}
              className="rounded px-3 py-1.5 text-xs font-medium"
              style={{
                background: monitoring ? "transparent" : "var(--accent)",
                color: monitoring ? "var(--text)" : "#111",
                border: "1px solid var(--line)",
              }}
            >
              {monitoring ? "Pause" : "Resume"}
            </button>

            <button
              type="button"
              onClick={() => void pollOnce(config?.pollIntervalMs ?? 3000)}
              disabled={busy}
              className="rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                color: "var(--text)",
              }}
            >
              Cek sekarang
            </button>
          </div>
        </header>
      ) : null}

      <div className="kiosk-body">
        <main className="kiosk-stage">
          {config ? (
            <iframe
              title="Inner Chamber"
              src={config.kioskUrl}
              className="kiosk-frame"
              allow="fullscreen"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div
              className="flex h-full items-center justify-center text-sm"
              style={{ color: "var(--muted)" }}
            >
              Memuat kiosk…
            </div>
          )}
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

            <dl
              className="grid gap-2 text-xs"
              style={{ color: "var(--muted)" }}
            >
              <div className="flex justify-between gap-3">
                <dt>Interval</dt>
                <dd style={{ color: "var(--text)" }}>
                  {config ? `${config.pollIntervalMs} ms` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Total cetak</dt>
                <dd style={{ color: "var(--text)" }}>{printCount}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Terakhir</dt>
                <dd style={{ color: "var(--text)" }}>
                  {lastPrintedAt ?? "—"}
                </dd>
              </div>
            </dl>

            <div className="print-layout-panel">
              <div
                className="mb-2 text-[11px] uppercase tracking-[0.14em]"
                style={{ color: "var(--muted)" }}
              >
                Print layout
              </div>

              <PrintLayoutFields
                label="Cover"
                value={printLayout.cover}
                onChange={(cover) => updateLayout({ ...printLayout, cover })}
              />
              <PrintLayoutFields
                label="Hasil API"
                value={printLayout.result}
                onChange={(result) => updateLayout({ ...printLayout, result })}
              />

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void testPrint()}
                  disabled={busy}
                  className="rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  style={{
                    background: "var(--accent)",
                    color: "#111",
                    border: "1px solid var(--accent)",
                  }}
                >
                  Test print
                </button>
                <button
                  type="button"
                  onClick={resetLayout}
                  className="rounded px-3 py-1.5 text-xs font-medium"
                  style={{
                    background: "transparent",
                    color: "var(--text)",
                    border: "1px solid var(--line)",
                  }}
                >
                  Reset ke .env
                </button>
              </div>

              <p
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                Satuan fix: width <code>%</code>, top/left <code>px</code>.
                Contoh width <code>90</code>, top <code>20</code>, left{" "}
                <code>10</code>.
              </p>
            </div>

            <div className="min-h-0 flex-1">
              <div
                className="mb-2 text-[11px] uppercase tracking-[0.14em]"
                style={{ color: "var(--muted)" }}
              >
                Print preview (2 halaman)
              </div>
              <div className="kiosk-preview-stack">
                <div className="kiosk-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/cover-fix.png"
                    alt="Cover"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="kiosk-preview">
                  <div className="result-preview-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/cover-result.png"
                      alt=""
                      className="result-preview-frame"
                    />
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Poster terakhir"
                        className="result-preview-poster"
                      />
                    ) : (
                      <span
                        className="result-preview-empty text-xs"
                        style={{ color: "var(--muted)" }}
                      >
                        Hasil API — belum ada
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      <div id="print-root" aria-hidden className="hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cover-fix.png" alt="" />
        <div className="result-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cover-result.png" alt="" />
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
