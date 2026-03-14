/** 피부 세부 항목 점수 및 코멘트 */
export interface SkinDetail {
  /** 점수 (0–100) */
  score: number;
  /** 유머러스한 한줄 코멘트 */
  comment: string;
}

/** 피부 세부 분석 항목들 */
export interface SkinDetails {
  /** 수분 */
  moisture: SkinDetail;
  /** 유분 */
  oil: SkinDetail;
  /** 탄력 */
  elasticity: SkinDetail;
  /** 모공 */
  pore: SkinDetail;
  /** 피부톤 */
  tone: SkinDetail;
}

/** LLM이 반환하는 피부 분석 결과 */
export interface SkinAnalysisResult {
  /** 종합 점수 (0–100) */
  score: number;
  /** 재미있는 피부 유형 별명 (예: "수분갈증 전사") */
  skinType: string;
  /** 위트있는 한줄 진단 */
  oneLiner: string;
  /** 세부 항목별 분석 */
  details: SkinDetails;
  /** 한줄 조언 */
  advice: string;
}

/** 분석 API 요청 바디 */
export interface AnalyzeRequest {
  /** Base64 인코딩된 이미지 데이터 (data:image/... 형식) */
  image: string;
}

/** 분석 API 성공 응답 */
export interface AnalyzeSuccessResponse {
  success: true;
  result: SkinAnalysisResult;
}

/** 분석 API 에러 응답 */
export interface AnalyzeErrorResponse {
  success: false;
  error: string;
}

/** 분석 API 응답 */
export type AnalyzeResponse = AnalyzeSuccessResponse | AnalyzeErrorResponse;
