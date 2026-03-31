import { NextResponse } from "next/server";
import { upsertReelCache } from "../../../lib/reel-cache-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchJsonWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const payload = await response.json();
    return { response, payload };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function toCleanText(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value && typeof value === "object") {
    const candidates = [value.text, value.content, value.ko, value.refined, value.value];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return "";
  }
  return "";
}

function normalizeSegments(segments) {
  if (!Array.isArray(segments)) return [];
  return segments
    .map((segment) => ({
      start: Number(segment?.start ?? 0),
      end: Number(segment?.end ?? 0),
      text: toCleanText(segment?.text),
    }))
    .filter((segment) => segment.text.length > 0);
}

function normalizeTextArray(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => toCleanText(item));
}

function buildBaseKoreanLines(englishSegments, koreanSegments, fallbackTranslation) {
  const fallbackLines = toCleanText(fallbackTranslation)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return englishSegments.map(
    (_, index) => toCleanText(koreanSegments[index]) || toCleanText(fallbackLines[index]) || ""
  );
}

function chunkLines(englishSegments, baseKoreanLines, chunkSize = 28) {
  const chunks = [];
  for (let start = 0; start < englishSegments.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, englishSegments.length);
    chunks.push({
      start,
      english: englishSegments.slice(start, end),
      korean: baseKoreanLines.slice(start, end),
    });
  }
  return chunks;
}

function buildRefinePrompt(chunkEnglish, chunkKorean) {
  return JSON.stringify({
    items: chunkEnglish.map((segment, index) => ({
      index,
      en: segment.text,
      ko: toCleanText(chunkKorean[index]),
    })),
    output_schema: {
      items: [{ index: 0, refined: "..." }],
    },
  });
}

function extractIndexedRefined(parsed) {
  const indexed = new Map();
  if (!parsed || typeof parsed !== "object") return indexed;

  if (Array.isArray(parsed.items)) {
    parsed.items.forEach((item, position) => {
      if (typeof item === "string") {
        const text = toCleanText(item);
        if (text) indexed.set(position, text);
        return;
      }
      const rawIndex = Number(item?.index ?? item?.idx ?? item?.i ?? position);
      if (!Number.isInteger(rawIndex) || rawIndex < 0) return;
      const text = toCleanText(item?.refined ?? item?.ko ?? item?.text ?? item?.value);
      if (text) indexed.set(rawIndex, text);
    });
  }

  const arrayFallback = Array.isArray(parsed.refined)
    ? parsed.refined
    : Array.isArray(parsed.lines)
      ? parsed.lines
      : [];
  arrayFallback.forEach((value, index) => {
    if (indexed.has(index)) return;
    const text = toCleanText(value);
    if (text) indexed.set(index, text);
  });

  const stringFallback =
    typeof parsed.refined_text === "string"
      ? parsed.refined_text
      : typeof parsed.refinedText === "string"
        ? parsed.refinedText
        : "";
  if (stringFallback) {
    stringFallback
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line, index) => {
        if (indexed.has(index)) return;
        indexed.set(index, line);
      });
  }

  return indexed;
}

function parseRefinedLines(parsed, englishLines, fallbackLines) {
  const indexedRefined = extractIndexedRefined(parsed);
  return Array.from({ length: englishLines.length }, (_, index) => {
    const candidate = toCleanText(indexedRefined.get(index));
    if (candidate) return candidate;
    return toCleanText(fallbackLines[index]);
  });
}

