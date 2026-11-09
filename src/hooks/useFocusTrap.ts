"use client";

import { useEffect, type RefObject } from "react";

/** 시트 안에서 Tab 으로 갈 수 있는 것 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 모달 시트의 키보드 초점(WAI-ARIA 모달 대화상자 관례) — 열리면 시트(패널, tabIndex -1)로 옮겨 제목부터 읽히고,
 * Tab·Shift+Tab 은 시트 안에서 처음 ↔ 끝으로 돈다(뒤 페이지로 새지 않게), 닫히면 연 버튼으로 돌려준다.
 * Esc 닫기는 시트마다 따로(뒤로가기 기록과 같이 닫아야 해서).
 */
export function useFocusTrap(panelRef: RefObject<HTMLElement | null>, isOpen = true): void {
  useEffect(() => {
    const panel = panelRef.current;
    if (!isOpen || !panel) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const isOutside = !(active instanceof Node) || !panel.contains(active);
      if (e.shiftKey && (active === first || active === panel || isOutside)) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && (active === last || isOutside)) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [panelRef, isOpen]);
}
