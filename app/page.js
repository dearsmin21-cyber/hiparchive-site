"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { siteConfig } from "./lib/site";
import {
  trackInquiryClick,
  trackNavClick,
  trackPackageSelection,
  trackPlanPickerOpen,
  trackPurchaseClick,
} from "./lib/analytics";
import styles from "./page.module.css";

const navItems = [
  { label: "작업 예시", href: "#작업-예시" },
  { label: "진행 방식", href: "#진행-방식" },
  { label: "FAQ", href: "#FAQ" },
];
const checkoutBaseUrl = "https://www.latpeed.com/products/ExM3O/pay?theme=light";
const inquiryUrl = "http://pf.kakao.com/_cxnmMX/chat";
const heroImageUrl = siteConfig.heroImage;

const showcaseVideos = [
  {
    src: "https://player.vimeo.com/video/1178139945?title=0&byline=0&portrait=0",
    title: "풀버전 리릭비디오 작업 예시",
    description:
      "곡 분위기에 맞춰 타이포와 가사 타이밍을 정교하게 구성한 고퀄리티 리릭비디오 제작 예시입니다.",
  },
  {
    src: "https://player.vimeo.com/video/1178140082?title=0&byline=0&portrait=0",
    title: "무드 중심 리릭비디오 작업 예시",
    description:
      "앨범커버와 배경 무드를 중심으로 화면 톤을 맞춘 lyric video 작업 예시입니다.",
  },
  {
    src: "https://player.vimeo.com/video/1178140001?title=0&byline=0&portrait=0",
    title: "숏폼 확장형 리릭비디오 예시",
    description:
      "메인 리릭비디오 흐름을 유지하면서 릴스·쇼츠형 활용까지 고려한 작업 예시입니다.",
  },
];

const processSteps = [
  {
    step: "01",
    title: "상담 및 자료 전달",
    description: "음원, 가사, 제목, 아티스트명, 앨범커버 또는 참고 무드를 전달받습니다.",
  },
  {
    step: "02",
    title: "디자인 방향 설정",
    description: "전달받은 분위기를 바탕으로 타이포와 화면 구성을 정리해 작업 방향을 맞춥니다.",
  },
  {
    step: "03",
    title: "시안 작업 및 수정",
    description: "초안 전달 후 피드백을 반영해 수정하고, 최종 결과물까지 마감합니다.",
  },
];

const requiredItems = [
  "음원 파일",
  "가사",
  "제목 / 아티스트명",
  "앨범커버",
  "릴스의 경우 하이라이트 타임라인",
];

const faqItems = [
  {
    question: "작업 기간은 얼마나 걸리나요?",
    answer: "작업 기간은 평균 1-2일 정도 소요됩니다. 음원 길이에 따라 편차가 있기 때문에 문의 부탁드립니다.",
  },
  {
    question: "배경 이미지도 작업 가능한가요?",
    answer: "가능합니다. 원하는 분위기만 공유해 주시면 그에 맞는 배경 방향으로 구성해드립니다.",
  },
  {
    question: "수정은 몇 번까지 가능한가요?",
    answer: "선택하신 패키지에 따라 수정 횟수가 다르며, 기본적으로 작업 방향이 크게 벗어나지 않는 선에서 반영해드립니다.",
  },
  {
    question: "앨범커버만 있어도 리릭비디오 제작이 가능한가요?",
    answer: "가능합니다. 앨범커버와 곡 무드만 있어도 전체 화면 방향을 잡아 리릭비디오를 제작할 수 있으며, 배경이 필요하면 별도로 구성해드립니다.",
  },
  {
    question: "리릭비디오 제작 비용은 어떻게 정해지나요?",
    answer: "작업 길이, 화면 구성 난이도, 숏폼 포함 여부에 따라 패키지가 나뉘며, 기본 패키지 외 커스텀 작업은 상담 후 안내드립니다.",
  },
  {
    question: "유튜브 업로드용과 숏폼용을 함께 제작할 수 있나요?",
    answer: "가능합니다. 메인 풀버전 리릭비디오를 중심으로 릴스·쇼츠형 숏폼까지 함께 구성할 수 있어 채널 운영 흐름에 맞춰 작업이 가능합니다.",
  },
  {
    question: "가사 타이밍은 자동으로 맞추나요?",
    answer: "아닙니다. 가사 타임라인은 곡의 분위기와 화면 전환에 맞춰 수작업으로 정리하고 있어 결과물 완성도를 더 높이는 방식으로 진행합니다.",
  },
];

