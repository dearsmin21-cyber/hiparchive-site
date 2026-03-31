import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const MAX_YTDLP_BUFFER = 12 * 1024 * 1024;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value) {
  return String(value || "").trim();
}

function isEnglishLanguageTag(rawLanguage) {
  const language = cleanText(rawLanguage).toLowerCase();
  return language === "en" || language.startsWith("en-") || language.startsWith("en_");
}

function parseYouTubeInput(rawInput) {
  if (!rawInput || typeof rawInput !== "string") return null;

  const input = rawInput.trim();
  if (!input) return null;

  const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  let parsedUrl;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  let videoId = "";

  if (host === "youtu.be") {
    videoId = parsedUrl.pathname.split("/").filter(Boolean)[0] || "";
  } else if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    if (parsedUrl.pathname === "/watch") {
      videoId = parsedUrl.searchParams.get("v") || "";
    } else {
      const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
      if (pathParts[0] === "shorts" || pathParts[0] === "embed" || pathParts[0] === "live") {
        videoId = pathParts[1] || "";
      }
    }
  }

  const safeVideoId = cleanText(videoId);
  if (!safeVideoId) return null;

  return {
    originalUrl: input,
    canonicalUrl: `https://www.youtube.com/watch?v=${safeVideoId}`,
    videoId: safeVideoId,
  };
}

async function runYtDlp(args, failureMessage) {
  try {
    return await execFileAsync("yt-dlp", args, {
      maxBuffer: MAX_YTDLP_BUFFER,
    });
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("`yt-dlp`가 설치되어 있지 않습니다. 먼저 설치해 주세요.");
    }
    const stderr = cleanText(error?.stderr);
    throw new Error(stderr || failureMessage);
  }
}

