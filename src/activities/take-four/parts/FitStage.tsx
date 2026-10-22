import type { ReactNode } from "react";

interface FitStageProps {
  children: ReactNode;
}

/**
 * 띠 자리. 남은 높이만 차지하고(띠가 화면을 늘리지 않게 absolute), 작은 폰에선 띠를 줄여
 * 아래 버튼이 화면 안에 남게 한다(시안은 390×844).
 */
export default function FitStage({ children }: FitStageProps) {
  return (
    <div className="relative min-h-[200px] flex-1">
      <div className="absolute inset-0 flex items-center justify-center [@media(max-height:660px)]:scale-[0.66] [@media(min-height:661px)_and_(max-height:700px)]:scale-[0.74] [@media(min-height:701px)_and_(max-height:780px)]:scale-[0.86]">
        {children}
      </div>
    </div>
  );
}
