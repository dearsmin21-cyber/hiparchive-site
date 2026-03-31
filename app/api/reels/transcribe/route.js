import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getReelCache, upsertReelCache } from "../../../lib/reel-cache-db";
import { buildTranscriptHash, cleanText, isEnglishLanguage } from "../../../lib/reel-utils";
import { translateEnglishTranscript } from "../../../lib/translation-service";

const execFileAsync = promisify(execFile);
const REEL_PATTERN =
  /^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i;
const PREVIEW_CACHE_DIR = path.join(os.tmpdir(), "reel-preview-cache");
const PREVIEW_CACHE_TTL_MS = 1000 * 60 * 60 * 8;
const MAX_SCENE_CAPTURES = 16;
const SCENE_DETECT_THRESHOLD = 0.34;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseReelUrl(url) {
  const match = url?.trim()?.match(REEL_PATTERN);
  if (!match) return null;

  const reelId = match[1];
  return {
    reelId,
    embedUrl: `https://www.instagram.com/reel/${reelId}/embed`,
  };
}

async function findAudioFile(directoryPath) {
  const files = await fs.readdir(directoryPath);
  const audioExtensions = [".mp3", ".m4a", ".wav", ".webm", ".ogg", ".aac"];
  const audioFile = files.find((fileName) =>
    audioExtensions.includes(path.extname(fileName).toLowerCase())
  );

  if (!audioFile) {
    throw new Error("오디오 파일을 찾지 못했습니다. yt-dlp 다운로드가 실패했을 수 있습니다.");
  }

  return path.join(directoryPath, audioFile);
}

async function findVideoFile(directoryPath) {
  const files = await fs.readdir(directoryPath);
  const videoExtensions = [".mp4", ".mov", ".webm", ".mkv"];
  const videoFile = files.find((fileName) =>
    videoExtensions.includes(path.extname(fileName).toLowerCase())
  );

  if (!videoFile) {
    throw new Error("재생용 비디오 파일을 찾지 못했습니다.");
  }

  return path.join(directoryPath, videoFile);
}

async function downloadAudio(reelUrl, tempDirPath) {
  const outputTemplate = path.join(tempDirPath, `${randomUUID()}.%(ext)s`);

  try {
    await execFileAsync("yt-dlp", [
      "--no-playlist",
      "--quiet",
      "--no-warnings",
      "-f",
      "ba",
      "-x",
      "--audio-format",
      "mp3",
      "-o",
      outputTemplate,
      reelUrl,
    ]);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("`yt-dlp`가 설치되어 있지 않습니다. 먼저 설치해 주세요.");
    }

    const stderr = error?.stderr?.trim();
    throw new Error(stderr || "릴스 오디오 다운로드에 실패했습니다.");
  }

  return findAudioFile(tempDirPath);
}

async function downloadPlaybackVideo(reelUrl, tempDirPath) {
  const outputTemplate = path.join(tempDirPath, `preview-${randomUUID()}.%(ext)s`);

  try {
    await execFileAsync("yt-dlp", [
      "--no-playlist",
      "--quiet",
      "--no-warnings",
      "-f",
      "bv*+ba/b",
      "--merge-output-format",
      "mp4",
      "-o",
      outputTemplate,
      reelUrl,
    ]);
  } catch {
    return "";
  }

  try {
    return await findVideoFile(tempDirPath);
  } catch {
    return "";
  }
}

function normalizeNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;

    const compact = text.toLowerCase().replace(/,/g, "").replace(/\s+/g, "");
    const unitMatch = compact.match(/^(-?\d+(?:\.\d+)?)(k|m|b|천|만|억)?$/i);
    if (unitMatch) {
      const base = Number(unitMatch[1]);
      const unit = unitMatch[2]?.toLowerCase() || "";
      if (Number.isFinite(base)) {
        const multipliers = {
          k: 1_000,
          m: 1_000_000,
          b: 1_000_000_000,
          천: 1_000,
          만: 10_000,
          억: 100_000_000,
        };
        const multiplier = multipliers[unit] || 1;
        return base * multiplier;
      }
    }

    const embeddedMatch = text.match(/(-?\d[\d,]*(?:\.\d+)?)\s*(k|m|b|천|만|억)?/i);
    if (embeddedMatch) {
      const base = Number(String(embeddedMatch[1]).replace(/,/g, ""));
      const unit = String(embeddedMatch[2] || "").toLowerCase();
      if (Number.isFinite(base)) {
        const multipliers = {
          k: 1_000,
          m: 1_000_000,
          b: 1_000_000_000,
          천: 1_000,
          만: 10_000,
          억: 100_000_000,
        };
        const multiplier = multipliers[unit] || 1;
        return base * multiplier;
      }
    }

    const parsedString = Number(compact);
    if (Number.isFinite(parsedString)) return parsedString;
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickFirstNumber(...candidates) {
  for (const candidate of candidates) {
    const number = normalizeNumber(candidate);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function pickFirstText(...candidates) {
  for (const candidate of candidates) {
    const value = cleanText(candidate);
    if (value) return value;
  }
  return "";
}

function pickPreferredCount(...candidates) {
  let firstFinite = null;
  for (const candidate of candidates) {
    const number = normalizeNumber(candidate);
    if (!Number.isFinite(number)) continue;
    if (firstFinite === null) firstFinite = number;
    if (number > 0) return number;
  }
  return firstFinite;
}

function walkEntries(root, visitor, maxDepth = 6) {
  const seen = new WeakSet();
  function visit(value, keyPath, depth) {
    if (depth > maxDepth) return;
    if (Array.isArray(value)) {
      for (let index = 0; index < Math.min(value.length, 80); index += 1) {
        visit(value[index], [...keyPath, String(index)], depth + 1);
      }
      return;
    }
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    const entries = Object.entries(value).slice(0, 120);
    for (const [key, nextValue] of entries) {
      visitor({ key, value: nextValue, path: [...keyPath, key] });
      visit(nextValue, [...keyPath, key], depth + 1);
    }
  }
  visit(root, [], 0);
}

function collectNumbersByKey(rawMetadata, keyPattern) {
  const numbers = [];
  walkEntries(rawMetadata, ({ key, value }) => {
    if (!keyPattern.test(String(key))) return;
    const number = normalizeNumber(value);
    if (Number.isFinite(number)) numbers.push(number);
  });
  return numbers;
}

function collectTextsByKey(rawMetadata, keyPattern) {
  const texts = [];
  walkEntries(rawMetadata, ({ key, value }) => {
    if (!keyPattern.test(String(key))) return;
    const text = cleanText(value);
    if (text) texts.push(text);
  });
  return texts;
}

function pickLargestNumberByKey(rawMetadata, keyPattern) {
  const numbers = collectNumbersByKey(rawMetadata, keyPattern).filter((number) => number >= 0);
  if (numbers.length === 0) return null;
  return Math.max(...numbers);
}

function parseCountFromText(rawText) {
  const text = cleanText(rawText);
  if (!text) return null;
  const matches = [
    text.match(/조회수\s*([0-9][0-9,]*(?:\.[0-9]+)?\s*(?:k|m|b|천|만|억)?)/i),
    text.match(/([0-9][0-9,]*(?:\.[0-9]+)?\s*(?:k|m|b|천|만|억)?)\s*(?:views?|plays?|조회수)/i),
  ].filter(Boolean);
  for (const match of matches) {
    const number = normalizeNumber(match?.[1]);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function firstMeaningfulLine(text) {
  const lines = String(text || "")
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[0] || "";
}

function normalizeSummaryText(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isBoilerplateSummary(text) {
  const normalized = normalizeSummaryText(text).toLowerCase();
  if (!normalized) return true;
  return (
    /^video by\b/.test(normalized) ||
    /^reels? by\b/.test(normalized) ||
    /^instagram\b/.test(normalized) ||
    /^original audio\b/.test(normalized) ||
    /^audio by\b/.test(normalized) ||
    /^link in bio\b/.test(normalized)
  );
}

function isLowQualitySummary(summary, { language }) {
  const normalized = normalizeSummaryText(summary);
  if (!normalized) return true;
  if (isBoilerplateSummary(normalized)) return true;
  if (normalized.length < 8) return true;

  const isEnglishVideo = String(language || "")
    .trim()
    .toLowerCase()
    .startsWith("en");
  if (isEnglishVideo && !/[가-힣]/.test(normalized)) return true;

  return false;
}

function heuristicSummary({ title, transcript }) {
  const fromTranscript = firstMeaningfulLine(transcript).replace(/\s+/g, " ").trim();
  if (fromTranscript) return fromTranscript.slice(0, 42);

  const fromTitle = firstMeaningfulLine(title);
  if (fromTitle && !isBoilerplateSummary(fromTitle)) return fromTitle.slice(0, 42);
  return "핵심 내용을 요약하지 못했습니다.";
}

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
  } finally {
    clearTimeout(timer);
  }
}

async function generateSummaryLine({ apiKey, title, transcript, language }) {
  const fallback = heuristicSummary({ title, transcript });
  if (!apiKey || !transcript) return fallback;

  const models = ["gpt-5", "gpt-5-mini", "gpt-4o-mini"];

  for (const model of models) {
    try {
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
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content:
                  "한 줄 요약만 작성하는 편집자다. 한국어로 12~32자 내 한 줄만 출력하라. 추상어 대신 영상의 핵심 내용이 보이게 구체적으로 작성하라. 문장부호 최소화. 설명 금지.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  title: String(title || ""),
                  language: String(language || ""),
                  transcript: String(transcript || "").slice(0, 2200),
                }),
              },
            ],
          }),
        },
        16000
      );

      if (!response.ok) continue;

      const line = normalizeSummaryText(payload?.choices?.[0]?.message?.content || "");
      if (!isLowQualitySummary(line, { language })) {
        return line;
      }
    } catch {
      // Try next model.
    }
  }

  return fallback;
}

