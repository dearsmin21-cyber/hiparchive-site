import { cleanText, isEnglishLanguage, normalizeSegments } from "./reel-utils";

function resolveDeepLApiUrl(deeplApiKey, deeplApiUrlFromEnv) {
  if (deeplApiUrlFromEnv) return deeplApiUrlFromEnv;
  if (String(deeplApiKey).trim().endsWith(":fx")) {
    return "https://api-free.deepl.com/v2/translate";
  }
  return "https://api.deepl.com/v2/translate";
}

function chunkArray(items, chunkSize) {
  const result = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    result.push(items.slice(index, index + chunkSize));
  }
  return result;
}

async function translateWithDeepL({ texts, context, deeplApiKey, deeplApiUrl }) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const allTranslations = [];
  const chunks = chunkArray(texts, 40);
  const requestHeaders = {
    Authorization: `DeepL-Auth-Key ${deeplApiKey}`,
    "Content-Type": "application/json",
  };

  for (const chunk of chunks) {
    const advancedBody = {
      text: chunk,
      source_lang: "EN",
      target_lang: "KO",
      context,
      model_type: "prefer_quality_optimized",
      preserve_formatting: true,
      custom_instructions: [
        "Preserve meaning and intent exactly. Do not omit or add information.",
        "Keep proper nouns, slang, and product names consistent and natural in Korean.",
        "Keep subtitle style concise and easy to read.",
      ],
    };

    let response = await fetch(deeplApiUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(advancedBody),
    });
    let payload = await response.json();

    if (!response.ok) {
      const basicBody = {
        text: chunk,
        source_lang: "EN",
        target_lang: "KO",
        context,
      };
      response = await fetch(deeplApiUrl, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(basicBody),
      });
      payload = await response.json();
    }

    if (!response.ok) {
      const message = payload?.message || payload?.detail || "DeepL 번역 API 요청이 실패했습니다.";
      throw new Error(message);
    }

    const translations = Array.isArray(payload?.translations) ? payload.translations : [];
    allTranslations.push(...translations.map((entry) => cleanText(entry?.text)));
  }

  return allTranslations;
}

function normalizeReviewerItems(rawItems, fallbackCount) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item) => ({
      index: Number(item?.index),
      ok: Boolean(item?.ok),
      corrected: cleanText(item?.corrected),
      reason: cleanText(item?.reason),
    }))
    .filter((item) => Number.isInteger(item.index) && item.index >= 0 && item.index < fallbackCount);
}

async function reviewTranslationsWithOpenAI({ sourceSegments, translatedTexts, openaiApiKey }) {
  if (!openaiApiKey || sourceSegments.length === 0 || translatedTexts.length === 0) {
    return {
      reviewedTexts: translatedTexts,
      reviewSummary: { correctedCount: 0, notes: [] },
    };
  }

  const entries = sourceSegments.map((segment, index) => ({
    index,
    en: segment.text,
    ko: cleanText(translatedTexts[index]),
  }));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a strict subtitle QA reviewer. Check fidelity from English to Korean. Return JSON only: {\"items\":[{\"index\":0,\"ok\":true,\"corrected\":\"\",\"reason\":\"\"}]}. If not ok, corrected must be faithful Korean subtitle without omissions and without adding meaning.",
        },
        {
          role: "user",
          content: JSON.stringify({ items: entries }),
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    return {
      reviewedTexts: translatedTexts,
      reviewSummary: { correctedCount: 0, notes: ["검수 모델 호출 실패로 원번역 사용"] },
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(payload?.choices?.[0]?.message?.content || "{}");
  } catch {
    return {
      reviewedTexts: translatedTexts,
      reviewSummary: { correctedCount: 0, notes: ["검수 응답 파싱 실패로 원번역 사용"] },
    };
  }

  const reviewedTexts = [...translatedTexts];
  const reviewItems = normalizeReviewerItems(parsed?.items, translatedTexts.length);
  let correctedCount = 0;
  const notes = [];

  for (const item of reviewItems) {
    if (!item.ok && item.corrected) {
      reviewedTexts[item.index] = item.corrected;
      correctedCount += 1;
    }
    if (!item.ok && item.reason) {
      notes.push(`#${item.index + 1}: ${item.reason}`);
    }
  }

  return {
    reviewedTexts,
    reviewSummary: { correctedCount, notes: notes.slice(0, 5) },
  };
}

export async function translateEnglishTranscript({ transcript, language, segments, deeplApiKey, deeplApiUrl, openaiApiKey }) {
  const safeTranscript = cleanText(transcript);
  const safeLanguage = cleanText(language);
  const safeSegments = normalizeSegments(segments);

  if (!safeTranscript && safeSegments.length === 0) {
    throw new Error("번역할 전사 데이터가 없습니다.");
  }

  if (!isEnglishLanguage(safeLanguage)) {
    return {
      translation: "",
      translationSegments: [],
      reviewSummary: { correctedCount: 0, notes: [] },
      translated: false,
    };
  }

  if (!deeplApiKey) {
    throw new Error("서버에 DEEPL_API_KEY가 설정되어 있지 않습니다.");
  }

  const resolvedApiUrl = resolveDeepLApiUrl(deeplApiKey, deeplApiUrl);
  const context = safeTranscript.slice(0, 3500);

  if (safeSegments.length > 0) {
    const sourceTexts = safeSegments.map((segment) => segment.text);
    const deepLTexts = await translateWithDeepL({
      texts: sourceTexts,
      context,
      deeplApiKey,
      deeplApiUrl: resolvedApiUrl,
    });

    const { reviewedTexts, reviewSummary } = await reviewTranslationsWithOpenAI({
      sourceSegments: safeSegments,
      translatedTexts: deepLTexts,
      openaiApiKey,
    });

    const translationSegments = safeSegments.map((segment, index) => ({
      start: segment.start,
      end: segment.end,
      text: cleanText(reviewedTexts[index] ?? deepLTexts[index]),
    }));

    return {
      translation: translationSegments.map((segment) => segment.text).join("\n"),
      translationSegments,
      reviewSummary,
      translated: true,
    };
  }

  const translatedTexts = await translateWithDeepL({
    texts: [safeTranscript],
    context,
    deeplApiKey,
    deeplApiUrl: resolvedApiUrl,
  });

  return {
    translation: cleanText(translatedTexts[0]),
    translationSegments: [],
    reviewSummary: { correctedCount: 0, notes: [] },
    translated: true,
  };
}
