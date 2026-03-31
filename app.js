const targetInput = document.getElementById("target");
const scanBtn = document.getElementById("scanBtn");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const progressBar = document.getElementById("progressBar");
const metricExposure = document.getElementById("metricExposure");
const metricActivity = document.getElementById("metricActivity");
const metricNetwork = document.getElementById("metricNetwork");
const timeline = document.getElementById("timeline");
const summary = document.getElementById("summary");

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function buildMockTimeline(handle) {
  const samples = [
    `@${handle}: 공개 프로필 메타 신호 추정치 생성`,
    `계정 활동 패턴: 주간 피크 시간대 모의 계산 완료`,
    `해시태그 연결성 그래프 샘플링 (실데이터 아님)`,
    `유사 계정 군집도 모의 스코어링`,
    `노출 리스크 요약 문장 생성`
  ];

  timeline.innerHTML = "";
  samples.forEach((text, idx) => {
    const li = document.createElement("li");
    li.textContent = text;
    li.style.animationDelay = `${idx * 0.12}s`;
    timeline.appendChild(li);
  });
}

function setIdleState() {
  statusDot.className = "dot idle";
  statusText.textContent = "대기 중";
  progressBar.style.width = "0%";
}

function renderMockResult(handle) {
  const exposureScore = randomInt(42, 94);
  const activity = ["Low", "Moderate", "Elevated", "Burst"];
  const networkScore = randomInt(30, 89);

  metricExposure.textContent = `${exposureScore}/100`;
  metricActivity.textContent = activity[randomInt(0, activity.length - 1)];
  metricNetwork.textContent = `${networkScore}/100`;

  summary.textContent = `@${handle} 계정은 모의 분석 기준으로 공개 흔적이 중간 이상으로 표시됩니다. ` +
    `이 요약은 UI 데모용으로만 생성되며, 실제 인스타그램 조회/수집은 수행하지 않습니다.`;

  buildMockTimeline(handle);
}

function runMockScan() {
  const handle = targetInput.value.trim().replace(/^@+/, "");

  if (!handle) {
    statusText.textContent = "핸들을 입력하세요";
    return;
  }

  scanBtn.disabled = true;
  statusDot.className = "dot scan";
  statusText.textContent = "모의 스캔 진행 중...";
  progressBar.style.width = "8%";

  let progress = 8;
  const timer = setInterval(() => {
    progress += randomInt(9, 18);
    if (progress >= 100) {
      progress = 100;
      clearInterval(timer);
      progressBar.style.width = `${progress}%`;
      statusDot.className = "dot done";
      statusText.textContent = "모의 스캔 완료";
      renderMockResult(handle);
      scanBtn.disabled = false;
      return;
    }
    progressBar.style.width = `${progress}%`;
  }, 320);
}

scanBtn.addEventListener("click", runMockScan);
targetInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runMockScan();
});

setIdleState();