function hasAudioCodec(format) {
  const acodec = String(format?.acodec || "").toLowerCase();
  if (!acodec) return false;
  return acodec !== "none";
}

function hasVideoCodec(format) {
  const vcodec = String(format?.vcodec || "").toLowerCase();
  if (!vcodec) return false;
  return vcodec !== "none";
}

function isSupportedContainer(format) {
  const ext = String(format?.ext || "").toLowerCase();
  return ext === "mp4" || ext === "mov" || ext === "webm";
}

function scorePlayableFormat(format) {
  const hasAudio = hasAudioCodec(format);
  const hasVideo = hasVideoCodec(format);
  if (!hasVideo) return -1;

  const url = String(format?.url || "");
  if (!url.startsWith("http")) return -1;

  const ext = String(format?.ext || "").toLowerCase();
  const height = Number(format?.height || 0);
  const protocol = String(format?.protocol || "").toLowerCase();
  const tbr = Number(format?.tbr || 0);

  let score = 0;
  if (hasAudio && hasVideo) score += 1000;
  if (isSupportedContainer(format)) score += 150;
  if (ext === "mp4") score += 40;
  if (protocol.includes("https")) score += 20;
  score += Math.min(1200, Math.max(0, height));
  score += Math.min(300, Math.max(0, tbr));
  return score;
}

function pickPlayableVideoUrl(rawMetadata) {
  const directUrl = String(rawMetadata?.url || "").trim();
  const directHasAudio = hasAudioCodec(rawMetadata);
  const directHasVideo = hasVideoCodec(rawMetadata);
  if (directUrl.startsWith("http") && directHasAudio && directHasVideo) return directUrl;

  const formats = Array.isArray(rawMetadata?.formats) ? rawMetadata.formats : [];
  const sorted = [...formats].sort((a, b) => scorePlayableFormat(b) - scorePlayableFormat(a));

  const bestMuxed = sorted.find((format) => hasAudioCodec(format) && hasVideoCodec(format));
  if (bestMuxed?.url) return String(bestMuxed.url);

  const fallbackVideoOnly = sorted.find((format) => hasVideoCodec(format));
  if (fallbackVideoOnly?.url) return String(fallbackVideoOnly.url);

  if (directUrl.startsWith("http")) return directUrl;
  return "";
}

function normalizeBackgroundAudioTitle(rawTitle) {
  const title = cleanText(rawTitle);
  if (!title) return "";
  const normalized = title.replace(/^original audio[:\s-]*/i, "").trim();
  if (!normalized) return "";
  if (/^original audio$/i.test(normalized)) return "";
  return normalized;
}

