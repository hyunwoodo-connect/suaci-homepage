import Image from "next/image";
import Button from "@/components/ui/Button";
import { SECTION_PADDING_Y_LG } from "@/constants/site";
import { getPrimaryProduct } from "@/data/products";
import {
  formatKRW,
  getDiscountPercent,
  getEffectivePrice,
} from "@/utils/commerce";

/**
 * Product — 중앙 정렬 보틀 + 미니멀 정보.
 *
 * 헤드라인·디스크립션·스펙 그리드 제거. 이미지가 주인공.
 */
export default function ProductFeatureSection() {
  const product = getPrimaryProduct();
  const discountPercent = getDiscountPercent(product.price);

  return (
    <section
      id="product"
      className={`product relative ${SECTION_PADDING_Y_LG} bg-bg-warm overflow-hidden border-t border-line`}
    >
      <div className="max-w-[720px] mx-auto px-[28px] flex flex-col items-center text-center max-md:px-[18px]">
        <span className="font-en text-[10px] tracking-[0.22em] uppercase text-ink-mute mb-[48px] max-md:mb-[32px]">
          {product.issueNumber} — Product
        </span>

        <div className="reveal relative w-full flex justify-center">
          <Image
            src={product.images.bottle.src}
            alt={product.images.bottle.alt}
            width={520}
            height={680}
            priority
            className="bottle-float w-auto max-h-[60vh] object-contain drop-shadow-[0_18px_36px_rgba(15,61,46,0.18)] max-md:max-h-[44vh]"
          />
        </div>

        <h2 className="reveal mt-[56px] font-serif font-light text-[clamp(28px,3.4vw,40px)] tracking-[-0.015em] text-ink m-0 max-md:mt-[36px] max-md:text-[26px]">
          {product.nameKo}
        </h2>

        <div className="reveal mt-[12px] font-en text-[11px] tracking-[0.22em] uppercase text-ink-mute">
          {product.shortDescriptor} · {product.volume}
        </div>

        <div className="reveal mt-[28px] flex items-baseline gap-[14px] flex-wrap justify-center">
          <span className="num font-en text-[13px] text-ink-mute line-through">
            {formatKRW(product.price.list)}
          </span>
          <span className="num font-en font-medium text-[22px] text-green tracking-[-0.01em]">
            {formatKRW(getEffectivePrice(product.price))}
          </span>
          {discountPercent !== null && (
            <span className="num font-en text-[10px] tracking-[0.18em] uppercase border border-green text-green px-[7px] py-[3px]">
              −{discountPercent}%
            </span>
          )}
        </div>

        <Button variant="primary" className="reveal mt-[36px] min-w-[220px]">
          장바구니 담기
        </Button>
      </div>
    </section>
  );
}
