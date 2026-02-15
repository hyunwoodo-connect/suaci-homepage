import { SECTION_PADDING_X } from "@/constants/site";

/**
 * 브랜드 스토리 섹션
 *
 * 레이아웃: 영상(좌) + 브랜드 탄생 스토리(우) 2컬럼
 * 왜 이 브랜드를 시작하게 되었는지에 대한 내러티브
 */
export default function BrandStorySection() {
  return (
    <section className="py-20 md:py-32">
      <div className={`max-w-[1400px] mx-auto ${SECTION_PADDING_X}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 lg:gap-20 items-center">
          {/* 좌측 — 영상 */}
          <div className="relative aspect-[3/4] bg-black overflow-hidden">
            <video
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src="/brand-story.mp4" type="video/mp4" />
            </video>
          </div>

          {/* 우측 — 스토리 */}
          <div>
            <p className="text-[10px] sm:text-xs tracking-[0.2em] text-muted mb-4">
              WHY WE STARTED
            </p>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-[-0.02em] leading-[1.2] mb-8">
              아무도 신경 쓰지 않던<br />
              그 순간을 위해
            </h2>

            <div className="w-10 h-[1px] bg-border mb-8" />

            <div className="flex flex-col gap-5 text-sm sm:text-base text-muted leading-[1.8] tracking-[-0.01em]">
              <p>
                산을 타고 내려오면 얼굴이 따갑고,
                서핑을 하고 나면 피부가 당기고,
                달리기를 마치면 볼이 달아오릅니다.
              </p>

              <p>
                그런데 그 순간에 쓸 수 있는 건 아무것도 없었습니다.
                선크림은 활동 전, 스킨케어는 집에서.
                그 사이 수 시간 동안 피부는 그냥 방치되고 있었습니다.
              </p>

              <p>
                수천억 달러 규모의 스킨케어 시장에서,
                활동 후 즉시 회복이라는 카테고리는
                존재하지 않았습니다.
              </p>

              <p className="text-foreground font-semibold">
                그래서 만들기로 했습니다.
                활동 직후, 그 자리에서 바로 쓸 수 있는 것들을.
                SUACI는 그렇게 시작됐습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