function extractBackgroundAudio(rawMetadata) {
  const deepAudioTitle = collectTextsByKey(
    rawMetadata,
    /(?:^|_)(?:track|song|music|music_title|audio|audio_track|audio_title|sound|original_sound)(?:$|_)/i
  )[0];
  const rawTitle = pickFirstText(
    rawMetadata?.track,
    rawMetadata?.song,
    rawMetadata?.music_title,
    rawMetadata?.audio_track,
    rawMetadata?.audio_title,
    rawMetadata?.music?.name,
    rawMetadata?.music?.title,
    rawMetadata?.music?.track,
    rawMetadata?.music_info?.title,
    rawMetadata?.music_info?.track,
    deepAudioTitle
  );
  const title = normalizeBackgroundAudioTitle(rawTitle);
  if (!title) return null;

  const deepArtist = collectTextsByKey(
    rawMetadata,
    /(?:^|_)(?:artist|track_artist|song_artist|music_artist|audio_artist|creator|owner)(?:$|_)/i
  )[0];
  const artist = pickFirstText(
    rawMetadata?.artist,
    rawMetadata?.music_artist,
    rawMetadata?.track_artist,
    rawMetadata?.song_artist,
    rawMetadata?.music?.artist,
    rawMetadata?.music_info?.artist,
    deepArtist
  );

  return {
    title,
    artist: artist || "",
    label: artist ? `${title} - ${artist}` : title,
  };
}

async function ensurePreviewCacheDirectory() {
  await fs.mkdir(PREVIEW_CACHE_DIR, { recursive: true });
}

async function cleanupPreviewCache() {
  await ensurePreviewCacheDirectory();
  const now = Date.now();
  const files = await fs.readdir(PREVIEW_CACHE_DIR);
  await Promise.all(
    files.map(async (name) => {
      const filePath = path.join(PREVIEW_CACHE_DIR, name);
      try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) return;
        if (now - stats.mtimeMs > PREVIEW_CACHE_TTL_MS) {
          await fs.rm(filePath, { force: true });
        }
      } catch {
        // Ignore cleanup failures.
      }
    })
  );
}

async function cachePlaybackVideo(videoPath, reelId) {
  if (!videoPath) return "";
  await cleanupPreviewCache();

  const ext = path.extname(videoPath).toLowerCase() || ".mp4";
  const fileName = `${Date.now()}-${reelId}-${randomUUID()}${ext}`;
  const targetPath = path.join(PREVIEW_CACHE_DIR, fileName);
  await fs.copyFile(videoPath, targetPath);
  return `/api/reels/media/${fileName}`;
}

async function probeVideoDuration(videoPath) {
  if (!videoPath) return 0;
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        videoPath,
      ],
      { maxBuffer: 1024 * 1024 }
    );
    const duration = Number(String(stdout || "").trim());
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  } catch {
    return 0;
  }
}

function parseSceneTimesFromFfmpegLog(stderr) {
  const log = String(stderr || "");
  const matches = [...log.matchAll(/showinfo[^\n]*pts_time:([0-9]+(?:\.[0-9]+)?)/g)];
  return matches
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 0);
}

async function detectSceneChangeTimes(videoPath) {
  if (!videoPath) return [];
  try {
    const { stderr } = await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-i",
        videoPath,
        "-vf",
        `select='gt(scene,${SCENE_DETECT_THRESHOLD})',showinfo`,
        "-an",
        "-f",
        "null",
        "-",
      ],
      { maxBuffer: 32 * 1024 * 1024 }
    );
    return parseSceneTimesFromFfmpegLog(stderr);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    return parseSceneTimesFromFfmpegLog(error?.stderr || "");
  }
}

function normalizeSceneTimes(times, durationSeconds) {
  const sorted = [...times]
    .map((time) => Number(time))
    .filter((time) => Number.isFinite(time) && time >= 0)
    .sort((left, right) => left - right);

  const normalized = [];
  const minGap = 0.72;
  const maxDuration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;

  for (const time of sorted) {
    const safeTime = Number(time.toFixed(3));
    if (maxDuration > 0 && safeTime > maxDuration - 0.08) continue;
    const previous = normalized[normalized.length - 1];
    if (!Number.isFinite(previous) || safeTime - previous >= minGap) {
      normalized.push(safeTime);
    }
  }

  return normalized;
}

