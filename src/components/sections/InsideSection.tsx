import { useTranslations } from "next-intl";

/**
 * Inside — 짙은 초록 배경 성분/특성 리스트 섹션.
 *
 * 구조:
 * - 2-col: left(eyebrow + headline + body) / right(6-row 리스트)
 * - 각 row: 번호 / 한국어 키워드 / 영문 설명
 */
export default function InsideSection() {
  const t = useTranslations("inside");

  const rows = [
    { n: t("row1N"), k: t("row1K"), e: t("row1E") },
    { n: t("row2N"), k: t("row2K"), e: t("row2E") },
    { n: t("row3N"), k: t("row3K"), e: t("row3E") },
    { n: t("row4N"), k: t("row4K"), e: t("row4E") },
    { n: t("row5N"), k: t("row5K"), e: t("row5E") },
    { n: t("row6N"), k: t("row6K"), e: t("row6E") },
  ];

  return (
    <section className="relative bg-green text-cream-on-green py-[160px] overflow-hidden max-sm:py-[88px]">
      <div className="max-w-[1480px] mx-auto px-[18px] md:px-[32px] grid grid-cols-[1.2fr_1fr] gap-[120px] max-lg:grid-cols-1 max-lg:gap-[48px]">
        {/* Left */}
        <div className="flex flex-col gap-[32px]">
          <span className="micro text-cream-on-green/50">{t("eyebrow")}</span>
          <h2 className="m-0 font-serif font-light text-[clamp(40px,4.8vw,72px)] leading-[1.08] tracking-[-0.02em] text-cream-on-green max-w-[14ch] text-balance">
            {t("headline1")}{" "}
            <span className="font-fraunces italic text-[#dbe6c8]">
              {t("headlineAccent")}
            </span>
          </h2>
          <p className="text-cream-on-green/72 text-[16px] leading-[1.85] max-w-[36ch] mt-[12px] m-0">
            {t("body")}
          </p>
        </div>

        {/* Right — rows */}
        <div className="flex flex-col border-t border-cream-on-green/[0.22]">
          {rows.map((row) => (
            <div
              key={row.n}
              className="grid grid-cols-[60px_1fr_auto] gap-[18px] py-[24px] border-b border-cream-on-green/[0.22] items-baseline"
            >
              <span className="font-en text-[11px] tracking-[0.32em] text-cream-on-green/50 uppercase">
                {row.n}
              </span>
              <span className="font-serif font-light text-[24px] tracking-[-0.01em] text-cream-on-green leading-[1.2]">
                {row.k}
              </span>
              <span className="font-fraunces italic font-light text-[14px] text-cream-on-green/55 tracking-[-0.005em]">
                {row.e}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
