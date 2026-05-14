import { useTranslations } from "next-intl";

/**
 * Band — 짙은 초록 배경 매니페스토 섹션.
 *
 * 구조:
 * - 거대한 "suaci" 워터마크 (green-2 색상, 뒤)
 * - 상단: 두 개의 meta 라벨
 * - 대형 Fraunces italic 헤드라인: "Calm, not cured."
 * - 하단: serif 본문 + 서명 블록
 */
export default function BandSection() {
  const t = useTranslations("band");

  return (
    <section
      id="story"
      className="relative bg-green text-cream-on-green py-[160px] overflow-hidden max-sm:py-[96px]"
    >
      {/* Watermark */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 -bottom-[32%] -translate-x-1/2 font-en font-medium text-[48vw] tracking-[-0.06em] leading-[0.8] text-green-2 opacity-85 pointer-events-none select-none"
      >
        suaci
      </div>

      {/* Content */}
      <div className="relative z-[2] max-w-[1480px] mx-auto px-[18px] md:px-[32px]">
        {/* Top labels */}
        <div className="flex items-start justify-between mb-[120px] font-en text-[11px] tracking-[0.32em] uppercase text-cream-on-green/55 max-sm:mb-0">
          <span>
            <b className="text-cream-on-green font-medium">{t("topLeft")}</b>
            {" — "}
            {t("topLeftSub")}
          </span>
          <span>{t("topRight")}</span>
        </div>

        {/* Headline */}
        <h2 className="reveal m-0 font-fraunces italic font-light text-[clamp(48px,7vw,112px)] leading-none tracking-[-0.03em] text-balance max-w-[18ch]">
          {t("headline1")}{" "}
          <span className="font-serif not-italic text-[#dbe6c8]">
            {t("headlineAccent")}
          </span>
          <br />
          {t("headline2")}
        </h2>

        {/* Footer: body + signature */}
        <div className="mt-[120px] grid grid-cols-2 gap-[60px] items-end max-sm:grid-cols-1 max-sm:mt-[64px] max-sm:gap-[32px]">
          <div className="reveal reveal-delay-1 font-serif font-light text-[18px] leading-[1.85] text-cream-on-green/82 max-w-[34ch] tracking-[-0.005em]">
            <span className="block">{t("body1")}</span>
            <span className="block">{t("body2")}</span>
            <span className="block mt-[18px]">{t("body3")}</span>
          </div>
          <div className="reveal reveal-delay-2 justify-self-end text-right font-en text-[11px] tracking-[0.32em] uppercase text-cream-on-green/55 max-sm:justify-self-start max-sm:text-left">
            {t("signLabel")}
            <em className="block not-italic text-cream-on-green font-fraunces italic font-light normal-case tracking-[-0.01em] text-[22px] mt-[8px]">
              {t("signLine1")}
              <br />
              {t("signLine2")}
            </em>
          </div>
        </div>
      </div>
    </section>
  );
}
