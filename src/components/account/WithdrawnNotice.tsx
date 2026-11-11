"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

/**
 * 회원 탈퇴 직후 홈에 보이는 '탈퇴가 끝났어요' 한 줄 — 탈퇴 시트가 홈으로 보내며 붙인 ?withdrawn=1 을 본다
 * (비밀번호 재설정 뒤 로그인 화면의 ?reset=1 과 같은 방식). 구매 바 위 알약 자리에 선다.
 */
export default function WithdrawnNotice() {
  const t = useTranslations("account.withdraw");
  const search = useSearchParams();

  if (search.get("withdrawn") !== "1") return null;

  return (
    <p
      role="status"
      className="pointer-events-auto m-0 flex min-h-[44px] items-center rounded-full bg-paper px-[16px] text-[13px] text-ink shadow-[0_2px_10px_rgba(20,20,20,0.10)]"
    >
      {t("done")}
    </p>
  );
}
