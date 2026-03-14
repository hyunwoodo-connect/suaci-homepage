"use client";

import { useState, useEffect } from "react";
import { LOADING_MESSAGES, LOADING_MESSAGE_INTERVAL } from "@/constants/personalColor";

export default function AnalysisLoading() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, LOADING_MESSAGE_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-8 py-20">
      {/* 컬러 휠 애니메이션 */}
      <div className="relative">
        <div className="h-24 w-24 animate-spin rounded-full" style={{ animationDuration: "3s", background: "conic-gradient(#FF6B6B, #FFD93D, #6BCB77, #4D96FF, #9B59B6, #FF6B6B)" }} />
        <div className="absolute inset-2 rounded-full bg-background" />
        <div className="absolute inset-0 flex items-center justify-center">
          <PaletteIcon />
        </div>
      </div>

      {/* 로딩 멘트 */}
      <p className="h-6 text-center text-sm text-muted transition-opacity duration-300">
        {LOADING_MESSAGES[messageIndex]}
      </p>

      {/* 프로그레스 도트 */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 animate-bounce rounded-full bg-foreground/40"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── 아이콘 컴포넌트 ─────────────────────────── */

function PaletteIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/60">
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  );
}
