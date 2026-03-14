"use client";

import type { SkinAnalysisResult } from "@/types/skinAnalysis";
import { DETAIL_LABELS, getScoreGrade } from "@/constants/skinCheck";
import ScoreGauge from "./ScoreGauge";

interface ResultCardProps {
  result: SkinAnalysisResult;
}

export default function ResultCard({ result }: ResultCardProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* 헤더: 점수 + 유형 */}
      <div className="flex flex-col items-center gap-4 pt-4">
        <ScoreGauge score={result.score} />
        <h2 className="text-2xl font-bold tracking-tight">{result.skinType}</h2>
        <p className="text-center text-muted">&ldquo;{result.oneLiner}&rdquo;</p>
      </div>

      {/* 구분선 */}
      <div className="h-px w-full bg-border" />

      {/* 세부 분석 */}
      <div className="flex flex-col gap-5">
        <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Detail Analysis
        </h3>

        {Object.entries(result.details).map(([key, detail]) => (
          <DetailRow
            key={key}
            label={DETAIL_LABELS[key as keyof typeof DETAIL_LABELS]}
            score={detail.score}
            comment={detail.comment}
          />
        ))}
      </div>

      {/* 구분선 */}
      <div className="h-px w-full bg-border" />

      {/* 조언 */}
      <div className="rounded-xl bg-foreground/5 p-5">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Advice</p>
        <p className="mt-2 text-sm leading-relaxed">{result.advice}</p>
      </div>
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function DetailRow({
  label,
  score,
  comment,
}: {
  label: string;
  score: number;
  comment: string;
}) {
  const grade = getScoreGrade(score);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={`text-sm font-bold ${grade.color}`}>{score}</span>
      </div>

      {/* 프로그레스 바 */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${getBarColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>

      <p className="text-xs text-muted">{comment}</p>
    </div>
  );
}

function getBarColor(score: number): string {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 75) return "bg-blue-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}
