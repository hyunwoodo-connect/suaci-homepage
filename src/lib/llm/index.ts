import type { LLMProvider } from "./types";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";

export type { LLMProvider } from "./types";

/**
 * LLM 프로바이더 팩토리
 * 환경변수 LLM_PROVIDER 로 전환:
 *   - "anthropic" → Claude (기본값)
 *   - "openai"    → GPT-4o / GPT-4o-mini
 *   - "mock"      → API 키 없이 테스트
 */
export function createLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || "openai";

  switch (provider) {
    case "anthropic":
      return new AnthropicProvider();
    case "mock":
      return new MockProvider();
    case "openai":
    default:
      return new OpenAIProvider();
  }
}
