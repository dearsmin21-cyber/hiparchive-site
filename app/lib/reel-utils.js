import { createHash } from "node:crypto";

export function cleanText(value) {
  return String(value || "").trim();
}

export function normalizeSegments(segments) {
  if (!Array.isArray(segments)) return [];

  return segments
    .map((segment) => ({
      start: Number(segment?.start ?? 0),
      end: Number(segment?.end ?? 0),
      text: cleanText(segment?.text),
    }))
    .filter((segment) => segment.text.length > 0);
}

export function isEnglishLanguage(language) {
  const normalized = cleanText(language).toLowerCase();
  return normalized === "english" || normalized.startsWith("en");
}

export function buildTranscriptHash({ transcript, segments, language }) {
  const normalizedTranscript = cleanText(transcript).replace(/\s+/g, " ");
  const normalizedLanguage = cleanText(language).toLowerCase();
  const normalizedSegments = normalizeSegments(segments).map((segment) => ({
    start: Number(segment.start).toFixed(3),
    end: Number(segment.end).toFixed(3),
    text: segment.text,
  }));

  const payload = JSON.stringify({
    language: normalizedLanguage,
    transcript: normalizedTranscript,
    segments: normalizedSegments,
  });

  return createHash("sha1").update(payload).digest("hex");
}

export function firstTruthyString(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}
