import Image from "next/image";
import { useTranslations } from "next-intl";
import { SHELL } from "@/constants/site";

/**
 * Story — Brand Note (Brand Story 인라인 통합)
 *
 * 중앙 정렬:
 * - eyebrow → 큰 명조 한 줄 → signature → photo → manifesto 2줄
 *   + dotted-rule pull → 3-cell principles
 */
export default function StorySection() {
  const t = useTranslations("story");

  return (
    <section
      id="story"
      className="story py-[160px] border-t border-line text-center bg-background max-md:py-[80px]"
    >
      <div className={SHELL}>
        <div className="reveal inline-flex justify-center font-en text-[11px] tracking-[0.22em] uppercase text-green mb-[48px] gap-[10px] items-baseline">
          <span className="num text-ink-mute tracking-[0.18em]">
            {t("eyebrowNumber")}
          </span>
          <span className="inline-block w-[18px] h-px bg-green -translate-y-[3px]" />
          <span>{t("eyebrowLabel")}</span>
        </div>

        <h2 className="reveal font-normal text-[clamp(34px,4.4vw,64px)] leading-[1.32] tracking-[-0.02em] text-balance max-w-[18ch] mx-auto text-ink m-0 max-md:text-[32px]">
          {t("pull1")}{" "}
          <span className="text-green">{t("pullHighlight")}</span>
        </h2>
        <div className="reveal mt-[36px] font-en text-[11px] tracking-[0.22em] uppercase text-ink-mute">
          {t("sig")}
        </div>

        <figure className="reveal mt-[48px] mx-auto w-[min(560px,80%)] relative bg-bg-warm m-0">
          <Image
            src="/home/ref-wishlist.jpg"
            alt=""
            width={800}
            height={500}
            className="w-full h-[340px] object-cover block grayscale-[0.05]"
          />
          <span className="absolute left-[14px] bottom-[12px] font-en text-[10px] tracking-[0.18em] uppercase text-white bg-[rgba(15,61,46,0.85)] px-[10px] py-[4px]">
            {t("photoCaption")}
          </span>
        </figure>

        <div className="reveal mx-auto mt-[96px] max-w-[46ch] text-center font-serif font-light text-[clamp(22px,2.2vw,28px)] leading-[1.7] text-ink tracking-[-0.005em] max-md:text-[18px] max-md:mt-[64px] max-md:px-[18px]">
          <p className="mb-[1em]">
            {t("manifesto1")}
            <br />
            {t("manifesto2")}
          </p>
          <p className="text-green border-t border-b border-dotted border-line py-[18px] mt-[32px] mb-0">
            {t("manifestoPull1")}
            <br />
            {t("manifestoPull2")}
          </p>
        </div>

        <div className="reveal mx-auto mt-[96px] max-w-[880px] grid grid-cols-3 border-t border-green border-b border-line max-md:grid-cols-1 max-md:mt-[64px]">
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
