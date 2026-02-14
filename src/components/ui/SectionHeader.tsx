import Link from "next/link";

interface SectionHeaderProps {
  /** 상단 소제목 (예: "CURATED FOR YOU") */
  subtitle: string;
  /** 메인 제목 (예: "BEST SELLER") */
  title: string;
  /** "VIEW ALL →" 링크 — 없으면 표시 안 함 */
  viewAllHref?: string;
  /** 가운데 정렬 여부 */
  centered?: boolean;
}

/**
 * 섹션 공통 헤더
 * - subtitle + title 조합
 * - 선택적으로 "VIEW ALL →" 링크 표시
 */
export default function SectionHeader({
  subtitle,
  title,
  viewAllHref,
  centered = false,
}: SectionHeaderProps) {
  if (centered) {
    return (
      <div className="text-center mb-12 md:mb-16">
        <p className="text-xs tracking-[0.3em] text-muted mb-3">{subtitle}</p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          {title}
        </h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 md:mb-16">
      <div>
        <p className="text-xs tracking-[0.3em] text-muted mb-3">{subtitle}</p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          {title}
        </h2>
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="mt-4 md:mt-0 text-sm tracking-[0.1em] text-muted hover:text-foreground transition-colors border-b border-muted hover:border-foreground pb-0.5"
        >
          VIEW ALL →
        </Link>
      )}
    </div>
  );
}
