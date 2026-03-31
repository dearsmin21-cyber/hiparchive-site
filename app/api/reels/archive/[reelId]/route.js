import { NextResponse } from "next/server";
import { getReelCache } from "../../../../lib/reel-cache-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeSegments(segments) {
  if (!Array.isArray(segments)) return [];
  return segments
    .map((segment) => ({
      start: Number(segment?.start ?? 0),
      end: Number(segment?.end ?? segment?.start ?? 0),
      text: cleanText(segment?.text),
    }))
    .filter((segment) => segment.text.length > 0);
}

function normalizeMetadata(metadata, sceneCaptures) {
  const safe = metadata && typeof metadata === "object" ? metadata : {};
  const scenesFromMeta = Array.isArray(safe.sceneCaptures) ? safe.sceneCaptures : [];
  const mergedScenes = Array.isArray(sceneCaptures) && sceneCaptures.length > 0 ? sceneCaptures : scenesFromMeta;

  return {
    title: cleanText(safe.title),
    uploader: cleanText(safe.uploader),
    likeCount: Number.isFinite(Number(safe.likeCount)) ? Number(safe.likeCount) : null,
    commentCount: Number.isFinite(Number(safe.commentCount)) ? Number(safe.commentCount) : null,
    viewCount: Number.isFinite(Number(safe.viewCount)) ? Number(safe.viewCount) : null,
    duration: Number.isFinite(Number(safe.duration)) ? Number(safe.duration) : null,
    uploadDate: cleanText(safe.uploadDate),
    thumbnail: cleanText(safe.thumbnail),
    videoUrl: cleanText(safe.videoUrl),
    backgroundAudio:
      safe.backgroundAudio && typeof safe.backgroundAudio === "object"
        ? {
            title: cleanText(safe.backgroundAudio?.title),
            artist: cleanText(safe.backgroundAudio?.artist),
            label: cleanText(safe.backgroundAudio?.label),
          }
        : null,
    sceneCaptures: Array.isArray(mergedScenes)
      ? mergedScenes
          .map((scene) => ({
            start: Number(scene?.start ?? 0),
            imageUrl: cleanText(scene?.imageUrl),
            roll: cleanText(scene?.roll),
            confidence: Number.isFinite(Number(scene?.confidence)) ? Number(scene.confidence) : null,
            source: cleanText(scene?.source),
          }))
          .filter((scene) => scene.imageUrl.length > 0)
      : [],
  };
}

export async function GET(_request, { params }) {
  try {
    const reelId = cleanText(params?.reelId);
    if (!reelId) {
      return NextResponse.json({ error: "잘못된 아카이브 ID입니다." }, { status: 400 });
    }

    const entry = await getReelCache(reelId);
    if (!entry) {
      return NextResponse.json({ error: "아카이브 항목을 찾지 못했습니다." }, { status: 404 });
    }

    const payload = {
      reelId,
      embedUrl: cleanText(entry?.embedUrl) || `https://www.instagram.com/reel/${reelId}/embed`,
      transcriptHash: cleanText(entry?.transcriptHash),
      summaryLine: cleanText(entry?.summaryLine),
      transcript: cleanText(entry?.transcript),
      language: cleanText(entry?.language),
      segments: normalizeSegments(entry?.segments),
      metadata: normalizeMetadata(entry?.metadata, entry?.sceneCaptures),
      translation: cleanText(entry?.translation),
      translationSegments: normalizeSegments(entry?.translationSegments),
      reviewSummary:
        entry?.reviewSummary && typeof entry.reviewSummary === "object"
          ? entry.reviewSummary
          : { correctedCount: 0, notes: [] },
      refinedTranslation: cleanText(entry?.refinedTranslation),
      refinedTranslationSegments: normalizeSegments(entry?.refinedTranslationSegments),
      refinedModelUsed: cleanText(entry?.refinedModelUsed),
      archivedAt: cleanText(entry?.updatedAt),
    };

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "아카이브 데이터를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

