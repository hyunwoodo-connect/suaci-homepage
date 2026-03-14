import Anthropic from "@anthropic-ai/sdk";
import type { PersonalColorResult } from "@/types/personalColor";
import type { LLMProvider } from "./types";

/** Anthropic Claude 기반 LLM 프로바이더 */
export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
  }

  async analyzePersonalColor(imageBase64: string, systemPrompt: string): Promise<PersonalColorResult> {
    // data:image/jpeg;base64,/9j/... → mediaType + base64 데이터 분리
    const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      throw new Error("잘못된 이미지 형식입니다.");
    }

    const mediaType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    const base64Data = match[2];

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: "이 얼굴 사진을 분석하여 퍼스널 컬러를 진단해주세요. 반드시 JSON 형식으로만 응답하세요.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("LLM 응답이 비어있습니다.");
    }

    // Claude가 JSON을 ```json ... ``` 으로 감쌀 수 있으므로 추출
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("LLM 응답에서 JSON을 파싱할 수 없습니다.");
    }

    return JSON.parse(jsonMatch[0]) as PersonalColorResult;
  }
}
