import { SITE, SECTION_PADDING_X } from "@/constants/site";
import ArrowButton from "@/components/ui/ArrowButton";

/**
 * 브랜드 스토리 섹션
 *
 * 레이아웃: 이미지(좌) + 텍스트(우) 2컬럼
 * 어두운 배경에 배경 장식 텍스트
 */
export default function BrandSection() {
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
              OUTDOOR RECOVERY SKINCARE
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-[1.15] tracking-[-0.02em] mb-6">
              활동 직후,<br />
              피부에 필요한 건<br />
              즉각적인 회복
            </h2>

            <div className="w-10 h-[1px] bg-white/30 mb-6" />

            <p className="text-sm md:text-base text-white/50 leading-[1.8] tracking-[-0.01em] mb-4">
              수천억 달러 규모의 글로벌 스킨케어 시장에서,
              아웃도어 활동 직후 즉시 회복에 특화된 제품군은
              카테고리 자체가 존재하지 않았습니다.
            </p>
            <p className="text-sm md:text-base text-white/50 leading-[1.8] tracking-[-0.01em] mb-4">
              SUACI는 그 구조적 공백에 진입합니다.
              자외선, 땀, 먼지로 지친 피부를 즉시 쿨링하고
              진정시키며, 손상된 장벽에 수분을 빠르게 보충합니다.
            </p>
            <p className="text-sm md:text-base text-white/50 leading-[1.8] tracking-[-0.01em] mb-10">
              복잡한 루틴 없이, 그 자리에서 바로.
              과학 기반 성분과 K-뷰티 인프라로 만든
              원스텝 리커버리.
            </p>

            <ArrowButton href="#" variant="light">
              DISCOVER MORE
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
