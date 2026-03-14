import { NextResponse } from "next/server";
import type { AnalyzeRequest, AnalyzeResponse } from "@/types/skinAnalysis";
import { createLLMProvider } from "@/lib/llm";
import { SKIN_ANALYSIS_PROMPT } from "@/constants/skinCheck";

const MAX_IMAGE_SIZE_MB = 4;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse<AnalyzeResponse>> {
  try {
    const body = (await request.json()) as AnalyzeRequest;

    if (!body.image) {
      return NextResponse.json(
        { success: false, error: "이미지가 필요합니다." },
        { status: 400 },
      );
    }

    // Base64 이미지 크기 체크 (대략적)
    const estimatedSize = (body.image.length * 3) / 4;
    if (estimatedSize > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: `이미지 크기는 ${MAX_IMAGE_SIZE_MB}MB 이하여야 합니다.` },
        { status: 400 },
      );
    }

    const provider = createLLMProvider();
    const result = await provider.analyzeSkin(body.image, SKIN_ANALYSIS_PROMPT);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[analyze] LLM 분석 실패:", error);

    const message =
      error instanceof Error ? error.message : "피부 분석 중 오류가 발생했습니다.";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
