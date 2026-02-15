import { SECTION_PADDING_X } from "@/constants/site";

/**
 * 브랜드 히스토리 섹션
 *
 * 레이아웃: 영상(좌) + 타임라인 히스토리(우) 2컬럼
 * 모바일: 영상 위 → 히스토리 아래 스택
 */
export default function BrandHistorySection() {
  return (
    <section className="py-20 md:py-32 bg-[#fafafa]">
      <div className={`max-w-[1400px] mx-auto ${SECTION_PADDING_X}`}>
        {/* 섹션 헤더 */}
        <p className="text-[10px] sm:text-xs tracking-[0.2em] text-muted mb-3">
          OUR JOURNEY
        </p>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-[-0.02em] leading-[1.2] mb-12 md:mb-16">
          Brand History
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 lg:gap-24">
          {/* 좌측 — 영상 */}
          <div className="relative aspect-[4/5] bg-black overflow-hidden sticky top-24 self-start">
            <video
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src="/brand-history.mp4" type="video/mp4" />
            </video>

            {/* 하단 캡션 */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-5 sm:p-6">
              <p className="text-[10px] tracking-[0.15em] text-white/50">
                THE STORY BEHIND SUACI
              </p>
            </div>
          </div>

          {/* 우측 — 타임라인 히스토리 */}
          <div className="flex flex-col">
            <HistoryItem
              year="2024.03"
              title="문제 인식"
              description="아웃도어 활동 후 피부 손상에 대한 리서치 시작. 글로벌 스킨케어 시장에서 활동 직후 즉시 회복 카테고리가 부재하다는 구조적 공백을 발견."
            />
            <HistoryItem
              year="2024.06"
              title="브랜드 설립"
              description="SUACI 브랜드 설립. 쿨링, 진정, 보습 — 세 가지 핵심 가치를 정의하고, 원스텝 리커버리라는 제품 철학을 수립."
            />
            <HistoryItem
              year="2024.09"
              title="제품 개발"
              description="한국 ODM/OEM 인프라를 활용한 첫 제품 개발 착수. 피부 과학 근거에 기반한 핵심 성분 선정 및 처방 설계."
            />
            <HistoryItem
              year="2024.12"
              title="필드 테스트"
              description="러너, 서퍼, 클라이머 등 실제 아웃도어 활동 인구 대상 필드 테스트 진행. 사용 직후 피부 온도 저하 및 진정 효과 확인."
            />
            <HistoryItem
              year="2025"
              title="Instant Cooling Mist 출시"
              description="SUACI의 첫 제품, 50ml Instant Cooling Mist 공식 출시. 아웃도어 즉시 회복이라는 새로운 카테고리의 시작."
              isLast
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────────── */

function HistoryItem({
  year,
  title,
  description,
  isLast = false,
}: {
  year: string;
  title: string;
  description: string;
  isLast?: boolean;
}) {
  return (
    <div className={`relative pl-8 ${isLast ? "" : "pb-10 md:pb-12"}`}>
      {/* 타임라인 라인 */}
      {!isLast && (
        <div className="absolute left-[5px] top-2 bottom-0 w-[1px] bg-border" />
      )}

      {/* 타임라인 도트 */}
      <div className="absolute left-0 top-[6px] w-[11px] h-[11px] rounded-full border-2 border-foreground bg-[#fafafa]" />

      {/* 연도 */}
      <p className="text-[11px] tracking-[0.1em] font-semibold text-[#A9FF39] mb-1">
        {year}
      </p>

      {/* 제목 */}
      <h3 className="text-base sm:text-lg font-bold tracking-[-0.01em] mb-2">
        {title}
      </h3>

      {/* 설명 */}
      <p className="text-xs sm:text-sm text-muted leading-[1.7] tracking-[-0.01em]">
        {description}
      </p>
    </div>
  );
}
