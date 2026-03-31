import { NextResponse } from "next/server";
import { listReelCaches } from "../../../lib/reel-cache-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value) {
  return String(value || "").trim();
}

function toSafeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || 120);
    const entries = await listReelCaches(limit);

    const items = entries.map((entry) => {
      const metadata = entry?.metadata && typeof entry.metadata === "object" ? entry.metadata : {};
      return {
        reelId: cleanText(entry?.reelId),
        embedUrl: cleanText(entry?.embedUrl),
        summaryLine: cleanText(entry?.summaryLine),
        language: cleanText(entry?.language),
        updatedAt: cleanText(entry?.updatedAt),
        title: cleanText(metadata?.title),
        uploader: cleanText(metadata?.uploader),
        thumbnail: cleanText(metadata?.thumbnail),
        uploadDate: cleanText(metadata?.uploadDate),
        likeCount: toSafeNumber(metadata?.likeCount),
        commentCount: toSafeNumber(metadata?.commentCount),
        viewCount: toSafeNumber(metadata?.viewCount),
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "아카이브 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

