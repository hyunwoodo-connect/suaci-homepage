import type { ReactNode } from "react";

interface DashedPillProps {
  /** 보통 `N장 더` */
  children: ReactNode;
}

/** 점선 알약. 다음으로 갈 버튼 자리인데 아직 못 누른다(앨범에서 네 장을 다 고르기 전). */
export default function DashedPill({ children }: DashedPillProps) {
  return (
    <button
      type="button"
      disabled
      className="box-border flex h-[58px] w-full items-center justify-center rounded-full border-2 border-dashed border-(color:--tf-ink) bg-transparent [font-family:inherit] text-[17px] text-(color:--tf-ink)"
    >
      {children}
    </button>
  );
}
