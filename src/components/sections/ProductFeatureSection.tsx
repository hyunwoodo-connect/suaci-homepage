import Image from "next/image";
import Button from "@/components/ui/Button";
import { SECTION_PADDING_Y_LG, SHELL } from "@/constants/site";
import { getPrimaryProduct } from "@/data/products";
import {
  formatKRW,
  getDiscountPercent,
  getEffectivePrice,
} from "@/utils/commerce";

/**
 * Product Feature — 보틀이 주인공인 한 페이지 매거진 features.
 *
 * 큰 보틀(bottle-float) + 코너 라벨 + 시적 풀라인 + 미니멀 commerce.
 * 카피보다 호흡과 사진이 정보를 만든다.
 */
export default function ProductFeatureSection() {
  const product = getPrimaryProduct();
  const discountPercent = getDiscountPercent(product.price);

  return (
    <section
      id="product"
      className={`product relative ${SECTION_PADDING_Y_LG} bg-bg-warm overflow-hidden border-t border-line`}
    >
      <div className={SHELL}>
        {/* 매거진 코너 마크 */}
        <div className="relative">
          <div className="grid grid-cols-2 items-baseline mb-[64px] max-md:grid-cols-1 max-md:gap-[14px] max-md:mb-[36px]">
            <span className="font-en text-[11px] tracking-[0.22em] uppercase text-green flex gap-[10px] items-baseline">
              <span className="num text-ink-mute tracking-[0.18em]">No.02</span>
              <span className="inline-block w-[18px] h-px bg-green -translate-y-[3px]" />
              <span>The bottle</span>
            </span>
            <span className="font-en text-[11px] tracking-[0.22em] uppercase text-ink-mute text-right max-md:text-left">
              Daily · {product.volume}
            </span>
          </div>
        </div>

        {/* 바틀 + 시적 풀라인 (좌우 비대칭) */}
        <div className="grid grid-cols-[1fr_1.1fr_1fr] gap-[20px] items-end max-md:grid-cols-1 max-md:gap-[40px]">
          {/* 좌측: 시적 풀라인 */}
          <div className="reveal pb-[48px] max-md:pb-0 max-md:order-2">
            <p className="font-fraunces italic font-light text-[clamp(22px,2.4vw,32px)] leading-[1.4] tracking-[-0.005em] text-ink m-0 max-w-[18ch]">
              The day, gathered<br />
              quietly on the skin.
            </p>
            <span className="block mt-[18px] font-en text-[10px] tracking-[0.22em] uppercase text-ink-mute">
              — Field note · No.01
            </span>
          </div>

          {/* 중앙: 보틀 */}
          <div className="reveal relative flex justify-center max-md:order-1">
            <Image
              src={product.images.bottle.src}
              alt={product.images.bottle.alt}
              width={560}
              height={740}
              priority
              className="bottle-float w-auto max-h-[72vh] object-contain drop-shadow-[0_28px_44px_rgba(15,61,46,0.20)] max-md:max-h-[58vh]"
            />
          </div>

          {/* 우측: 미니멀 commerce */}
          <div className="reveal pb-[48px] flex flex-col gap-[18px] max-md:pb-0 max-md:order-3 max-md:items-start">
            <div>
              <span className="font-en text-[10px] tracking-[0.22em] uppercase text-ink-mute block mb-[10px]">
                {product.shortDescriptor}
              </span>
              <h2 className="font-serif font-light text-[clamp(26px,2.8vw,36px)] tracking-[-0.015em] text-ink m-0 leading-[1.18]">
                {product.nameKo}
              </h2>
            </div>

            <div className="flex items-baseline gap-[12px] pt-[18px] border-t border-line">
              <span className="num font-en text-[12px] text-ink-mute line-through">
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

            <Button variant="primary" className="w-full mt-[6px] max-md:w-auto max-md:min-w-[200px]">
              장바구니 담기
            </Button>

            <span className="font-en text-[10px] tracking-[0.18em] uppercase text-ink-mute">
              ● 오늘 출고 · 무료배송
            </span>
          </div>
        </div>

        {/* 하단 dotted divider + closing line */}
        <div className="mt-[120px] pt-[24px] border-t border-dotted border-line flex justify-between gap-[24px] font-en text-[10px] tracking-[0.22em] uppercase text-ink-mute flex-wrap max-md:mt-[64px] max-md:flex-col max-md:gap-[10px]">
          <span>— Pump · Spray · 약산성</span>
          <span>Made in Korea</span>
          <span>No.01 / 2026</span>
        </div>
      </div>
    </section>
  );
}
