import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANALYSIS_VERSION = 8;
const HOOK_WINDOW_SECONDS = 3;
const MAX_ANCHORS = 6;

const CRITERIA = [
  {
    id: "hook_15_words_1_5s",
    label: "초반 3초/15단어 내 공감·고통 훅",
    check: "초반 3초 안에서 15단어 내외로 공감/고통 훅을 제시했는가",
    hookOnly: true,
  },
  {
    id: "hook_you_fear_shame",
    label: "훅에 '너/나/우리' + 보편적 두려움/수치심",
    check: "초반 훅에서 너/나/우리/you/we/I 같은 대명사와 보편적 두려움/수치심을 다뤘는가",
    hookOnly: true,
  },
  {
    id: "background_specific_2_4",
    label: "배경의 구체성(시간·장소·숫자) 2-4문장",
    check: "시간/장소/숫자 같은 구체 정보가 2-4문장 안에 들어갔는가",
    hookOnly: false,
  },
  {
    id: "lesson_result_not_preachy",
    label: "교훈 + 가시적 결과/증거 + 비설교톤",
    check: "교훈을 주되 설교조가 아니고 결과/증거를 제시했는가",
    hookOnly: false,
  },
  {
    id: "cta_subtle_connected",
    label: "CTA 자연스러움/마지막 문장 연결",
    check: "CTA가 있다면 마지막 흐름과 자연스럽게 이어지는가",
    hookOnly: false,
  },
  {
    id: "friend_complaining_tone_audio",
    label: "친한 친구의 불평 섞인 말투(오디오 추정)",
    check: "친한 친구가 털어놓듯 말하는 불평 톤이 느껴지는가(전사+타이밍 기반 추정)",
    hookOnly: false,
  },
  {
    id: "short_punchy_repetition",
    label: "짧고 강렬 + 반복 활용",
    check: "짧고 강한 문장을 선호하고 필요한 반복을 활용하는가",
    hookOnly: false,
  },
  {
    id: "three_act_structure",
    label: "3막 구조(도입-클라이맥스-결말)",
    check: "도입-클라이맥스-결말의 3막 흐름이 보이는가",
    hookOnly: false,
  },
  {
    id: "self_deprecating_or_slang",
    label: "긴장 완화용 자기비하/속어",
    check: "긴장 완화를 위한 자기비하/속어 사용이 있는가",
    hookOnly: false,
  },
];

const HOOK_PRONOUN_PATTERN =
  /\b(i|me|my|mine|we|our|us|you|your)\b|나|나는|내가|내|저|저는|제가|우리|너|너는|네가/i;
const HOOK_FEAR_SHAME_PATTERN =
  /fear|afraid|scared|anxious|panic|shame|ashamed|embarrass|guilt|lonely|behind|rejected|failure|worthless|두려|불안|수치|창피|민망|죄책|외롭|뒤처|실패|거절|초조|부끄|불명예/i;
const HOOK_EMPATHY_PAIN_PATTERN =
  /hard|tough|struggle|pain|hurt|stuck|lost|broke|failure|problem|pressure|stress|meaning of life|late-bloom|mess|can't|couldn't|didn't|worried|anxiety|힘들|고통|아프|막막|버겁|망했|실패|압박|불안|걱정|외롭|뒤처|의미/i;
const HOOK_VULNERABLE_OPEN_PATTERN =
  /\b(i thought|i was|i used to|i felt|i couldn't|i didn't|i had to|i lost|i failed)\b|나는|내가|저는|제가|한때|예전|처음엔|생각했|못했/i;
const SELF_DEPRECATING_SLANG_PATTERN =
  /stupid|idiot|dumb|loser|awkward|cringe|trash|suck|moron|pathetic|bro|damn|lol|lmao|바보|멍청|허접|망했|쪽팔|민망|흑역사|찐따|ㅋㅋ|ㅜㅜ|ㅠㅠ/i;
const THREE_ACT_TRANSITION_PATTERN =
  /but|however|then|until|finally|so|because|그래서|하지만|그런데|결국|이후|마침내/i;