const mobileServiceDescription = [
  {
    title: "서비스 설명",
    body: [
      "감도높은 디자인, HipArchive STUDIO 입니다\n아티스트님의 음원을 리릭비디오를 통해 리브랜딩 해드립니다",
      "영상 퀄리티를 높이기 위해 모든 가사 타임라인을 수작업으로 맞춰드리고 있으며,\n디자인 또한 커스텀으로 작업 진행하고 있습니다",
    ],
  },
  {
    title: "배경 안내",
    body: [
      "영상에 들어갈 배경 또는 앨범커버가 준비되어 있지 않으실 경우\n컨셉만 말씀해주시면 자체적으로 배경 제작 해드리고 있습니다",
    ],
  },
  {
    title: "영상 타입",
    body: [
      "기본적으로 1920X1080(FHD) 유튜브 영상 타입으로 작업이 진행되며,\n원하실 경우 숏폼(릴스/쇼츠) 또는 커스텀 사이즈로 작업 가능합니다",
    ],
  },
  {
    title: "작업 진행",
    steps: [
      "작업 요청(주문)",
      "작업자와 상담 및 자료 전달",
      "작업 시작",
      "아티스트에게 작업 시안 전송",
      "시안 수정 및 작업 종료",
    ],
  },
  {
    title: "전달 자료 안내",
    body: [
      "음원 파일, 가사, 제목/아티스트명, 앨범커버 또는 배경(선택사항), 기타 전달 사항",
    ],
  },
];

const reviewItems = [
  {
    author: "적극*****",
    rating: "4.9",
    timeline: "작업 기간 2일",
    amount: "주문 금액 5~10만원",
    text: "응답이 빠르고 소통도 매끄러워서 진행이 편했고, 요청한 분위기를 정확하게 반영해 결과물 완성도까지 만족스러웠습니다.",
  },
  {
    author: "ve*****",
    rating: "5.0",
    timeline: "작업 기간 1일",
    amount: "주문 금액 5만원 미만",
    text: "작업 속도가 빠른데도 결과물이 예쁘게 잘 나와서 만족했습니다. 짧은 일정 안에 깔끔하게 마감받고 싶을 때 믿고 맡길 수 있을 것 같습니다.",
  },
  {
    author: "K9*****",
    rating: "5.0",
    timeline: "작업 기간 2일",
    amount: "주문 금액 5~10만원",
    text: "요구사항에 맞춰 화면 구성을 꼼꼼하게 맞춰주셔서 이번에도 만족했습니다. 원하는 무드가 있을 때 믿고 다시 의뢰하기 좋은 작업이었습니다.",
  },
  {
    author: "Po*****",
    rating: "5.0",
    timeline: "작업 기간 2일",
    amount: "주문 금액 5~10만원",
    text: "결과물 자체도 만족스러웠고 응대가 친절해서 작업 내내 편하게 소통할 수 있었습니다. 다음 작업도 다시 맡기고 싶다는 생각이 들었습니다.",
  },
  {
    author: "ha*****",
    rating: "5.0",
    timeline: "작업 기간 2일",
    amount: "주문 금액 5~10만원",
    text: "음악 분위기에 맞는 화면 톤을 잘 잡아주셔서 곡의 인상이 더 또렷해졌습니다. 전체 무드가 자연스럽게 정리돼서 만족도가 높았습니다.",
  },
  {
    author: "유능*****",
    rating: "5.0",
    timeline: "작업 기간 1일",
    amount: "주문 금액 5만원 미만",
    text: "과하지 않게 깔끔하고 예쁘게 정리된 결과물이 마음에 들었습니다. 수정 반영도 빨라서 일정 맞추기에도 부담이 없었습니다.",
  },
  {
    author: "맛있*****",
    rating: "5.0",
    timeline: "작업 기간 2일",
    amount: "주문 금액 5~10만원",
    text: "트렌디한 감각으로 정리해주신 데다 의견 반영과 수정 속도도 빨라서 전체 진행이 매끄러웠습니다. 결과물 퀄리티도 기대 이상이었습니다.",
  },
  {
    author: "21*****",
    rating: "5.0",
    timeline: "작업 기간 2일",
    amount: "주문 금액 5~10만원",
    text: "곡 분위기가 잘 살아나는 리릭비디오를 받아서 만족했습니다. 발매 전에 음악의 첫인상을 정리하고 싶을 때 잘 맞는 작업이라고 느꼈습니다.",
  },
];

