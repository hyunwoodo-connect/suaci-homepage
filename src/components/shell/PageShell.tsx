import type { ReactNode } from "react";
import SiteFooter from "@/components/home/SiteFooter";
import SiteHeader from "@/components/home/SiteHeader";

/**
 * 서브페이지 공용 셸 — v5 white studio.
 * 헤더 + 페이지 타이틀 행(.sec) + 콘텐츠(.page-cell) + 푸터.
 */
interface PageShellProps {
  /** v4 호환용 번호 라벨 (v5에선 표시하지 않음) */
  no: string;
  /** 페이지 타이틀 */
  title: ReactNode;
  /** 타이틀 우측 메타 */
  meta?: string;
  children: ReactNode;
}

export default function PageShell({ no, title, meta, children }: PageShellProps) {
  return (
    <main className="frame relative w-full bg-paper">
      <SiteHeader />
      <div className="sec">
        <div className="sec__no">{no}</div>
        <h1 className="sec__ti m-0">{title}</h1>
        <div className="sec__me">{meta}</div>
      </div>
      <div className="cell page-cell">{children}</div>
      <SiteFooter />
    </main>
  );
}
