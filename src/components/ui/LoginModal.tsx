"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 로그인 모달 — 매거진 톤, 짙은 초록 보더, UI 쉘 (실 인증 미연결).
 */
export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const t = useTranslations("login");
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-overlay z-[100] flex items-center justify-center p-[20px]"
    >
      <div className="relative bg-background border border-green w-full max-w-[420px] px-[36px] py-[40px]">
        <button
          type="button"
          onClick={onClose}
          aria-label="close"
          className="absolute top-[14px] right-[14px] text-ink-mute text-[16px] leading-none p-[8px] hover:text-foreground transition-colors"
        >
          ×
        </button>

        <div className="font-en text-[10px] tracking-[0.22em] uppercase text-green mb-[18px]">
          {t("eyebrow")}
        </div>
        <h3 className="text-[24px] tracking-[-0.01em] mb-[6px]">{t("title")}</h3>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onClose();
          }}
          className="flex flex-col gap-[14px] mt-[28px]"
        >
          <InputField
            label={t("labelEmail")}
            type="email"
            placeholder={t("placeholderEmail")}
          />
          <InputField
            label={t("labelPassword")}
            type="password"
            placeholder={t("placeholderPassword")}
          />
          <Button variant="uppercase" type="submit" className="mt-[14px] w-full">
            {t("submit")}
          </Button>
          <div className="mt-[18px] flex justify-between font-en text-[11px] tracking-[0.06em] text-ink-mute">
            <span>{t("altPrompt")}</span>
            <Link
              href="/signup"
              onClick={onClose}
              className="text-green border-b border-green pb-[2px]"
            >
              {t("altLink")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
