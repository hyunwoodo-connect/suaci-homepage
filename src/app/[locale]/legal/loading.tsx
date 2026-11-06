"use client";

import { useTranslations } from "next-intl";

import PageShell from "@/components/shell/PageShell";
import Skeleton from "@/components/ui/Skeleton";

/** 정책 문서 줄 길이들 — 실제 문서처럼 들쭉날쭉하게(같은 길이 막대만 쌓이면 표처럼 보인다) */
const LINE_WIDTHS = ["w-[92%]", "w-full", "w-[78%]", "w-[96%]", "w-[64%]"] as const;

/**
 * 정책 문서로 넘어가는 동안 — 헤더·제목 줄은 그대로 두고, 제목·시행일·본문 자리만 같은 크기의 뼈대.
 * [locale] 전체가 아니라 여기에만 둔다: 전체에 두면 없는 주소(404)까지 이 Suspense 안에서 그려져 응답 코드가 200 이 된다.
 */
export default function LegalLoading() {
  const tc = useTranslations("common");
  return (
    <PageShell
      title={<Skeleton inline className="h-[0.8em] w-[5em]" />}
      meta={<Skeleton inline className="h-[12px] w-[120px]" />}
    >
      <div
        role="status"
        aria-label={tc("loading")}
        aria-busy="true"
        className="flex max-w-[72ch] flex-col gap-[10px]"
      >
        <span className="flex h-[25px] items-center">
          <Skeleton className="h-[14px] w-[160px]" />
        </span>
        {[...LINE_WIDTHS, ...LINE_WIDTHS].map((w, i) => (
          <span key={i} className="flex h-[25px] items-center">
            <Skeleton className={`h-[12px] ${w}`} />
          </span>
        ))}
      </div>
    </PageShell>
  );
}
