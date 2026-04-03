"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { siteConfig } from "../lib/site";
import { trackInquiryClick, trackNavClick } from "../lib/analytics";
import styles from "../page.module.css";

const navItems = [
  { label: "작업 예시", href: "#작업-예시" },
  { label: "진행 방식", href: "#진행-방식" },
  { label: "FAQ", href: "#FAQ" },
];

const inquiryUrl = "http://pf.kakao.com/_cxnmMX/chat";
const heroImageUrl = siteConfig.heroImage;

const showcaseVideos = [
  {
    src: "https://player.vimeo.com/video/1178139945?title=0&byline=0&portrait=0",
    title: "앨범커버 무드 참고 예시",
  },
  {
    src: "https://player.vimeo.com/video/1178140082?title=0&byline=0&portrait=0",
    title: "아트워크 톤 참고 예시",
  },
  {
    src: "https://player.vimeo.com/video/1178140001?title=0&byline=0&portrait=0",
    title: "브랜딩 확장형 작업 예시",
  },
];

const processSteps = [
  {
    step: "01",
    title: "작업 요청 및 자료 전달",
    description: "곡, 가사, 레퍼런스와 원하는 무드, 상세한 구상 내용을 전달받습니다.",
  },
  {
    step: "02",
    title: "시안 제작",
    description: "곡의 인상과 방향에 맞춰 메인 시안을 제작하고 아티스트에게 전달합니다.",
  },
  {
    step: "03",
    title: "수정 및 최종 전달",
    description: "피드백을 반영해 시안을 정리하고 최종 파일까지 전달해 작업을 마무리합니다.",
  },
];

const requiredItems = [
  "곡 제목 / 아티스트명",
  "곡 또는 가사",
  "상세한 구상 내용",
  "참고 이미지 또는 무드보드",
  "사용 가능한 사진 / 로고",
];

const faqItems = [
  {
    question: "상업적으로도 사용할 수 있나요?",
    answer:
      "네. 작업 비용에 상업적 이용 범위를 포함해 안내하는 방향으로 진행하고 있으며, 발매 및 프로모션 활용을 고려해 작업합니다.",
  },
  {
    question: "폰트와 이미지는 라이선스 문제가 없나요?",
    answer:
      "상업적으로 활용 가능한 폰트와 이미지를 기준으로 작업 방향을 맞추고 있습니다. 별도 자료를 전달해주실 경우에도 사용 가능 범위를 함께 확인해드립니다.",
  },
  {
    question: "최종 파일은 어떤 형식으로 전달되나요?",
    answer:
      "기본 제공 파일은 3000x3000 PNG 기준으로 안내드리며, 요청 시 JPG 형식도 함께 전달 가능합니다. 필요 파일 형식이 있다면 미리 말씀해주시면 맞춰드립니다.",
  },
  {
    question: "수정은 어느 정도까지 가능한가요?",
    answer:
      "기본 패키지 기준 3회까지 수정 가능하며, 처음 합의한 방향 안에서 색감이나 텍스트, 디테일을 다듬는 식으로 반영합니다. 전체 방향이 바뀌는 재시안 요청은 별도 협의가 필요합니다.",
  },
];

const mobileServiceDescription = [
  {
    title: "서비스 설명",
    body: [
      "HipArchive STUDIO는 예술성과 현대적인 무드를 함께 담은 앨범커버 디자인을 작업합니다.",
      "곡의 인상과 아티스트의 정체성이 한 장의 아트워크 안에서 선명하게 느껴질 수 있도록 방향을 정리합니다.",
    ],
  },
  {
    title: "작업 방향",
    body: [
      "다양한 주제와 스타일을 바탕으로 곡 분위기, 참고 무드, 전달하고 싶은 감정을 시각적으로 풀어내는 방향으로 작업합니다.",
    ],
  },
  {
    title: "상업적 이용 및 파일 안내",
    body: [
      "상업적 활용을 고려한 방향으로 작업하며, 기본 파일은 3000x3000 PNG 기준으로 제공됩니다. 요청 시 JPG 등 다른 형식도 함께 안내해드립니다.",
    ],
  },
  {
    title: "작업 진행",
    steps: [
      "작업 요청(주문)",
      "곡, 가사, 구상 내용 전달",
      "작업 시작",
      "아티스트에게 시안 전송",
      "시안 수정 및 작업 종료",
    ],
  },
  {
    title: "전달 자료 안내",
    body: [
      "곡 제목, 아티스트명, 곡 또는 가사, 레퍼런스 이미지, 상세한 구상 내용을 보내주시면 작업 방향을 더 빠르게 맞출 수 있습니다.",
    ],
  },
];

