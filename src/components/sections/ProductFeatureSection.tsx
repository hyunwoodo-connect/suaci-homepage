import Image from "next/image";
import { useTranslations } from "next-intl";
import { SHELL } from "@/constants/site";
import SectionEyebrow from "@/components/ui/SectionEyebrow";
import Button from "@/components/ui/Button";
import { getPrimaryProduct } from "@/data/products";
import {
  formatKRW,
  getDiscountPercent,
  getEffectivePrice,
} from "@/utils/commerce";

/**
 * Product Feature — 좌측 큰 제품 컷 + 우측 정보 컬럼
 *
 * 가격·할인율·이미지·용량은 commerce 데이터에서 끌어쓴다.
 * 라벨/카피는 i18n에 둔다.
 */
export default function ProductFeatureSection() {
  const t = useTranslations("product");
  const product = getPrimaryProduct();
  const discountPercent = getDiscountPercent(product.price);

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
              src={product.images.bottle.src}
              alt={product.images.bottle.alt}
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
              {product.name}
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
                {formatKRW(product.price.list)}
              </span>
              <span className="num text-green font-en font-medium text-[22px] tracking-[-0.01em]">
                {formatKRW(getEffectivePrice(product.price))}
                <span className="text-[12px] text-ink-mute font-normal ml-[2px]">
                  {product.price.currency}
                </span>
              </span>
              {discountPercent !== null && (
                <span className="num ml-auto font-en text-[10px] tracking-[0.18em] uppercase border border-green text-green px-[8px] py-[4px]">
                  −{discountPercent}%
                </span>
              )}
            </div>

            <div className="reveal grid grid-cols-2 gap-[8px] mt-[8px] mb-[4px] max-md:grid-cols-1">
              <Button variant="primary">{t("ctaAddToCart")}</Button>
              <Button variant="secondary">{t("ctaBuyNow")}</Button>
            </div>

            <div className="reveal grid grid-cols-3 mt-auto border-t border-line max-md:grid-cols-2">
              <SpecCell label={t("specVolumeKey")} value={product.volumeDetail} />
              <SpecCell label={t("specTypeKey")} value={t("specTypeValue")} />
              <SpecCell label={t("specUseKey")} value={t("specUseValue")} isLast />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface SpecCellProps {
  label: string;
  value: string;
  isLast?: boolean;
}

function SpecCell({ label, value, isLast }: SpecCellProps) {
  return (
    <div
      className={`py-[14px] pr-[12px] ${
        isLast ? "" : "border-r border-dotted border-line"
      }`}
    >
      <span className="font-en text-[10px] tracking-[0.18em] uppercase text-ink-mute block mb-[6px]">
        {label}
      </span>
      <span className="font-en text-[13px] text-ink num">{value}</span>
    </div>
  );
}