function shouldUseNullObjectLine(englishLine, previousEnglishLine) {
  const current = toCleanText(englishLine);
  if (!current) return false;

  if (/^followers\.?$/i.test(current)) return true;

  const normalizedCurrent = current.replace(/[’]/g, "'");
  const currentTokens = normalizedCurrent
    .replace(/[^a-zA-Z0-9'\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (currentTokens.length === 0) return false;

  const prev = toCleanText(previousEnglishLine);
  const prevEndsSentence = /[.!?]["')\]]*$/.test(prev);
  const startsLower = /^[a-z]/.test(normalizedCurrent);
  const startsConnector =
    /^(and|or|but|so|because|that|which|who|when|where|if|then|to)\b/i.test(normalizedCurrent);

  if (currentTokens.length === 1 && prev && !prevEndsSentence) return true;
  if (currentTokens.length <= 2 && !prevEndsSentence && (startsLower || startsConnector)) return true;

  return false;
}

function sanitizeRefinedLines(refinedLines, baseLines, englishLines) {
  const safeLines = [];
  let correctedCount = 0;

  for (let index = 0; index < refinedLines.length; index += 1) {
    const refined = toCleanText(refinedLines[index]);
    const base = toCleanText(baseLines[index]);
    const english = toCleanText(englishLines[index]);
    const prevEnglish = toCleanText(englishLines[index - 1]);

    if (shouldUseNullObjectLine(english, prevEnglish)) {
      safeLines.push("Null Object");
      continue;
    }

    if (/^null object$/i.test(refined)) {
      safeLines.push("Null Object");
      continue;
    }

    if (!refined || refined === "[object Object]") {
      safeLines.push(base);
      correctedCount += 1;
      continue;
    }

    safeLines.push(refined);
  }

  return { safeLines, correctedCount };
}

async function requestRefine({ model, apiKey, prompt }) {
  const { response, payload } = await fetchJsonWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
        {
          role: "system",
          content:
              "You are a Korean subtitle writer for Instagram Reels. Rewrite Korean subtitle lines to be natural, colloquial, and easy to read. Keep meaning faithful to the English source. Minor paraphrasing is allowed, but do not change facts, numbers, names, or intent. Return JSON only. Use schema: {\"items\":[{\"index\":0,\"refined\":\"...\"}]}. Preserve every index without shifting or merging lines. If a line is a dangling fragment that should not be translated independently, set refined to exactly \"Null Object\".",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    },
    120000
  );

  if (!response.ok) {
    const message = payload?.error?.message || "문장 다듬기 요청이 실패했습니다.";
    throw new Error(message);
  }

  return JSON.parse(payload?.choices?.[0]?.message?.content || "{}");
}

async function refineChunkWithFallback({ apiKey, prompt }) {
  const models = ["gpt-5", "gpt-5-mini", "gpt-4o-mini"];
  let lastError;

  for (const model of models) {
    try {
      const parsed = await requestRefine({ model, apiKey, prompt });
      return { parsed, modelUsed: model };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("문장 다듬기 모델 호출에 실패했습니다.");
}

function buildSegmentsWithText(baseSegments, texts) {
  return baseSegments.map((segment, index) => ({
    start: segment.start,
    end: segment.end,
    text: toCleanText(texts[index]),
  }));
}

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 OPENAI_API_KEY가 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const reelId = toCleanText(body?.reelId);
    const transcriptHash = toCleanText(body?.transcriptHash);
    const englishSegments = normalizeSegments(body?.segments);
    const koreanSegments = normalizeTextArray(body?.translationSegments);
    const fallbackTranslation = toCleanText(body?.translation);
    const baseKoreanLines = buildBaseKoreanLines(englishSegments, koreanSegments, fallbackTranslation);

    if (englishSegments.length === 0) {
      return NextResponse.json({ error: "원문 세그먼트가 없습니다." }, { status: 400 });
    }
    if (baseKoreanLines.every((line) => !line)) {
      return NextResponse.json({ error: "기존 한국어 번역이 없습니다." }, { status: 400 });
    }

    const chunks = chunkLines(englishSegments, baseKoreanLines);
    const modelUsedSet = new Set();
    const refinedAllLines = [];
    let totalCorrectedCount = 0;

    for (const chunk of chunks) {
      const prompt = buildRefinePrompt(chunk.english, chunk.korean);
      const { parsed, modelUsed } = await refineChunkWithFallback({
        apiKey,
        prompt,
      });
      modelUsedSet.add(modelUsed);

      const chunkEnglishLines = chunk.english.map((segment) => segment.text);
      const refinedChunk = parseRefinedLines(parsed, chunkEnglishLines, chunk.korean);
      const { safeLines, correctedCount } = sanitizeRefinedLines(
        refinedChunk,
        chunk.korean,
        chunkEnglishLines
      );
      totalCorrectedCount += correctedCount;
      refinedAllLines.push(...safeLines);
    }

    const refinedSegments = buildSegmentsWithText(englishSegments, refinedAllLines);
    const refinedTranslation = refinedAllLines.join("\n");
    const modelUsed = Array.from(modelUsedSet).join(" -> ");

    if (reelId) {
      await upsertReelCache(reelId, {
        ...(transcriptHash ? { transcriptHash } : {}),
        refinedTranslation,
        refinedTranslationSegments: refinedSegments,
        refinedModelUsed: modelUsed,
      });
    }

    return NextResponse.json({
      refinedSegments,
      refinedTranslation,
      modelUsed,
      refineReview: {
        correctedCount: totalCorrectedCount,
        notes: [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "문장 다듬기 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
