import type { PersonalColorResult } from "@/types/personalColor";

/**
 * LLM 프로바이더 인터페이스
 * 새로운 LLM을 추가하려면 이 인터페이스를 구현하면 됩니다.
 */
export interface LLMProvider {
  /** 이미지를 분석하여 퍼스널 컬러 진단 결과를 반환 */
  analyzePersonalColor(imageBase64: string, systemPrompt: string): Promise<PersonalColorResult>;
}
