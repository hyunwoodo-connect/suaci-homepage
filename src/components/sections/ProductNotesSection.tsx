import { useTranslations } from "next-intl";
import { SECTION_PADDING_Y, SHELL } from "@/constants/site";
import SectionEyebrow from "@/components/ui/SectionEyebrow";

/**
 * Product Notes — Moments + Qualities 통합 섹션.
 *
 * 2-col 그리드 (desktop) / 1-col stack (mobile).
 * 좌측 When: 4 사용 시나리오 (텍스트 only — 사진 통째로 제거).
 * 우측 What: 4 제품 속성.
 */

interface WhenItem {
  n: string;
  tagKey: string;
  krKey: string;
  bodyKey: string;
}

const WHEN_ITEMS: WhenItem[] = [
  { n: "01", tagKey: "when1Tag", krKey: "when1Kr", bodyKey: "when1Body" },
  { n: "02", tagKey: "when2Tag", krKey: "when2Kr", bodyKey: "when2Body" },
  { n: "03", tagKey: "when3Tag", krKey: "when3Kr", bodyKey: "when3Body" },
  { n: "04", tagKey: "when4Tag", krKey: "when4Kr", bodyKey: "when4Body" },
];

interface WhatItem {
  n: string;
  titleKey: string;
  enKey: string;
  descKey: string;
}

const WHAT_ITEMS: WhatItem[] = [
  { n: "01", titleKey: "what1Title", enKey: "what1En", descKey: "what1Desc" },
  { n: "02", titleKey: "what2Title", enKey: "what2En", descKey: "what2Desc" },
  { n: "03", titleKey: "what3Title", enKey: "what3En", descKey: "what3Desc" },
  { n: "04", titleKey: "what4Title", enKey: "what4En", descKey: "what4Desc" },
];

export default function ProductNotesSection() {
  const t = useTranslations("productNotes");

  return (
    <section className={`product-notes ${SECTION_PADDING_Y} border-t border-line`}>
      <div className={SHELL}>
        <div className="grid grid-cols-[160px_1fr_1fr] gap-[48px] items-end mb-[64px] max-md:grid-cols-1 max-md:gap-[18px] max-md:mb-[36px]">
          <SectionEyebrow number={t("eyebrowNumber")} label={t("eyebrowLabel")} />
          <h2 className="reveal font-normal text-[clamp(28px,3.4vw,46px)] leading-[1.25] tracking-[-0.015em] text-balance max-w-[14ch] max-md:text-[28px]">
            {t("headline1")}
            <br />
            {t("headline2")}
          </h2>
          <div className="reveal font-en text-[13px] tracking-[0.04em] text-ink-mute leading-[1.65] self-end max-w-[30ch]">
            {t("enSub1")}
            <br />
            {t("enSub2")}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-[80px] border-t border-line max-md:grid-cols-1 max-md:gap-0">
          <div className="reveal border-r border-dotted border-line pr-[48px] max-md:border-r-0 max-md:pr-0 max-md:border-b max-md:border-line max-md:pb-[24px] max-md:mb-[16px]">
            <h3 className="font-en text-[11px] tracking-[0.22em] uppercase text-green pt-[28px] pb-[16px] border-b border-dotted border-line mb-[8px]">
              {t("whenLabel")}
            </h3>
            {WHEN_ITEMS.map((item, idx) => (
              <div
                key={item.n}
                className={`grid grid-cols-[40px_1fr] gap-[18px] py-[22px] items-start ${
                  idx < WHEN_ITEMS.length - 1
                    ? "border-b border-dotted border-line"
                    : ""
                }`}
              >
                <span className="num font-en text-[13px] tracking-[0.04em] text-green font-medium pt-[2px]">
                  {item.n}
                </span>
                <div>
                  <div className="flex items-baseline gap-[10px] mb-[10px] font-en text-[11px] tracking-[0.18em] uppercase text-green flex-wrap">
                    <span>{t(item.tagKey)}</span>
                    <span className="font-sans normal-case tracking-normal text-[12px] text-ink-mute">
                      {t(item.krKey)}
                    </span>
                  </div>
                  <p className="text-ink-soft text-[15px] leading-[1.8] max-w-[32ch] m-0">
                    {t(item.bodyKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="reveal pl-[48px] max-md:pl-0">
            <h3 className="font-en text-[11px] tracking-[0.22em] uppercase text-green pt-[28px] pb-[16px] border-b border-dotted border-line mb-[8px]">
              {t("whatLabel")}
            </h3>
            {WHAT_ITEMS.map((item, idx) => (
              <div
                key={item.n}
                className={`grid grid-cols-[40px_1fr] gap-[18px] py-[22px] items-start ${
                  idx < WHAT_ITEMS.length - 1
                    ? "border-b border-dotted border-line"
                    : ""
                }`}
              >
                <span className="num font-en text-[13px] tracking-[0.04em] text-green font-medium pt-[4px]">
                  {item.n}
                </span>
                <div>
                  <h4 className="font-normal text-[19px] leading-[1.45] tracking-[-0.01em] flex items-baseline gap-[14px] flex-wrap mb-[8px]">
                    {t(item.titleKey)}
                    <span className="font-en text-[11px] tracking-[0.06em] text-ink-mute uppercase">
                      {t(item.enKey)}
                    </span>
                  </h4>
                  <p className="text-ink-soft text-[15px] leading-[1.8] max-w-[32ch] m-0">
                    {t(item.descKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
