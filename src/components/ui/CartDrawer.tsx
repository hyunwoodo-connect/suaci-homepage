"use client";

import { useTranslations } from "next-intl";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 우측 슬라이드 카트 드로어 (UI 쉘 — 빈 상태 표시만).
 */
export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const t = useTranslations("cart");
  useBodyScrollLock(isOpen);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 bg-overlay z-[89] transition-opacity duration-500 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        aria-label="cart"
        className={`fixed top-0 right-0 h-screen w-full max-w-[420px] bg-background z-[90] border-l border-green flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-[28px] py-[24px] border-b border-line">
          <div className="font-en text-[11px] tracking-[0.22em] uppercase text-green">
            {t("title")}
            <span className="font-en text-ink-mute ml-[10px]">00</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="text-ink-mute p-[6px] hover:text-foreground transition-colors text-[16px] leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center px-[40px] text-ink-mute">
          <div className="font-sans text-[18px] text-ink">{t("empty")}</div>
          <div className="font-en text-[11px] tracking-[0.18em] uppercase mt-[14px]">
            {t("emptySub")}
          </div>
        </div>

        <div className="px-[28px] py-[24px] border-t border-line font-en text-[10px] tracking-[0.18em] uppercase text-ink-mute text-center">
          {t("foot")}
        </div>
      </aside>
    </>
  );
}
