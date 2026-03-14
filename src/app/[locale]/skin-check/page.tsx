"use client";

import { useState, useCallback } from "react";
import type { PersonalColorResult, AnalyzeResponse } from "@/types/personalColor";
import { SECTION_PADDING_X } from "@/constants/site";
import Camera from "@/components/skin-check/Camera";
import AnalysisLoading from "@/components/skin-check/AnalysisLoading";
import ColorReveal from "@/components/skin-check/ColorReveal";
import ResultCard from "@/components/skin-check/ResultCard";
import ShareButtons from "@/components/skin-check/ShareButtons";

type Phase = "intro" | "camera" | "loading" | "reveal" | "result" | "error";

export default function SkinCheckPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [result, setResult] = useState<PersonalColorResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleCapture = useCallback(async (imageDataUrl: string) => {
    setPhase("loading");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });

      const data: AnalyzeResponse = await response.json();

      if (data.success) {
        setResult(data.result);
        setPhase("reveal");
      } else {
        setErrorMessage(data.error);
        setPhase("error");
      }
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      setPhase("error");
    }
  }, []);

  const handleRevealComplete = useCallback(() => {
    setPhase("result");
  }, []);

  const handleRetry = useCallback(() => {
    setResult(null);
    setErrorMessage("");
    setPhase("camera");
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setErrorMessage("");
    setPhase("intro");
  }, []);

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = result
    ? `${siteUrl}/skin-check?type=${encodeURIComponent(result.typeName)}&season=${result.season}&colors=${result.bestColors.map((c) => c.hex).join(",")}`
    : siteUrl;
  const shareText = result
    ? `나의 퍼스널 컬러는 ${result.typeName}! ✨ "${result.oneLiner}" — SUACI에서 무료 진단받기`
    : "";

  return (
    <div className={`min-h-screen bg-background ${SECTION_PADDING_X}`}>
      <div className="mx-auto max-w-md py-8">
        {/* 헤더 */}
        <header className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            SUACI Beauty Advisor
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">퍼스널 컬러 진단</h1>
        </header>

        {/* 페이즈별 UI */}
        {phase === "intro" && <IntroPhase onStart={() => setPhase("camera")} />}
        {phase === "camera" && <Camera onCapture={handleCapture} />}
        {phase === "loading" && <AnalysisLoading />}
        {phase === "reveal" && result && (
          <ColorReveal result={result} onRevealComplete={handleRevealComplete} />
        )}
        {phase === "result" && result && (
          <div className="flex flex-col gap-8">
            <ResultCard result={result} />
            <ShareButtons shareUrl={shareUrl} shareText={shareText} />
            <button
              onClick={handleRetry}
              className="mx-auto text-sm text-muted underline underline-offset-4 transition-colors hover:text-foreground"
            >
              다시 진단받기
            </button>
          </div>
        )}
        {phase === "error" && (
          <ErrorPhase message={errorMessage} onRetry={handleRetry} />
        )}

        {/* 푸터 */}
        <footer className="mt-12 pb-8 text-center">
          <p className="text-xs text-muted/60">
            본 서비스는 엔터테인먼트 목적이며, 전문 컬러 컨설팅이 아닙니다.
          </p>
          {phase !== "intro" && (
            <button
              onClick={handleReset}
              className="mt-3 text-xs text-muted underline underline-offset-4 transition-colors hover:text-foreground"
            >
              처음으로
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function IntroPhase({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100">
          <PaletteIcon />
        </div>
        <h2 className="text-lg font-medium">3초 셀카로 알아보는 진짜 내 컬러</h2>
        <p className="max-w-xs text-sm leading-relaxed text-muted">
          AI가 당신의 퍼스널 컬러를 진단하고,
          어울리는 패션 / 메이크업 / 헤어 컬러까지 추천해드려요.
        </p>
      </div>

      <button
        onClick={onStart}
        className="rounded-full bg-foreground px-8 py-3.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
      >
        진단 시작하기
      </button>

      <ul className="flex flex-col gap-2 text-xs text-muted">
        <li className="flex items-center gap-2">
          <CheckIcon /> 얼굴이 잘 보이게 정면 셀카를 찍어주세요
        </li>
        <li className="flex items-center gap-2">
          <CheckIcon /> 자연광에서 촬영하면 더 정확해요
        </li>
        <li className="flex items-center gap-2">
          <CheckIcon /> 사진은 분석 후 즉시 삭제됩니다
        </li>
      </ul>
    </div>
  );
}

function ErrorPhase({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <span className="text-2xl">😵</span>
      </div>
      <p className="text-center text-sm text-muted">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-80"
      >
        다시 시도
      </button>
    </div>
  );
}

function PaletteIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/60">
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-emerald-500">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
