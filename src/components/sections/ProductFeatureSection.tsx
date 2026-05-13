import Image from "next/image";
import { useTranslations } from "next-intl";
import { SHELL } from "@/constants/site";
import SectionEyebrow from "@/components/ui/SectionEyebrow";

/**
 * Product Feature — 좌측 큰 제품 컷 + 우측 정보 컬럼
 */
export default function ProductFeatureSection() {
  const t = useTranslations("product");

  return (
    <section
      id="product"
      className="product-feature pt-[120px] pb-[140px] border-t border-line bg-background max-md:py-[80px]"
    >
      <div className={SHELL}>
        <div className="grid grid-cols-[1.05fr_1fr] gap-[60px] items-stretch min-h-[78vh] max-md:grid-cols-1 max-md:gap-[24px] max-md:min-h-0">
          <div className="reveal bg-bg-warm relative flex items-center justify-center overflow-hidden max-md:min-h-[420px]">
            <span className="corner absolute top-[20px] left-[24px] font-en text-[10px] tracking-[0.18em] uppercase text-ink-mute">
              {t("cornerTL")}
            </span>
            <span className="corner absolute top-[20px] right-[24px] font-en text-[10px] tracking-[0.18em] uppercase text-ink-mute">
              {t("cornerTR")}
            </span>
            <span className="absolute top-1/2 left-[24px] w-px h-[48px] bg-green" />
            <Image
              src="/home/suaci-bottle.png"
              alt="SUACI Daily Calming Mist bottle"
              width={720}
              height={960}
              className="bottle-float max-h-[80vh] w-auto object-contain mix-blend-multiply contrast-[1.02] max-md:max-h-[60vh]"
            />
            <span className="absolute bottom-[20px] left-[24px] font-en text-[10px] tracking-[0.18em] uppercase text-ink-mute">
              {t("cornerBL")}
            </span>
            <span className="absolute bottom-[20px] right-[24px] font-en text-[10px] tracking-[0.18em] uppercase text-ink-mute">
              {t("cornerBR")}
            </span>
            <span className="absolute left-1/2 bottom-[32px] -translate-x-1/2 bg-background px-[14px] py-[8px] font-en text-[10px] tracking-[0.22em] uppercase text-green border border-line">
              {t("ticket")}
            </span>
          </div>

          <div className="pt-[20px] flex flex-col gap-[32px]">
            <SectionEyebrow number={t("eyebrowNumber")} label={t("eyebrowLabel")} />
            <h2 className="reveal font-normal text-[clamp(32px,3.6vw,52px)] leading-[1.22] tracking-[-0.015em] max-w-[14ch] text-balance max-md:text-[28px]">
              {t("headline1")}
              <br />
              <span className="text-green">{t("headlineHighlight")}</span>
            </h2>
            <p className="reveal text-ink-soft text-[16px] leading-[1.95] max-w-[34ch]">
              {t("desc1")}
              <br />
              {t("desc2")}
              <br />
              {t("desc3")}
              <br />
              {t("desc4")}
            </p>
            <a
              href="#"
              className="reveal inline-flex items-center gap-[10px] font-en text-[12px] tracking-[0.06em] uppercase text-green border-b border-green pb-[6px] self-start hover:gap-[14px] transition-all duration-300"
            >
              {t("detailLink")} <span>→</span>
            </a>

            <div className="reveal flex items-baseline gap-[18px] pt-[20px] border-t border-line mt-[8px]">
              <span className="num text-ink-mute line-through text-[13px] font-en">
                {t("priceWas")}
              </span>
              <span className="num text-green font-en font-medium text-[22px] tracking-[-0.01em]">
                {t("priceNow")}
                <span className="text-[12px] text-ink-mute font-normal ml-[2px]">
                  {t("priceCurrency")}
                </span>
              </span>
              <span className="ml-auto font-en text-[10px] tracking-[0.18em] uppercase border border-green text-green px-[8px] py-[4px]">
                {t("priceOff")}
              </span>
            </div>

            <div className="reveal grid grid-cols-2 gap-[8px] mt-[8px] mb-[4px] max-md:grid-cols-1">
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

            <div className="reveal grid grid-cols-3 mt-auto border-t border-line max-md:grid-cols-2">
              <SpecCell k={t("specVolumeKey")} v={t("specVolumeValue")} />
              <SpecCell k={t("specTypeKey")} v={t("specTypeValue")} />
              <SpecCell k={t("specUseKey")} v={t("specUseValue")} last />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface SpecCellProps {
  k: string;
  v: string;
  last?: boolean;
}

function SpecCell({ k, v, last }: SpecCellProps) {
  return (
    <div
      className={`py-[14px] pr-[12px] ${
        last ? "" : "border-r border-dotted border-line"
      }`}
    >
      <span className="font-en text-[10px] tracking-[0.18em] uppercase text-ink-mute block mb-[6px]">
        {k}
      </span>
      <span className="font-en text-[13px] text-ink num">{v}</span>
    </div>
  );
}
