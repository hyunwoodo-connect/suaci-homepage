import type { ReactNode } from "react";

import SiteHeader from "@/components/home/SiteHeader";

interface PayResultProps {
  /** 무슨 일이 있었고 무엇을 하면 되는지 한두 문장 */
  message: string;
  /** 다음 행동(주 버튼 하나, 필요하면 그 아래 작은 링크) */
  children?: ReactNode;
}

/**
 * 결제창에서 돌아온 자리(확인 중·멈춤·거절·잠깐 막힘) — 헤더는 두고(나갈 길), 가운데 한 문장 + 엄지 자리 버튼 하나.
 * 결제 흐름 한가운데라 푸터·큰 제목은 두지 않는다.
 */
export default function PayResult({ message, children }: PayResultProps) {
  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col items-stretch justify-center gap-[24px] px-[16px] pb-[96px] text-center">
        <p role="status" className="m-0 text-[17px] leading-[1.55] text-ink">
          {message}
        </p>
        {children && <div className="flex flex-col items-stretch gap-[8px]">{children}</div>}
      </div>
    </main>
  );
}
