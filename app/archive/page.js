"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function formatCount(value, empty = "-") {
  if (!Number.isFinite(value)) return empty;
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatUpdatedAt(value) {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleString("ko-KR");
}

export default function ArchivePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadArchive() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/reels/archive?limit=240");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "아카이브 목록을 불러오지 못했습니다.");
        }
        if (cancelled) return;
        setItems(Array.isArray(payload?.items) ? payload.items : []);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError?.message || "아카이브 로딩 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadArchive();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasItems = useMemo(() => items.length > 0, [items]);

  return (
    <main className="page archive-page">
      <div className="mesh" aria-hidden="true" />

      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-wrap">
            <div className="brand">OpenArea</div>
            <div className="top-tabs">
              <Link href="/" className="top-tab">
                전사
              </Link>
              <Link href="/archive" className="top-tab active">
                아카이브
              </Link>
            </div>
          </div>
        </div>
        <div className="status">
          <span className={`dot ${loading ? "working" : hasItems ? "done" : "idle"}`} />
          {loading ? "불러오는 중..." : `${items.length}개 보관됨`}
        </div>
      </header>

      {error ? <p className="error top-error">{error}</p> : null}

      <section className="panel archive-panel">
        <h2>아카이브</h2>
        {!loading && !hasItems ? (
          <p className="placeholder">저장된 전사 결과가 없습니다. 전사를 먼저 실행해 주세요.</p>
        ) : null}
        <div className="archive-list">
          {items.map((item) => (
            <Link
              key={item.reelId}
              href={`/?archive=${encodeURIComponent(item.reelId)}`}
              className="archive-card"
            >
              <p className="archive-card-title">{item.title || "제목 정보 없음"}</p>
              <p className="archive-card-summary">{item.summaryLine || "요약 없음"}</p>
              <div className="archive-card-meta">
                <span>{item.uploader || "작성자 정보 없음"}</span>
                <span>{formatUpdatedAt(item.updatedAt)}</span>
              </div>
              <div className="archive-card-stats">
                <span>좋아요 {formatCount(item.likeCount)}</span>
                <span>댓글 {formatCount(item.commentCount)}</span>
                <span>조회수 {formatCount(item.viewCount, "집계 안됨")}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

