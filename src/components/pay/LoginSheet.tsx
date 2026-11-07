"use client";

import { useEffect } from "react";

import { useTranslations } from "next-intl";

import SocialLoginButtons from "@/components/auth/SocialLoginButtons";
import CloseButton from "@/components/ui/CloseButton";
import { Link } from "@/i18n/navigation";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCloseOnBack } from "@/hooks/useCloseOnBack";

interface LoginSheetProps {
  /** 로그인 뒤 돌아갈 경로(구매 이어가기) */
  next: string;
  onClose: () => void;
}

/**
 * 구매 직전 로그인 하단 시트 — 카카오·네이버 + 이메일 회원 길(이메일로 가입한 손님이 구매 중에 막히지 않게).
 * 닫기: X · 바깥 누르기 · Esc · 뒤로가기
 */
export default function LoginSheet({ next, onClose }: LoginSheetProps) {
  const t = useTranslations("pay.login");
  const tc = useTranslations("common");
  const ta = useTranslations("auth");
  useBodyScrollLock(true);
  const close = useCloseOnBack(true, onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* 바깥 누르기 — 읽는 길은 X 버튼이 맡는다 */}
      <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-ink/30" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-sheet-title"
        className="relative flex w-full max-w-[480px] flex-col gap-[16px] rounded-t-[20px] bg-paper px-[20px] pb-[32px] pt-[20px]"
      >
        <div className="-mr-[12px] -mt-[8px] flex items-center justify-between gap-[12px]">
          <h2 id="login-sheet-title" className="m-0 text-[17px] font-medium">
            {t("title")}
          </h2>
          <CloseButton label={tc("close")} onClick={close} />
        </div>
        {/* replace — 시트가 쌓은 기록 칸을 로그인 화면이 차지해 돌아올 때 헛돌지 않는다 */}
        <SocialLoginButtons next={next} replace />
        <p className="m-0 text-center text-[12px] text-grey">{t("hint")}</p>
        {/* 로그인 화면의 이메일 폼을 펼친 채로 열고, 끝나면 같은 구매로 돌아온다 */}
        {/* replace — 시트가 쌓은 기록 칸을 로그인 화면이 차지해 뒤로가기 한 번에 홈으로 돌아온다 */}
        <Link
          href={{ pathname: "/login", query: { next, email: "1" } }}
          replace
          className="-my-[6px] inline-flex min-h-[44px] items-center justify-center text-[14px] text-grey underline underline-offset-[3px] hover:text-ink"
        >
          {ta("emailLogin")}
        </Link>
      </div>
    </div>
  );
}
