import Link from "next/link";
import { siteConfig } from "../lib/site";
import styles from "./trust.module.css";

const trustSections = [
  {
    title: "작업 진행 기준",
    items: [
      "상담 후 전달받은 음원, 가사, 무드에 맞춰 작업 방향을 먼저 정리합니다.",
      "가사 타이밍은 자동 처리보다 수작업 정리에 가깝게 진행해 완성도를 우선합니다.",
      "작업 범위와 일정은 패키지 또는 상담 내용 기준으로 확정합니다.",
    ],
  },
  {
    title: "수정 및 전달",
    items: [
      "수정 횟수는 선택한 패키지 기준으로 반영됩니다.",
      "초안 확인 후 같은 방향 안에서 필요한 수정 사항을 정리해 반영합니다.",
      "최종 결과물은 약속한 비율과 규격 기준으로 전달합니다.",
    ],
  },
  {
    title: "결제 및 일정 안내",
    items: [
      "결제는 외부 결제 페이지를 통해 진행됩니다.",
      "작업 착수 후 일정은 곡 길이와 피드백 속도에 따라 일부 조정될 수 있습니다.",
      "커스텀 범위가 큰 작업은 상담 후 별도 안내가 추가될 수 있습니다.",
    ],
  },
  {
    title: "응답 및 문의",
    items: [
      "문의는 카카오톡 채널을 통해 가장 빠르게 확인합니다.",
      "평균 응답 시간은 상황에 따라 다를 수 있으나 빠른 확인을 우선합니다.",
      "작업 전 궁금한 점은 결제 전에도 편하게 문의하실 수 있습니다.",
    ],
  },
];

export const metadata = {
  title: "신뢰 안내",
  description:
    "HipArchive 작업 진행 기준, 수정 방식, 결제 및 일정 안내를 한눈에 확인할 수 있는 신뢰 안내 페이지입니다.",
  alternates: {
    canonical: "/trust",
  },
};

export default function TrustPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            <img className={styles.logo} src="/header-logo.png" alt="HipArchive" />
          </Link>
          <Link href="/" className={styles.backLink}>
            메인으로
          </Link>
        </header>

        <section className={styles.hero}>
          <div className={styles.kicker}>TRUST</div>
          <h1 className={styles.title}>신뢰 안내</h1>
          <p className={styles.description}>
            {siteConfig.name}에서 작업을 맡기기 전, 진행 방식과 수정 기준, 결제 및 문의 흐름을
            편하게 확인하실 수 있도록 정리한 안내 페이지입니다.
          </p>
        </section>

        <section className={styles.grid}>
          {trustSections.map((section) => (
            <article key={section.title} className={styles.card}>
              <h2>{section.title}</h2>
              <ul className={styles.list}>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className={styles.ctaCard}>
          <div>
            <div className={styles.ctaLabel}>CONTACT</div>
            <h2>작업 전 상담이 필요하시면 바로 문의하실 수 있습니다.</h2>
            <p>
              패키지 선택이 고민되거나 일정, 수정 범위가 애매한 경우에는 상담 후 가장 맞는 방향으로
              안내해드립니다.
            </p>
          </div>
          <a
            className={styles.ctaButton}
            href="http://pf.kakao.com/_cxnmMX/chat"
            target="_blank"
            rel="noreferrer"
          >
            카카오톡 문의하기
          </a>
        </section>
      </div>
    </main>
  );
}
