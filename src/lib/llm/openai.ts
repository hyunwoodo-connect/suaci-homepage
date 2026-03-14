import OpenAI from "openai";
import type { PersonalColorResult } from "@/types/personalColor";
import type { LLMProvider } from "./types";

/** OpenAI 기반 LLM 프로바이더 */
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  async analyzePersonalColor(imageBase64: string, systemPrompt: string): Promise<PersonalColorResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: imageBase64,
                detail: "low",
              },
            },
            {
              type: "text",
              text: "이 얼굴 사진을 분석하여 퍼스널 컬러를 진단해주세요.",
            },
          ],
        },
      ],
      max_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LLM 응답이 비어있습니다.");
    }

    return JSON.parse(content) as PersonalColorResult;
  }
}
