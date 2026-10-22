"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** 대화상자 이름(시안 aria-label: 응모하기·응모 취소·신고·내 네컷 떼기) */
  label: string;
  /** cream: 기본 / paper: 응모 시트(입력칸이 있어 더 밝게) */
  tone?: "cream" | "paper";
  children: ReactNode;
}

/** 아래서 올라오는 시트. 뒤를 어둡게 덮고, Esc·바깥 탭으로 닫힌다. */
export default function BottomSheet({
  isOpen,
  onClose,
  label,
  tone = "cream",
  children,
}: BottomSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-backdrop
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
