"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const REEL_PATTERN =
  /^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i;

function buildEmbedUrl(url) {
  const match = url.trim().match(REEL_PATTERN);
  if (!match) return null;
  return `https://www.instagram.com/reel/${match[1]}/embed`;
}

function formatTimestamp(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) return "-";

  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatUploadDate(rawDate) {
  if (!rawDate || !/^\d{8}$/.test(rawDate)) return "-";
  const year = rawDate.slice(0, 4);
  const month = rawDate.slice(4, 6);
  const day = rawDate.slice(6, 8);
  return `${year}.${month}.${day}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatCount(value, emptyLabel = "-") {
  if (!Number.isFinite(value)) return emptyLabel;
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatBackgroundAudio(backgroundAudio) {
  if (!backgroundAudio || typeof backgroundAudio !== "object") return "정보 없음";
  const title = String(backgroundAudio?.title || "").trim();
  const artist = String(backgroundAudio?.artist || "").trim();
  if (!title) return "정보 없음";
  return artist ? `${title} - ${artist}` : title;
}

function formatOverlaySubtitle(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";

  const maxLineLength = 24;
  const words = raw.split(" ").filter(Boolean);
  const lines = [];
  let current = "";
  let truncated = false;

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLineLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length === 2) {
      truncated = index < words.length - 1 || Boolean(current);
      break;
    }
  }
  if (lines.length < 2 && current) {
    lines.push(current);
    current = "";
  }

  if (lines.length === 0) return raw.slice(0, maxLineLength);
  if (truncated && lines[1]) {
    lines[1] = lines[1].endsWith("…") ? lines[1] : `${lines[1]}…`;
  }
  return lines.join("\n");
}

function normalizeSubtitleText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (/^null object$/i.test(text)) return "";
  return text;
}

function normalizeComparableText(value) {
  return normalizeSubtitleText(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTextMatch(leftValue, rightValue) {
  const left = normalizeComparableText(leftValue);
  const right = normalizeComparableText(rightValue);
  if (!left || !right) return 0;
  if (left === right) return 1000;
  if (right.includes(left)) return 850;
  if (left.includes(right)) return 780;

  const leftWords = left.split(" ").filter(Boolean);
  const rightWords = right.split(" ").filter(Boolean);
  if (leftWords.length === 0 || rightWords.length === 0) return 0;

  const rightSet = new Set(rightWords);
  const overlap = leftWords.filter((word) => rightSet.has(word)).length;
  const ratio = overlap / Math.max(leftWords.length, rightWords.length);
  return Math.round(ratio * 600);
}

function stripAnalysisEvidence(rawText) {
  if (!rawText) return "";
  let text = String(rawText).trim();
  text = text.replace(/근거\s*구간\s*[:：][^\n\r]*/gi, " ");
  text = text.replace(/\[\d{1,2}:\d{2}\][^\n\r]*/g, " ");
  text = text.replace(/주요\s*근거\s*시간대[^.。!\n]*/gi, " ");
  text = text.replace(/\s{2,}/g, " ").trim();
  return text;
}

function buildSegmentKey(start, end) {
  const safeStart = Number(start);
  const safeEnd = Number(end);
  if (!Number.isFinite(safeStart) || !Number.isFinite(safeEnd)) return "";
  return `${safeStart.toFixed(3)}-${safeEnd.toFixed(3)}`;
}

function buildSegmentTextLookup(segments) {
  if (!Array.isArray(segments)) {
    return { byIndex: [], byKey: new Map() };
  }

  const byIndex = [];
  const byKey = new Map();

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const text = normalizeSubtitleText(segment?.text);
    const key = buildSegmentKey(segment?.start, segment?.end);
    byIndex[index] = text;
    if (key) byKey.set(key, text);
  }

  return { byIndex, byKey };
}

function getSegmentText(lookup, segment, index) {
  const key = buildSegmentKey(segment?.start, segment?.end);
  if (key && lookup.byKey.has(key)) {
    return lookup.byKey.get(key) || "";
  }
  return lookup.byIndex[index] || "";
}

function findActiveSegmentIndex(segments, currentTimeSeconds) {
  if (!Array.isArray(segments) || segments.length === 0) return -1;

  const currentTime = Number(currentTimeSeconds);
  if (!Number.isFinite(currentTime)) return -1;

  let left = 0;
  let right = segments.length - 1;
  let candidate = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const start = Number(segments[mid]?.start ?? 0);
    if (currentTime >= start) {
      candidate = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  if (candidate < 0) return -1;

  const tolerance = 0.06;
  const currentEnd = Number(segments[candidate]?.end ?? segments[candidate]?.start ?? 0);
  if (currentTime <= currentEnd + tolerance) return candidate;

  const next = candidate + 1;
  if (next < segments.length) {
    const nextStart = Number(segments[next]?.start ?? 0);
    const nextEnd = Number(segments[next]?.end ?? nextStart);
    if (currentTime >= nextStart - tolerance && currentTime <= nextEnd + tolerance) {
      return next;
    }
  }

  return Math.min(candidate, segments.length - 1);
}

function normalizeRollLabel(rawRoll) {
  const value = String(rawRoll || "").trim().toLowerCase();
  if (
    value.startsWith("b") ||
    value.includes("b-roll") ||
    value.includes("b roll") ||
    value.includes("b롤")
  ) {
    return "B-roll";
  }
  return "A-roll";
}

function normalizeSceneCaptures(sceneCaptures) {
  if (!Array.isArray(sceneCaptures)) return [];
  return sceneCaptures
    .map((scene) => ({
      start: Number(scene?.start ?? 0),
      imageUrl: String(scene?.imageUrl || "").trim(),
      roll: normalizeRollLabel(scene?.roll),
      confidence: Number(scene?.confidence ?? 0),
    }))
    .filter((scene) => Number.isFinite(scene.start) && scene.start >= 0 && scene.imageUrl)
    .sort((left, right) => left.start - right.start);
}

function collapseConsecutiveARollSceneCaptures(sceneCaptures) {
  if (!Array.isArray(sceneCaptures) || sceneCaptures.length === 0) return [];
  const collapsed = [];

  for (let index = 0; index < sceneCaptures.length; index += 1) {
    const scene = sceneCaptures[index];
    if (!scene) continue;

    const previousRaw = sceneCaptures[index - 1];
    if (scene.roll === "A-roll" && previousRaw?.roll === "A-roll") {
      continue;
    }

    collapsed.push({ ...scene, sourceIndex: index });
  }

  return collapsed;
}

function findActiveSceneIndex(sceneCaptures, currentTimeSeconds) {
  if (!Array.isArray(sceneCaptures) || sceneCaptures.length === 0) return -1;
  const currentTime = Number(currentTimeSeconds);
  if (!Number.isFinite(currentTime)) return 0;

  let left = 0;
  let right = sceneCaptures.length - 1;
  let candidate = 0;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const start = Number(sceneCaptures[mid]?.start ?? 0);
    if (currentTime >= start) {
      candidate = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return Math.max(0, Math.min(candidate, sceneCaptures.length - 1));
}

function getProgressHint(elapsedSeconds) {
  if (elapsedSeconds < 3) return "릴스 메타데이터 확인 중";
  if (elapsedSeconds < 8) return "오디오 다운로드 및 추출 중";
  if (elapsedSeconds < 15) return "음성 전사 처리 중";
  if (elapsedSeconds < 24) return "전사 세그먼트 정리 중";
  return "마무리 처리 중";
}

const ANALYSIS_VERSION = 8;

function fallbackReelSummary(result) {
  const metadataTitle = String(result?.metadata?.title || "").trim();
  if (metadataTitle) {
    return metadataTitle.length > 52 ? `${metadataTitle.slice(0, 52)}...` : metadataTitle;
  }

  const transcript = String(result?.transcript || "").trim();
  if (!transcript) return "";
  const firstLine = transcript
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
  if (!firstLine) return "";
  return firstLine.length > 52 ? `${firstLine.slice(0, 52)}...` : firstLine;
}

export default function MockConsole() {
  const [archiveReelId, setArchiveReelId] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("대기 중");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [subtitleMode, setSubtitleMode] = useState(true);
  const [showKorean, setShowKorean] = useState(false);
  const [translatingKorean, setTranslatingKorean] = useState(false);
  const [refiningKorean, setRefiningKorean] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [refineProgress, setRefineProgress] = useState(0);
  const [showRefinedKorean, setShowRefinedKorean] = useState(false);
  const [refinedModel, setRefinedModel] = useState("");
  const [playerTime, setPlayerTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showPlayerUi, setShowPlayerUi] = useState(true);
  const [videoPlaybackError, setVideoPlaybackError] = useState(false);
  const [followPlayback, setFollowPlayback] = useState(true);
  const [showVideoSubtitle, setShowVideoSubtitle] = useState(false);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [activeScriptTab, setActiveScriptTab] = useState("transcript");
  const [analyzingScript, setAnalyzingScript] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisDetailOpen, setAnalysisDetailOpen] = useState({});
  const [copied, setCopied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const videoRef = useRef(null);
  const playerUiTimerRef = useRef(null);
  const segmentRefs = useRef([]);

  const previewEmbedUrl = useMemo(() => buildEmbedUrl(url), [url]);
  useEffect(() => {
    function syncArchiveParam() {
      if (typeof window === "undefined") return;
      const next = new URLSearchParams(window.location.search).get("archive") || "";
      setArchiveReelId(String(next).trim());
    }

    syncArchiveParam();
    window.addEventListener("popstate", syncArchiveParam);
    return () => window.removeEventListener("popstate", syncArchiveParam);
  }, []);
  const transcriptSegments = useMemo(() => {
    if (!Array.isArray(result?.segments)) return [];

    return result.segments
      .map((segment) => ({
        start: Number(segment?.start ?? 0),
        end: Number(segment?.end ?? 0),
        text: String(segment?.text ?? "").trim(),
      }))
      .filter((segment) => segment.text.length > 0);
  }, [result?.segments]);
  const translatedSegments = useMemo(() => {
    return buildSegmentTextLookup(result?.translationSegments);
  }, [result?.translationSegments]);
  const refinedSegments = useMemo(() => {
    return buildSegmentTextLookup(result?.refinedTranslationSegments);
  }, [result?.refinedTranslationSegments]);
  const sceneCaptures = useMemo(
    () => normalizeSceneCaptures(result?.metadata?.sceneCaptures),
    [result?.metadata?.sceneCaptures]
  );
  const displaySceneCaptures = useMemo(
    () => collapseConsecutiveARollSceneCaptures(sceneCaptures),
    [sceneCaptures]
  );
  const englishDetected = String(result?.language || "").toLowerCase().startsWith("en");
  const canSyncByPlayback = Boolean(result?.metadata?.videoUrl);
  const hasSegments = transcriptSegments.length > 0;
  const hasRefinedSegments = refinedSegments.byIndex.some((line) => line.length > 0);
  const isSubtitleMode = subtitleMode && hasSegments;
  const progressHint = useMemo(() => getProgressHint(elapsedSeconds), [elapsedSeconds]);
  const canShowVideoSubtitle = englishDetected && canSyncByPlayback && hasSegments;
  const reelSummaryLine = useMemo(
    () => String(result?.summaryLine || "").trim() || fallbackReelSummary(result),
    [result]
  );
  const analysisResult = result?.analysis || null;
  const analysisCriteria = Array.isArray(analysisResult?.criteria) ? analysisResult.criteria : [];
  const analysisChart = analysisResult?.chart || { passCount: 0, partialCount: 0, failCount: 0 };
  const analysisHookTemplate =
    analysisResult?.hookTemplate && typeof analysisResult.hookTemplate === "object"
      ? analysisResult.hookTemplate
      : null;
  const analysisReady = analysisCriteria.length > 0;
  const activeSegmentIndex = useMemo(() => {
    if (!hasSegments) return -1;
    return findActiveSegmentIndex(transcriptSegments, playerTime);
  }, [hasSegments, playerTime, transcriptSegments]);
  const activeSceneCaptureIndex = useMemo(
    () => findActiveSceneIndex(sceneCaptures, playerTime),
    [sceneCaptures, playerTime]
  );
  const activeDisplaySceneCaptureIndex = useMemo(
    () => findActiveSceneIndex(displaySceneCaptures, playerTime),
    [displaySceneCaptures, playerTime]
  );
  const activeRollLabel = useMemo(() => {
    if (activeSceneCaptureIndex < 0) return "";
    return sceneCaptures[activeSceneCaptureIndex]?.roll || "";
  }, [sceneCaptures, activeSceneCaptureIndex]);
  const videoSubtitleLine = useMemo(() => {
    if (!showVideoSubtitle) return "";
    if (activeSegmentIndex < 0) return "";
    const segment = transcriptSegments[activeSegmentIndex];
    if (!segment) return "";
    const refinedLine = showRefinedKorean ? getSegmentText(refinedSegments, segment, activeSegmentIndex) : "";
    const translatedLine = getSegmentText(translatedSegments, segment, activeSegmentIndex);
    if (refinedLine) return formatOverlaySubtitle(refinedLine);
    return formatOverlaySubtitle(translatedLine);
  }, [
    showVideoSubtitle,
    activeSegmentIndex,
    transcriptSegments,
    refinedSegments,
    translatedSegments,
    showRefinedKorean,
  ]);

  function findSegmentIndexForAnchor(anchor) {
    if (!anchor) return -1;
    const anchorStart = Number(anchor?.start);
    const anchorText = String(anchor?.text || "").trim();

    if (anchorText) {
      let bestIndex = -1;
      let bestScore = 0;
      for (let index = 0; index < transcriptSegments.length; index += 1) {
        const segment = transcriptSegments[index];
        const score = scoreTextMatch(anchorText, segment?.text || "");
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
      if (bestIndex >= 0 && bestScore >= 120) return bestIndex;
    }

    if (Number.isFinite(anchorStart)) {
      const byRange = transcriptSegments.findIndex(
        (segment) => anchorStart >= segment.start - 0.25 && anchorStart <= segment.end + 0.25
      );
      if (byRange >= 0) return byRange;

      const byStart = transcriptSegments.findIndex(
        (segment) => Math.abs(Number(segment.start) - anchorStart) <= 0.35
      );
      if (byStart >= 0) return byStart;
    }

    return -1;
  }

  function getAnchorKoreanLine(anchor) {
    const index = findSegmentIndexForAnchor(anchor);
    if (index < 0) return "";
    const segment = transcriptSegments[index];
    if (!segment) return "";
    const refined = getSegmentText(refinedSegments, segment, index);
    const translated = getSegmentText(translatedSegments, segment, index);
    if (showRefinedKorean) return refined || translated || "";
    return translated || refined || "";
  }

  const transcriptText = useMemo(() => {
    if (!result?.transcript) return "전사 결과가 비어 있습니다.";
    if (!showTimestamps || !hasSegments || isSubtitleMode) return result.transcript;

    return transcriptSegments
      .map((segment) => `[${formatTimestamp(segment.start)}] ${segment.text}`)
      .join("\n");
  }, [result?.transcript, showTimestamps, hasSegments, isSubtitleMode, transcriptSegments]);

  useEffect(() => {
    if (!loading) return;

    const startedAt = Date.now();
    setElapsedSeconds(0);
    setProgressPercent(8);

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(elapsed);

      setProgressPercent((previous) => {
        const target =
          elapsed < 3 ? 24 : elapsed < 8 ? 48 : elapsed < 15 ? 72 : elapsed < 25 ? 88 : 93;
        const next = previous + Math.max(0.8, (target - previous) * 0.2);
        return Math.min(93, next);
      });
    }, 250);

    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (!translatingKorean) return;

    setTranslationProgress(6);
    const timer = setInterval(() => {
      setTranslationProgress((previous) => {
        if (previous >= 93) return 93;
        const next = previous + Math.max(1, (93 - previous) * 0.18);
        return Math.min(93, next);
      });
    }, 220);

    return () => clearInterval(timer);
  }, [translatingKorean]);

  useEffect(() => {
    if (!refiningKorean) return;

    setRefineProgress(6);
    const timer = setInterval(() => {
      setRefineProgress((previous) => {
        if (previous >= 93) return 93;
        const next = previous + Math.max(1, (93 - previous) * 0.18);
        return Math.min(93, next);
      });
    }, 220);

    return () => clearInterval(timer);
  }, [refiningKorean]);

  useEffect(() => {
    if (!analyzingScript) return;

    setAnalysisProgress(8);
    const timer = setInterval(() => {
      setAnalysisProgress((previous) => {
        if (previous >= 93) return 93;
        const next = previous + Math.max(1, (93 - previous) * 0.16);
        return Math.min(93, next);
      });
    }, 240);

    return () => clearInterval(timer);
  }, [analyzingScript]);

  useEffect(() => {
    if (!followPlayback) return;
    if (activeSegmentIndex < 0) return;
    const target = segmentRefs.current[activeSegmentIndex];
    if (!target) return;
    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSegmentIndex, followPlayback]);

  useEffect(() => {
    setPlayerTime(0);
    setPlayerDuration(0);
    setIsPlaying(false);
    setIsMuted(false);
    setShowPlayerUi(true);
    setVideoPlaybackError(false);
    segmentRefs.current = [];
    setAnalysisDetailOpen({});
  }, [result?.reelId]);

  useEffect(() => {
    if (!archiveReelId) return;
    let cancelled = false;

    async function loadArchive() {
      setArchiveLoading(true);
      setError("");
      setStatus("아카이브 불러오는 중...");

      try {
        const response = await fetch(`/api/reels/archive/${archiveReelId}`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "아카이브 데이터를 불러오지 못했습니다.");
        }
        if (cancelled) return;

        setResult(payload);
        setUrl(`https://www.instagram.com/reel/${payload.reelId}/`);
        setShowKorean(
          Boolean(
            String(payload?.translation || "").trim() ||
              (Array.isArray(payload?.translationSegments) && payload.translationSegments.length > 0)
          )
        );
        setShowRefinedKorean(
          Boolean(
            String(payload?.refinedTranslation || "").trim() ||
              (Array.isArray(payload?.refinedTranslationSegments) &&
                payload.refinedTranslationSegments.length > 0)
          )
        );
        setStatus("아카이브 로드 완료");
      } catch (archiveError) {
        if (cancelled) return;
        setError(archiveError?.message || "아카이브 로딩 중 오류가 발생했습니다.");
        setStatus("실패");
      } finally {
        if (!cancelled) setArchiveLoading(false);
      }
    }

    void loadArchive();
    return () => {
      cancelled = true;
    };
  }, [archiveReelId]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = Boolean(isMuted);
  }, [isMuted]);

  useEffect(() => {
    return () => {
      if (playerUiTimerRef.current) {
        clearTimeout(playerUiTimerRef.current);
      }
    };
  }, []);

  function clearPlayerUiTimer() {
    if (!playerUiTimerRef.current) return;
    clearTimeout(playerUiTimerRef.current);
    playerUiTimerRef.current = null;
  }

  function hidePlayerUiSoon(delayMs = 950) {
    clearPlayerUiTimer();
    if (!isPlaying) return;
    playerUiTimerRef.current = setTimeout(() => {
      setShowPlayerUi(false);
    }, delayMs);
  }

  function showPlayerUiNow(keepVisible = false) {
    setShowPlayerUi(true);
    if (keepVisible || !isPlaying) {
      clearPlayerUiTimer();
      return;
    }
    hidePlayerUiSoon();
  }

  useEffect(() => {
    if (isPlaying) {
      hidePlayerUiSoon(1100);
      return;
    }
    clearPlayerUiTimer();
    setShowPlayerUi(true);
  }, [isPlaying]);

  function togglePlayPause() {
    const video = videoRef.current;
    if (!video) return;
    showPlayerUiNow(true);
    if (video.paused) {
      void video.play();
      return;
    }
    video.pause();
  }

  function handleTimelineSeek(nextTime) {
    const video = videoRef.current;
    if (!video) return;
    showPlayerUiNow(true);
    const parsed = clamp(Number(nextTime) || 0, 0, Number(video.duration || playerDuration || 0));
    video.currentTime = parsed;
    setPlayerTime(parsed);
  }

  async function handleCopyTranscript() {
    if (!result?.transcript) return;

    try {
      await navigator.clipboard.writeText(result.transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("클립보드 복사에 실패했습니다.");
    }
  }

  async function ensureKoreanTranslation(currentResult) {
    if (!currentResult) return null;
    if (currentResult.translation || (currentResult.translationSegments || []).length > 0) {
      return currentResult;
    }
    if (!String(currentResult.language || "").toLowerCase().startsWith("en")) {
      return currentResult;
    }

    setTranslatingKorean(true);
    try {
      const response = await fetch("/api/reels/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reelId: currentResult.reelId,
          transcriptHash: currentResult.transcriptHash,
          transcript: currentResult.transcript,
          language: currentResult.language,
          segments: currentResult.segments,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "한국어 번역 요청에 실패했습니다.");
      }

      const merged = {
        ...currentResult,
        translation: payload.translation || "",
        translationSegments: Array.isArray(payload.translationSegments)
          ? payload.translationSegments
          : [],
      };
      setResult(merged);
      setReviewSummary(payload.reviewSummary || null);
      setTranslationProgress(100);
      return merged;
    } finally {
      setTranslatingKorean(false);
      setTimeout(() => setTranslationProgress(0), 300);
    }
  }

  function handleSegmentClick(segmentStartSeconds) {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Number(segmentStartSeconds) || 0);
    }
    setPlayerTime(Math.max(0, Number(segmentStartSeconds) || 0));
  }

  async function ensureRefinedKorean(currentResult) {
    if (!currentResult) return null;
    if (
      currentResult.refinedTranslation ||
      (Array.isArray(currentResult.refinedTranslationSegments) &&
        currentResult.refinedTranslationSegments.length > 0)
    ) {
      return currentResult;
    }

    const hasBaseTranslation =
      currentResult.translation ||
      (Array.isArray(currentResult.translationSegments) &&
        currentResult.translationSegments.length > 0);
    if (!hasBaseTranslation) {
      throw new Error("먼저 한국어 번역을 생성해 주세요.");
    }

    setRefiningKorean(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 420000);
      const response = await fetch("/api/reels/refine-korean", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reelId: currentResult.reelId,
          transcriptHash: currentResult.transcriptHash,
          segments: currentResult.segments,
          translationSegments: currentResult.translationSegments,
          translation: currentResult.translation,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "문장 다듬기 요청에 실패했습니다.");
      }

      const merged = {
        ...currentResult,
        refinedTranslation: payload.refinedTranslation || "",
        refinedTranslationSegments: Array.isArray(payload.refinedSegments)
          ? payload.refinedSegments
          : [],
      };
      setResult(merged);
      setRefinedModel(payload.modelUsed || "");
      setRefineProgress(100);
      return merged;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("문장 다듬기 시간이 초과되었습니다. 다시 시도해 주세요.");
      }
      throw error;
    } finally {
      setRefiningKorean(false);
      setTimeout(() => setRefineProgress(0), 300);
    }
  }

  async function ensureScriptAnalysis(currentResult) {
    if (!currentResult) return null;
    const existingAnalysis = currentResult.analysis;
    const existingModelUsed = String(existingAnalysis?.modelUsed || "").toLowerCase();
    const existingVersion = Number(existingAnalysis?.analysisVersion || 0);
    if (
      existingAnalysis &&
      Array.isArray(existingAnalysis.criteria) &&
      existingVersion >= ANALYSIS_VERSION &&
      existingModelUsed &&
      existingModelUsed !== "fallback"
    ) {
      return currentResult;
    }
    if (!currentResult.transcript) {
      throw new Error("먼저 전사를 완료해 주세요.");
    }

    setAnalyzingScript(true);
    try {
      const response = await fetch("/api/reels/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: currentResult.transcript,
          language: currentResult.language,
          segments: currentResult.segments,
          metadata: currentResult.metadata,
          analysisVersion: ANALYSIS_VERSION,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "스크립트 분석에 실패했습니다.");
      }

      const merged = {
        ...currentResult,
        analysis: payload,
      };
      setResult(merged);
      setAnalysisProgress(100);
      return merged;
    } finally {
      setAnalyzingScript(false);
      setTimeout(() => setAnalysisProgress(0), 300);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!url.trim()) {
      setError("릴스 URL을 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setCopied(false);
    setShowKorean(false);
    setShowRefinedKorean(false);
    setShowVideoSubtitle(false);
    setRefinedModel("");
    setReviewSummary(null);
    setActiveScriptTab("transcript");
    setAnalysisProgress(0);
    setStatus("오디오 추출 및 AI 전사 진행 중...");

    try {
      const response = await fetch("/api/reels/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "요청 처리에 실패했습니다.");
      }

      setProgressPercent(100);
      setResult(payload);
      if (payload?.reviewSummary) {
        setReviewSummary(payload.reviewSummary);
      }
      if (String(payload?.language || "").toLowerCase().startsWith("en")) {
        setShowKorean(true);
        setSubtitleMode(true);
        try {
          setStatus("번역 다듬기 적용 중...");
          const withKorean = await ensureKoreanTranslation(payload);
          const refinedResult = await ensureRefinedKorean(withKorean);
          if (
            String(refinedResult?.refinedTranslation || "").trim() ||
            (Array.isArray(refinedResult?.refinedTranslationSegments) &&
              refinedResult.refinedTranslationSegments.length > 0)
          ) {
            setShowRefinedKorean(true);
          }
        } catch (refineOnSubmitError) {
          setError(refineOnSubmitError?.message || "자동 문장 다듬기 처리 중 오류가 발생했습니다.");
        }
      }
      if (payload?.translationError) {
        setError(payload.translationError);
      }
      setStatus("완료");
    } catch (submitError) {
      setProgressPercent(100);
      setResult(null);
      setStatus("실패");
      setError(submitError.message || "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleVideoSubtitle() {
    const next = !showVideoSubtitle;
    if (!next) {
      setShowVideoSubtitle(false);
      return;
    }

    if (!canShowVideoSubtitle) {
      setError("실시간 영상 자막은 영어 전사 + 직접 재생 가능한 영상에서만 사용할 수 있습니다.");
      return;
    }

    try {
      setError("");
      await ensureKoreanTranslation(result);
      if (hasRefinedSegments) {
        setShowRefinedKorean(true);
      }
      setShowVideoSubtitle(true);
    } catch (error) {
      setError(error?.message || "실시간 영상 자막 준비 중 오류가 발생했습니다.");
    }
  }

  return (
    <main className="page">
      <div className="mesh" aria-hidden="true" />

      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-wrap">
            <div className="brand">OpenArea</div>
            <div className="top-tabs">
              <Link href="/" className="top-tab active">
                전사
              </Link>
              <Link href="/archive" className="top-tab">
                아카이브
              </Link>
            </div>
          </div>
          <form className="topbar-input-wrap" onSubmit={handleSubmit}>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              spellCheck="false"
            />
            <button type="submit" disabled={loading}>
              {loading ? "처리 중..." : "전사 시작"}
            </button>
          </form>
        </div>
        <div className="status">
          <span className={`dot ${loading ? "working" : result ? "done" : "idle"}`} />
          {archiveLoading ? "아카이브 로딩 중..." : status}
        </div>
      </header>

      {loading ? (
        <p className="hero-loading top-progress">
          {progressHint} · {Math.floor(progressPercent)}% · {elapsedSeconds}초
        </p>
      ) : null}

      {error ? <p className="error top-error">{error}</p> : null}

      <section className="workspace">
        <article className="panel reel-panel">
          <div className="reel-head">
            <h2>릴스 미리보기</h2>
          </div>
          {result?.embedUrl || previewEmbedUrl ? (
            result?.metadata?.videoUrl && !videoPlaybackError ? (
              <>
                <div
                  className={`video-wrap ${showPlayerUi ? "ui-visible" : "ui-hidden"}`}
                  onPointerMove={() => showPlayerUiNow(false)}
                  onPointerDown={() => showPlayerUiNow(true)}
                  onPointerUp={() => hidePlayerUiSoon(820)}
                  onPointerLeave={() => hidePlayerUiSoon(520)}
                >
                  <video
                    ref={videoRef}
                    className="reel-video"
                    src={result.metadata.videoUrl}
                    playsInline
                    preload="metadata"
                    onPointerUp={togglePlayPause}
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      setVideoPlaybackError(false);
                      const duration = Number(video.duration || 0);
                      setPlayerDuration(Number.isFinite(duration) ? duration : 0);
                      setPlayerTime(Number(video.currentTime || 0));
                      setIsPlaying(!video.paused);
                      setIsMuted(Boolean(video.muted));
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onVolumeChange={(event) => setIsMuted(Boolean(event.currentTarget.muted))}
                    onTimeUpdate={(event) => setPlayerTime(event.currentTarget.currentTime || 0)}
                    onError={() => setVideoPlaybackError(true)}
                  />
                  {activeRollLabel ? (
                    <div
                      className={`video-roll-overlay ${activeRollLabel === "B-roll" ? "b-roll" : "a-roll"}`}
                    >
                      {activeRollLabel}
                    </div>
                  ) : null}
                  {showVideoSubtitle && videoSubtitleLine ? (
                    <div className="video-subtitle-overlay">
                      <p>{videoSubtitleLine}</p>
                    </div>
                  ) : null}
                  <div className="video-fade" aria-hidden="true" />
                  <div className="video-control-deck">
                    <div className="video-control-row">
                      <button
                        type="button"
                        className="video-control-button icon primary"
                        onClick={togglePlayPause}
                        title={isPlaying ? "일시정지" : "재생"}
                        aria-label={isPlaying ? "일시정지" : "재생"}
                      >
                        {isPlaying ? (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M8 6l10 6-10 6z" fill="currentColor" />
                          </svg>
                        )}
                      </button>
                      <span className="video-time-readout">
                        {formatDuration(playerTime)} / {formatDuration(playerDuration)}
                      </span>
                      <button
                        type="button"
                        className="video-control-button icon"
                        onClick={() => setIsMuted((previous) => !previous)}
                        title={isMuted ? "음소거 해제" : "음소거"}
                        aria-label={isMuted ? "음소거 해제" : "음소거"}
                      >
                        {isMuted ? (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 10v4h4l5 4V6l-5 4H4z" fill="currentColor" />
                            <path
                              d="M16 9l4 6M20 9l-4 6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 10v4h4l5 4V6l-5 4H4z" fill="currentColor" />
                            <path
                              d="M16 9c1.5 1.2 1.5 4.8 0 6M18.8 6.8c3.5 3 3.5 7.4 0 10.4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        className={`video-control-button icon ${showVideoSubtitle ? "active" : ""}`}
                        onClick={toggleVideoSubtitle}
                        disabled={translatingKorean || !canShowVideoSubtitle}
                        title={showVideoSubtitle ? "영상 자막 끄기" : "영상 자막 켜기"}
                        aria-label={showVideoSubtitle ? "영상 자막 끄기" : "영상 자막 켜기"}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect
                            x="3"
                            y="5"
                            width="18"
                            height="14"
                            rx="2.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <path
                            d="M7 11h10M7 14h6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                    <input
                      className="video-timeline-slider"
                      type="range"
                      min="0"
                      max={Math.max(playerDuration, 0.001)}
                      step="0.05"
                      value={Math.min(playerTime, Math.max(playerDuration, 0.001))}
                      onChange={(event) => handleTimelineSeek(event.target.value)}
                      aria-label="재생 위치"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <iframe
                  title="Instagram Reel"
                  src={`${result?.embedUrl || previewEmbedUrl}?utm_source=ig_embed&utm_campaign=loading`}
                  allowFullScreen
                />
                <p className="sync-note">
                  현재 임베드 모드에서는 재생 시간 감지가 제한되어 자동 강조가 동작하지 않을 수 있습니다.
                </p>
              </>
            )
          ) : (
            <p className="placeholder">유효한 릴스 링크를 입력하면 여기에 영상이 표시됩니다.</p>
          )}
          {result?.metadata ? (
                <div className="reel-info">
              <p className="reel-title">{result.metadata.title || "제목 정보 없음"}</p>
              <p className="reel-author">{result.metadata.uploader || "작성자 정보 없음"}</p>
              <div className="reel-stats">
                <div>
                  <span>좋아요</span>
                  <strong>{formatCount(result.metadata.likeCount)}</strong>
                </div>
                <div>
                  <span>댓글</span>
                  <strong>{formatCount(result.metadata.commentCount)}</strong>
                </div>
                <div>
                  <span>조회수</span>
                  <strong>{formatCount(result.metadata.viewCount, "집계 안됨")}</strong>
                </div>
                <div>
                  <span>업로드</span>
                  <strong>{formatUploadDate(result.metadata.uploadDate)}</strong>
                </div>
                <div className="reel-audio">
                  <span>배경음</span>
                  <strong>{formatBackgroundAudio(result.metadata.backgroundAudio)}</strong>
                </div>
              </div>
            </div>
          ) : null}
          {displaySceneCaptures.length > 0 ? (
            <div className="scene-captures-panel">
              <div className="scene-captures-head">
                <p>장면 전환 캡처</p>
                <span>{activeRollLabel || "-"}</span>
              </div>
              <div className="scene-captures-list">
                {displaySceneCaptures.map((scene, index) => (
                  <button
                    type="button"
                    key={`${scene.start}-${scene.imageUrl}-${index}`}
                    className={`scene-capture-card ${index === activeDisplaySceneCaptureIndex ? "active" : ""}`}
                    onClick={() => handleSegmentClick(scene.start)}
                    title={`${formatTimestamp(scene.start)} ${scene.roll}`}
                  >
                    <div className="scene-capture-image-wrap">
                      <img src={scene.imageUrl} alt={`장면 캡처 ${formatTimestamp(scene.start)}`} loading="lazy" />
                      <span className={`scene-roll-badge ${scene.roll === "B-roll" ? "b-roll" : "a-roll"}`}>
                        {scene.roll}
                      </span>
                    </div>
                    <span className="scene-capture-time">{formatTimestamp(scene.start)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <article className="panel script-panel">
          <h2>대본</h2>
          {result ? (
            activeScriptTab === "transcript" ? (
              <>
                <div className="text-block">
                  <div className="text-head">
                    <h3>전사본</h3>
                    <div className="view-controls">
                      <button
                        type="button"
                        className={`control-icon-button ${showTimestamps ? "active" : ""}`}
                        onClick={() => setShowTimestamps((previous) => !previous)}
                        title={`시간대 표시 ${showTimestamps ? "끄기" : "켜기"}`}
                        aria-label={`시간대 표시 ${showTimestamps ? "끄기" : "켜기"}`}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <circle
                            cx="12"
                            cy="12"
                            r="8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <path
                            d="M12 8v4l2.5 1.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`control-icon-button ${isSubtitleMode ? "active" : ""}`}
                        onClick={() => setSubtitleMode((previous) => !previous)}
                        disabled={!hasSegments}
                        title={`자막 단위 보기 ${isSubtitleMode ? "끄기" : "켜기"}`}
                        aria-label={`자막 단위 보기 ${isSubtitleMode ? "끄기" : "켜기"}`}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect
                            x="4"
                            y="5"
                            width="16"
                            height="14"
                            rx="2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <path
                            d="M7 10h10M7 14h10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`control-icon-button ${followPlayback ? "active" : ""}`}
                        onClick={() => setFollowPlayback((previous) => !previous)}
                        disabled={!canSyncByPlayback}
                        title={`재생 따라가기 ${followPlayback ? "끄기" : "켜기"}`}
                        aria-label={`재생 따라가기 ${followPlayback ? "끄기" : "켜기"}`}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <circle
                            cx="12"
                            cy="12"
                            r="7"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <circle cx="12" cy="12" r="2" fill="currentColor" />
                        </svg>
                      </button>
                      {englishDetected ? (
                        <>
                          <button
                            type="button"
                            className={`control-icon-button ${showKorean ? "active" : ""} ${translatingKorean ? "loading" : ""}`}
                            onClick={async () => {
                              const next = !showKorean;
                              if (next) {
                                setSubtitleMode(true);
                                try {
                                  setError("");
                                  await ensureKoreanTranslation(result);
                                  setShowKorean(true);
                                } catch (translationError) {
                                  setError(
                                    translationError?.message || "한국어 번역 처리 중 오류가 발생했습니다."
                                  );
                                }
                                return;
                              }
                              setShowKorean(false);
                              setShowRefinedKorean(false);
                            }}
                            disabled={translatingKorean}
                            title={translatingKorean ? "한국어 번역 로딩 중" : `한국어 표시 ${showKorean ? "끄기" : "켜기"}`}
                            aria-label={translatingKorean ? "한국어 번역 로딩 중" : `한국어 표시 ${showKorean ? "끄기" : "켜기"}`}
                          >
                            {translatingKorean ? (
                              <svg className="spin" viewBox="0 0 24 24" aria-hidden="true">
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="8"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeDasharray="30 22"
                                />
                              </svg>
                            ) : (
                              <span className="control-icon-korean">한</span>
                            )}
                          </button>
                          <button
                            type="button"
                            className={`control-icon-button ${showRefinedKorean ? "active" : ""} ${refiningKorean ? "loading" : ""}`}
                            onClick={async () => {
                              const next = !showRefinedKorean;
                              if (next) {
                                try {
                                  setError("");
                                  setSubtitleMode(true);
                                  let currentResult = result;
                                  if (!showKorean) {
                                    currentResult = await ensureKoreanTranslation(currentResult);
                                    setShowKorean(true);
                                  }
                                  await ensureRefinedKorean(currentResult);
                                  setShowRefinedKorean(true);
                                } catch (refineError) {
                                  setError(
                                    refineError?.message || "문장 다듬기 처리 중 오류가 발생했습니다."
                                  );
                                }
                                return;
                              }
                              setShowRefinedKorean(false);
                            }}
                            disabled={translatingKorean || refiningKorean}
                            title={
                              refiningKorean
                                ? "릴스 톤 다듬기 로딩 중"
                                : `릴스 톤 다듬기 ${showRefinedKorean ? "끄기" : "켜기"}`
                            }
                            aria-label={
                              refiningKorean
                                ? "릴스 톤 다듬기 로딩 중"
                                : `릴스 톤 다듬기 ${showRefinedKorean ? "끄기" : "켜기"}`
                            }
                          >
                            {refiningKorean ? (
                              <svg className="spin" viewBox="0 0 24 24" aria-hidden="true">
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="8"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeDasharray="30 22"
                                />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M12 4l1.7 3.7L18 9.2l-3.1 2.7.9 4.1L12 13.9 8.2 16l.9-4.1L6 9.2l4.3-1.5L12 4z"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </button>
                        </>
                      ) : (
                        <button type="button" className="control-icon-button" disabled title="영어 영상에서만 한국어 번역 가능">
                          <span className="control-icon-korean">한</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className={`icon-button ${copied ? "copied" : ""}`}
                        onClick={handleCopyTranscript}
                        title={copied ? "복사됨" : "대본 전체 복사"}
                        aria-label="대본 전체 복사"
                      >
                        {copied ? (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M20 7L9 18l-5-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <rect
                              x="9"
                              y="9"
                              width="11"
                              height="11"
                              rx="2"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                            <path
                              d="M5 15V5a2 2 0 012-2h10"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  {isSubtitleMode ? (
                    <ul className="segment-list">
                      {transcriptSegments.map((segment, index) => {
                        const translatedLine = getSegmentText(translatedSegments, segment, index);
                        const refinedLine = getSegmentText(refinedSegments, segment, index);

                        return (
                          <li
                            key={`${segment.start}-${segment.end}-${index}`}
                            ref={(element) => {
                              segmentRefs.current[index] = element;
                            }}
                            className={index === activeSegmentIndex ? "active" : ""}
                            onClick={() => handleSegmentClick(segment.start)}
                          >
                            {showTimestamps ? (
                              <span className="time-tag">{formatTimestamp(segment.start)}</span>
                            ) : null}
                            <div className="segment-content">
                              <span>{segment.text}</span>
                              {showKorean && translatedLine ? (
                                <p className="segment-translation">{translatedLine}</p>
                              ) : null}
                              {showRefinedKorean && refinedLine ? (
                                <p className="segment-refined">{refinedLine}</p>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="plain-transcript">{transcriptText}</p>
                  )}

                  {showKorean && result.translation && !isSubtitleMode ? (
                    <div className="inline-translation">
                      <h4>한국어 번역</h4>
                      <p>{result.translation}</p>
                    </div>
                  ) : null}
                  {showRefinedKorean && result.refinedTranslation && !isSubtitleMode ? (
                    <div className="inline-translation refined-block">
                      <h4>릴스 톤 다듬기</h4>
                      <p>{result.refinedTranslation}</p>
                    </div>
                  ) : null}

                  {reelSummaryLine ? (
                    <div className="script-summary">
                      <h4>이 릴스 한줄 요약 (GPT-5)</h4>
                      <p>{reelSummaryLine}</p>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="meta">
                  <span>분석 모델: {analysisResult?.modelUsed || "대기"}</span>
                  {analyzingScript ? <span>분석 처리 중</span> : null}
                  {analysisResult?.generatedAt ? (
                    <span>{new Date(analysisResult.generatedAt).toLocaleString("ko-KR")}</span>
                  ) : null}
                </div>
                <div className="analysis-panel">
                  {!analysisReady && !analyzingScript ? (
                    <div className="analysis-placeholder">
                      <p>분석 데이터가 아직 없습니다.</p>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setError("");
                            await ensureScriptAnalysis(result);
                          } catch (analysisError) {
                            setError(analysisError?.message || "분석 처리 중 오류가 발생했습니다.");
                          }
                        }}
                      >
                        분석 시작
                      </button>
                    </div>
                  ) : null}
                  {analysisReady ? (
                    <>
                      <div className="analysis-summary-card">
                        <div className="analysis-summary-head">
                          <h3>릴스 구조 분석 요약</h3>
                          <strong>{analysisChart.passCount}개 체크</strong>
                        </div>
                        <p className="analysis-summary-text">{analysisResult.summary}</p>
                        {analysisHookTemplate ? (
                          <div
                            className={`analysis-hook-template ${analysisHookTemplate.matched ? "matched" : "unmatched"}`}
                          >
                            <p className="analysis-hook-template-title">
                              {analysisHookTemplate.matched
                                ? "초반 3초 Hook 템플릿 매칭"
                                : "초반 3초 Hook 형식 추정"}
                            </p>
                            <p className="analysis-hook-template-body">
                              {analysisHookTemplate.matched
                                ? analysisHookTemplate.template
                                : analysisHookTemplate.inferredFormat || "형식 추정 불가"}
                            </p>
                            {analysisHookTemplate.hookText ? (
                              <p className="analysis-hook-template-text">{analysisHookTemplate.hookText}</p>
                            ) : null}
                            {analysisHookTemplate.note ? (
                              <p className="analysis-hook-template-note">{analysisHookTemplate.note}</p>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="analysis-check-chart" aria-hidden="true">
                          <div className="analysis-check-col">
                            <span className="analysis-check-num">{analysisChart.passCount}</span>
                            <p>통과</p>
                          </div>
                          <div className="analysis-check-col">
                            <span className="analysis-check-num">{analysisChart.partialCount}</span>
                            <p>보완</p>
                          </div>
                          <div className="analysis-check-col">
                            <span className="analysis-check-num">{analysisChart.failCount}</span>
                            <p>미흡</p>
                          </div>
                        </div>
                      </div>

                      <ul className="analysis-list">
                        {analysisCriteria.map((criterion, index) => {
                          const compact = index >= 4;
                          const isOpen = Boolean(analysisDetailOpen[criterion.id]);
                          const displayAnchors = Array.isArray(criterion.anchors)
                            ? criterion.anchors
                                .filter(Boolean)
                                .slice(0, 6)
                                .filter((anchor, anchorIndex, anchors) => {
                                  const key = `${Number(anchor?.start ?? 0).toFixed(3)}-${Number(anchor?.end ?? 0).toFixed(3)}-${String(anchor?.text || "").trim()}`;
                                  return (
                                    anchors.findIndex((candidate) => {
                                      const candidateKey = `${Number(candidate?.start ?? 0).toFixed(3)}-${Number(candidate?.end ?? 0).toFixed(3)}-${String(candidate?.text || "").trim()}`;
                                      return candidateKey === key;
                                    }) === anchorIndex
                                  );
                                })
                            : [];
                          const evidenceText = stripAnalysisEvidence(criterion.evidence);
                          return (
                            <li key={criterion.id} className={`analysis-item ${compact ? "compact" : ""}`}>
                              <div className="analysis-item-top">
                                <h4>{criterion.label}</h4>
                                <div className="analysis-compact-actions">
                                  <span className={`analysis-check ${criterion.judgement}`}>
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path
                                        d="M20 7L9 18l-5-5"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </span>
                                  {compact ? (
                                    <button
                                      type="button"
                                      className="analysis-detail-toggle"
                                      onClick={() =>
                                        setAnalysisDetailOpen((previous) => ({
                                          ...previous,
                                          [criterion.id]: !previous[criterion.id],
                                        }))
                                      }
                                    >
                                      {isOpen ? "닫기" : "자세히 보기"}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              {!compact || isOpen ? (
                                <>
                                  <p className="analysis-evidence">판단 이유: {evidenceText || criterion.evidence}</p>
                                  {displayAnchors.length > 0 ? (
                                    <div className="analysis-anchors">
                                      {displayAnchors.map((anchor, anchorIndex) => {
                                        const koreanAnchorLine = getAnchorKoreanLine(anchor);
                                        return (
                                          <div
                                            key={`${criterion.id}-${Number(anchor?.start ?? 0)}-${anchorIndex}`}
                                            className="analysis-anchor-item"
                                          >
                                            <span className="analysis-anchor-time">
                                              {formatTimestamp(Number(anchor?.start ?? 0))}
                                            </span>
                                            <div className="analysis-anchor-copy">
                                              <p className="analysis-anchor-text">{String(anchor?.text || "").trim()}</p>
                                              {koreanAnchorLine ? (
                                                <p className="analysis-anchor-translation">{koreanAnchorLine}</p>
                                              ) : null}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : null}
                  {analyzingScript ? (
                    <div className="analysis-progress">
                      <div className="analysis-progress-track">
                        <div
                          className="analysis-progress-fill"
                          style={{ width: `${analysisProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                  <p className="analysis-note">
                    오디오 말투 평가는 타임라인과 표현 패턴 기반 추정치입니다.
                  </p>
                </div>
              </>
            )
          ) : (
            <p className="placeholder">전사 시작 버튼을 누르면 결과가 여기 표시됩니다.</p>
          )}
        </article>
      </section>
    </main>
  );
}
