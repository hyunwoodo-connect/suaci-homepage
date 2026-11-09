"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCloseOnBack } from "@/hooks/useCloseOnBack";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** 대화상자 이름(`벽에 붙이기`·`신고`·`내 네컷 떼기`) */
  label: string;
  /** cream: 기본 / paper: 더 밝은 종이(벽에 붙이기 시트) */
  tone?: "cream" | "paper";
  children: ReactNode;
}

/** 아래서 올라오는 시트. 뒤를 어둡게 덮고, Esc·바깥 탭·폰 뒤로가기로 닫힌다. 열린 동안 포커스는 시트 안에서만 돈다. */
export default function BottomSheet({
  isOpen,
  onClose,
  label,
  tone = "cream",
  children,
}: BottomSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(isOpen);
  // close 는 늘 같은 함수라 열린 동안 포커스를 다시 잡지 않는다
  const close = useCloseOnBack(isOpen, onClose);

  // 열리면 시트로 초점, Tab 은 시트 안에서만, 닫히면 연 버튼으로(공용 훅)
  useFocusTrap(dialogRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      data-backdrop
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="fixed inset-0 z-10 flex items-end bg-(--tf-dim)"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`box-border flex w-full flex-col gap-[12px] rounded-t-[24px] px-[24px] pt-[26px] pb-[28px] outline-none transition-transform duration-300 ease-out motion-reduce:transition-none starting:translate-y-full ${
          tone === "paper" ? "bg-(--tf-paper)" : "bg-(--tf-cream)"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