async function fetchVideoMetadata(youtubeUrl) {
  try {
    const { stdout } = await runYtDlp(
      ["--skip-download", "--dump-single-json", "--no-playlist", "--no-warnings", youtubeUrl],
      "유튜브 메타데이터 조회에 실패했습니다."
    );
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function normalizeMetadata(rawMetadata, videoId) {
  return {
    videoId,
    title: cleanText(rawMetadata?.title),
    channel: cleanText(rawMetadata?.uploader || rawMetadata?.channel),
    duration: Number(rawMetadata?.duration) || null,
    uploadDate: cleanText(rawMetadata?.upload_date),
    thumbnail: cleanText(rawMetadata?.thumbnail),
  };
}

function captionFileScore(fileName) {
  const name = fileName.toLowerCase();
  if (!name.endsWith(".vtt")) return -100;
  if (name.includes("live_chat")) return -100;

  let score = 0;
  if (name.endsWith(".en.vtt")) score += 40;
  if (/\.en-[a-z0-9]+\.vtt$/i.test(name)) score += 30;
  if (name.includes(".en-orig.")) score += 24;
  if (name.includes(".en.")) score += 18;
  if (name.includes(".orig.")) score += 3;
  return score;
}

async function pickBestCaptionFile(directoryPath) {
  const files = await fs.readdir(directoryPath);
  const candidates = files
    .map((name) => ({
      name,
      score: captionFileScore(name),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) return "";
  return path.join(directoryPath, candidates[0].name);
}

async function downloadEnglishCaptionFile({ youtubeUrl, directoryPath, auto }) {
  await fs.mkdir(directoryPath, { recursive: true });
  const outputTemplate = path.join(directoryPath, "%(id)s.%(ext)s");

  const args = [
    "--skip-download",
    "--no-playlist",
    "--quiet",
    "--no-warnings",
    "--sub-langs",
    "en.*,en",
    "--sub-format",
    "vtt",
    auto ? "--write-auto-sub" : "--write-sub",
    "-o",
    outputTemplate,
    youtubeUrl,
  ];

  await runYtDlp(
    args,
    auto ? "자동 영어 자막 다운로드에 실패했습니다." : "수동 영어 자막 다운로드에 실패했습니다."
  );

  return pickBestCaptionFile(directoryPath);
}

function parseVttTimestamp(rawTimestamp) {
  const normalized = cleanText(rawTimestamp).replace(",", ".");
  const parts = normalized.split(":");
  if (parts.length < 2 || parts.length > 3) return Number.NaN;

  const tail = Number(parts[parts.length - 1]);
  const minutes = Number(parts[parts.length - 2]);
  const hours = parts.length === 3 ? Number(parts[0]) : 0;
  if (![hours, minutes, tail].every(Number.isFinite)) return Number.NaN;

  return hours * 3600 + minutes * 60 + tail;
}

function decodeHtmlEntities(text) {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function stripCaptionFormatting(rawLine) {
  let line = String(rawLine || "");
  line = line.replace(/<\d{2}:\d{2}(?::\d{2})?\.\d{3}>/g, " ");
  line = line.replace(/<\/?c(?:\.[^>]*)?>/g, "");
  line = line.replace(/<\/?[^>]+>/g, "");
  line = decodeHtmlEntities(line);
  return line.replace(/\s+/g, " ").trim();
}

function compactSegments(rawSegments) {
  const sorted = rawSegments
    .map((segment) => ({
      start: Number(segment?.start ?? 0),
      end: Number(segment?.end ?? 0),
      text: cleanText(segment?.text),
    }))
    .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.text)
    .sort((left, right) => left.start - right.start);

  const merged = [];
  for (const segment of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push(segment);
      continue;
    }

    const isSameText = previous.text === segment.text;
    const isNearby = segment.start <= previous.end + 0.45;
    if (isSameText && isNearby) {
      previous.end = Math.max(previous.end, segment.end);
      continue;
    }
    merged.push(segment);
  }

  return merged.map((segment) => ({
    start: Number(segment.start.toFixed(3)),
    end: Number(segment.end.toFixed(3)),
    text: segment.text,
  }));
}

function splitWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function wordsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function findTailNovelWords(previousText, currentText) {
  const previousWords = splitWords(previousText);
  const currentWords = splitWords(currentText);
  if (currentWords.length === 0) return [];
  if (previousWords.length === 0) return currentWords;
  if (wordsEqual(previousWords, currentWords)) return [];

  const maxOverlap = Math.min(previousWords.length, currentWords.length);
  let bestOverlap = 0;

  for (let overlap = maxOverlap; overlap >= 1; overlap -= 1) {
    let matched = true;
    for (let offset = 0; offset < overlap; offset += 1) {
      const prevWord = previousWords[previousWords.length - overlap + offset];
      const currWord = currentWords[offset];
      if (prevWord !== currWord) {
        matched = false;
        break;
      }
    }
    if (matched) {
      bestOverlap = overlap;
      break;
    }
  }

  if (bestOverlap <= 0) return currentWords;
  return currentWords.slice(bestOverlap);
}

function removeRollingCaptionOverlap(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const cleaned = [];
  let previousText = "";

  for (const segment of segments) {
    const text = cleanText(segment?.text);
    if (!text) continue;

    const novelWords = findTailNovelWords(previousText, text);
    previousText = text;
    if (novelWords.length === 0) continue;

    cleaned.push({
      start: Number(segment.start ?? 0),
      end: Number(segment.end ?? 0),
      text: novelWords.join(" "),
    });
  }

  return compactSegments(cleaned);
}

function parseVttText(vttText, { removeRollingOverlap = false } = {}) {
  const blocks = String(vttText || "")
    .replace(/\r/g, "")
    .split(/\n{2,}/);

  const segments = [];
  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) continue;

    const cueIndex = lines.findIndex((line) => line.includes("-->"));
    if (cueIndex < 0 || cueIndex >= lines.length - 1) continue;

    const [startPart, endPartWithSetting] = lines[cueIndex].split("-->");
    if (!startPart || !endPartWithSetting) continue;

    const endPart = endPartWithSetting.trim().split(/\s+/)[0];
    const start = parseVttTimestamp(startPart);
    const end = parseVttTimestamp(endPart);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    const text = lines
      .slice(cueIndex + 1)
      .map(stripCaptionFormatting)
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!text) continue;
    segments.push({
      start,
      end,
      text,
    });
  }

  const compacted = compactSegments(segments);
  if (!removeRollingOverlap) return compacted;
  return removeRollingCaptionOverlap(compacted);
}

function buildTranscriptText(segments) {
  return segments
    .map((segment) => cleanText(segment.text))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readCaptionTranscript(captionPath, { removeRollingOverlap = false } = {}) {
  if (!captionPath) return null;
  const rawVtt = await fs.readFile(captionPath, "utf8");
  const segments = parseVttText(rawVtt, { removeRollingOverlap });
  const transcript = buildTranscriptText(segments);
  if (!transcript) return null;

  return {
    language: "en",
    transcript,
    segments,
  };
}

async function findAudioFile(directoryPath) {
  const files = await fs.readdir(directoryPath);
  const supportedExtensions = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".webm"];
  const matched = files.find((fileName) =>
    supportedExtensions.includes(path.extname(fileName).toLowerCase())
  );
  if (!matched) {
    throw new Error("오디오 파일을 찾지 못했습니다. 다운로드가 실패했을 수 있습니다.");
  }
  return path.join(directoryPath, matched);
}