const HOOK_TEMPLATE_PATTERNS = [
  {
    template: "Here’s exactly how to [outcome]. [solution].",
    regex: /^here['’]?s exactly how to\b/i,
  },
  {
    template: "Here’s exactly how you’re gonna [outcome].",
    regex: /^here['’]?s exactly how you['’]?re (gonna|going to)\b/i,
  },
  {
    template: "Here’s the exact 3 step process to [outcome].",
    regex: /^here['’]?s the exact \d+\s*step process to\b/i,
  },
  {
    template: "Here’s the only method/way/strategy/hack that will let you [outcome].",
    regex: /^here['’]?s the only (method|way|strategy|hack)\b/i,
  },
  {
    template: "Wanna know why most people never [outcome]?",
    regex: /^wanna know why most people never\b/i,
  },
  {
    template: "In 60 seconds I’m going to prove/show [outcome].",
    regex: /^in 60 seconds\b/i,
  },
  {
    template: "I’m gonna show/teach you exactly how to [outcome].",
    regex: /^i['’]?m gonna (show|teach) you exactly how to\b/i,
  },
  {
    template: "Here’s the story of how I [personal outcome].",
    regex: /^here['’]?s the story of how i\b/i,
  },
  {
    template: "A lot of people who wanna [outcome] fail because [reason].",
    regex: /^a lot of people who wanna\b/i,
  },
  {
    template: "Here’s how to stop [opposite of outcome].",
    regex: /^here['’]?s how to stop\b/i,
  },
  {
    template: "If you wanna [outcome], here’s [checklist/process].",
    regex: /^if you wanna\b/i,
  },
  {
    template: "You ever see people who [outcome] ...?",
    regex: /^you ever see people\b/i,
  },
  {
    template: "Today, we’re gonna be talking about [outcome].",
    regex: /^today,\s*we['’]?re gonna be talking about\b/i,
  },
  {
    template: "3/4/5 steps(or ways/things/rules) for [outcome].",
    regex: /^\d+\s*(steps?|ways?|things?|rules?|principles?)\b/i,
  },
  {
    template: "If I was young again ... this is how I’d do it.",
    regex: /^if i was (young again|you)\b/i,
  },
];

function cleanText(value) {
  return String(value || "").trim();
}

function hasHangul(text) {
  return /[가-힣]/.test(cleanText(text));
}

function normalizeSegments(segments) {
  if (!Array.isArray(segments)) return [];
  return segments
    .map((segment) => ({
      start: Number(segment?.start ?? 0),
      end: Number(segment?.end ?? 0),
      text: cleanText(segment?.text),
    }))
    .filter((segment) => segment.text.length > 0);
}

function countWords(text) {
  return cleanText(text).split(/\s+/).filter(Boolean).length;
}

function normalizeJudgement(value) {
  const normalized = cleanText(value).toLowerCase();
  if (
    normalized === "yes" ||
    normalized === "pass" ||
    normalized === "true" ||
    normalized === "통과" ||
    normalized === "적합"
  ) {
    return "yes";
  }
  if (
    normalized === "no" ||
    normalized === "fail" ||
    normalized === "false" ||
    normalized === "미흡" ||
    normalized === "부적합"
  ) {
    return "no";
  }
  return "partial";
}

function judgementScore(judgement) {
  if (judgement === "yes") return 85;
  if (judgement === "partial") return 55;
  return 25;
}

function buildChart(criteria) {
  const passCount = criteria.filter((item) => item.judgement === "yes").length;
  const partialCount = criteria.filter((item) => item.judgement === "partial").length;
  const failCount = criteria.filter((item) => item.judgement === "no").length;
  return { passCount, partialCount, failCount };
}

function formatAnchorTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const remain = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
}

function normalizeComparableText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTextMatch(anchorText, segmentText) {
  const left = normalizeComparableText(anchorText);
  const right = normalizeComparableText(segmentText);
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

function findBestSegmentByText(anchorText, segments) {
  if (!anchorText) return null;
  let best = null;

  for (const segment of segments) {
    const score = scoreTextMatch(anchorText, segment.text);
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { score, segment };
    }
  }

  if (!best || best.score < 120) return null;
  return best.segment;
}

function dedupeAnchors(anchors) {
  const deduped = [];
  const seen = new Set();

  for (const anchor of anchors) {
    const key = `${Number(anchor.start).toFixed(3)}-${Number(anchor.end).toFixed(3)}-${anchor.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(anchor);
  }

  return deduped;
}

function normalizeAnchorItem(anchor, segments) {
  const text = cleanText(anchor?.text);
  const modelStart = Number(anchor?.start);
  const modelEnd = Number(anchor?.end);

  const matchedByText = findBestSegmentByText(text, segments);
  if (matchedByText) {
    return {
      start: matchedByText.start,
      end: matchedByText.end,
      text: matchedByText.text,
    };
  }

  if (!Number.isFinite(modelStart) || !Number.isFinite(modelEnd) || !text) return null;

  return {
    start: modelStart,
    end: modelEnd,
    text,
  };
}

function filterHookAnchors(anchors) {
  return anchors.filter((anchor) => Number(anchor.start) <= HOOK_WINDOW_SECONDS + 0.05);
}

function normalizeAnchors(rawAnchors, segments, hookOnly) {
  if (!Array.isArray(rawAnchors)) return [];

  const normalized = rawAnchors
    .map((anchor) => normalizeAnchorItem(anchor, segments))
    .filter(Boolean)
    .slice(0, MAX_ANCHORS * 2);

  const scoped = hookOnly ? filterHookAnchors(normalized) : normalized;
  return dedupeAnchors(scoped).slice(0, MAX_ANCHORS);
}

function pickHeuristicAnchors(criterionId, segments, hookOnly) {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const earlySegments = segments.filter((segment) => segment.start <= HOOK_WINDOW_SECONDS);
  const pronounPattern = /\b(you|your|we|our|i|my|me)\b|너|나|우리/i;
  const fearPattern = /fear|afraid|shame|embarrass|scared|anxious|두려|불안|수치|창피/i;
  const backgroundPattern = /\d|month|year|day|today|yesterday|home|office|school|city|오전|오후|월|년|일|시|분|달|살|만원|달러|조회/i;
  const lessonPattern = /learn|realize|lesson|result|proof|evidence|worked|교훈|결과|증거|깨달/i;
  const ctaPattern = /(follow|subscribe|comment|dm|link in bio|save|share|팔로우|댓글|디엠|공유|저장|링크)/i;
  const slangPattern = /stupid|awkward|cringe|idiot|dumb|lol|bro|damn|바보|민망|허접|망함|ㅋㅋ/i;

  const pick = (predicate, fallback, size = 3) => {
    const matched = segments.filter(predicate).slice(0, size);
    if (matched.length > 0) return matched;
    return fallback.slice(0, size);
  };

  let selected = [];

  switch (criterionId) {
    case "hook_15_words_1_5s":
      selected = earlySegments.slice(0, 3);
      break;
    case "hook_you_fear_shame":
      selected = pick(
        (segment) => segment.start <= HOOK_WINDOW_SECONDS && (pronounPattern.test(segment.text) || fearPattern.test(segment.text)),
        earlySegments,
        3
      );
      break;
    case "background_specific_2_4":
      selected = pick((segment) => backgroundPattern.test(segment.text), segments, 3);
      break;
    case "lesson_result_not_preachy":
      selected = pick((segment) => lessonPattern.test(segment.text), segments, 3);
      break;
    case "cta_subtle_connected":
      selected = pick((segment) => ctaPattern.test(segment.text), segments, 2);
      break;
    case "friend_complaining_tone_audio":
      selected = segments.filter((segment) => segment.text.length <= 90).slice(0, 3);
      break;
    case "short_punchy_repetition":
      selected = segments.filter((segment) => countWords(segment.text) <= 8).slice(0, 3);
      break;
    case "three_act_structure": {
      const middle = segments[Math.floor(segments.length / 2)];
      selected = [segments[0], middle, segments[segments.length - 1]].filter(Boolean);
      break;
    }
    case "self_deprecating_or_slang":
      selected = pick((segment) => slangPattern.test(segment.text), segments, 3);
      break;
    default:
      selected = segments.slice(0, 2);
      break;
  }

  const anchors = dedupeAnchors(
    selected.map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text,
    }))
  );

  const scoped = hookOnly ? filterHookAnchors(anchors) : anchors;
  return scoped.slice(0, MAX_ANCHORS);
}

function getHookSegments(segments) {
  return (Array.isArray(segments) ? segments : []).filter(
    (segment) => Number(segment.start) <= HOOK_WINDOW_SECONDS + 0.05
  );
}

function inferHookFormat(hookText) {
  const text = cleanText(hookText);
  if (!text) return "훅 텍스트 없음";

  if (/^\d+\s*(steps?|ways?|things?|rules?|principles?)\b/i.test(text)) {
    return "리스트형(숫자 나열)";
  }
  if (/\?$/.test(text) || /^you ever|^wanna know why|^does /i.test(text)) {
    return "질문형";
  }
  if (/years? ago|months? ago|when i|i was|i thought|예전|한때|처음엔|나는|내가/i.test(text)) {
    return "개인 스토리/회고형";
  }
  if (/^here['’]?s|^this is|^if you|^i['’]?m gonna|how to\b/i.test(text)) {
    return "가이드/해결책 제시형";
  }
  return "경험 공유형";
}

function detectHookTemplate(segments) {
  const hookSegments = getHookSegments(segments);
  const hookText = hookSegments.map((segment) => cleanText(segment.text)).join(" ").trim();
  const normalizedHook = hookText.replace(/\s+/g, " ").trim();

  if (!normalizedHook) {
    return {
      matched: false,
      template: "",
      inferredFormat: "훅 텍스트 없음",
      hookText: "",
      note: "초반 3초에 분석 가능한 문장이 없습니다.",
    };
  }

  for (const pattern of HOOK_TEMPLATE_PATTERNS) {
    if (pattern.regex.test(normalizedHook)) {
      return {
        matched: true,
        template: pattern.template,
        inferredFormat: "",
        hookText: normalizedHook,
        note: "제공된 훅 양식 목록과 매칭되었습니다.",
      };
    }
  }

  return {
    matched: false,
    template: "",
    inferredFormat: inferHookFormat(normalizedHook),
    hookText: normalizedHook,
    note: "제공된 양식과 정확히 일치하지 않아 실제 훅 유형을 추정했습니다.",
  };
}

function buildHookSignals(segments) {
  const hookSegments = getHookSegments(segments);
  const hookText = hookSegments.map((segment) => cleanText(segment.text)).join(" ").trim();
  const firstWords = cleanText(hookText)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 15)
    .join(" ");

  return {
    hookSegments,
    hookText,
    hasHookText: hookText.length > 0,
    hasPronoun: HOOK_PRONOUN_PATTERN.test(hookText),
    hasFearShame: HOOK_FEAR_SHAME_PATTERN.test(hookText),
    hasEmpathyPain: HOOK_EMPATHY_PAIN_PATTERN.test(hookText),
    hasVulnerableOpen: HOOK_VULNERABLE_OPEN_PATTERN.test(hookText),
    firstWordCount: countWords(firstWords),
  };
}

function pickHookAnchorsByPattern(segments, pattern, fallbackLimit = 3) {
  const hookSegments = getHookSegments(segments);
  const matched = hookSegments.filter((segment) => pattern.test(cleanText(segment.text)));
  const source = matched.length > 0 ? matched : hookSegments;
  return dedupeAnchors(
    source.slice(0, fallbackLimit).map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text,
    }))
  );
}

function buildHookEmpathyEvidence(judgement) {
  if (judgement === "yes") {
    return "초반 3초에서 개인 경험 기반의 감정 문장이 바로 등장해 공감·고통 훅이 명확합니다. 시청자가 자기 이야기처럼 받아들일 수 있는 도입이라 후속 전개로 자연스럽게 연결됩니다.";
  }
  if (judgement === "partial") {
    return "초반 3초에 훅 형태는 존재하지만 감정 강도나 문제의식이 다소 약해 임팩트가 제한적입니다. 첫 문장에서 공감 포인트를 더 선명하게 제시하면 몰입도가 높아집니다.";
  }
  return "초반 3초 구간에 문장은 있으나 공감·고통을 직접적으로 건드리는 훅이 충분히 강하지 않습니다. 도입 문장에 감정 갈등이나 문제상황을 더 또렷하게 배치할 필요가 있습니다.";
}

function buildHookPronounEvidence(judgement, hasPronoun, hasFearShame) {
  if (judgement === "yes") {
    return "초반 훅에서 '너/나/우리' 계열 대명사를 통해 자기화 지점을 만들었고, 두려움/수치심 정서도 함께 드러납니다. 개인 서사가 보편 감정으로 확장되어 공감 연결이 잘 형성됩니다.";
  }
  if (judgement === "partial") {
    if (hasPronoun && !hasFearShame) {
      return "초반 훅에서 '너/나/우리' 계열 대명사는 확인되지만, 보편적 두려움/수치심 표현은 약한 편입니다. 공감의 입구는 열려 있으나 감정 자극 강도는 보완이 필요합니다.";
    }
    if (!hasPronoun && hasFearShame) {
      return "두려움/수치심 정서는 감지되지만 청자를 자기 이야기로 끌어들이는 대명사 사용이 부족합니다. 대명사와 감정요소를 함께 배치하면 훅 설득력이 더 올라갑니다.";
    }
  }
  return "초반 훅에서 '너/나/우리' 계열 대명사와 보편적 두려움/수치심이 동시에 확인되지 않습니다. 대명사와 감정 트리거를 함께 넣어 자기화 포인트를 강화하는 편이 좋습니다.";
}

function snippet(text, limit = 56) {
  const raw = cleanText(text).replace(/\s+/g, " ");
  if (raw.length <= limit) return raw;
  return `${raw.slice(0, limit)}...`;
}

function intensityScore(segmentText) {
  const text = cleanText(segmentText);
  if (!text) return 0;
  let score = Math.min(12, countWords(text));
  if (/[!?]/.test(text)) score += 3;
  if (THREE_ACT_TRANSITION_PATTERN.test(text)) score += 2;
  if (HOOK_EMPATHY_PAIN_PATTERN.test(text)) score += 2;
  return score;
}

function pickClimaxSegment(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  if (segments.length <= 2) return segments[Math.floor(segments.length / 2)];

  const start = Math.floor(segments.length * 0.35);
  const end = Math.max(start + 1, Math.floor(segments.length * 0.75));
  const pool = segments.slice(start, end + 1);
  if (pool.length === 0) return segments[Math.floor(segments.length / 2)];

  let best = pool[0];
  let bestScore = intensityScore(best.text);
  for (const segment of pool.slice(1)) {
    const score = intensityScore(segment.text);
    if (score > bestScore) {
      best = segment;
      bestScore = score;
    }
  }

  return best;
}

function buildThreeActEvidence(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return "도입에서 상황 제시, 중반 전환, 결말 정리의 3막 구조를 확인하기 어려운 데이터입니다. 스크립트 전체 길이가 충분할 때 구조 판단 정확도가 높아집니다.";
  }

  const intro = segments[0];
  const climax = pickClimaxSegment(segments) || segments[Math.floor(segments.length / 2)] || intro;
  const ending = segments[segments.length - 1] || climax || intro;

  return `도입: "${snippet(intro?.text)}"로 화자의 출발 상황을 제시합니다. 클라이맥스: "${snippet(climax?.text)}"에서 긴장이나 관점 전환이 강조됩니다. 결말: "${snippet(ending?.text)}"로 메시지를 정리하며 마무리됩니다.`;
}

function scoreSlangAnchorText(text) {
  const raw = cleanText(text);
  if (!raw) return 0;

  let score = 0;
  const strongMatches =
    raw.match(
      /stupid|idiot|dumb|loser|awkward|cringe|trash|suck|moron|pathetic|바보|멍청|허접|망했|쪽팔|민망|흑역사|찐따/gi
    ) || [];
  score += strongMatches.length * 4;

  const softMatches = raw.match(/bro|damn|lol|lmao|ㅋㅋ|ㅜㅜ|ㅠㅠ/gi) || [];
  score += softMatches.length * 2;

  if (SELF_DEPRECATING_SLANG_PATTERN.test(raw)) score += 2;
  return score;
}

function chooseRepresentativeSlangAnchor(existingAnchors, segments) {
  const candidateAnchors = dedupeAnchors([
    ...(Array.isArray(existingAnchors) ? existingAnchors : []),
    ...pickHeuristicAnchors("self_deprecating_or_slang", segments, false),
  ]).slice(0, MAX_ANCHORS);

  if (candidateAnchors.length === 0) {
    return { anchor: null, score: 0 };
  }

  let best = candidateAnchors[0];
  let bestScore = scoreSlangAnchorText(best.text);

  for (const anchor of candidateAnchors.slice(1)) {
    const score = scoreSlangAnchorText(anchor.text);
    if (score > bestScore) {
      best = anchor;
      bestScore = score;
      continue;
    }
    if (score === bestScore && Number(anchor.start) < Number(best.start)) {
      best = anchor;
    }
  }

  if (bestScore <= 0) {
    return { anchor: null, score: 0 };
  }

  return { anchor: best, score: bestScore };
}

function applyCriterionOverrides(criteria, segments) {
  const hookSignals = buildHookSignals(segments);

  return criteria.map((criterion) => {
    if (criterion.id === "hook_15_words_1_5s") {
      const hookAnchors =
        criterion.anchors.length > 0
          ? filterHookAnchors(criterion.anchors).slice(0, MAX_ANCHORS)
          : pickHookAnchorsByPattern(segments, HOOK_EMPATHY_PAIN_PATTERN, 3);
      const conciseEnough = hookSignals.firstWordCount > 0 && hookSignals.firstWordCount <= 18;
      const strongHook =
        hookSignals.hasVulnerableOpen ||
        (hookSignals.hasEmpathyPain && (hookSignals.hasPronoun || conciseEnough));

      let judgement = criterion.judgement;
      if (!hookSignals.hasHookText) {
        judgement = "no";
      } else if (strongHook) {
        judgement = "yes";
      } else if (hookSignals.hasPronoun && judgement === "no") {
        judgement = "partial";
      }

      return {
        ...criterion,
        judgement,
        anchors: hookAnchors,
        evidence: buildHookEmpathyEvidence(judgement),
      };
    }

    if (criterion.id === "hook_you_fear_shame") {
      const hookAnchors =
        criterion.anchors.length > 0
          ? filterHookAnchors(criterion.anchors).slice(0, MAX_ANCHORS)
          : pickHookAnchorsByPattern(
              segments,
              new RegExp(`${HOOK_PRONOUN_PATTERN.source}|${HOOK_FEAR_SHAME_PATTERN.source}`, "i"),
              3
            );

      let judgement = criterion.judgement;
      if (hookSignals.hasPronoun && hookSignals.hasFearShame) {
        judgement = "yes";
      } else if (hookSignals.hasPronoun || hookSignals.hasFearShame) {
        judgement = "partial";
      } else {
        judgement = "no";
      }

      return {
        ...criterion,
        judgement,
        anchors: hookAnchors,
        evidence: buildHookPronounEvidence(judgement, hookSignals.hasPronoun, hookSignals.hasFearShame),
      };
    }

    if (criterion.id === "self_deprecating_or_slang") {
      const representative = chooseRepresentativeSlangAnchor(criterion.anchors, segments);
      const anchorList = representative.anchor ? [representative.anchor] : [];
      const judgement =
        representative.score >= 6 ? "yes" : representative.score > 0 ? "partial" : "no";

      const evidence =
        judgement === "yes"
          ? "자기비하/속어 표현이 확인되어 긴장 완화 장치가 분명하게 작동합니다. 대표성이 가장 큰 구간 1개만 근거로 제시했습니다."
          : judgement === "partial"
            ? "가벼운 구어체/속어는 보이지만 자기비하 강도는 제한적입니다. 대표 구간 1개를 근거로 제시했습니다."
            : "자기비하/속어 표현이 뚜렷하게 확인되지 않아 긴장 완화 장치로 보기 어렵습니다.";

      return {
        ...criterion,
        judgement,
        anchors: anchorList,
        evidence,
      };
    }

    if (criterion.id === "three_act_structure") {
      const evidence = buildThreeActEvidence(segments);
      let judgement = criterion.judgement;
      if (segments.length >= 6 && judgement === "no") judgement = "partial";
      if (segments.length >= 12 && judgement === "partial") judgement = "yes";

      return {
        ...criterion,
        judgement,
        anchors: [],
        evidence,
      };
    }

    return criterion;
  });
}

function stripEvidenceTimeline(raw) {
  let text = cleanText(raw);
  if (!text) return "";

  text = text.replace(/근거\s*구간\s*[:：][^\n\r]*/gi, " ");
  text = text.replace(/\[\d{1,2}:\d{2}\][^\n\r]*/g, " ");
  text = text.replace(/주요\s*근거\s*시간대[^.。!\n]*/gi, " ");
  text = text.replace(/\s{2,}/g, " ").trim();

  return text;
}

function buildFallbackEvidence(criterionId, judgement, anchors) {
  const timeHint =
    anchors.length > 0
      ? anchors
          .slice(0, 3)
          .map((anchor) => formatAnchorTime(anchor.start))
          .join(", ")
      : "";

  if (criterionId === "hook_15_words_1_5s") {
    if (judgement === "yes") {
      return "초반 3초 안에서 감정적으로 끌어당기는 문장을 사용해 훅이 비교적 선명합니다. 도입부에서 주제를 빠르게 제시해 시청자가 바로 맥락을 이해할 수 있습니다.";
    }
    if (judgement === "partial") {
      return "초반 3초 안에 시작하긴 하지만 공감/고통 포인트가 강하게 드러나지 않아 훅 임팩트가 제한적입니다. 첫 문장에서 문제의식이나 감정 강도를 조금 더 명확히 제시하면 좋습니다.";
    }
    return "초반 3초 구간에서 시선을 붙잡는 공감·고통 훅이 뚜렷하게 보이지 않습니다. 도입부 첫 문장을 더 직접적이고 감정 중심으로 구성할 필요가 있습니다.";
  }

  if (criterionId === "hook_you_fear_shame") {
    if (judgement === "yes") {
      return "초반 훅에서 청자를 자기 이야기처럼 느끼게 하는 대명사 사용이 보입니다. 동시에 불안/수치심 같은 보편 감정을 건드려 공감 연결이 잘 형성됩니다.";
    }
    return "초반 훅에서 '너/나/우리' 계열 대명사 또는 보편적 두려움/수치심 표현이 약한 편입니다. 개인 경험은 있으나 보편 감정으로 확장되는 연결고리가 부족해 보입니다.";
  }

  if (criterionId === "background_specific_2_4") {
    return "시간·숫자·상황 맥락의 구체성은 전달력에 직접적으로 영향을 줍니다. 해당 스크립트는 배경 설명의 밀도에 따라 몰입도 차이가 발생하며, 핵심 정보가 연속적으로 제시될수록 이해가 쉬워집니다.";
  }

  if (criterionId === "lesson_result_not_preachy") {
    return "교훈 제시 자체보다 결과와 증거의 균형이 중요합니다. 설교처럼 들리지 않도록 경험 기반 문장과 가시적 결과를 함께 제시했는지를 중심으로 판단했습니다.";
  }

  if (criterionId === "cta_subtle_connected") {
    return "CTA는 문맥을 끊지 않고 마지막 문장과 자연스럽게 이어질 때 거부감이 낮아집니다. 본문 메시지의 여운을 유지한 상태에서 행동 유도가 나오는지 확인했습니다.";
  }

  if (criterionId === "friend_complaining_tone_audio") {
    return "오디오 원본을 직접 감정 분석한 값이 아니라 전사 문장 길이와 호흡 타이밍으로 말투를 추정했습니다. 친구에게 털어놓는 듯한 불평 톤과 구어체 흐름이 유지되는지 중점적으로 봤습니다.";
  }

  if (criterionId === "short_punchy_repetition") {
    return "짧고 강한 문장이 반복될수록 릴스에서는 리듬감과 기억점이 좋아집니다. 문장 길이 분포와 반복 패턴을 기준으로 전달 강도를 평가했습니다.";
  }

  if (criterionId === "three_act_structure") {
    return "도입에서 문제를 열고 중반에서 긴장을 올린 뒤 결말에서 정리되는 흐름이 있는지 확인했습니다. 구조가 분명할수록 메시지 회수력이 높아집니다.";
  }

  if (criterionId === "self_deprecating_or_slang") {
    return "자기비하나 속어는 긴장을 풀어 친밀감을 높이는 장치가 될 수 있습니다. 다만 과하면 핵심 메시지가 약해지므로 빈도와 맥락의 적절성을 함께 판단했습니다.";
  }

  return timeHint
    ? `대본의 주요 구간(${timeHint})을 중심으로 표현 패턴과 전개를 검토했습니다. 해당 기준과의 적합도를 문장 맥락 기반으로 판단했습니다.`
    : "대본 전체 맥락에서 표현 패턴과 전개를 검토해 해당 기준 적합도를 판단했습니다.";
}

function ensureKoreanReason(criterion, anchors) {
  let evidence = stripEvidenceTimeline(criterion?.evidence);
  if (!evidence || evidence.length < 40) {
    evidence = buildFallbackEvidence(criterion.id, criterion.judgement, anchors);
  }

  if (criterion.hookOnly && !evidence.includes("초반 3초")) {
    evidence = `초반 3초 구간을 기준으로 판단했습니다. ${evidence}`;
  }

  if (!hasHangul(evidence)) {
    evidence = buildFallbackEvidence(criterion.id, criterion.judgement, anchors);
  }

  return evidence;
}

function englishRatio(text) {
  const raw = cleanText(text);
  if (!raw) return 0;
  const englishCount = (raw.match(/[A-Za-z]/g) || []).length;
  return englishCount / raw.length;
}

function needsLocalization(summary, criteria) {
  if (!hasHangul(summary) || englishRatio(summary) > 0.32) return true;
  return criteria.some((criterion) => !hasHangul(criterion.evidence) || englishRatio(criterion.evidence) > 0.34);
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
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("분석 요청 시간이 초과되었습니다.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonFromModelContent(content) {
  const raw = cleanText(content);
  if (!raw) throw new Error("모델 응답이 비어 있습니다.");

  const candidates = [raw];
  candidates.push(raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim());

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  throw new Error("JSON 파싱 실패");
}

function buildSegmentSample(segments) {
  if (segments.length <= 72) return segments;

  const head = segments.slice(0, 24);
  const middleStart = Math.max(0, Math.floor(segments.length / 2) - 12);
  const middle = segments.slice(middleStart, middleStart + 24);
  const tail = segments.slice(-24);

  return dedupeAnchors([...head, ...middle, ...tail]);
}

function buildPromptPayload({ transcript, language, metadata, segments }) {
  const hookSegments = segments.filter((segment) => segment.start <= HOOK_WINDOW_SECONDS);
  const hookText = hookSegments.map((segment) => segment.text).join(" ").trim();
  const sentenceCount = cleanText(transcript)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean).length;

  return {
    language,
    title: cleanText(metadata?.title),
    uploader: cleanText(metadata?.uploader),
    transcript: cleanText(transcript).slice(0, 3400),
    segments: buildSegmentSample(segments),
    derivedSignals: {
      hookWindowSeconds: HOOK_WINDOW_SECONDS,
      hookWordCount: countWords(hookText),
      sentenceCount,
      totalWords: countWords(transcript),
      totalDuration: segments.length > 0 ? Number(segments[segments.length - 1].end || 0) : 0,
    },
    criteria: CRITERIA.map((criterion) => ({
      id: criterion.id,
      label: criterion.label,
      check: criterion.check,
      hookOnly: criterion.hookOnly,
    })),
  };
}

async function requestAnalysisModel({ apiKey, payload, model }) {
  const { response, payload: json } = await fetchJsonWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "너는 한국어 릴스 스크립트 분석가다. 한국어로만 답해라. 각 기준은 judgement(yes|partial|no), evidence(2문장 이상), anchors(최대 6개)를 반환해라. evidence에는 근거 구간이나 타임코드를 적지 마라(근거는 anchors 배열에만). 훅 관련 두 기준은 반드시 초반 3초 안의 내용만 근거로 사용해라. self_deprecating_or_slang 기준은 해당 시 대표 anchor 1개만 반환해라. three_act_structure 기준은 anchors를 비워라. JSON 스키마: {\"summary\":\"...\",\"criteria\":[{\"id\":\"...\",\"judgement\":\"yes|partial|no\",\"evidence\":\"...\",\"anchors\":[{\"start\":0.0,\"end\":1.2,\"text\":\"...\"}]}]}.",
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
      }),
    },
    100000
  );

  if (!response.ok) {
    throw new Error(json?.error?.message || "분석 모델 호출 실패");
  }

  return parseJsonFromModelContent(json?.choices?.[0]?.message?.content || "");
}

async function analyzeWithFallbackModels({ apiKey, payload }) {
  const models = ["gpt-5", "gpt-5-mini", "gpt-4o-mini"];
  let lastError;

  for (const model of models) {
    try {
      const parsed = await requestAnalysisModel({ apiKey, payload, model });
      return { parsed, modelUsed: model };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("분석 모델 호출 실패");
}

function normalizeModelCriteria(rawCriteria, segments) {
  const criteriaById = new Map(
    (Array.isArray(rawCriteria) ? rawCriteria : [])
      .map((item) => [cleanText(item?.id), item])
      .filter(([id]) => Boolean(id))
  );

  return CRITERIA.map((criterion) => {
    const raw = criteriaById.get(criterion.id) || {};
    const judgement = normalizeJudgement(raw?.judgement);
    const anchorsFromModel = normalizeAnchors(raw?.anchors, segments, criterion.hookOnly);
    const anchors =
      anchorsFromModel.length > 0
        ? anchorsFromModel
        : pickHeuristicAnchors(criterion.id, segments, criterion.hookOnly);

    const evidence = ensureKoreanReason(
      {
        id: criterion.id,
        hookOnly: criterion.hookOnly,
        judgement,
        evidence: raw?.evidence,
      },
      anchors
    );

    return {
      id: criterion.id,
      label: criterion.label,
      hookOnly: criterion.hookOnly,
      judgement,
      evidence,
      anchors,
    };
  });
}

function buildFallbackAnalysis(segments) {
  const criteria = CRITERIA.map((criterion) => {
    const anchors = pickHeuristicAnchors(criterion.id, segments, criterion.hookOnly);
    const judgement = anchors.length > 0 ? "partial" : "no";
    return {
      id: criterion.id,
      label: criterion.label,
      hookOnly: criterion.hookOnly,
      judgement,
      evidence: ensureKoreanReason(
        {
          id: criterion.id,
          hookOnly: criterion.hookOnly,
          judgement,
          evidence: "",
        },
        anchors
      ),
      anchors,
    };
  });

  return {
    summary: "모델 응답이 불안정해 휴리스틱 분석 결과를 표시했습니다. 핵심 기준은 유지하되 신뢰도는 낮을 수 있습니다.",
    criteria,
    modelUsed: "fallback",
  };
}

async function localizeToKorean({ apiKey, summary, criteria }) {
  const { response, payload } = await fetchJsonWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
              "영문이 섞인 분석 텍스트를 자연스러운 한국어로만 바꿔라. 의미를 바꾸지 마라. JSON만 반환: {\"summary\":\"...\",\"items\":[{\"id\":\"...\",\"evidence\":\"...\"}]}",
          },
          {
            role: "user",
            content: JSON.stringify({
              summary,
              items: criteria.map((criterion) => ({
                id: criterion.id,
                evidence: criterion.evidence,
              })),
            }),
          },
        ],
      }),
    },
    30000
  );

  if (!response.ok) {
    throw new Error(payload?.error?.message || "한국어 로컬라이즈 실패");
  }

  return parseJsonFromModelContent(payload?.choices?.[0]?.message?.content || "");
}

function applyLocalizationFallback(summary, criteria) {
  const normalizedSummary = hasHangul(summary)
    ? summary
    : "릴스 스크립트 구조 기준으로 훅, 전개, CTA, 말투를 종합 분석했습니다.";

  const normalizedCriteria = criteria.map((criterion) => {
    if (hasHangul(criterion.evidence)) return criterion;
    return {
      ...criterion,
      evidence: ensureKoreanReason(criterion, criterion.anchors),
    };
  });

  return {
    summary: normalizedSummary,
    criteria: normalizedCriteria,
  };
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
    const transcript = cleanText(body?.transcript);
    const language = cleanText(body?.language);
    const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : {};
    const segments = normalizeSegments(body?.segments);

    if (!transcript) {
      return NextResponse.json({ error: "분석할 전사 데이터가 없습니다." }, { status: 400 });
    }

    const promptPayload = buildPromptPayload({
      transcript,
      language,
      metadata,
      segments,
    });

    let parsed;
    let modelUsed = "fallback";

    try {
      const analyzed = await analyzeWithFallbackModels({ apiKey, payload: promptPayload });
      parsed = analyzed.parsed;
      modelUsed = analyzed.modelUsed;
    } catch {
      const fallback = buildFallbackAnalysis(segments);
      const adjustedCriteria = applyCriterionOverrides(fallback.criteria, segments);
      const hookTemplate = detectHookTemplate(segments);
      const chart = buildChart(adjustedCriteria);
      const overallScore = Math.round(
        adjustedCriteria.reduce((sum, criterion) => sum + judgementScore(criterion.judgement), 0) /
          adjustedCriteria.length
      );

      return NextResponse.json({
        summary: fallback.summary,
        overallScore,
        criteria: adjustedCriteria,
        hookTemplate,
        chart,
        modelUsed: fallback.modelUsed,
        analysisVersion: ANALYSIS_VERSION,
        generatedAt: new Date().toISOString(),
      });
    }

    let summary = cleanText(parsed?.summary);
    if (!summary) {
      summary = "릴스의 훅, 공감 구조, 메시지 전개, CTA 흐름을 기준으로 분석했습니다.";
    }

    let criteria = normalizeModelCriteria(parsed?.criteria, segments);

    if (needsLocalization(summary, criteria)) {
      try {
        const localized = await localizeToKorean({ apiKey, summary, criteria });
        const localizedMap = new Map(
          (Array.isArray(localized?.items) ? localized.items : [])
            .map((item) => [cleanText(item?.id), item])
            .filter(([id]) => Boolean(id))
        );

        summary = cleanText(localized?.summary) || summary;
        criteria = criteria.map((criterion) => {
          const localizedItem = localizedMap.get(criterion.id);
          if (!localizedItem) return criterion;

          const localizedEvidence = ensureKoreanReason(
            {
              ...criterion,
              evidence: localizedItem.evidence,
            },
            criterion.anchors
          );

          return {
            ...criterion,
            evidence: localizedEvidence,
          };
        });
      } catch {
        const fallbackLocalized = applyLocalizationFallback(summary, criteria);
        summary = fallbackLocalized.summary;
        criteria = fallbackLocalized.criteria;
      }
    } else {
      const fallbackLocalized = applyLocalizationFallback(summary, criteria);
      summary = fallbackLocalized.summary;
      criteria = fallbackLocalized.criteria;
    }

    criteria = applyCriterionOverrides(criteria, segments);
    const hookTemplate = detectHookTemplate(segments);

    const chart = buildChart(criteria);
    const overallScore = Math.round(
      criteria.reduce((sum, criterion) => sum + judgementScore(criterion.judgement), 0) / criteria.length
    );

    return NextResponse.json({
      summary,
      overallScore,
      criteria,
      hookTemplate,
      chart,
      modelUsed,
      analysisVersion: ANALYSIS_VERSION,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "분석 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
