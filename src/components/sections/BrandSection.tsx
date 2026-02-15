import { useTranslations } from "next-intl";
import { SECTION_PADDING_X } from "@/constants/site";
import ArrowButton from "@/components/ui/ArrowButton";

/**
 * 브랜드 스토리 섹션
 *
 * 레이아웃: 이미지(좌) + 텍스트(우) 2컬럼
 * 어두운 배경에 배경 장식 텍스트
 */
export default function BrandSection() {
  const t = useTranslations("brand");

  // title에 \n이 포함되어 있으므로 <br />로 변환
  const titleParts = t("title").split("\n");

  return (
    <section id="story" className="relative py-24 md:py-40 bg-foreground text-white overflow-hidden">
      {/* 배경 장식 텍스트 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15vw] font-bold tracking-[0.2em] text-white/[0.03] select-none whitespace-nowrap pointer-events-none">
        RECOVERY
      </div>

      <div className={`relative z-10 max-w-[1400px] mx-auto ${SECTION_PADDING_X}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
          {/* 좌측 - 이미지 플레이스홀더 */}
          <BrandImagePlaceholder />

          {/* 우측 - 텍스트 콘텐츠 */}
          <div>
            <p className="text-[10px] sm:text-xs tracking-[0.25em] text-white/40 mb-4">
              {t("subtitle")}
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-[1.15] tracking-[-0.02em] mb-6">
              {titleParts.map((part, i) => (
                <span key={i}>
                  {part}
                  {i < titleParts.length - 1 && <br />}
                </span>
              ))}
            </h2>

            <div className="w-10 h-[1px] bg-white/30 mb-6" />

            <p className="text-sm md:text-base text-white/50 leading-[1.8] tracking-[-0.01em] mb-4">
              {t("p1")}
            </p>
            <p className="text-sm md:text-base text-white/50 leading-[1.8] tracking-[-0.01em] mb-4">
              {t("p2")}
            </p>
            <p className="text-sm md:text-base text-white/50 leading-[1.8] tracking-[-0.01em] mb-10">
              {t("p3")}
            </p>

            <ArrowButton href="#" variant="light">
              {t("cta")}
            </ArrowButton>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────────── */

/** 브랜드 이미지 플레이스홀더 (코너 장식 포함) */
function BrandImagePlaceholder() {
  return (
    <div className="aspect-[4/5] bg-white/5 relative">
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs tracking-[0.3em] text-white/20">
          BRAND IMAGE
        </span>
      </div>
      {/* 코너 장식 */}
      <div className="absolute -top-3 -left-3 w-20 h-20 border-t border-l border-white/20" />
      <div className="absolute -bottom-3 -right-3 w-20 h-20 border-b border-r border-white/20" />
    </div>
  );
}
