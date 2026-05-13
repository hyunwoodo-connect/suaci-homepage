import { useTranslations } from "next-intl";
import { SHELL } from "@/constants/site";
import SectionEyebrow from "@/components/ui/SectionEyebrow";

interface QualityItem {
  n: string;
  titleKey: string;
  enKey: string;
  descKey: string;
}

const QUALITIES: QualityItem[] = [
  { n: "01", titleKey: "q1Title", enKey: "q1En", descKey: "q1Desc" },
  { n: "02", titleKey: "q2Title", enKey: "q2En", descKey: "q2Desc" },
  { n: "03", titleKey: "q3Title", enKey: "q3En", descKey: "q3Desc" },
  { n: "04", titleKey: "q4Title", enKey: "q4En", descKey: "q4Desc" },
];

/**
 * Qualities — 네 가지 결, 2x2 인덱스 리스트
 */
export default function QualitiesSection() {
  const t = useTranslations("qualities");

  return (
    <section className="qualities py-[140px] border-t border-line bg-bg-warm max-md:py-[80px]">
      <div className={SHELL}>
        <div className="grid grid-cols-[160px_1fr_1fr] gap-[48px] items-end mb-[80px] max-md:grid-cols-1 max-md:gap-[18px] max-md:mb-[36px]">
          <SectionEyebrow number={t("eyebrowNumber")} label={t("eyebrowLabel")} />
          <h2 className="reveal font-normal text-[clamp(28px,3.4vw,46px)] leading-[1.25] tracking-[-0.015em] max-w-[14ch] max-md:text-[28px]">
            {t("headline")}
          </h2>
          <div className="reveal font-en text-[13px] tracking-[0.04em] text-ink-mute leading-[1.65] self-end max-w-[30ch]">
            {t("enSub1")}
            <br />
            {t("enSub2")}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-[80px] gap-y-0 border-t border-line max-md:grid-cols-1 max-md:gap-0">
          {QUALITIES.map((q) => (
            <div
              key={q.n}
              className="reveal grid grid-cols-[80px_1fr] gap-[24px] py-[34px] border-b border-line items-start max-md:grid-cols-[50px_1fr] max-md:gap-[14px] max-md:py-[22px]"
            >
              <span className="num font-en text-[13px] tracking-[0.04em] text-green font-medium pt-[4px]">
                {q.n}
              </span>
              <div>
                <h4 className="font-normal text-[21px] leading-[1.45] tracking-[-0.01em] flex items-baseline gap-[14px] flex-wrap mb-[8px]">
                  {t(q.titleKey)}
                  <span className="font-en text-[11px] tracking-[0.06em] text-ink-mute uppercase">
                    {t(q.enKey)}
                  </span>
                </h4>
                <p className="text-ink-soft text-[15px] leading-[1.8] max-w-[32ch]">
                  {t(q.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
