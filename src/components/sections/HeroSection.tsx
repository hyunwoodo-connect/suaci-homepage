import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Hero — Home v2 풀블리드 매거진 히어로.
 *
 * 구조:
 * - 풀블리드 mood 사진 (heroBreathe 애니메이션)
 * - 그라데이션 오버레이 (하단 + 좌측)
 * - 코너 프레임 (1px white border inset 18px)
 * - 3-row 그리드: top(meta) / center(headline) / bottom(caption · scroll · CTA)
 */
export default function HeroSection() {
  const t = useTranslations("hero2");

  return (
    <section className="relative h-[calc(100vh-96px)] min-h-[680px] overflow-hidden bg-[#0a1a13] text-[#f4efe1] max-sm:h-[calc(100vh-86px)] max-sm:min-h-[560px]">
      {/* Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/banner.mp4" type="video/mp4" />
      </video>

      {/* Gradient overlays */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg,rgba(10,28,18,.10) 0%,rgba(10,28,18,0) 28%,rgba(10,28,18,.62) 100%),linear-gradient(90deg,rgba(10,28,18,.32) 0%,rgba(10,28,18,0) 38%)",
        }}
      />

      {/* Corner frame */}
      <span className="absolute inset-[18px] border border-[#f4efe1]/[0.18] pointer-events-none z-[1]" />

      {/* Content grid */}
      <div className="relative z-[2] h-full max-w-[1480px] mx-auto px-[18px] md:px-[32px] grid grid-rows-[auto_1fr_auto]">
        {/* Top: meta labels */}
        <div className="flex items-start justify-between pt-[36px]">
          <div className="micro micro--light">
            <b className="text-[#f4efe1] font-medium">{t("metaLeft")}</b>
            {" "}·{" "}
            {t("metaLeftSub")}
          </div>
          <div className="flex flex-col items-end gap-[6px]">
            <div className="micro micro--light">
              {t("issueLabel")}{" "}
              <b className="text-[#f4efe1] font-medium">{t("issueNumber")}</b>
            </div>
            <div className="micro micro--light">{t("issueSeason")}</div>
          </div>
        </div>

        {/* Center: headline */}
        <div className="flex items-end pb-[14px]">
          <h1 className="m-0 font-serif font-light text-[clamp(64px,9vw,148px)] leading-[0.95] tracking-[-0.035em] text-[#f4efe1] max-w-[14ch] text-balance max-sm:text-[60px]">
            {t("headline1")}
            <br />
            <span className="font-fraunces italic font-light text-[#dbe6c8]">
              {t("headline2")}
            </span>
            <span className="font-fraunces italic text-[#dbe6c8] inline-block ml-[0.04em]">
              .
            </span>
          </h1>
        </div>

        {/* Bottom: 3-col — caption / scroll / CTA */}
        <div className="grid grid-cols-3 items-end gap-[24px] pb-[40px] max-lg:grid-cols-2 max-lg:gap-[18px] max-sm:grid-cols-1 max-sm:pb-[24px]">
          {/* Caption */}
          <div className="max-lg:hidden">
            <b className="block font-en font-medium text-[11px] tracking-[0.32em] uppercase text-[#f4efe1]/55 mb-[14px] not-italic">
              {t("captionLabel")}
            </b>
            <div className="font-fraunces italic font-light text-[18px] leading-[1.4] text-[#f4efe1]/86 max-w-[28ch]">
              {t("captionText")
                .split("\n")
                .map((line, i, arr) => (
                  <span key={i}>
                    {line}
                    {i < arr.length - 1 && <br />}
                  </span>
                ))}
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="justify-self-center flex flex-col items-center gap-[10px] font-en text-[10px] tracking-[0.32em] uppercase text-[#f4efe1]/70 max-lg:hidden">
            {t("scroll")}
            <span className="w-px h-[32px] bg-[#f4efe1]/50" />
          </div>

          {/* CTA */}
          <div className="justify-self-end flex flex-col items-end gap-[10px] max-sm:justify-self-start max-sm:items-start">
            <span className="font-en font-medium text-[14px] tracking-[0.06em] text-[#f4efe1]/78">
              <s className="text-[#f4efe1]/45 mr-[8px] font-normal">
                {t("priceOld")}
              </s>
              {t("priceNew")} · {t("priceVolume")}
            </span>
            <Link
              href="/#product"
              className="font-en text-[11px] tracking-[0.32em] uppercase text-[#0a1a13] bg-[#f4efe1] px-[24px] py-[14px] inline-flex items-center gap-[14px] hover:-translate-y-[2px] transition-transform duration-250"
            >
              {t("cta")} <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