const reviewItems = [
  {
    author: "fresh*****",
    rating: "5.0",
    timeline: "작업 기간 3일",
    amount: "주문 금액 10~30만원",
    text: "레퍼런스로 전달드린 분위기 그대로 잘 잡아주셔서 만족했습니다. 결과물도 훨씬 완성도 있게 나왔어요.",
  },
  {
    author: "tokto*****",
    rating: "5.0",
    timeline: "작업 기간 3일",
    amount: "주문 금액 10만원 미만",
    text: "느낌 너무 좋아요. 감각적인 아트워크 찾으시면 추천드리고 싶어요.",
  },
  {
    author: "sunny*****",
    rating: "5.0",
    timeline: "작업 기간 2일",
    amount: "주문 금액 10만원 미만",
    text: "빠르게 답변 주셔서 진행도 빠르게 끝났습니다.",
  },
  {
    author: "lucky*****",
    rating: "5.0",
    timeline: "작업 기간 3일",
    amount: "주문 금액 10만원 미만",
    text: "빠르고 섬세하게 작업해주셔서 감사했어요.",
  },
  {
    author: "angel*****",
    rating: "5.0",
    timeline: "작업 기간 3일",
    amount: "주문 금액 10~30만원",
    text: "신속한 대응과 친절함 둘 다 좋았습니다. 아이디어가 잘 안 잡혀서 믿고 맡겼는데 수정할 것 없이 만족스러운 결과물이 나왔어요.",
  },
  {
    author: "shiny*****",
    rating: "5.0",
    timeline: "작업 기간 3일",
    amount: "주문 금액 10만원 미만",
    text: "상담도 꼼꼼하게 해주시고 수정도 친절히 반영해주셔서 만족하는 결과물이 나온 것 같아요.",
  },
  {
    author: "li*****",
    rating: "5.0",
    timeline: "작업 기간 3일",
    amount: "주문 금액 10만원 미만",
    text: "주문한 내용을 정확하고 친절하게 반영해주셨습니다. 감사합니다.",
  },
  {
    author: "black*****",
    rating: "4.9",
    timeline: "작업 기간 3일",
    amount: "주문 금액 10~30만원",
    text: "생각했던 이미지를 잘 살려주셔서 곡 분위기가 더 또렷하게 보였어요.",
  },
];

const reviewBreakdown = [
  { label: "결과물 만족도", score: 4.9 },
  { label: "컨셉 반영도", score: 4.9 },
  { label: "친절한 상담", score: 5.0 },
];

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "앨범커버 디자인 제작",
    serviceType: "고퀄리티 앨범커버 및 아트워크 디자인",
    provider: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    areaServed: "KR",
    url: `${siteConfig.url}/album`,
    description:
      "곡의 예술성과 아티스트의 무드를 시각적으로 정리하는 앨범커버 디자인 제작 서비스입니다.",
    offers: [
      {
        "@type": "Offer",
        name: "High 퀄리티 디자인",
        priceCurrency: "KRW",
        description:
          "노래와 어울리는 앨범커버를 전문적으로 작업합니다. 원본 파일 제공과 상업적 이용을 포함한 디자인 패키지입니다.",
        availability: "https://schema.org/InStock",
        url: `${siteConfig.url}/album`,
      },
    ],
  },
];

function MainPreviewImage() {
  return (
    <div className={`${styles.previewCard} ${styles.previewFeatured} ${styles.previewImageCard}`}>
      <img className={styles.previewImage} src={heroImageUrl} alt="앨범커버 대표 작업 예시" />
    </div>
  );
}

