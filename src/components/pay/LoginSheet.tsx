"use client";

import { useTranslations } from "next-intl";
import SocialLoginButtons from "@/components/auth/SocialLoginButtons";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface LoginSheetProps {
  /** 로그인 뒤 돌아갈 경로(구매 이어가기) */
  next: string;
  onClose: () => void;
}

/** 구매 직전 로그인 하단 시트 — "누군지만 알려 주세요." + 카카오·네이버 (스펙 §2 B) */
export default function LoginSheet({ next, onClose }: LoginSheetProps) {
  const t = useTranslations("pay.login");
  useBodyScrollLock(true);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/30"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-sheet-title"
        className="relative flex w-full max-w-[480px] flex-col gap-[16px] rounded-t-[20px] bg-paper px-[20px] pb-[32px] pt-[20px]"
      >
        <h2 id="login-sheet-title" className="m-0 text-[17px] font-medium">
          {t("title")}
        </h2>
        <SocialLoginButtons next={next} />
        <p className="m-0 text-center text-[12px] text-grey">{t("hint")}</p>
      </div>
    </div>
  );
}
