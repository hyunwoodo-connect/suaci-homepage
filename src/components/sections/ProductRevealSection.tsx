import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * Product Reveal — 베이지/초록 스플릿 배경 제품 섹션.
 *
 * 구조:
 * - 전체 배경: beige, 오른쪽 38%에 green strip
 * - 3-col grid: left(meta + 큰 01) / center(보틀 float) / right(제품 정보 on green)
 * - 코너 라벨 (TL, BL)
 */
export default function ProductRevealSection() {
  const t = useTranslations("productReveal");

  return (
    <section id="product" className="relative bg-beige overflow-hidden">
      {/* Green strip on right */}
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 w-[38%] h-full bg-green z-0 max-lg:w-full max-lg:h-[60%] max-lg:top-auto max-lg:bottom-0"
      />

      {/* Corner labels */}
      <span className="absolute top-[48px] left-[32px] font-en text-[10px] tracking-[0.32em] uppercase text-ink-mute z-[3]">
        {t("cornerTL")}
      </span>
      <span className="absolute bottom-[48px] left-[32px] font-en text-[10px] tracking-[0.32em] uppercase text-green font-medium z-[3]">
        {t("cornerBL")}
      </span>

      {/* Main grid */}
      <div className="relative z-[2] max-w-[1480px] mx-auto px-[18px] md:px-[32px] py-[140px] grid grid-cols-[1fr_1.05fr_1fr] gap-[48px] items-end min-h-[920px] max-lg:grid-cols-1 max-lg:gap-[40px] max-lg:py-[80px] max-lg:min-h-0">
        {/* Left meta */}
        <div className="self-start pt-[24px]">
          <div className="reveal font-en text-[11px] tracking-[0.32em] uppercase text-ink-mute mb-[18px]">
            {t("metaLabel")}
          </div>
          <div className="reveal reveal-delay-1 font-en text-[13vw] leading-[0.85] font-medium text-green tracking-[-0.05em] max-lg:text-[120px]">
            {t("index")}
            <sup className="text-[0.18em] tracking-[0.32em] uppercase text-ink-mute align-top inline-block translate-y-[0.6em] ml-[0.2em] font-medium">
              {t("indexSup")}
            </sup>
          </div>
        </div>

        {/* Center bottle */}
        <div className="relative flex justify-center items-end h-full">
          <Image
            src="/image/suaci-bottle.png"
            alt="짙은 초록색 SUACI Daily Calming Mist 보틀"
            width={400}
            height={780}
            priority
            className="max-h-[780px] w-auto [animation:bottleFloat_7s_ease-in-out_infinite] drop-shadow-[0_40px_80px_rgba(15,61,46,0.32)] origin-bottom"
          />
        </div>

        {/* Right product info (on green) */}
        <div className="reveal reveal-delay-2 text-cream-on-green self-end pb-0">
          <span className="micro text-cream-on-green/55">{t("micro")}</span>
          <h3 className="font-serif font-light text-[clamp(34px,3.6vw,52px)] leading-[1.1] tracking-[-0.02em] text-cream-on-green mt-[14px] mb-[10px] m-0 text-balance">
            {t("name1")}
            <br />
            {t("name2")}
          </h3>
          <span className="font-en text-[12px] tracking-[0.22em] uppercase text-cream-on-green/55 mb-[32px] block">
            {t("volume")}
          </span>

          {/* Spec rows */}
          <dl className="flex items-baseline justify-between gap-[24px] py-[18px] border-t border-b border-cream-on-green/[0.18] m-0">
            <dt className="font-en text-[11px] tracking-[0.22em] uppercase text-cream-on-green/55">
              {t("phKey")}
            </dt>
            <dd className="m-0 font-en text-[14px] text-cream-on-green tracking-[0.04em]">
              {t("phValue")}
            </dd>
          </dl>
          <dl className="flex items-baseline justify-between gap-[24px] py-[18px] border-b border-cream-on-green/[0.18] m-0">
            <dt className="font-en text-[11px] tracking-[0.22em] uppercase text-cream-on-green/55">
              {t("formatKey")}
            </dt>
            <dd className="m-0 font-en text-[14px] text-cream-on-green tracking-[0.04em]">
              {t("formatValue")}
            </dd>
          </dl>
          <dl className="flex items-baseline justify-between gap-[24px] py-[18px] border-b border-cream-on-green/[0.18] m-0">
            <dt className="font-en text-[11px] tracking-[0.22em] uppercase text-cream-on-green/55">
              {t("shipKey")}
            </dt>
            <dd className="m-0 font-en text-[14px] text-cream-on-green tracking-[0.04em]">
              {t("shipValue")}
            </dd>
          </dl>

          {/* Price */}
          <div className="flex items-baseline gap-[14px] mt-[30px] mb-[28px]">
            <s className="font-en text-cream-on-green/45">{t("priceOld")}</s>
            <b className="font-en font-medium text-[26px] tracking-[-0.005em] text-cream-on-green">
              {t("priceNew")}
            </b>
            <em className="not-italic font-en text-[11px] tracking-[0.22em] uppercase text-[#dbe6c8] px-[8px] py-[4px] border border-cream-on-green/50 ml-[2px]">
              {t("priceBadge")}
            </em>
          </div>

          {/* CTA buttons */}
          <div className="flex gap-0 border border-cream-on-green/60">
            <a
              href="#"
              className="flex-1 py-[18px] px-[22px] font-en text-[11px] tracking-[0.32em] uppercase text-center text-cream-on-green hover:bg-cream-on-green hover:text-green transition-colors duration-250"
            >
              {t("ctaAdd")}
            </a>
            <a
              href="#"
              className="flex-1 py-[18px] px-[22px] font-en text-[11px] tracking-[0.32em] uppercase text-center text-cream-on-green border-l border-cream-on-green/60 hover:bg-cream-on-green hover:text-green transition-colors duration-250"
            >
              {t("ctaBuy")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