function sampleSceneTimes(times, maxItems) {
  if (!Array.isArray(times) || times.length === 0) return [];
  if (times.length <= maxItems) return [...times];
  if (maxItems <= 1) return [times[0]];

  const result = [];
  const lastIndex = times.length - 1;
  const step = lastIndex / (maxItems - 1);

  for (let index = 0; index < maxItems; index += 1) {
    const time = times[Math.round(index * step)];
    if (Number.isFinite(time)) result.push(time);
  }

  return [...new Set(result)].sort((left, right) => left - right);
}

async function captureSceneFrame(videoPath, reelId, timeSeconds, index) {
  await ensurePreviewCacheDirectory();

  const fileName = `${Date.now()}-${reelId}-scene-${String(index + 1).padStart(2, "0")}-${randomUUID()}.jpg`;
  const targetPath = path.join(PREVIEW_CACHE_DIR, fileName);

  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-ss",
      String(Number(timeSeconds).toFixed(3)),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-vf",
      "scale=420:-2",
      "-q:v",
      "5",
      "-y",
      targetPath,
    ],
    { maxBuffer: 8 * 1024 * 1024 }
  );

  return {
    start: Number(Number(timeSeconds).toFixed(3)),
    imageUrl: `/api/reels/media/${fileName}`,
    filePath: targetPath,
  };
}

function countWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasSpeechAroundTime(segments, timeSeconds) {
  const time = Number(timeSeconds);
  if (!Array.isArray(segments) || !Number.isFinite(time)) return false;

  const windowStart = time - 0.85;
  const windowEnd = time + 1.1;
  let wordCount = 0;

  for (const segment of segments) {
    const start = Number(segment?.start ?? 0);
    const end = Number(segment?.end ?? start);
    if (end < windowStart || start > windowEnd) continue;
    wordCount += countWords(segment?.text);
    if (wordCount >= 4) return true;
  }

  return false;
}

function normalizeRoll(rawRoll, fallback) {
  const value = String(rawRoll || "").trim().toLowerCase();
  if (!value) return fallback;
  if (/^a/.test(value) || value.includes("a-roll") || value.includes("a roll") || value.includes("a롤")) {
    return "A-roll";
  }
  if (/^b/.test(value) || value.includes("b-roll") || value.includes("b roll") || value.includes("b롤")) {
    return "B-roll";
  }
  if (value.includes("unknown") || value.includes("unclear")) return fallback;
  return fallback;
}

function heuristicRollByTime(segments, timeSeconds) {
  return hasSpeechAroundTime(segments, timeSeconds) ? "A-roll" : "B-roll";
}

function pickNearbyTranscript(segments, timeSeconds) {
  const time = Number(timeSeconds);
  if (!Array.isArray(segments) || !Number.isFinite(time)) return "";
  const nearby = segments
    .filter((segment) => {
      const start = Number(segment?.start ?? 0);
      const end = Number(segment?.end ?? start);
      return !(end < time - 1.2 || start > time + 1.2);
    })
    .map((segment) => cleanText(segment?.text))
    .filter(Boolean)
    .slice(0, 2);
  return nearby.join(" / ").slice(0, 180);
}

function pickVisionFrameIndexes(total, limit) {
  if (!Number.isInteger(total) || total <= 0) return [];
  if (total <= limit) return Array.from({ length: total }, (_, index) => index);
  if (limit <= 1) return [0];

  const indexes = new Set([0, total - 1]);
  const step = (total - 1) / (limit - 1);
  for (let i = 1; i < limit - 1; i += 1) {
    indexes.add(Math.round(i * step));
  }
  return [...indexes].sort((left, right) => left - right);
}

