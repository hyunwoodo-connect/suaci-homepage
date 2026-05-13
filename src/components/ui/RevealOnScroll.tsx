"use client";

import { useEffect } from "react";

/**
 * 페이지 진입 후 .reveal 요소를 IntersectionObserver로 관찰해
 * 뷰포트에 닿으면 .in 클래스를 붙여 페이드업 시킨다.
 *
 * 한 번만 마운트하면 페이지의 모든 .reveal 노드를 커버한다.
 */
export default function RevealOnScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".reveal, .reveal-mask, .reveal-scale",
      ),
    );
    if (reduce) {
      nodes.forEach((n) => n.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 },
    );

    nodes.forEach((n) => io.observe(n));

    return () => io.disconnect();
  }, []);

  return null;
}
