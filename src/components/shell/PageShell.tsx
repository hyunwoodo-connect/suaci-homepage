import type { ReactNode } from "react";
import TopBar from "@/components/home/TopBar";

/**
 * 서브페이지 공용 셸 — v4 acid grid.
 * TopBar + 페이지 라벨 행(sec) + 콘텐츠 셀 + 하단 바.
 */
interface PageShellProps {
  /** sec 라벨 행의 번호 텍스트 (예: "AC") */
  no: string;
  /** sec 라벨 행의 타이틀 */
  title: ReactNode;
  /** sec 라벨 행의 우측 메타 */
  meta?: string;
  children: ReactNode;
}

export default function PageShell({ no, title, meta, children }: PageShellProps) {
  return (
    <main className="frame v4-grid">
      <TopBar />
      <div className="sec">
        <div className="sec__no">{no}</div>
        <div className="sec__ti">{title}</div>
        <div className="sec__me">{meta}</div>
      </div>
      <div className="cell page-cell">{children}</div>
      <div className="cell ft-bottom">
        <span>© 2026 SUACI — Calm your skin, wherever you are.</span>
        <span>Made for the middle of the day.</span>
      </div>
    </main>
  );
}