const reviewBreakdown = [
  { label: "결과물 만족도", score: 4.9 },
  { label: "친절한 상담", score: 5.0 },
  { label: "신속한 대응", score: 5.0 },
];

const packages = [
  {
    id: "standard",
    optionId: "69c4ea44be57430b853f23e3",
    name: "STANDARD",
    price: "29,000원",
    subtitle: "High 퀄리티 릴스 리릭비디오 작업",
    description:
      "음원과 어울리는 릴스/쇼츠형 리릭비디오를 전문적으로 작업합니다. 광범위한 디자인적 요소를 사용합니다.",
    timeline: "1일",
    revisions: "3회",
    output: "세로형 숏폼 1종",
  },
  {
    id: "deluxe",
    optionId: "69c4ea44be57430b853f23e4",
    name: "DELUXE",
    price: "56,700원",
    originalPrice: "63,000원",
    benefitLabel: "기간 한정 10% 할인",
    subtitle: "High 퀄리티 리릭비디오 작업",
    description:
      "음원과 어울리는 리릭비디오를 전문적으로 작업합니다. 광범위한 디자인적 요소를 사용합니다.",
    timeline: "2일",
    revisions: "3회",
    output: "가로형 풀버전 1종",
  },
  {
    id: "premium",
    optionId: "69c4ea44be57430b853f23e5",
    name: "PREMIUM",
    price: "81,000원",
    originalPrice: "90,000원",
    benefitLabel: "기간 한정 10% 할인",
    subtitle: "High 퀄리티 리릭비디오 패키지",
    description:
      "숏폼 + 풀버전 리릭비디오를 올인원으로 작업해드립니다. 광범위한 디자인적 요소를 사용합니다.",
    timeline: "3일",
    revisions: "5회",
    output: "숏폼 1종 + 풀버전 1종",
  },
];

const homepageStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    alternateName: siteConfig.fullName,
    url: siteConfig.url,
    inLanguage: "ko-KR",
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    alternateName: siteConfig.fullName,
    url: siteConfig.url,
    logo: `${siteConfig.url}/icon.png`,
    image: heroImageUrl,
    sameAs: [inquiryUrl],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: inquiryUrl,
        availableLanguage: ["ko"],
      },
    ],
  },
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
    name: "리릭비디오 제작",
    serviceType: "고퀄리티 리릭비디오 및 가사 영상 제작",
    provider: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    areaServed: "KR",
    url: siteConfig.url,
    description: siteConfig.description,
    offers: packages.map((item) => ({
      "@type": "Offer",
      name: item.subtitle,
      priceCurrency: "KRW",
      price: item.price.replace(/[^\d]/g, ""),
      description: item.description,
      availability: "https://schema.org/InStock",
      url: siteConfig.url,
    })),
  },
];

function MainPreviewImage() {
  return (
    <div className={`${styles.previewCard} ${styles.previewFeatured} ${styles.previewImageCard}`}>
      <img className={styles.previewImage} src={heroImageUrl} alt="리릭비디오 대표 작업 예시" />
    </div>
  );
}

