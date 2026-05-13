"use client";

import { useEffect } from "react";

/**
 * 작은 짙은 초록 점이 마우스를 follow.
 * 인터랙티브 요소(a/button/input/[data-cursor-active]) 위에서는 scale up.
 * touch 디바이스에서는 비활성.
 */
export default function CustomCursor() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const dot = document.createElement("div");
    dot.className = "custom-cursor-dot";
    dot.setAttribute("aria-hidden", "true");
    document.body.appendChild(dot);

    let targetX = -100;
    let targetY = -100;
    let x = -100;
    let y = -100;
    let targetScale = 1;
    let scale = 1;
    let rafId = 0;

    const INTERACTIVE_SELECTOR =
      'a, button, [role="button"], input, textarea, select, label, [data-cursor-active]';

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const setScaleFromTarget = (t: EventTarget | null) => {
      if (!(t instanceof Element)) return;
      targetScale = t.closest(INTERACTIVE_SELECTOR) ? 2.6 : 1;
    };

    const onOver = (e: MouseEvent) => setScaleFromTarget(e.target);
    const onOut = (e: MouseEvent) => setScaleFromTarget(e.relatedTarget);

    const tick = () => {
      x += (targetX - x) * 0.22;
      y += (targetY - y) * 0.22;
      scale += (targetScale - scale) * 0.16;
      dot.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("mouseout", onOut, { passive: true });
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      dot.remove();
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
    };
  }, []);

  return null;
}
