import type { ReactNode } from "react";

/**
 * 상태 표시 — 누를 수 없는 것. 버튼(알약, 44~52px)과 헷갈리지 않게 작고 각지게(22px, 모서리 4px),
 * 그림자·호버·손가락 커서 없이 옅은 바탕 + 점 + 짙은 글자.
 *
 * tone 은 뜻으로 고른다:
 *  - "neutral" 진행 중(결제완료·배송중·접수됨)
 *  - "done"    끝났고 잘 됐다(승인됨·진행 중인 이벤트). 라임 옅은 바탕 + 짙은 초록 글자 — 라임은 바탕 띠로만, 글자색으로 쓰지 않는다
 *  - "muted"   닫힌 것(주문취소·환불완료·종료)
 *  - "problem" 손님이 알아야 할 문제(거절됨·처리 지연)
 * 글자 대비는 모두 WCAG AA(4.5:1) 이상.
 */
export type BadgeTone = "neutral" | "done" | "muted" | "problem";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-ink/[0.06] text-ink",
  done: "bg-lime/30 text-green-900",
  muted: "bg-ink/[0.04] text-grey",
  problem: "bg-alert/[0.08] text-alert",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-ink",
  done: "bg-green-700",
  muted: "bg-grey/50",
  problem: "bg-alert",
};

export default function Badge({ tone = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-[22px] w-fit shrink-0 cursor-default select-none items-center gap-[6px] whitespace-nowrap rounded-[4px] px-[8px] text-[12px] font-medium leading-none ${TONE_CLASSES[tone]} ${className}`}
    >
      <span aria-hidden="true" className={`size-[6px] rounded-full ${DOT_CLASSES[tone]}`} />
      {children}
    </span>
  );
}
