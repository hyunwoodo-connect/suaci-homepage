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

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** 아래서 올라오는 시트. 뒤를 어둡게 덮고, Esc·바깥 탭으로 닫힌다. 열린 동안 포커스는 시트 안에서만 돈다. */
export default function BottomSheet({
  isOpen,
  onClose,
  label,
  tone = "cream",
  children,
}: BottomSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // 부모가 렌더마다 새 onClose를 넘겨도 열린 동안 포커스를 다시 잡지 않도록 ref로 든다
  const onCloseRef = useRef(onClose);
  useBodyScrollLock(isOpen);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      // 시트 밖으로 Tab이 새지 않게 처음 ↔ 끝을 잇는다
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      // 닫히면 연 버튼으로 포커스를 돌려준다
      opener?.focus();
    };
  }, [isOpen]);

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
