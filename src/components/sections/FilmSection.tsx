import SectionHeader from "@/components/ui/SectionHeader";
import PlayButton from "@/components/ui/PlayButton";

/**
 * 필름 섹션 — 영상/룩북 쇼케이스
 *
 * 레이아웃: 좌측 큰 카드(2칸) + 우측 세로 2장(1칸)
 */
export default function FilmSection() {
  return (
    <section className="py-20 md:py-32 bg-[#fafafa]">
      <div className="max-w-[1400px] mx-auto px-8 sm:px-10 md:px-14 lg:px-20 xl:px-28">
        <SectionHeader subtitle="FILM" title="SUACI IN ACTION" centered />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {/* 메인 카드 (2칸) */}
          <FilmCard
            className="md:col-span-2"
            bg="bg-[#222]"
            label="BRAND FILM"
            title="Why Recovery Matters"
            description="활동 직후, 피부에 일어나는 변화"
            playSize="lg"
            aspect="aspect-[16/9]"
          />

          {/* 우측 카드 2장 */}
          <div className="flex flex-col gap-4 md:gap-5">
            <FilmCard
              className="flex-1"
              bg="bg-[#2a2a2a]"
              label="HOW TO USE"
              title="One Step Recovery"
              aspect="aspect-[16/9] md:aspect-auto md:h-full"
            />
            <FilmCard
              className="flex-1"
              bg="bg-[#1e1e1e]"
              label="FIELD TEST"
              title="Real Outdoor, Real Skin"
              aspect="aspect-[16/9] md:aspect-auto md:h-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────────── */

interface FilmCardProps {
  bg: string;
  label: string;
  title: string;
  description?: string;
  /** PlayButton 크기 */
  playSize?: "sm" | "lg";
  /** 이미지 영역 aspect ratio 클래스 */
  aspect: string;
  className?: string;
}

/** 필름 카드 — 어두운 배경 + 재생 버튼 + 그라디언트 오버레이 */
function FilmCard({
  bg,
  label,
  title,
  description,
  playSize = "sm",
  aspect,
  className = "",
}: FilmCardProps) {
  return (
    <div className={`group cursor-pointer relative overflow-hidden ${className}`}>
      <div className={`${aspect} ${bg} relative`}>
        {/* 재생 버튼 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <PlayButton size={playSize} />
        </div>

        {/* 하단 그라디언트 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* 텍스트 */}
        <div className={`absolute bottom-0 left-0 ${playSize === "lg" ? "p-6 md:p-8" : "p-5"}`}>
          <p className="text-[10px] tracking-[0.2em] text-white/50 mb-1">
            {label}
          </p>
          <h3
            className={`font-semibold text-white ${
              playSize === "lg" ? "text-lg md:text-xl" : "text-sm"
            }`}
          >
            {title}
          </h3>
          {description && (
            <p className="text-xs text-white/50 mt-2">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