async function downloadAudioFile(youtubeUrl, directoryPath) {
  const outputTemplate = path.join(directoryPath, "%(id)s.%(ext)s");
  await runYtDlp(
    [
      "--no-playlist",
      "--quiet",
      "--no-warnings",
      "-f",
      "ba",
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "-o",
      outputTemplate,
      youtubeUrl,
    ],
    "오디오 다운로드에 실패했습니다."
  );
  return findAudioFile(directoryPath);
}

async function transcribeWithOpenAI(audioPath, apiKey) {
  const audioBuffer = await fs.readFile(audioPath);
  const formData = new FormData();
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("language", "en");
  formData.append("temperature", "0");
  formData.append(
    "prompt",
    "The audio is in English. Transcribe exactly what is spoken. Do not summarize or translate."
  );
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
    const message = payload?.error?.message || "OpenAI 전사 API 요청이 실패했습니다.";
    throw new Error(message);
  }
  return payload;
}

function normalizeOpenAiSegments(rawSegments) {
  if (!Array.isArray(rawSegments)) return [];
  return rawSegments
    .map((segment) => ({
      start: Number(segment?.start ?? 0),
      end: Number(segment?.end ?? 0),
      text: cleanText(segment?.text),
    }))
    .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.text);
}

async function tryCaptionFirstTranscription({ youtubeUrl, temporaryDirectory }) {
  const manualDirectory = path.join(temporaryDirectory, "manual-subs");
  const manualCaptionPath = await downloadEnglishCaptionFile({
    youtubeUrl,
    directoryPath: manualDirectory,
    auto: false,
  }).catch(() => "");

  if (manualCaptionPath) {
    const manualTranscript = await readCaptionTranscript(manualCaptionPath, {
      removeRollingOverlap: false,
    }).catch(() => null);
    if (manualTranscript) {
      return {
        ...manualTranscript,
        source: "youtube-manual-captions",
      };
    }
  }

  const autoDirectory = path.join(temporaryDirectory, "auto-subs");
  const autoCaptionPath = await downloadEnglishCaptionFile({
    youtubeUrl,
    directoryPath: autoDirectory,
    auto: true,
  }).catch(() => "");

  if (!autoCaptionPath) return null;

  const autoTranscript = await readCaptionTranscript(autoCaptionPath, {
    removeRollingOverlap: true,
  }).catch(() => null);
  if (!autoTranscript) return null;
  return {
    ...autoTranscript,
    source: "youtube-auto-captions",
  };
}

export async function POST(request) {
  let temporaryDirectory = "";

  try {
    const body = await request.json();
    const parsedInput = parseYouTubeInput(body?.url);
    if (!parsedInput) {
      return NextResponse.json(
        {
          error: "유효한 유튜브 링크를 입력해 주세요.",
        },
        { status: 400 }
      );
    }

    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "youtube-transcribe-"));
    const metadata = normalizeMetadata(
      await fetchVideoMetadata(parsedInput.canonicalUrl),
      parsedInput.videoId
    );

    const captionTranscript = await tryCaptionFirstTranscription({
      youtubeUrl: parsedInput.canonicalUrl,
      temporaryDirectory,
    });

    if (captionTranscript) {
      return NextResponse.json({
        ...metadata,
        originalUrl: parsedInput.originalUrl,
        canonicalUrl: parsedInput.canonicalUrl,
        source: captionTranscript.source,
        language: captionTranscript.language,
        transcript: captionTranscript.transcript,
        segments: captionTranscript.segments,
      });
    }

    const openaiApiKey = cleanText(process.env.OPENAI_API_KEY);
    if (!openaiApiKey) {
      return NextResponse.json(
        {
          error:
            "이 영상의 영어 자막을 찾지 못했습니다. 서버에 OPENAI_API_KEY를 설정하면 음성 전사로 자동 대체됩니다.",
        },
        { status: 500 }
      );
    }

    const audioDirectory = path.join(temporaryDirectory, "audio");
    await fs.mkdir(audioDirectory, { recursive: true });
    const audioPath = await downloadAudioFile(parsedInput.canonicalUrl, audioDirectory);
    const openAiResult = await transcribeWithOpenAI(audioPath, openaiApiKey);
    const segments = normalizeOpenAiSegments(openAiResult?.segments);
    const transcript =
      cleanText(openAiResult?.text) ||
      buildTranscriptText(segments) ||
      "전사 결과가 비어 있습니다. 다른 영상 링크로 다시 시도해 주세요.";

    return NextResponse.json({
      ...metadata,
      originalUrl: parsedInput.originalUrl,
      canonicalUrl: parsedInput.canonicalUrl,
      source: "openai-whisper",
      language: isEnglishLanguageTag(openAiResult?.language) ? "en" : cleanText(openAiResult?.language || "en"),
      transcript,
      segments,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "전사 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  } finally {
    if (temporaryDirectory) {
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}
