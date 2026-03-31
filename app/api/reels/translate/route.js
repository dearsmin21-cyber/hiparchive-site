import { NextResponse } from "next/server";
import { getReelCache, upsertReelCache } from "../../../lib/reel-cache-db";
import { buildTranscriptHash, cleanText, normalizeSegments } from "../../../lib/reel-utils";
import { translateEnglishTranscript } from "../../../lib/translation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeCachedTranslation(entry) {
  const translationSegments = Array.isArray(entry?.translationSegments)
    ? entry.translationSegments
        .map((segment) => ({
          start: Number(segment?.start ?? 0),
          end: Number(segment?.end ?? 0),
          text: cleanText(segment?.text),
        }))
        .filter((segment) => segment.text.length > 0)
    : [];

  return {
    translation: cleanText(entry?.translation),
    translationSegments,
    reviewSummary:
      entry?.reviewSummary && typeof entry.reviewSummary === "object"
        ? entry.reviewSummary
        : { correctedCount: 0, notes: [] },
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const transcript = cleanText(body?.transcript);
    const language = cleanText(body?.language);
    const segments = normalizeSegments(body?.segments);
    const reelId = cleanText(body?.reelId);

    const transcriptHash = buildTranscriptHash({ transcript, segments, language });

    if (reelId) {
      const cached = await getReelCache(reelId);
      if (cached?.transcriptHash === transcriptHash && (cached?.translation || cached?.translationSegments?.length)) {
        const cachedPayload = sanitizeCachedTranslation(cached);
        return NextResponse.json({
          ...cachedPayload,
          cached: true,
        });
      }
    }

    const translationResult = await translateEnglishTranscript({
      transcript,
      language,
      segments,
      deeplApiKey: process.env.DEEPL_API_KEY,
      deeplApiUrl: process.env.DEEPL_API_URL,
      openaiApiKey: process.env.OPENAI_API_KEY,
    });

    if (reelId && translationResult.translated) {
      await upsertReelCache(reelId, {
        transcriptHash,
        language,
        translation: translationResult.translation,
        translationSegments: translationResult.translationSegments,
        reviewSummary: translationResult.reviewSummary,
      });
    }

    return NextResponse.json({
      translation: translationResult.translation,
      translationSegments: translationResult.translationSegments,
      reviewSummary: translationResult.reviewSummary,
      cached: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "한국어 번역 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
