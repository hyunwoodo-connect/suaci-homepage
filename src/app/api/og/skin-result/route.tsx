import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const score = searchParams.get("score") || "??";
  const skinType = searchParams.get("type") || "피부 유형";
  const oneLiner = searchParams.get("comment") || "";

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
          backgroundColor: "#ffffff",
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
          SUACI Skin Lab
        </div>

        {/* 점수 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "40",
          }}
        >
          <div
            style={{
              fontSize: "120",
              fontWeight: "900",
              color: "#111111",
              lineHeight: "1",
            }}
          >
            {score}
          </div>
          <div
            style={{
              fontSize: "20",
              color: "#999999",
              marginTop: "8",
            }}
          >
            / 100
          </div>
        </div>

        {/* 유형 */}
        <div
          style={{
            display: "flex",
            fontSize: "36",
            fontWeight: "700",
            color: "#111111",
            marginTop: "32",
          }}
        >
          {skinType}
        </div>

        {/* 한줄 진단 */}
        {oneLiner && (
          <div
            style={{
              display: "flex",
              fontSize: "18",
              color: "#666666",
              marginTop: "16",
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
