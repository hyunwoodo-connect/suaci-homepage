import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * Moment Hero — 풀블리드 사용 사진 + 오버레이 텍스트.
 *
 * 구조:
 * - 100vh 사진 배경
 * - 그라데이션 오버레이
 * - 3-row 그리드: top(meta) / center(headline + body) / bottom(labels + pulsing dot)
 */
export default function MomentHeroSection() {
  const t = useTranslations("momentHero");

  return (
    <section id="moments" className="relative bg-black overflow-hidden text-[#f4efe1]">
      {/* Photo */}
      <div className="relative h-screen min-h-[760px] overflow-hidden max-sm:h-[80vh] max-sm:min-h-[520px]">
        <Image
          src="/image/usage/usage-01.jpg"
          alt="햇살 아래 가볍게 분사하는 한 순간"
          fill
          sizes="100vw"
          className="object-cover"
        />
        {/* Gradient overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(110deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,0) 38%,rgba(0,0,0,0) 65%,rgba(0,0,0,.35) 100%),linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(0,0,0,.5) 100%)",
          }}
        />
      </div>

      {/* Overlay content */}
      <div className="absolute inset-0 z-[2] max-w-[1480px] w-full left-1/2 -translate-x-1/2 mx-auto px-[18px] md:px-[32px] py-[80px] grid grid-rows-[auto_1fr_auto]">
        {/* Top */}
        <div className="flex justify-between items-start font-en text-[11px] tracking-[0.32em] uppercase text-[#f4efe1]/65">
          <span>
            <b className="text-[#f4efe1] font-medium">{t("topLeft")}</b>
            {" — "}
            {t("topLeftSub")}
          </span>
          <span>{t("topRight")}</span>
        </div>

        {/* Center */}
        <div className="self-center max-w-[780px]">
          <h2 className="font-fraunces italic font-light text-[clamp(54px,7.4vw,128px)] leading-[0.95] tracking-[-0.03em] m-0 mb-[24px] text-[#f4efe1] text-balance max-sm:text-[54px]">
            {t("headline1")}{" "}
            <span className="font-serif not-italic text-[#dbe6c8]">
              {t("headlineAccent")}
            </span>
            <br />
            {t("headline2")}
          </h2>
          <p className="font-serif font-light text-[17px] leading-[1.85] text-[#f4efe1]/78 max-w-[32ch] m-0">
            {t("body")}
          </p>
        </div>

        {/* Bottom */}
        <div className="flex justify-between items-end font-en text-[10px] tracking-[0.36em] uppercase text-[#f4efe1]/55">
          <span>
            <span className="inline-block w-[6px] h-[6px] rounded-full bg-cream-on-green mr-[10px] align-middle [animation:dotPulse_2s_ease-in-out_infinite]" />
            {t("bottomLeft")}
          </span>
          <span>{t("bottomRight")}</span>
        </div>
      </div>
    </section>
  );
}
