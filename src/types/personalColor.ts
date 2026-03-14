/** 퍼스널 컬러 대분류 톤 */
export type ToneType = "cool" | "warm";

/** 퍼스널 컬러 4계절 */
export type SeasonType = "spring" | "summer" | "autumn" | "winter";

/** 퍼스널 컬러 세부톤 */
export type SubToneType = "light" | "bright" | "true" | "mute" | "deep";

/** HEX 색상 코드와 이름 */
export interface ColorSwatch {
  /** HEX 코드 (예: "#E8A0BF") */
  hex: string;
  /** 색상명 (예: "로즈 핑크") */
  name: string;
}

/** 카테고리별 컬러 추천 */
export interface ColorRecommendation {
  /** 카테고리명 */
  category: string;
  /** 추천 내용 */
  items: string[];
}

/** LLM이 반환하는 퍼스널 컬러 진단 결과 */
export interface PersonalColorResult {
  /** 대분류 톤 (cool / warm) */
  tone: ToneType;
  /** 4계절 (spring / summer / autumn / winter) */
  season: SeasonType;
  /** 세부톤 (light / bright / true / mute / deep) */
  subTone: SubToneType;
  /** 한국어 타입명 (예: "여름 쿨 뮤트") */
  typeName: string;
  /** 타입 한줄 설명 */
  typeDescription: string;
  /** 재미있는 한줄 평 (바이럴 핵심 요소) */
  oneLiner: string;
  /** 어울리는 베스트 컬러 팔레트 (6~8개) */
  bestColors: ColorSwatch[];
  /** 피해야 할 컬러 (4~6개) */
  worstColors: ColorSwatch[];
  /** 카테고리별 컬러 추천 (패션, 립/메이크업, 헤어, 액세서리) */
  recommendations: ColorRecommendation[];
}

/** 분석 API 요청 바디 */
export interface AnalyzeRequest {
  /** Base64 인코딩된 이미지 데이터 (data:image/... 형식) */
  image: string;
}

/** 분석 API 성공 응답 */
export interface AnalyzeSuccessResponse {
  success: true;
  result: PersonalColorResult;
}

/** 분석 API 에러 응답 */
export interface AnalyzeErrorResponse {
  success: false;
  error: string;
}

/** 분석 API 응답 */
export type AnalyzeResponse = AnalyzeSuccessResponse | AnalyzeErrorResponse;
