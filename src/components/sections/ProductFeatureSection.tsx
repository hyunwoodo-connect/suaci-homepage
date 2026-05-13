import Image from "next/image";
import { getPrimaryProduct } from "@/data/products";
import { formatKRW, getEffectivePrice } from "@/utils/commerce";

/**
 * Product Feature — Aesop / Tamburins 톤의 미니멀 보틀 세션.
 *
 * 화면 중앙 보틀이 거의 전부. 텍스트는 보틀 아래 작게.
 * 풀라인, 코너 마크, 3-col 레이아웃 같은 가식 제거.
 */
export default function ProductFeatureSection() {
  const product = getPrimaryProduct();

  return (
    <section
      id="product"
      className="product relative bg-bg-warm py-[200px] max-md:py-[120px]"
    >
      <div className="mx-auto max-w-[760px] px-[24px] flex flex-col items-center text-center">
        <div className="relative flex justify-center">
          <Image
            src={product.images.bottle.src}
            alt={product.images.bottle.alt}
            width={640}
            height={840}
            priority
            className="bottle-float w-auto max-h-[72vh] object-contain drop-shadow-[0_28px_60px_rgba(15,61,46,0.16)] max-md:max-h-[56vh]"
          />
        </div>

        <span className="mt-[88px] font-en text-[10px] tracking-[0.36em] uppercase text-ink-mute max-md:mt-[48px]">
          Portable Calming Mist
        </span>

        <h2 className="mt-[18px] font-serif font-light text-[clamp(30px,3.2vw,42px)] tracking-[-0.015em] text-ink m-0 leading-[1.18]">
          {product.nameKo}
        </h2>

        <span className="mt-[14px] font-en text-[11px] tracking-[0.16em] uppercase text-ink-mute num">
          {product.volume} · 약산성 저자극
        </span>

        <div className="mt-[36px] flex items-baseline gap-[14px]">
          <span className="num font-en text-[12px] text-ink-mute line-through">
            {formatKRW(product.price.list)}
          </span>
          <span className="num font-en font-medium text-[22px] text-ink tracking-[-0.01em]">
            {formatKRW(getEffectivePrice(product.price))}
          </span>
        </div>

        <button
          type="button"
          className="mt-[32px] inline-flex items-center gap-[12px] border border-ink text-ink px-[36px] py-[14px] font-en text-[11px] tracking-[0.28em] uppercase hover:bg-ink hover:text-background transition-colors duration-300"
        >
          Add to bag
          <span className="font-sans text-[12px]">→</span>
        </button>
      </div>
    </section>
  );
}
