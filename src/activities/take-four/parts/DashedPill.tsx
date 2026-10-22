import type { ReactNode } from "react";

interface DashedPillProps {
  /** 보통 `N장 더` */
  children: ReactNode;
}

/** 점선 알약. 아직 누를 수 없는 자리(앨범에서 네 장을 다 고르기 전). */
export default function DashedPill({ children }: DashedPillProps) {
  return (
    <div
      aria-disabled="true"
      className="box-border flex h-[58px] w-full items-center justify-center rounded-full border-2 border-dashed border-(color:--tf-ink) text-[17px]"
    >
      {children}
    </div>
  );
}
