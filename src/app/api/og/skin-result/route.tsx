import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const SEASON_COLORS: Record<string, { bg: string; accent: string }> = {
  spring: { bg: "#FFF7ED", accent: "#F59E0B" },
  summer: { bg: "#EFF6FF", accent: "#6366F1" },
  autumn: { bg: "#FFF7ED", accent: "#EA580C" },
  winter: { bg: "#F8FAFC", accent: "#475569" },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const typeName = searchParams.get("type") || "퍼스널 컬러";
  const oneLiner = searchParams.get("comment") || "";
  const season = searchParams.get("season") || "summer";
  const colors = searchParams.get("colors") || "";

  const theme = SEASON_COLORS[season] || SEASON_COLORS.summer;
  const colorList = colors ? colors.split(",").slice(0, 6) : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200",
          height: "630",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.bg,
          fontFamily: "sans-serif",
        }}
      >
        {/* 상단 브랜드 */}
        <div
          style={{
            display: "flex",
            fontSize: "14",
            fontWeight: "500",
            letterSpacing: "0.2em",
            color: "#999999",
            textTransform: "uppercase",
          }}
        >
          SUACI Beauty Advisor
        </div>

        {/* 타입명 */}
        <div
          style={{
            display: "flex",
            fontSize: "56",
            fontWeight: "900",
            color: theme.accent,
            marginTop: "32",
            lineHeight: "1.2",
          }}
        >
          {typeName}
        </div>

        {/* 컬러 팔레트 */}
        {colorList.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "12",
              marginTop: "32",
            }}
          >
            {colorList.map((hex, i) => (
              <div
                key={i}
                style={{
                  width: "48",
                  height: "48",
                  borderRadius: "12",
                  backgroundColor: hex,
                  border: "2px solid rgba(0,0,0,0.05)",
                }}
              />
            ))}
          </div>
        )}

        {/* 한줄 진단 */}
        {oneLiner && (
          <div
            style={{
              display: "flex",
              fontSize: "20",
              color: "#666666",
              marginTop: "24",
              maxWidth: "800",
              textAlign: "center",
            }}
          >
            &ldquo;{oneLiner}&rdquo;
          </div>
        )}

        {/* 하단 CTA */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: "40",
            fontSize: "16",
            color: "#999999",
          }}
        >
          나도 진단받기 → suaci.com/skin-check
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