export default function Page() {
  const [selectedPackage, setSelectedPackage] = useState("standard");
  const [mobileSelectedPackage, setMobileSelectedPackage] = useState("standard");
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [showAllVideos, setShowAllVideos] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showMobileServiceDetails, setShowMobileServiceDetails] = useState(false);
  const [showMobilePackagePicker, setShowMobilePackagePicker] = useState(false);
  const [showMobileInquiryHint, setShowMobileInquiryHint] = useState(true);
  const [mobileInquiryHintReady, setMobileInquiryHintReady] = useState(false);

  const activePackage =
    packages.find((item) => item.id === selectedPackage) || packages[0];
  const mobileActivePackage =
    packages.find((item) => item.id === mobileSelectedPackage) || activePackage;
  const activePackageIndex = Math.max(
    0,
    packages.findIndex((item) => item.id === activePackage.id),
  );
  const shouldShowMobileInquiryHint =
    mobileInquiryHintReady && showMobileInquiryHint && !showMobilePackagePicker;

  function handlePurchase(packageId = activePackage.id, location = "package_card") {
    const targetPackage =
      packages.find((item) => item.id === packageId) || activePackage;
    const optionId = targetPackage?.optionId;
    const targetUrl = new URL(checkoutBaseUrl);

    trackPurchaseClick(targetPackage, location);

    if (optionId) {
      targetUrl.searchParams.set("option_id", optionId);
    }
    setShowMobilePackagePicker(false);
    window.location.href = targetUrl.toString();
  }

  function handleInquiry(location = "general") {
    trackInquiryClick(location);
    setShowMobilePackagePicker(false);
    window.location.href = inquiryUrl;
  }

  function handleMobilePurchase() {
    if (typeof window !== "undefined" && window.innerWidth <= 860 && !showMobilePackagePicker) {
      setMobileSelectedPackage(selectedPackage);
      trackPlanPickerOpen(packages.find((item) => item.id === selectedPackage) || packages[0]);
      setShowMobilePackagePicker(true);
      return;
    }
    handlePurchase(mobileSelectedPackage, "mobile_action_bar");
  }

  function handleMainPackageSelection(packageId) {
    const nextPackage = packages.find((item) => item.id === packageId);
    setSelectedPackage(packageId);
    if (nextPackage) {
      trackPackageSelection(nextPackage, "main_package_tabs");
    }
  }

  function handleMobilePackageSelection(packageId) {
    const nextPackage = packages.find((item) => item.id === packageId);
    setMobileSelectedPackage(packageId);
    if (nextPackage) {
      trackPackageSelection(nextPackage, "mobile_plan_picker");
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (window.innerWidth <= 860) {
      setSelectedPackage("deluxe");
      setMobileSelectedPackage("deluxe");
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
      {homepageStructuredData.map((item) => (
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
                onClick={() => trackNavClick(item.label)}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <button
            className={styles.headerCta}
            type="button"
            onClick={() => handleInquiry("header")}
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
                  trackNavClick(`mobile_${item.label}`);
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
          <div className={styles.eyebrow}>CUSTOM LYRIC VIDEO</div>
          <h1 className={styles.heroTitle}>감도높은 고퀄리티 리릭비디오 작업해드립니다</h1>
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
              <span className={styles.sectionKicker}>Video</span>
              <h2 className={styles.sectionTitle}>작업 영상 예시</h2>
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
                    아래 자료를 보내주시면 상담 후 바로 작업 방향을 빠르게 맞출 수 있습니다.
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

            <div
              className={styles.packageTabs}
              style={{ "--package-index": activePackageIndex }}
            >
              <span className={styles.packageIndicator} aria-hidden="true" />
              {packages.map((item) => (
                <button
                  key={item.id}
                  className={`${styles.packageTab} ${
                    item.id === activePackage.id ? styles.packageTabActive : ""
                  }`}
                  type="button"
                  onClick={() => handleMainPackageSelection(item.id)}
                >
                  <span className={styles.packageTabName}>{item.name}</span>
                </button>
              ))}
            </div>

            <div className={styles.packageBody}>
              {activePackage.benefitLabel ? (
                <div className={styles.packageBenefit}>{activePackage.benefitLabel}</div>
              ) : null}
              <div className={styles.packagePriceRow}>
                <div className={styles.packagePrice}>{activePackage.price}</div>
                {activePackage.originalPrice ? (
                  <div className={styles.packageOriginalPrice}>{activePackage.originalPrice}</div>
                ) : null}
              </div>
              <div className={styles.packageSubtitle}>{activePackage.subtitle}</div>
              <div className={styles.packageTrustLine}>
                {activePackage.id === "deluxe" ? (
                  <span className={styles.packageTrustAccent}>가장 많이 선택되는 플랜</span>
                ) : (
                  <span>
                    최근 30일 기준 {activePackage.id === "premium" ? "6건 이상" : "12건 작업"}
                  </span>
                )}
                <span>
                  평균 작업 {activePackage.id === "premium" ? "2일" : "24시간"} 이내
                </span>
              </div>
              <p className={styles.packageDescription}>{activePackage.description}</p>

              <dl className={styles.packageMeta}>
                <div>
                  <dt>작업 기간</dt>
                  <dd>{activePackage.timeline}</dd>
                </div>
                <div>
                  <dt>수정 횟수</dt>
                  <dd>{activePackage.revisions}</dd>
                </div>
                <div>
                  <dt>결과물</dt>
                  <dd>{activePackage.output}</dd>
                </div>
              </dl>

              <div className={styles.packageActions}>
                <button
                  className={styles.purchaseButton}
                  type="button"
                  onClick={() => handlePurchase(activePackage.id, "package_card")}
                >
                  구매하기
                </button>
                <button
                  className={styles.ghostButton}
                  type="button"
                  onClick={() => handleInquiry("package_card")}
                >
                  바로 문의하기
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
            {reviewItems.map((item) => (
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
        </div>
      </section>

      <div className={styles.mobileActionBar}>
        <div className={styles.mobileActionBarInner}>
          <div
            id="mobile-plan-picker"
            className={`${styles.mobilePlanPicker} ${
              showMobilePackagePicker ? styles.mobilePlanPickerOpen : ""
            }`}
          >
            <div className={styles.mobilePlanPickerTop}>
              <div>
                <div className={styles.mobilePlanPickerLabel}>구매 플랜 선택</div>
                <div className={styles.mobilePlanPickerHint}>선택한 플랜으로 결제 페이지가 열립니다.</div>
              </div>
              <button
                type="button"
                className={styles.mobilePlanPickerClose}
                aria-label="플랜 선택 닫기"
                onClick={() => setShowMobilePackagePicker(false)}
              >
                <svg
                  className={styles.mobilePlanPickerCloseIcon}
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 4l8 8M12 4 4 12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {mobileActivePackage.benefitLabel ? (
              <div className={styles.mobilePlanPickerBenefit}>{mobileActivePackage.benefitLabel}</div>
            ) : null}

            <div className={styles.mobilePlanPickerPriceRow}>
              <strong className={styles.mobilePlanPickerPrice}>{mobileActivePackage.price}</strong>
              {mobileActivePackage.originalPrice ? (
                <span className={styles.mobilePlanPickerOriginalPrice}>
                  {mobileActivePackage.originalPrice}
                </span>
              ) : null}
            </div>

            <div className={styles.mobilePlanSelectWrap}>
              <select
                id="mobile-plan-select"
                className={styles.mobilePlanSelect}
                value={mobileSelectedPackage}
                onChange={(event) => handleMobilePackageSelection(event.target.value)}
              >
                {packages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.price}
                    {item.benefitLabel ? ` · ${item.benefitLabel}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.mobileInquiryWrap}>
            <div
              className={styles.mobileInquiryHint}
              aria-hidden={!shouldShowMobileInquiryHint}
              style={{
                opacity: shouldShowMobileInquiryHint ? 1 : 0,
                visibility: shouldShowMobileInquiryHint ? "visible" : "hidden",
                pointerEvents: shouldShowMobileInquiryHint ? "auto" : "none",
                transform: shouldShowMobileInquiryHint
                  ? "translateX(-50%) translateY(0)"
                  : "translateX(-50%) translateY(8px) scale(0.96)",
              }}
            >
              평균 응답 10분 이내
            </div>
            <button
              className={`${styles.ghostButton} ${styles.mobileGhostButton}`}
              type="button"
              onClick={() => handleInquiry("mobile_action_bar")}
            >
              바로 문의하기
            </button>
          </div>
          <button
            className={`${styles.purchaseButton} ${styles.mobilePurchaseButton}`}
            type="button"
            onClick={handleMobilePurchase}
            aria-expanded={showMobilePackagePicker}
            aria-controls="mobile-plan-picker"
          >
            구매하기
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
            결제는 외부 결제 페이지를 통해 진행됩니다. 최종 작업 범위와 일정은 상담 내용에 따라
            조정될 수 있습니다.
          </p>
        </div>
      </footer>
    </main>
  );
}
