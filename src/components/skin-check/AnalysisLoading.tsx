"use client";

import { useState, useEffect } from "react";
import { LOADING_MESSAGES, LOADING_MESSAGE_INTERVAL } from "@/constants/skinCheck";

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
      {/* 펄스 애니메이션 */}
      <div className="relative">
        <div className="h-24 w-24 animate-pulse rounded-full bg-foreground/10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <ScanIcon />
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

function ScanIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/60">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}
