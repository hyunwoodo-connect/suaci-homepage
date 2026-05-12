import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * Hero — image-led split
 *
 * 좌측 42%: 칩 + 명조 헤드라인 + sub + commerce card
 * 우측 58%: 풀블리드 풍경 사진 크로스페이드 + 오버레이
 */
export default function HeroSection() {
  const t = useTranslations("hero");

  return (
    <section className="hero relative min-h-screen overflow-hidden bg-background">
      <div className="relative h-screen min-h-[680px] max-md:h-auto max-md:min-h-0">
        <div className="absolute inset-0 grid grid-cols-[minmax(420px,42%)_1fr] max-md:relative max-md:flex max-md:flex-col max-md:inset-auto">
          {/* ── 좌측 ── */}
          <div className="relative z-[2] flex flex-col gap-[32px] bg-background border-r border-line pt-[88px] pb-[52px] px-[56px] max-md:border-r-0 max-md:pt-[60px] max-md:pb-[32px] max-md:px-[22px] max-md:gap-[24px]">
            <div className="inline-flex items-center gap-[10px] self-start font-en text-[11px] tracking-[0.22em] uppercase text-green">
              <span className="w-[7px] h-[7px] rounded-full bg-green shadow-[0_0_0_5px_rgba(15,61,46,0.12)]" />
              <span>
                <b className="font-medium">{t("chipNumber")}</b>
                &nbsp;·&nbsp;{t("chipLabel")}
              </span>
            </div>

            <div className="hero-headline reveal mt-auto mb-0">
              <h1 className="font-serif font-light text-[clamp(46px,5.2vw,80px)] leading-[1.06] tracking-[-0.025em] text-ink text-balance max-w-[14ch] max-md:text-[42px] max-md:max-w-none">
                <span className="w">{t("headline1")} </span>
                <span className="w relative inline-block text-green">
                  {t("headlineHighlight")}
                  <span
                    aria-hidden="true"
                    className="absolute left-[-2px] right-[-2px] bottom-[0.08em] h-[0.42em] bg-[rgba(15,61,46,0.10)] -z-10"
                  />
                </span>
                <br />
                <span className="w">{t("headline2")}</span>
                <span className="w font-fraunces italic font-light text-green text-[0.92em] tracking-[-0.04em]">
                  {t("headlinePeriod")}
                </span>
              </h1>
            </div>

            <div className="text-[15px] leading-[1.75] text-ink-soft max-w-[32ch]">
              <span className="block font-en text-[11px] tracking-[0.22em] uppercase text-green mb-[10px]">
                {t("subLabel")}
              </span>
              {t("subText")
                .split("\n")
                .map((line, i, arr) => (
                  <span key={i}>
                    {line}
                    {i < arr.length - 1 && <br />}
                  </span>
                ))}
            </div>

            <div className="flex flex-col gap-[18px] pt-[24px] border-t border-line">
              <div className="flex items-center gap-[16px] max-md:flex-wrap">
                <div className="w-[72px] h-[90px] bg-bg-warm flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <Image
                    src="/home/suaci-bottle.png"
                    alt=""
                    width={72}
                    height={90}
                    className="h-[92%] w-auto object-contain drop-shadow-[0_6px_10px_rgba(15,61,46,0.18)]"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-[6px]">
                  <div className="font-medium text-[16px] text-ink tracking-[-0.01em]">
                    {t("productName")}{" "}
                    <em className="font-en not-italic font-normal text-ink-mute text-[12px] ml-[6px] tracking-[0.04em]">
                      {t("productVolume")}
                    </em>
                  </div>
                  <div className="font-en text-[11px] tracking-[0.16em] uppercase text-ink-mute flex gap-[10px] items-center">
                    <span className="text-green tracking-normal text-[12px]">
                      {t("rating")}
                    </span>
                    <span>{t("ratingCount")}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-[2px] text-right flex-shrink-0">
                  <span className="font-en text-[12px] text-ink-mute line-through">
                    {t("priceWas")}
                  </span>
                  <span className="font-en font-medium text-[22px] text-green tracking-[-0.01em]">
                    {t("priceNow")}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-[8px] max-md:grid-cols-1">
                <button
                  type="button"
                  className="px-[18px] py-[15px] text-[14px] font-medium tracking-[0.02em] text-center border border-green bg-green text-white hover:bg-foreground hover:border-foreground transition-colors"
                >
                  {t("ctaAddToCart")}
                </button>
                <button
                  type="button"
                  className="px-[18px] py-[15px] text-[14px] font-medium tracking-[0.02em] text-center border border-green text-green hover:bg-green hover:text-white transition-colors"
                >
                  {t("ctaBuyNow")}
                </button>
              </div>
              <div className="font-en text-[11px] tracking-[0.12em] uppercase text-ink-mute flex gap-[14px] items-center pt-[2px] flex-wrap">
                <span className="text-green font-medium">{t("shipFree")}</span>
                <span>{t("shipMin")}</span>
                <span>·</span>
                <span>{t("shipToday")}</span>
              </div>
            </div>
          </div>

          {/* ── 우측 ── */}
          <div className="relative overflow-hidden bg-[#1a2a20] max-md:h-[62vh] max-md:min-h-[380px]">
            <Image
              src="/home/hero-reading.jpg"
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 100vw, 58vw"
              className="hero-photo f1 object-cover"
            />
            <Image
              src="/home/hero-cat.jpg"
              alt=""
              fill
              sizes="(max-width: 900px) 100vw, 58vw"
              className="hero-photo f2 object-cover"
            />
            <Image
              src="/home/hero-lake.jpg"
              alt=""
              fill
              sizes="(max-width: 900px) 100vw, 58vw"
              className="hero-photo f3 object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none z-[1]"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%), linear-gradient(90deg, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0) 28%)",
              }}
            />
            <span className="absolute inset-[24px] border border-white/20 pointer-events-none z-[2] max-md:inset-[14px]" />

            <div className="absolute top-[36px] right-[36px] text-right flex flex-col gap-[6px] z-[3] font-en text-[11px] tracking-[0.22em] uppercase text-white/85 max-md:hidden">
              <span>
                {t("issue")} <b className="text-white font-medium">{t("issueNumber")}</b>
              </span>
              <span>{t("season")}</span>
            </div>
            <div className="absolute bottom-[36px] left-[36px] flex flex-col gap-[6px] z-[3] font-en text-[11px] tracking-[0.22em] uppercase text-white/85 max-md:hidden">
              <span>{t("fieldReel")}</span>
              <span>{t("fieldLocation")}</span>
            </div>
            <div className="absolute bottom-[36px] right-[36px] flex flex-col items-end gap-[14px] z-[3] font-en text-[11px] tracking-[0.22em] uppercase text-white/90 max-w-[30ch] max-md:hidden">
              <div className="font-fraunces italic font-light text-[24px] leading-[1.4] tracking-[-0.01em] normal-case text-white text-right">
                {t("quote")
                  .split("\n")
                  .map((line, i, arr) => (
                    <span key={i}>
                      {line}
                      {i < arr.length - 1 && <br />}
                    </span>
                  ))}
              </div>
              <span>{t("quoteCaption")}</span>
            </div>
            <div className="absolute left-1/2 bottom-[18px] -translate-x-1/2 z-[3] flex flex-col items-center gap-[10px] font-en text-[10px] tracking-[0.32em] uppercase text-white/75 [writing-mode:vertical-rl] [text-orientation:mixed] max-md:hidden">
              <span>{t("scroll")}</span>
              <span className="w-px h-[36px] bg-white/60" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
