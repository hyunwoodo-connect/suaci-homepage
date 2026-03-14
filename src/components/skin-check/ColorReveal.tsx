"use client";

import { useState, useEffect } from "react";
import type { PersonalColorResult } from "@/types/personalColor";
import { SEASON_THEMES } from "@/constants/personalColor";

interface ColorRevealProps {
  result: PersonalColorResult;
  onRevealComplete: () => void;
}

export default function ColorReveal({ result, onRevealComplete }: ColorRevealProps) {
  const [step, setStep] = useState(0);
  const theme = SEASON_THEMES[result.season];

  useEffect(() => {
    const timers = [
      // Step 1: "당신의 퍼스널 컬러는..." 텍스트 등장 (0ms)
      setTimeout(() => setStep(1), 300),
      // Step 2: 색상들이 원형으로 퍼지는 애니메이션 (1.5s)
      setTimeout(() => setStep(2), 1800),
      // Step 3: 타입명 공개 (3s)
      setTimeout(() => setStep(3), 3300),
      // Step 4: 한줄평 등장 (4.5s)
      setTimeout(() => setStep(4), 4800),
      // Step 5: "결과 보기" 버튼 등장 (6s)
      setTimeout(() => setStep(5), 6000),
    ];

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 py-8">
      {/* 배경 그라데이션 — 컬러 스플래시 */}
      <div
        className={`pointer-events-none fixed inset-0 transition-opacity duration-1000 ${step >= 2 ? "opacity-20" : "opacity-0"}`}
        style={{
          background: `radial-gradient(ellipse at center, ${theme.accentColor}40 0%, transparent 70%)`,
        }}
      />

      {/* Step 1: 도입 텍스트 */}
      <p
        className={`text-center text-lg font-medium text-muted transition-all duration-700 ${step >= 1 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      >
        당신의 퍼스널 컬러는...
      </p>

      {/* Step 2: 컬러 서클 애니메이션 */}
      <div className="relative flex h-48 w-48 items-center justify-center">
        {result.bestColors.slice(0, 6).map((color, i) => {
          const angle = (i * 360) / 6;
          const radius = step >= 2 ? 70 : 0;
          const x = Math.cos((angle * Math.PI) / 180) * radius;
          const y = Math.sin((angle * Math.PI) / 180) * radius;

          return (
            <div
              key={color.hex}
              className="absolute h-10 w-10 rounded-full shadow-lg transition-all duration-700"
              style={{
                backgroundColor: color.hex,
                transform: `translate(${x}px, ${y}px) scale(${step >= 2 ? 1 : 0})`,
                transitionDelay: `${i * 100}ms`,
              }}
            />
          );
        })}

        {/* 중앙 이모지 */}
        <span
          className={`relative z-10 text-5xl transition-all duration-500 ${step >= 2 ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
          style={{ transitionDelay: "600ms" }}
        >
          {theme.emoji}
        </span>
      </div>

      {/* Step 3: 타입명 공개 */}
      <div
        className={`flex flex-col items-center gap-2 transition-all duration-700 ${step >= 3 ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
      >
        <div className={`rounded-full px-4 py-1.5 text-sm font-medium ${theme.bgColor} ${theme.textColor}`}>
          {result.tone === "cool" ? "쿨톤" : "웜톤"}
        </div>
        <h2 className="text-3xl font-bold tracking-tight">{result.typeName}</h2>
        <p className="max-w-xs text-center text-sm text-muted">{result.typeDescription}</p>
      </div>

      {/* Step 4: 한줄평 */}
      <p
        className={`max-w-sm text-center text-base leading-relaxed italic text-foreground/70 transition-all duration-700 ${step >= 4 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      >
        &ldquo;{result.oneLiner}&rdquo;
      </p>

      {/* Step 5: 결과 보기 버튼 */}
      <button
        onClick={onRevealComplete}
        className={`rounded-full bg-foreground px-8 py-3.5 text-sm font-medium text-background transition-all duration-500 hover:opacity-80 ${step >= 5 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      >
        자세한 결과 보기
      </button>
    </div>
  );
}
