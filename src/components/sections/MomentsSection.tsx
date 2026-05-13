import Image from "next/image";
import { useTranslations } from "next-intl";
import { SECTION_PADDING_Y, SHELL } from "@/constants/site";
import SectionEyebrow from "@/components/ui/SectionEyebrow";

interface MomentItem {
  n: string;
  tagKey: string;
  krKey: string;
  figKey: string;
  body1Key: string;
  body2Key: string;
  body3Key: string;
  img: string;
  imgAlt: string;
}

const MOMENTS: MomentItem[] = [
  {
    n: "M01",
    tagKey: "moment1Tag",
    krKey: "moment1Kr",
    figKey: "moment1Fig",
    body1Key: "moment1Body1",
    body2Key: "moment1Body2",
    body3Key: "moment1Body3",
    img: "/old/home/ref-reading.jpg",
    imgAlt: "사무실에서 책을 읽는 실내 컷",
  },
  {
    n: "M02",
    tagKey: "moment2Tag",
    krKey: "moment2Kr",
    figKey: "moment2Fig",
    body1Key: "moment2Body1",
    body2Key: "moment2Body2",
    body3Key: "moment2Body3",
    img: "/old/home/ref-puffer.jpg",
    imgAlt: "메이크업 위 클로즈업 컷",
  },
  {
    n: "M03",
    tagKey: "moment3Tag",
    krKey: "moment3Kr",
    figKey: "moment3Fig",
    body1Key: "moment3Body1",
    body2Key: "moment3Body2",
    body3Key: "moment3Body3",
    img: "/old/home/ref-walking-coat.jpg",
    imgAlt: "코트를 입고 외부를 걷는 컷",
  },
  {
    n: "M04",
    tagKey: "moment4Tag",
    krKey: "moment4Kr",
    figKey: "moment4Fig",
    body1Key: "moment4Body1",
    body2Key: "moment4Body2",
    body3Key: "moment4Body3",
    img: "/old/home/ref-walking-white.jpg",
    imgAlt: "흰색 아우터를 입고 걷는 미니멀 컷",
  },
];

/**
 * Moments — 4가지 사용 시나리오 카드 그리드
 */
export default function MomentsSection() {
  const t = useTranslations("moments");

  return (
    <section className={`moments ${SECTION_PADDING_Y} border-t border-line`}>
      <div className={SHELL}>
        <div className="grid grid-cols-[160px_1fr_1fr] gap-[48px] items-end mb-[80px] max-md:grid-cols-1 max-md:gap-[18px] max-md:mb-[36px]">
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

        <div className="grid grid-cols-4 border-t border-line border-b max-md:grid-cols-1">
          {MOMENTS.map((m, idx) => (
            <article
              key={m.n}
              className={`moment group reveal flex flex-col min-h-[340px] ${
                idx < MOMENTS.length - 1
                  ? "border-r border-line max-md:border-r-0 max-md:border-b max-md:border-line"
                  : ""
              } max-md:min-h-0 max-md:py-[24px]`}
            >
              <figure className="m-0 relative bg-bg-warm overflow-hidden">
                <span className="absolute right-[12px] top-[10px] font-en text-[10px] tracking-[0.18em] text-white drop-shadow-md z-[1]">
                  {m.n}
                </span>
                <Image
                  src={m.img}
                  alt={m.imgAlt}
                  width={500}
                  height={400}
                  className="w-full h-[300px] object-cover block transition-transform duration-[1.4s] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.03]"
                />
                <span className="absolute left-[10px] bottom-[10px] font-en text-[9px] tracking-[0.18em] uppercase text-white bg-[rgba(15,61,46,0.85)] px-[8px] py-[3px] z-[1]">
                  {t(m.figKey)}
                </span>
              </figure>
              <div className="p-[22px] pt-[22px] pr-[28px] pb-[28px] flex flex-col gap-[14px] flex-1">
                <div className="flex items-baseline gap-[10px] font-en text-[10px] tracking-[0.18em] uppercase text-green flex-wrap">
                  <span className="text-ink-mute">{`0${idx + 1}`}</span>
                  <span>{t(m.tagKey)}</span>
                  <span className="font-sans normal-case tracking-normal text-[12px] text-ink-mute">
                    {t(m.krKey)}
                  </span>
                </div>
                <h3 className="font-normal text-[21px] leading-[1.5] tracking-[-0.01em] text-ink text-balance mt-[4px]">
                  {t(m.body1Key)}
                  <br />
                  {t(m.body2Key)}
                  <br />
                  {t(m.body3Key)}
                </h3>
                <div className="mt-auto font-en text-[10px] tracking-[0.18em] uppercase text-ink-mute flex justify-between gap-[12px] pt-[18px] border-t border-dotted border-line">
                  <span>{`Moment 0${idx + 1}`}</span>
                  <span>{t(m.tagKey)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
