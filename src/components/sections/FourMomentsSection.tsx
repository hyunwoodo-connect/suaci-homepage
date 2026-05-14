import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * Four Moments — 지그재그 레이아웃.
 *
 * 구조:
 * - 헤더: eyebrow + 대형 headline
 * - 4개 아이템, 홀수/짝수 교대로 photo/text 위치 교체
 * - 사진 위에 큰 번호 (CSS ::before via data-num)
 * - 사진 hover시 scale 효과
 */

interface MomentItemData {
  num: string;
  micro: string;
  title1: string;
  titleAccent: string;
  body: string;
  where: string;
  image: string;
  alt: string;
  flip: boolean;
}

export default function FourMomentsSection() {
  const t = useTranslations("fourMoments");

  const items: MomentItemData[] = [
    {
      num: "01",
      micro: t("moment1Micro"),
      title1: t("moment1Title1"),
      titleAccent: t("moment1TitleAccent"),
      body: t("moment1Body"),
      where: t("moment1Where"),
      image: "/image/daily/daily-03.jpg",
      alt: "책상 앞, 차분한 작업의 시간",
      flip: false,
    },
    {
      num: "02",
      micro: t("moment2Micro"),
      title1: t("moment2Title1"),
      titleAccent: t("moment2TitleAccent"),
      body: t("moment2Body"),
      where: t("moment2Where"),
      image: "/image/daily/daily-05.jpg",
      alt: "일상의 작은 디테일, 화장 위에",
      flip: true,
    },
    {
      num: "03",
      micro: t("moment3Micro"),
      title1: t("moment3Title1"),
      titleAccent: t("moment3TitleAccent"),
      body: t("moment3Body"),
      where: t("moment3Where"),
      image: "/image/mood/mood-04.jpg",
      alt: "햇살 가득한 야외",
      flip: false,
    },
    {
      num: "04",
      micro: t("moment4Micro"),
      title1: t("moment4Title1"),
      titleAccent: t("moment4TitleAccent"),
      body: t("moment4Body"),
      where: t("moment4Where"),
      image: "/image/daily/daily-02.jpg",
      alt: "저녁의 마침표",
      flip: true,
    },
  ];

  return (
    <section className="relative bg-background py-[160px] max-sm:py-[88px]">
      {/* Header */}
      <div className="max-w-[1480px] mx-auto mb-[100px] px-[18px] md:px-[32px] grid grid-cols-[160px_1fr] gap-[48px] items-end max-sm:grid-cols-1 max-sm:mb-[56px]">
        <span className="micro text-green font-medium">
          {t("eyebrow")}
        </span>
        <h2 className="reveal m-0 font-serif font-light text-[clamp(44px,5.2vw,82px)] leading-[1.04] tracking-[-0.025em] text-balance max-w-[18ch]">
          {t("headline1")}
          <br />
          <span className="font-fraunces italic text-green">
            {t("headlineAccent")}
          </span>
        </h2>
      </div>

      {/* Items */}
      {items.map((item) => (
        <MomentItem key={item.num} item={item} />
      ))}
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface MomentItemProps {
  item: MomentItemData;
}

function MomentItem({ item }: MomentItemProps) {
  return (
    <div
      className={`reveal max-w-[1480px] mx-auto mb-[40px] px-[18px] md:px-[32px] grid grid-cols-2 gap-[80px] items-center min-h-[560px] relative max-lg:grid-cols-1 max-lg:gap-[24px] max-lg:min-h-0`}
    >
      {/* Photo */}
      <figure
        data-num={item.num}
        className={`relative h-[560px] overflow-hidden bg-beige m-0 group max-lg:h-[420px] ${
          item.flip ? "order-2 max-lg:order-0" : ""
        } before:content-[attr(data-num)] before:absolute before:top-[-20px] before:z-[2] before:font-en before:font-medium before:text-[200px] before:leading-[0.8] before:text-green before:tracking-[-0.05em] before:pointer-events-none max-lg:before:text-[120px] ${
          item.flip
            ? "before:left-auto before:right-[-12px]"
            : "before:left-[-12px]"
        }`}
      >
        <Image
          src={item.image}
          alt={item.alt}
          fill
          sizes="(max-width: 1100px) 100vw, 50vw"
          className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
        />
      </figure>

      {/* Text */}
      <div className="flex flex-col gap-[24px] px-[24px] max-lg:px-0">
        <span className="micro text-green font-medium">{item.micro}</span>
        <h3 className="m-0 font-serif font-light text-[clamp(34px,3.6vw,52px)] leading-[1.12] tracking-[-0.02em] text-balance">
          {item.title1}{" "}
          <span className="font-fraunces italic text-green">
            {item.titleAccent}
          </span>
        </h3>
        <p className="m-0 text-ink-soft text-[16px] leading-[1.85] max-w-[32ch]">
          {item.body}
        </p>
        <span className="mt-[8px] font-en text-[10px] tracking-[0.32em] uppercase text-ink-mute">
          {item.where}
        </span>
      </div>
    </div>
  );
}
