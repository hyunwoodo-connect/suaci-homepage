"use client";

import { useTranslations } from "next-intl";

import PageShell from "@/components/shell/PageShell";
import Skeleton from "@/components/ui/Skeleton";

/**
 * 이벤트 목록으로 넘어가는 동안 — 헤더·제목 줄은 그대로 두고 카드 두 장 크기의 뼈대(상태 뱃지 / 제목 / 요약).
 * [locale] 전체가 아니라 여기에만 둔다: 전체에 두면 없는 주소(404)까지 이 Suspense 안에서 그려져 응답 코드가 200 이 된다.
 */
export default function EventsLoading() {
  const tc = useTranslations("common");
  return (
    <PageShell title={<Skeleton inline className="h-[0.8em] w-[3.5em]" />}>
      <ul
        role="status"
        aria-label={tc("loading")}
        aria-busy="true"
        className="m-0 grid list-none gap-[16px] p-0 md:grid-cols-2"
      >
        {["w-[180px]", "w-[136px]"].map((w) => (
          <li key={w} className="flex flex-col gap-[12px] border border-line p-[20px]">
            <Skeleton shape="badge" className="h-[22px] w-[56px]" />
            <span className="flex h-[30px] items-center">
              <Skeleton className={`h-[16px] ${w}`} />
            </span>
            <span className="flex h-[24px] items-center">
              <Skeleton className="h-[12px] w-[240px] max-w-full" />
            </span>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
