import { NextResponse } from "next/server";
import {
  DEFAULT_PRINT_LAYOUT,
  normalizePrintLayout,
} from "@/lib/print-layout";

export const dynamic = "force-dynamic";

export async function GET() {
  const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? "3000");
  const kioskUrl = process.env.KIOSK_URL ?? "https://inner-chamber.tech/";

  // Shared defaults (optional), then per-page overrides.
  const sharedWidth = process.env.PRINT_WIDTH;
  const sharedTop = process.env.PRINT_TOP;
  const sharedLeft = process.env.PRINT_LEFT;

  const printLayout = normalizePrintLayout(
    {
      cover: {
        width: process.env.PRINT_COVER_WIDTH ?? sharedWidth,
        top: process.env.PRINT_COVER_TOP ?? sharedTop,
        left: process.env.PRINT_COVER_LEFT ?? sharedLeft,
      },
      result: {
        width: process.env.PRINT_RESULT_WIDTH ?? sharedWidth,
        top: process.env.PRINT_RESULT_TOP ?? sharedTop,
        left: process.env.PRINT_RESULT_LEFT ?? sharedLeft,
      },
    },
    DEFAULT_PRINT_LAYOUT,
  );

  return NextResponse.json({
    kioskUrl,
    pollIntervalMs: Number.isFinite(pollIntervalMs)
      ? Math.max(1000, pollIntervalMs)
      : 3000,
    printLayout,
  });
}
