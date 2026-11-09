"use client";

import { useEffect, useRef } from "react";

import { useTranslations } from "next-intl";

import SocialLoginButtons from "@/components/auth/SocialLoginButtons";
import ButtonLink from "@/components/ui/ButtonLink";
import CloseButton from "@/components/ui/CloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCloseOnBack } from "@/hooks/useCloseOnBack";
import { useFocusTrap } from "@/hooks/useFocusTrap";

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
  // 열리면 시트로 초점, Tab 은 시트 안에서만, 닫히면 '구매하기'로 돌아간다(UX 리뷰 H1)
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef);

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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-sheet-title"
        tabIndex={-1}
        className="relative flex w-full max-w-[480px] flex-col gap-[16px] rounded-t-[20px] bg-paper px-[20px] pb-[32px] pt-[20px] outline-none"
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
        {/* 이메일로 가입한 손님도 같은 무게로 보이게 — 작은 밑줄 글자 대신 테두리 버튼(UX 리뷰 C2) */}
        <ButtonLink
          href={{ pathname: "/login", query: { next, email: "1" } }}
          replace
          variant="secondary"
          className="w-full"
        >
          {ta("emailLogin")}
        </ButtonLink>
      </div>
    </div>
  );
}