export default function AlbumPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [showAllVideos, setShowAllVideos] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showMobileServiceDetails, setShowMobileServiceDetails] = useState(false);
  const [showMobileInquiryHint, setShowMobileInquiryHint] = useState(true);
  const [mobileInquiryHintReady, setMobileInquiryHintReady] = useState(false);

  const visibleReviewItems = showAllReviews ? reviewItems : reviewItems.slice(0, 4);

  function handleInquiry(location = "album_general") {
    trackInquiryClick(location);
    window.location.href = inquiryUrl;
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let ticking = false;

    const updateVisibility = () => {
      const isMobile = window.innerWidth <= 860;
      const threshold = window.innerHeight * 0.08;
      const scrollTop =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;

      setShowMobileInquiryHint(!isMobile || scrollTop <= threshold);
    };

    const handleScroll = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(() => {
        updateVisibility();
        ticking = false;
      });
    };

    updateVisibility();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMobileInquiryHintReady(true);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className={styles.page}>
      {structuredData.map((item) => (
        <script
          key={item["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brandBlock}>
            <img className={styles.brandLogo} src="/header-logo.png" alt="HipArchive" />
          </Link>

          <nav className={styles.nav} aria-label="섹션 이동">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={styles.navLink}
                onClick={() => trackNavClick(`album_${item.label}`)}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <button
            className={styles.headerCta}
            type="button"
            onClick={() => handleInquiry("album_header")}
          >
            문의하기
          </button>

          <button
            className={styles.mobileMenuButton}
            type="button"
            aria-label="메뉴 열기"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((current) => !current)}
          >
            <span
              className={`${styles.mobileMenuLine} ${
                mobileMenuOpen ? styles.mobileMenuLineTopOpen : ""
              }`}
            />
            <span
              className={`${styles.mobileMenuLine} ${
                mobileMenuOpen ? styles.mobileMenuLineMiddleOpen : ""
              }`}
            />
            <span
              className={`${styles.mobileMenuLine} ${
                mobileMenuOpen ? styles.mobileMenuLineBottomOpen : ""
              }`}
            />
          </button>
        </div>

        <div
          className={`${styles.mobileMenuPanel} ${
            mobileMenuOpen ? styles.mobileMenuPanelOpen : ""
          }`}
        >
          <nav className={styles.mobileMenuNav} aria-label="모바일 섹션 이동">
            {navItems.filter((item) => item.label !== "진행 방식").map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={styles.mobileMenuLink}
                onClick={() => {
                  trackNavClick(`album_mobile_${item.label}`);
                  setMobileMenuOpen(false);
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>CUSTOM ALBUM COVER</div>
          <h1 className={styles.heroTitle}>곡의 예술성을 앨범커버로 만들어드립니다</h1>
          <div className={styles.heroRating} aria-label="평점 4.9, 리뷰 8개">
            <span className={styles.heroStars} aria-hidden="true">
              {Array.from({ length: 5 }).map((_, index) => (
                <svg
                  key={index}
                  className={styles.heroStarIcon}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2.9l2.84 5.76 6.36.92-4.6 4.48 1.09 6.33L12 17.41l-5.69 2.98 1.09-6.33-4.6-4.48 6.36-.92L12 2.9z" />
                </svg>
              ))}
            </span>
            <a className={styles.heroReviewCount} href="#리뷰">
              4.9 <span className={styles.heroReviewCountMuted}>(8)</span>
            </a>
          </div>
        </div>

        <div className={styles.heroPreview}>
          <MainPreviewImage />
        </div>
      </section>

      <section className={styles.contentShell}>
        <div className={styles.mainContent}>
          <section className={`${styles.section} ${styles.mobileServiceSection}`}>
            <div className={styles.mobileServiceContent}>
              <article className={styles.mobileServiceGroup}>
                <h2 className={styles.mobileServiceTitle}>{mobileServiceDescription[0].title}</h2>
                {mobileServiceDescription[0].body.map((paragraph) => (
                  <p key={paragraph} className={styles.mobileServiceText}>
                    {paragraph}
                  </p>
                ))}
              </article>

              <div
                id="mobile-service-details"
                className={`${styles.mobileServiceDetailsWrap} ${
                  showMobileServiceDetails ? styles.mobileServiceDetailsWrapOpen : ""
                }`}
              >
                <div className={styles.mobileServiceDetails}>
                  {mobileServiceDescription.slice(1).map((item) => (
                    <article key={item.title} className={styles.mobileServiceGroup}>
                      <h2 className={`${styles.mobileServiceTitle} ${styles.mobileServiceSubTitle}`}>
                        {item.title}
                      </h2>
                      {item.body
                        ? item.body.map((paragraph) => (
                            <p key={paragraph} className={styles.mobileServiceText}>
                              {paragraph}
                            </p>
                          ))
                        : null}
                      {item.steps ? (
                        <ol className={styles.mobileProcessList}>
                          {item.steps.map((step) => (
                            <li key={step} className={styles.mobileProcessItem}>
                              {step}
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </article>
                  ))}
                </div>

                {!showMobileServiceDetails ? (
                  <>
                    <div className={styles.mobileServiceFade} aria-hidden="true" />
                    <button
                      type="button"
                      className={styles.mobileServiceMore}
                      aria-expanded={showMobileServiceDetails}
                      aria-controls="mobile-service-details"
                      onClick={() => setShowMobileServiceDetails(true)}
                    >
                      <span>자세히 보기</span>
                      <span
                        className={`${styles.faqIcon} ${styles.videoShowcaseMoreIcon}`}
                        aria-hidden="true"
                      />
                    </button>
                  </>
                ) : null}
              </div>

              {showMobileServiceDetails ? (
                <button
                  type="button"
                  className={`${styles.mobileServiceMore} ${styles.mobileServiceMoreOpen}`}
                  aria-expanded={showMobileServiceDetails}
                  aria-controls="mobile-service-details"
                  onClick={() => setShowMobileServiceDetails(false)}
                >
                  <span>접기</span>
                  <span
                    className={`${styles.faqIcon} ${styles.videoShowcaseMoreIcon} ${styles.faqIconOpen}`}
                    aria-hidden="true"
                  />
                </button>
              ) : null}
            </div>
          </section>

          <section id="작업-예시" className={`${styles.section} ${styles.videoSection}`}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionKicker}>Portfolio</span>
              <h2 className={styles.sectionTitle}>작업 예시</h2>
            </div>

            <div className={styles.videoShowcaseGrid}>
              {showcaseVideos.slice(0, 2).map((item) => (
                <div key={item.src}>
                  <iframe
                    className={styles.videoShowcasePlayer}
                    src={item.src}
                    title={item.title}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ))}
            </div>

            <div
              className={`${styles.videoShowcaseExtra} ${
                showAllVideos ? styles.videoShowcaseExtraOpen : ""
              }`}
            >
              <div className={styles.videoShowcaseExtraInner}>
                {showcaseVideos.slice(2).map((item) => (
                  <div key={item.src}>
                    <iframe
                      className={styles.videoShowcasePlayer}
                      src={item.src}
                      title={item.title}
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ))}
              </div>

              {!showAllVideos ? (
                <>
                  <div className={styles.videoShowcaseFade} aria-hidden="true" />
                  <button
                    type="button"
                    className={styles.videoShowcaseMore}
                    onClick={() => setShowAllVideos(true)}
                  >
                    <span>더보기</span>
                    <span
                      className={`${styles.faqIcon} ${styles.videoShowcaseMoreIcon}`}
                      aria-hidden="true"
                    />
                  </button>
                </>
              ) : null}
            </div>
          </section>

          <section id="진행-방식" className={`${styles.section} ${styles.processSection}`}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionKicker}>Process</span>
              <h2 className={styles.sectionTitle}>작업은 이렇게 진행됩니다</h2>
            </div>

            <div className={styles.processGrid}>
              {processSteps.map((item) => (
                <article key={item.step} className={styles.processCard}>
                  <div className={styles.processStep}>{item.step}</div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={`${styles.section} ${styles.subtleInfoSection}`}>
            <div className={styles.dualGrid}>
              <article className={`${styles.infoCard} ${styles.infoCardSubtle} ${styles.requiredCard}`}>
                <div className={styles.requiredCardHead}>
                  <div className={styles.infoLabel}>준비 자료</div>
                  <h3>작업 전에 필요한 것</h3>
                  <p className={styles.requiredCardDescription}>
                    아래 자료를 보내주시면 앨범커버 방향을 더 빠르고 정확하게 맞출 수 있습니다.
                  </p>
                </div>
                <ul className={styles.requiredList}>
                  {requiredItems.map((item) => (
                    <li key={item} className={styles.requiredItem}>
                      <span className={styles.requiredItemIcon} aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          <section id="FAQ" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionKicker}>FAQ</span>
              <h2 className={styles.sectionTitle}>자주 묻는 질문</h2>
            </div>

            <div className={styles.faqList}>
              {faqItems.map((item, index) => (
                <article key={item.question} className={styles.faqItem}>
                  <button
                    type="button"
                    className={styles.faqQuestionButton}
                    aria-expanded={openFaqIndex === index}
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  >
                    <span className={styles.faqQuestionText}>{item.question}</span>
                    <span
                      className={`${styles.faqIcon} ${
                        openFaqIndex === index ? styles.faqIconOpen : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    className={`${styles.faqAnswer} ${
                      openFaqIndex === index ? styles.faqAnswerOpen : ""
                    }`}
                  >
                    <div className={styles.faqAnswerInner}>
                      <p>{item.answer}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside id="패키지" className={styles.sidebar}>
          <div className={styles.packageCard}>
            <div className={styles.packageHeader}>
              <span className={styles.packageLabel}>Package</span>
              <h2>작업 패키지</h2>
            </div>

            <div className={styles.packageBody}>
              <div className={styles.packageBenefit}>상업적 이용 포함</div>
              <div className={styles.packagePriceRow}>
                <div className={styles.packagePrice}>문의 후 견적 안내</div>
              </div>
              <div className={styles.packageSubtitle}>High 퀄리티 디자인</div>
              <div className={styles.packageTrustLine}>
                <span>원본파일 제공</span>
                <span>상업적 이용 가능</span>
              </div>
              <p className={styles.packageDescription}>
                노래와 어울리는 커버를 전문적으로 작업합니다. 광범위한 디자인적 요소를 사용하며,
                곡의 무드와 아티스트의 방향을 한 장의 아트워크로 정리해드립니다.
              </p>

              <dl className={styles.packageMeta}>
                <div>
                  <dt>시안 개수</dt>
                  <dd>1개</dd>
                </div>
                <div>
                  <dt>작업일</dt>
                  <dd>3일</dd>
                </div>
                <div>
                  <dt>수정 횟수</dt>
                  <dd>3회</dd>
                </div>
                <div>
                  <dt>기본 사이즈</dt>
                  <dd>3000 x 3000</dd>
                </div>
              </dl>

              <div className={styles.packageActions}>
                <button
                  className={styles.purchaseButton}
                  type="button"
                  onClick={() => handleInquiry("album_package_primary")}
                >
                  제작 문의하기
                </button>
                <button
                  className={styles.ghostButton}
                  type="button"
                  onClick={() => {
                    window.location.href = "/trust";
                  }}
                >
                  환불/규정 안내
                </button>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section id="리뷰" className={styles.reviewSection}>
        <div className={styles.reviewSectionInner}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>작업 리뷰 (8)</h2>
          </div>

          <div className={styles.reviewMobileSummary}>
            <div className={styles.reviewMobileRatingLine} aria-label="평점 4.9, 리뷰 8개">
              <div className={styles.reviewMobileStars} aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <svg
                    key={index}
                    className={styles.reviewMobileStarIcon}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2.9l2.84 5.76 6.36.92-4.6 4.48 1.09 6.33L12 17.41l-5.69 2.98 1.09-6.33-4.6-4.48 6.36-.92L12 2.9z" />
                  </svg>
                ))}
              </div>
              <div className={styles.reviewMobileRatingText}>
                <strong>4.9</strong>
                <span>(8)</span>
              </div>
            </div>

            <div className={styles.reviewMobileBreakdown}>
              {reviewBreakdown.map((item) => (
                <div key={item.label} className={styles.reviewMobileMetric}>
                  <span className={styles.reviewMobileMetricLabel}>{item.label}</span>
                  <div className={styles.reviewMobileMetricTrack} aria-hidden="true">
                    <span
                      className={styles.reviewMobileMetricFill}
                      style={{ width: `${(item.score / 5) * 100}%` }}
                    />
                  </div>
                  <span className={styles.reviewMobileMetricValue}>{item.score.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.reviewGrid}>
            {visibleReviewItems.map((item) => (
              <article key={item.author} className={styles.reviewCard}>
                <div className={styles.reviewCardHead}>
                  <div className={styles.reviewAuthor}>
                    <span className={styles.reviewAvatar} aria-hidden="true" />
                    <strong>{item.author}</strong>
                  </div>
                  <div className={styles.reviewRating}>
                    <div className={styles.reviewStars} aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <svg
                          key={index}
                          className={styles.reviewStarIcon}
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 2.9l2.84 5.76 6.36.92-4.6 4.48 1.09 6.33L12 17.41l-5.69 2.98 1.09-6.33-4.6-4.48 6.36-.92L12 2.9z" />
                        </svg>
                      ))}
                    </div>
                    <span className={styles.reviewRatingValue}>{item.rating}</span>
                  </div>
                </div>
                <div className={styles.reviewMeta}>
                  <span>{item.timeline}</span>
                  <span>{item.amount}</span>
                </div>
                <p>{item.text}</p>
              </article>
            ))}
          </div>

          {reviewItems.length > 4 ? (
            <div
              className={styles.reviewMoreWrap}
              style={{ display: "flex", justifyContent: "center", marginTop: "24px" }}
            >
              <button
                type="button"
                className={styles.reviewMoreButton}
                onClick={() => setShowAllReviews((current) => !current)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: 0,
                  border: 0,
                  outline: "none",
                  background: "transparent",
                  color: "#5b5e66",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  cursor: "pointer",
                  appearance: "none",
                  WebkitAppearance: "none",
                }}
              >
                <span>{showAllReviews ? "접기" : "더보기"}</span>
                <span
                  className={`${styles.faqIcon} ${styles.videoShowcaseMoreIcon} ${
                    showAllReviews ? styles.faqIconOpen : ""
                  }`}
                  aria-hidden="true"
                />
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <div className={styles.mobileActionBar}>
        <div className={styles.mobileActionBarInner}>
          <div className={styles.mobileInquiryWrap}>
            <div
              className={styles.mobileInquiryHint}
              aria-hidden={!(mobileInquiryHintReady && showMobileInquiryHint)}
              style={{
                opacity: mobileInquiryHintReady && showMobileInquiryHint ? 1 : 0,
                visibility: mobileInquiryHintReady && showMobileInquiryHint ? "visible" : "hidden",
                pointerEvents:
                  mobileInquiryHintReady && showMobileInquiryHint ? "auto" : "none",
                transform:
                  mobileInquiryHintReady && showMobileInquiryHint
                    ? "translateX(-50%) translateY(0)"
                    : "translateX(-50%) translateY(8px) scale(0.96)",
              }}
            >
              평균 응답 10분 이내
            </div>
            <button
              className={`${styles.ghostButton} ${styles.mobileGhostButton}`}
              type="button"
              onClick={() => {
                window.location.href = "/trust";
              }}
            >
              규정 안내
            </button>
          </div>
          <button
            className={`${styles.purchaseButton} ${styles.mobilePurchaseButton}`}
            type="button"
            onClick={() => handleInquiry("album_mobile_action_bar")}
          >
            제작 문의하기
          </button>
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <strong className={styles.footerName}>HipArchive</strong>
          <div className={styles.footerLinks}>
            <Link href="/trust" className={styles.footerLink}>
              환불/규정 안내
            </Link>
          </div>
          <p className={styles.footerMeta}>
            작업 범위와 일정은 상담 내용에 따라 조정될 수 있습니다. 최종 진행 전 작업 방향과 전달 파일을
            함께 안내해드립니다.
          </p>
        </div>
      </footer>
    </main>
  );
}