async function classifySceneRollsWithOpenAI({ sceneFrames, segments, apiKey }) {
  const fallback = sceneFrames.map((frame) => ({
    roll: heuristicRollByTime(segments, frame.start),
    confidence: 0.58,
    source: "heuristic",
  }));

  if (!apiKey || !Array.isArray(sceneFrames) || sceneFrames.length === 0) {
    return fallback;
  }

  const selectedIndexes = pickVisionFrameIndexes(sceneFrames.length, 12);
  const userContent = [
    {
      type: "text",
      text:
        "각 프레임을 A-roll 또는 B-roll로 분류하세요. A-roll: 화자가 카메라를 향해 직접 말하는 장면. B-roll: 보조 화면/컷어웨이/텍스트 위주/삽입 영상. JSON만 반환: {\"items\":[{\"index\":0,\"roll\":\"A-roll\",\"confidence\":0.84}]}",
    },
  ];

  for (const index of selectedIndexes) {
    const frame = sceneFrames[index];
    if (!frame?.filePath) continue;
    try {
      const imageBuffer = await fs.readFile(frame.filePath);
      const base64 = imageBuffer.toString("base64");
      const transcriptHint = pickNearbyTranscript(segments, frame.start);
      userContent.push({
        type: "text",
        text: `index=${index}, time=${Number(frame.start).toFixed(2)}s, transcript_hint=${transcriptHint || "none"}`,
      });
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${base64}`,
          detail: "low",
        },
      });
    } catch {
      // Ignore unreadable frame.
    }
  }

  if (userContent.length <= 1) {
    return fallback;
  }

  try {
    const { response, payload } = await fetchJsonWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You classify short-form video frames into A-roll vs B-roll. Return strict JSON only.",
            },
            {
              role: "user",
              content: userContent,
            },
          ],
        }),
      },
      45000
    );

    if (!response.ok) return fallback;

    const parsed = JSON.parse(payload?.choices?.[0]?.message?.content || "{}");
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const byIndex = new Map();

    for (const item of items) {
      const index = Number(item?.index);
      if (!Number.isInteger(index) || index < 0 || index >= sceneFrames.length) continue;
      const fallbackRoll = fallback[index]?.roll || "A-roll";
      const roll = normalizeRoll(item?.roll, fallbackRoll);
      const confidence = Number(item?.confidence);
      byIndex.set(index, {
        roll,
        confidence:
          Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : 0.62,
        source: "vision",
      });
    }

    return sceneFrames.map((frame, index) => byIndex.get(index) || fallback[index]);
  } catch {
    return fallback;
  }
}

async function buildSceneCaptures({ videoPath, reelId, durationSeconds, segments, apiKey }) {
  if (!videoPath || !reelId) return [];

  const detectedTimes = await detectSceneChangeTimes(videoPath);
  const normalizedTimes = normalizeSceneTimes(
    [0, ...detectedTimes],
    Number.isFinite(durationSeconds) ? durationSeconds : 0
  );
  const sampledTimes = sampleSceneTimes(normalizedTimes, MAX_SCENE_CAPTURES);
  if (sampledTimes.length === 0) return [];

  const frames = [];
  for (let index = 0; index < sampledTimes.length; index += 1) {
    const timeSeconds = sampledTimes[index];
    try {
      const frame = await captureSceneFrame(videoPath, reelId, timeSeconds, index);
      frames.push(frame);
    } catch {
      // Skip frame extraction failures and continue.
    }
  }

  if (frames.length === 0) return [];

  const rollLabels = await classifySceneRollsWithOpenAI({
    sceneFrames: frames,
    segments,
    apiKey,
  });

  return frames.map((frame, index) => ({
    start: frame.start,
    imageUrl: frame.imageUrl,
    roll: rollLabels[index]?.roll || heuristicRollByTime(segments, frame.start),
    confidence: Number(
      Number.isFinite(rollLabels[index]?.confidence) ? rollLabels[index].confidence : 0.55
    ),
    source: rollLabels[index]?.source || "heuristic",
  }));
}

function normalizeMetadata(rawMetadata) {
  if (!rawMetadata || typeof rawMetadata !== "object") return null;

  const deepViewCount = pickLargestNumberByKey(
    rawMetadata,
    /(?:^|_)(?:view_count|views|views_count|play_count|plays|watch_count|video_view_count|media_view_count)(?:$|_)/i
  );
  const inferredViewFromText = pickFirstNumber(
    parseCountFromText(rawMetadata?.description),
    parseCountFromText(rawMetadata?.title),
    parseCountFromText(rawMetadata?.fulltitle)
  );
  const viewCount = pickPreferredCount(
    rawMetadata.view_count,
    rawMetadata.play_count,
    rawMetadata.video_view_count,
    rawMetadata.media_view_count,
    rawMetadata.statistics?.view_count,
    rawMetadata.statistics?.play_count,
    rawMetadata.media_statistics?.view_count,
    rawMetadata.media_statistics?.play_count,
    deepViewCount,
    inferredViewFromText
  );

  const deepLikeCount = pickLargestNumberByKey(
    rawMetadata,
    /(?:^|_)(?:like_count|likes|favorite_count|favourite_count|heart_count|upvote_count)(?:$|_)/i
  );
  const deepCommentCount = pickLargestNumberByKey(
    rawMetadata,
    /(?:^|_)(?:comment_count|comments|reply_count|replies)(?:$|_)/i
  );

  return {
    title: rawMetadata.title || rawMetadata.fulltitle || "",
    uploader: rawMetadata.uploader || rawMetadata.channel || rawMetadata.creator || "",
    likeCount: pickPreferredCount(rawMetadata.like_count, deepLikeCount),
    commentCount: pickPreferredCount(rawMetadata.comment_count, deepCommentCount),
    viewCount,
    duration: normalizeNumber(rawMetadata.duration),
    uploadDate: rawMetadata.upload_date || "",
    thumbnail: rawMetadata.thumbnail || "",
    videoUrl: pickPlayableVideoUrl(rawMetadata),
    backgroundAudio: extractBackgroundAudio(rawMetadata),
  };
}

function splitLongSegment(segment) {
  const start = Number(segment?.start ?? 0);
  const end = Number(segment?.end ?? start);
  const rawText = String(segment?.text ?? "").trim();
  if (!rawText) return [];

  const maxChars = 56;
  const sentenceLike = rawText
    .split(/(?<=[.!?])\s+|(?<=,)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const units = sentenceLike.length > 0 ? sentenceLike : [rawText];
  const chunks = [];

  for (const unit of units) {
    if (unit.length <= maxChars) {
      chunks.push(unit);
      continue;
    }

    const words = unit.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        chunks.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) chunks.push(current);
  }

  if (chunks.length <= 1) {
    return [{ start, end, text: rawText }];
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0) || 1;
  const duration = Math.max(0.01, end - start);
  let cursor = start;

  return chunks.map((chunk, index) => {
    const ratio = chunk.length / totalLength;
    const chunkDuration = index === chunks.length - 1 ? Math.max(0.01, end - cursor) : duration * ratio;
    const chunkStart = cursor;
    const chunkEnd = Math.min(end, chunkStart + chunkDuration);
    cursor = chunkEnd;
    return {
      start: Number(chunkStart.toFixed(3)),
      end: Number(chunkEnd.toFixed(3)),
      text: chunk,
    };
  });
}

async function fetchReelMetadata(reelUrl) {
  try {
    const { stdout } = await execFileAsync(
      "yt-dlp",
      ["--skip-download", "--dump-single-json", "--no-playlist", "--no-warnings", reelUrl],
      { maxBuffer: 10 * 1024 * 1024 }
    );
    return normalizeMetadata(JSON.parse(stdout));
  } catch {
    return null;
  }
}

async function transcribeAudio(audioPath, apiKey) {
  const audioBuffer = await fs.readFile(audioPath);
  const formData = new FormData();
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("file", new Blob([audioBuffer]), path.basename(audioPath));

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "전사 API 요청이 실패했습니다.";
    throw new Error(message);
  }

  return payload;
}

function normalizeSegments(segments) {
  if (!Array.isArray(segments)) return [];

  return segments.flatMap((segment) => splitLongSegment(segment));
}

export async function POST(request) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return NextResponse.json(
      {
        error: "서버에 OPENAI_API_KEY가 설정되어 있지 않습니다.",
      },
      { status: 500 }
    );
  }

  let temporaryDirectory;

  try {
    const body = await request.json();
    const reelInput = parseReelUrl(body?.url);
    if (!reelInput) {
      return NextResponse.json(
        {
          error: "인스타그램 릴스 URL 형식이 아닙니다.",
        },
        { status: 400 }
      );
    }

    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "reel-transcribe-"));
    const metadata = await fetchReelMetadata(body.url);
    const downloadedPreviewVideoPath = await downloadPlaybackVideo(body.url, temporaryDirectory);
    const audioPath = await downloadAudio(body.url, temporaryDirectory);
    const transcription = await transcribeAudio(audioPath, openaiApiKey);
    const cachedPlaybackUrl = await cachePlaybackVideo(downloadedPreviewVideoPath, reelInput.reelId);
    const mergedMetadata = metadata
      ? {
          ...metadata,
          videoUrl: cachedPlaybackUrl || "",
        }
      : cachedPlaybackUrl
        ? {
            title: "",
            uploader: "",
            likeCount: null,
            commentCount: null,
            viewCount: null,
            duration: null,
            uploadDate: "",
            thumbnail: "",
            videoUrl: cachedPlaybackUrl,
            backgroundAudio: null,
          }
        : metadata;

    const transcript = transcription?.text?.trim() || "";
    const language = transcription?.language || "";
    const segments = normalizeSegments(transcription?.segments);
    const fallbackDuration = Number(segments[segments.length - 1]?.end ?? 0);
    const videoDuration =
      Number(mergedMetadata?.duration) || (await probeVideoDuration(downloadedPreviewVideoPath));
    const durationSeconds = Number.isFinite(videoDuration) && videoDuration > 0 ? videoDuration : fallbackDuration;
    const sceneCaptures = await buildSceneCaptures({
      videoPath: downloadedPreviewVideoPath,
      reelId: reelInput.reelId,
      durationSeconds,
      segments,
      apiKey: openaiApiKey,
    });
    const metadataWithScenes = mergedMetadata
      ? {
          ...mergedMetadata,
          sceneCaptures,
        }
      : mergedMetadata;
    const transcriptHash = buildTranscriptHash({ transcript, segments, language });
    const cachedEntry = await getReelCache(reelInput.reelId);
    const hasFreshCache = cachedEntry?.transcriptHash === transcriptHash;

    const cachedSummaryLine = cleanText(cachedEntry?.summaryLine);
    const summaryLine =
      hasFreshCache &&
      cachedSummaryLine &&
      !isLowQualitySummary(cachedSummaryLine, { language })
        ? cachedSummaryLine
        : await generateSummaryLine({
            apiKey: openaiApiKey,
            title: mergedMetadata?.title || "",
            transcript,
            language,
          });

    let translation = "";
    let translationSegments = [];
    let reviewSummary = { correctedCount: 0, notes: [] };
    let translationCached = false;
    let translationError = "";

    if (isEnglishLanguage(language)) {
      if (
        hasFreshCache &&
        (cleanText(cachedEntry?.translation) ||
          (Array.isArray(cachedEntry?.translationSegments) && cachedEntry.translationSegments.length > 0))
      ) {
        translation = cleanText(cachedEntry?.translation);
        translationSegments = Array.isArray(cachedEntry?.translationSegments)
          ? cachedEntry.translationSegments
              .map((segment) => ({
                start: Number(segment?.start ?? 0),
                end: Number(segment?.end ?? 0),
                text: cleanText(segment?.text),
              }))
              .filter((segment) => segment.text.length > 0)
          : [];
        reviewSummary =
          cachedEntry?.reviewSummary && typeof cachedEntry.reviewSummary === "object"
            ? cachedEntry.reviewSummary
            : reviewSummary;
        translationCached = true;
      } else {
        try {
          const translated = await translateEnglishTranscript({
            transcript,
            language,
            segments,
            deeplApiKey: process.env.DEEPL_API_KEY,
            deeplApiUrl: process.env.DEEPL_API_URL,
            openaiApiKey,
          });

          translation = translated.translation;
          translationSegments = translated.translationSegments;
          reviewSummary = translated.reviewSummary;
        } catch (error) {
          translationError = error?.message || "자동 번역 처리 중 오류가 발생했습니다.";
        }
      }
    }

    await upsertReelCache(reelInput.reelId, {
      reelUrl: body.url,
      embedUrl: reelInput.embedUrl,
      transcriptHash,
      transcript,
      language,
      segments,
      metadata: metadataWithScenes || null,
      summaryLine,
      backgroundAudio: mergedMetadata?.backgroundAudio || null,
      sceneCaptures,
      translation,
      translationSegments,
      reviewSummary,
    });

    return NextResponse.json({
      reelId: reelInput.reelId,
      embedUrl: reelInput.embedUrl,
      transcriptHash,
      metadata: metadataWithScenes,
      summaryLine,
      transcript,
      language,
      segments,
      translationSegments,
      translation,
      reviewSummary,
      translationCached,
      translationError,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  } finally {
    if (temporaryDirectory) {
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}
