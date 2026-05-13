import Image from "next/image";
import { getPrimaryProduct } from "@/data/products";

/**
 * Hero — 풀블리드 mood 시네마.
 *
 * 카피 거의 없음. 이미지가 말한다.
 * 3개 mood 사진이 18초 주기로 crossfade.
 */
export default function HeroSection() {
  const product = getPrimaryProduct();
  const heroPhotos = product.images.hero ?? [];

  return (
    <section className="relative h-screen min-h-[680px] overflow-hidden bg-[#1a2a20] max-md:min-h-[560px]">
      {heroPhotos.slice(0, 3).map((photo, i) => (
        <Image
          key={photo.src}
          src={photo.src}
          alt={photo.alt}
          fill
          priority={i === 0}
          sizes="100vw"
          className={`hero-photo f${i + 1} object-cover`}
        />
      ))}

      <div
        aria-hidden="true"
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      <span className="absolute inset-[24px] z-[2] border border-white/15 pointer-events-none max-md:inset-[14px]" />

      <div className="absolute top-[36px] right-[32px] z-[2] text-right font-en text-[11px] tracking-[0.22em] uppercase text-white/90 max-md:top-[22px] max-md:right-[18px] max-md:text-[10px]">
        <div>
          <b className="font-medium">{product.issueNumber}</b>
          &nbsp;·&nbsp;{product.name}
        </div>
        <div className="mt-[6px] text-white/65">Calm your skin, wherever you are.</div>
      </div>

      <div className="absolute bottom-[48px] left-[32px] z-[2] text-white max-md:bottom-[28px] max-md:left-[18px]">
        <div className="font-en font-medium text-[60px] tracking-[-0.02em] leading-[0.88] max-md:text-[44px]">
          suaci
        </div>
        <div className="mt-[12px] font-en text-[11px] tracking-[0.22em] uppercase text-white/85 max-md:text-[10px]">
          Daily Calming Mist · {product.volume}
        </div>
      </div>

      <div className="absolute left-1/2 bottom-[26px] -translate-x-1/2 z-[2] flex flex-col items-center gap-[8px] font-en text-[10px] tracking-[0.32em] uppercase text-white/65 max-md:hidden">
        <span>scroll</span>
        <span className="w-px h-[28px] bg-white/45" />
      </div>
    </section>
  );
}
