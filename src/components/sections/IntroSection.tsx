import Image from "next/image";
import { useTranslations } from "next-intl";
import SectionEyebrow from "@/components/ui/SectionEyebrow";

/**
 * Intro — 왜 만들었나
 *
 * 디자인 사양:
 * - 풀블리드 (max-width 없음, 좌우 56px만 여백)
 * - 상단 dotted rule + meta 두 줄
 * - 큰 명조 헤드라인 (9.2vw)
 * - 3-cell problem cards (큰 이탤릭 number)
 * - closing 한 줄
 * - editorial pull 라인
 * - field note + photo
 */
export default function IntroSection() {
  const t = useTranslations("intro");

  return (
    <section className="intro relative bg-background border-t border-line">
      <div className="reveal grid grid-cols-[200px_1fr_200px] items-center pt-[38px] gap-[24px] px-[56px] max-md:grid-cols-1 max-md:pt-[24px] max-md:px-[18px]">
        <div className="font-en text-[11px] tracking-[0.22em] uppercase text-ink-mute">
          {t("topLeft")}
        </div>
        <div className="h-px bg-green w-full max-md:hidden" />
        <div className="font-en text-[11px] tracking-[0.22em] uppercase text-ink-mute text-right max-md:hidden">
          {t("topRight")}
        </div>
      </div>

      <div className="px-[56px] pt-[80px] pb-[28px] flex flex-col gap-[24px] max-md:px-[18px] max-md:pt-[48px] max-md:pb-[24px]">
        <SectionEyebrow number={t("eyebrowNumber")} label={t("eyebrowLabel")} />
        <h2 className="reveal font-serif font-light text-[clamp(56px,9.2vw,164px)] leading-[0.98] tracking-[-0.035em] text-ink text-balance m-0 max-md:text-[44px]">
          {t("headline1")}
          <br />
          {t("headline2")}{" "}
          <span className="font-fraunces italic font-light text-green">
            {t("headlineHighlight")}
          </span>
        </h2>
      </div>

      <div className="reveal grid grid-cols-3 border-t border-green border-b border-line mt-[48px] mx-0 max-md:grid-cols-1 max-md:mt-[28px]">
        <ProblemCard
          n={t("card1Number")}
          title={t("card1Title")}
          body={t("card1Body")}
        />
        <ProblemCard
          n={t("card2Number")}
          title={t("card2Title")}
          body={t("card2Body")}
        />
        <ProblemCard
          n={t("card3Number")}
          title={t("card3Title")}
          body={t("card3Body")}
          last
        />
      </div>

      <div className="reveal grid grid-cols-[200px_1fr_200px] items-start gap-[24px] px-[56px] pt-[80px] pb-[110px] max-md:grid-cols-1 max-md:px-[18px] max-md:pt-[48px] max-md:pb-[64px]">
        <div className="font-en text-[11px] tracking-[0.22em] uppercase text-green pt-[14px]">
          {t("closeLabel")}
        </div>
        <p className="font-serif font-light text-[clamp(24px,2.4vw,34px)] leading-[1.45] tracking-[-0.014em] text-ink text-balance m-0 max-w-[32ch] justify-self-start max-md:text-[20px]">
          {t("closeText")}{" "}
          <span className="font-fraunces italic text-green">
            {t("closeHighlight")}
          </span>
        </p>
        <div className="font-en text-[11px] tracking-[0.22em] uppercase text-ink-mute text-right max-md:hidden">
          {t("closeRight")}
        </div>
      </div>

      <div className="reveal mt-[80px] pt-[24px] border-t border-dotted border-line flex justify-between gap-[24px] font-en text-[11px] tracking-[0.06em] uppercase text-ink-mute px-[56px] max-md:px-[18px] max-md:flex-col max-md:mt-[40px]">
        <span>{t("pull1")}</span>
        <span>{t("pull2")}</span>
        <span>{t("pull3")}</span>
      </div>

      <div className="reveal mt-[80px] pt-[36px] border-t border-dotted border-line grid grid-cols-2 gap-[36px] items-end px-[56px] pb-[80px] max-md:grid-cols-1 max-md:gap-[18px] max-md:px-[18px] max-md:mt-[40px] max-md:pb-[48px]">
        <figure className="m-0 bg-bg-warm relative">
          <Image
            src="/home/ref-khaki.jpg"
            alt=""
            width={1200}
            height={760}
            className="w-full h-[380px] object-cover block max-md:h-[300px]"
          />
        </figure>
        <div className="font-en text-[14px] leading-[1.75] text-ink tracking-[0.005em] max-w-[36ch] pb-[8px]">
          <span className="block text-[11px] tracking-[0.22em] uppercase text-green mb-[14px] font-medium">
            {t("noteLabel")}
          </span>
          {t("noteLine1")}
          <br />
          {t("noteLine2")}
          <br />
          <br />
          {t("noteLine3")}
          <br />
          {t("noteLine4")}
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface ProblemCardProps {
  n: string;
  title: string;
  body: string;
  last?: boolean;
}

function ProblemCard({ n, title, body, last }: ProblemCardProps) {
  return (
    <div
      className={`px-[56px] pt-[48px] pb-[56px] bg-background relative max-md:px-[18px] max-md:py-[32px] ${
        last
          ? ""
          : "border-r border-dotted border-line max-md:border-r-0 max-md:border-b max-md:border-b-dotted max-md:border-line"
      }`}
    >
      <span className="num font-fraunces italic font-light text-[84px] text-green leading-none tracking-[-0.03em] block mb-[32px] max-md:text-[54px] max-md:mb-[18px]">
        {n}
      </span>
      <h5 className="font-serif font-normal text-[26px] tracking-[-0.018em] text-ink mb-[14px] leading-[1.3] max-md:text-[20px]">
        {title}
      </h5>
      <p className="text-[15px] leading-[1.75] text-ink-soft max-w-[28ch]">
        {body}
      </p>
    </div>
  );
}
