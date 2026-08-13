import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM =
  process.env.POSTER_API_BASE_URL?.replace(/\/$/, "") ??
  "https://inner-chamber.tech";

export async function GET() {
  const token = process.env.POSTER_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "Access token not configured" },
      { status: 500 },
    );
  }

  try {
    const upstream = await fetch(`${UPSTREAM}/api/posters/latest`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "image/png, application/json",
      },
      cache: "no-store",
      // Hindari hang di mini PC kalau upstream lambat/mati.
      signal: AbortSignal.timeout(10_000),
    });

    if (upstream.status === 404) {
      return NextResponse.json(
        { error: "No poster available" },
        { status: 404 },
      );
    }

    if (upstream.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!upstream.ok) {
      let message = "Upstream error";
      try {
        const body = (await upstream.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // keep default message
      }
      return NextResponse.json(
        { error: message },
        { status: upstream.status },
      );
    }

    const bytes = await upstream.arrayBuffer();
    const contentType =
      upstream.headers.get("content-type") ?? "image/png";
    const disposition =
      upstream.headers.get("content-disposition") ??
      'inline; filename="poster.png"';

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach poster API";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
