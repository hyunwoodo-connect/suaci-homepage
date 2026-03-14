"use client";

import type { PersonalColorResult, ColorSwatch, ColorRecommendation } from "@/types/personalColor";
import { SEASON_THEMES } from "@/constants/personalColor";

interface ResultCardProps {
  result: PersonalColorResult;
}

export default function ResultCard({ result }: ResultCardProps) {
  const theme = SEASON_THEMES[result.season];

  return (
    <div className="flex flex-col gap-8">
      {/* 헤더: 타입 + 한줄평 */}
      <div className="flex flex-col items-center gap-4 pt-4">
        <span className="text-5xl">{theme.emoji}</span>
        <div className={`rounded-full px-4 py-1.5 text-sm font-medium ${theme.bgColor} ${theme.textColor}`}>
          {result.tone === "cool" ? "쿨톤" : "웜톤"}
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{result.typeName}</h2>
        <p className="text-center text-sm text-muted">{result.typeDescription}</p>
        <p className="max-w-sm text-center text-base italic text-foreground/70">
          &ldquo;{result.oneLiner}&rdquo;
        </p>
      </div>

      {/* 구분선 */}
      <div className="h-px w-full bg-border" />

      {/* 베스트 컬러 팔레트 */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Best Colors
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {result.bestColors.map((color) => (
            <ColorChip key={color.hex} color={color} />
          ))}
        </div>
      </div>

      {/* 구분선 */}
      <div className="h-px w-full bg-border" />

      {/* 피해야 할 컬러 */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Avoid These Colors
        </h3>
        <div className="flex flex-col gap-3">
          {result.worstColors.map((color) => (
            <WorstColorRow key={color.hex} color={color} />
          ))}
        </div>
      </div>

      {/* 구분선 */}
      <div className="h-px w-full bg-border" />

      {/* 카테고리별 추천 */}
      <div className="flex flex-col gap-6">
        <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Beauty Advice
        </h3>
        {result.recommendations.map((rec) => (
          <RecommendationCard key={rec.category} recommendation={rec} />
        ))}
      </div>
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function ColorChip({ color }: { color: ColorSwatch }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="h-14 w-14 rounded-xl border border-border/50 shadow-sm"
        style={{ backgroundColor: color.hex }}
      />
      <span className="text-center text-[10px] leading-tight text-muted">{color.name}</span>
    </div>
  );
}

function WorstColorRow({ color }: { color: ColorSwatch }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-8 w-8 shrink-0 rounded-lg border border-border/50"
        style={{ backgroundColor: color.hex }}
      >
        {/* X 표시 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-0.5 rotate-45 rounded-full bg-white/80" />
          <div className="absolute h-6 w-0.5 -rotate-45 rounded-full bg-white/80" />
        </div>
      </div>
      <span className="text-xs text-muted">{color.name}</span>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: ColorRecommendation }) {
  const icon = getCategoryIcon(recommendation.category);

  return (
    <div className="rounded-xl bg-foreground/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-sm font-medium">{recommendation.category}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {recommendation.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <span className="mt-0.5 shrink-0 text-foreground/30">&#x2022;</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function getCategoryIcon(category: string): string {
  if (category.includes("패션")) return "👗";
  if (category.includes("립") || category.includes("메이크업")) return "💄";
  if (category.includes("헤어")) return "💇";
  if (category.includes("액세서리")) return "💍";
  return "✨";
}
