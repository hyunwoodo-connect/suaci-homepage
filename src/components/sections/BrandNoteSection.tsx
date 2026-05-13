import { useTranslations } from "next-intl";
import { SECTION_PADDING_Y_LG, SHELL } from "@/constants/site";
import SectionEyebrow from "@/components/ui/SectionEyebrow";

/**
 * Brand Note — Intro + Story 통합 섹션.
 *
 * 구조 (중앙 정렬 매거진 톤):
 *   eyebrow → problem statement (2줄) → signature → manifesto headline
 *   → manifesto pull (dotted-bordered 2단락) → 3 principles row
 *
 * `id="story"`는 기존 푸터/헤더의 `/#story` 앵커 호환용.
 */
export default function BrandNoteSection() {
  const t = useTranslations("brandNote");

  return (
    <section
      id="story"
      className={`brand-note ${SECTION_PADDING_Y_LG} border-t border-line text-center bg-background`}
    >
      <div className={SHELL}>
        <div className="reveal inline-flex justify-center mb-[40px]">
          <SectionEyebrow number={t("eyebrowNumber")} label={t("eyebrowLabel")} />
        </div>

        <p className="reveal font-serif font-light text-[clamp(20px,2.4vw,28px)] leading-[1.55] text-ink-soft max-w-[28ch] mx-auto m-0 max-md:text-[18px]">
          {t("problemLine1")}
          <br />
          {t("problemLine2")}
        </p>

        <div className="reveal mt-[36px] font-en text-[11px] tracking-[0.22em] uppercase text-ink-mute">
          {t("signature")}
        </div>

        <h2 className="reveal mt-[48px] font-normal text-[clamp(34px,4.4vw,64px)] leading-[1.32] tracking-[-0.02em] text-balance max-w-[18ch] mx-auto text-ink m-0 max-md:text-[32px]">
          {t("manifestoHeadline1")}{" "}
          <span className="text-green">{t("manifestoHeadlineHighlight")}</span>
        </h2>

        <div className="reveal mx-auto mt-[64px] max-w-[46ch] text-center font-serif font-light text-[clamp(22px,2.2vw,28px)] leading-[1.7] text-green tracking-[-0.005em] border-t border-b border-dotted border-line py-[24px] max-md:text-[18px] max-md:mt-[48px] max-md:px-[18px]">
          <p className="m-0 mb-[1em]">
            {t("manifesto1")}
            <br />
            {t("manifesto2")}
          </p>
          <p className="m-0">
            {t("manifesto3")}
            <br />
            {t("manifesto4")}
          </p>
        </div>

        <div className="reveal mx-auto mt-[72px] max-w-[880px] grid grid-cols-3 border-t border-green border-b border-line max-md:grid-cols-1 max-md:mt-[48px]">
          <PrincipleCell n={t("principle1Number")} text={t("principle1")} />
          <PrincipleCell n={t("principle2Number")} text={t("principle2")} />
          <PrincipleCell n={t("principle3Number")} text={t("principle3")} last />
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface PrincipleCellProps {
  n: string;
  text: string;
  last?: boolean;
}

function PrincipleCell({ n, text, last }: PrincipleCellProps) {
  return (
    <div
      className={`px-[28px] py-[36px] text-left ${
        last
          ? ""
          : "border-r border-dotted border-line max-md:border-r-0 max-md:border-b max-md:border-line"
      } max-md:py-[22px] max-md:px-0`}
    >
      <span className="font-en font-light text-[36px] text-green leading-none tracking-[-0.02em] block mb-[18px]">
        {n}
      </span>
      <h4 className="font-serif font-normal text-[18px] tracking-[-0.01em] text-ink leading-[1.4] m-0">
        {text}
      </h4>
    </div>
  );
}
