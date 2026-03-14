/** 피부 분석 LLM 시스템 프롬프트 */
export const SKIN_ANALYSIS_PROMPT = `당신은 SUACI의 유쾌한 피부 분석 AI입니다.
사용자가 보낸 얼굴 사진을 보고 재미있고 위트있게 피부를 분석해주세요.

톤: MZ세대가 좋아할 유머러스하고 힙한 말투.
과하게 전문적이지 않게, 친구가 장난치듯 분석해주세요.
피부 유형 별명은 창의적이고 웃긴 걸로 만들어주세요.
한줄 진단은 SNS에 공유하고 싶을 만큼 재밌어야 합니다.

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "score": 0~100 사이의 정수,
  "skinType": "재미있는 피부 유형 별명 (예: 수분갈증 전사, 유분 제국의 황제, 꿀피부 요정)",
  "oneLiner": "위트있는 한줄 진단 (SNS 공유하고 싶을 정도로)",
  "details": {
    "moisture": { "score": 0~100, "comment": "수분 관련 재밌는 코멘트" },
    "oil": { "score": 0~100, "comment": "유분 관련 재밌는 코멘트" },
    "elasticity": { "score": 0~100, "comment": "탄력 관련 재밌는 코멘트" },
    "pore": { "score": 0~100, "comment": "모공 관련 재밌는 코멘트" },
    "tone": { "score": 0~100, "comment": "피부톤 관련 재밌는 코멘트" }
  },
  "advice": "한줄 스킨케어 조언 (가볍고 재밌게)"
}` as const;

/** 분석 중 로딩 멘트 (랜덤으로 돌려가며 표시) */
export const LOADING_MESSAGES = [
  "피부 세포 하나하나 뜯어보는 중...",
  "AI가 돋보기 들고 관찰 중...",
  "모공 수 세는 중...",
  "피부 나이 계산 중... 긴장하세요",
  "수분 레이더 가동 중...",
  "피부결 스캔 중...",
  "유분기 측정 센서 켜는 중...",
  "당신의 피부를 진지하게 감상 중...",
] as const;

/** 로딩 멘트 교체 간격 (ms) */
export const LOADING_MESSAGE_INTERVAL = 2000;

/** 세부 분석 항목 라벨 매핑 */
export const DETAIL_LABELS = {
  moisture: "수분",
  oil: "유분",
  elasticity: "탄력",
  pore: "모공",
  tone: "피부톤",
} as const;

/** 점수 구간별 등급 */
export const SCORE_GRADES = [
  { min: 90, label: "S", color: "text-emerald-500" },
  { min: 75, label: "A", color: "text-blue-500" },
  { min: 60, label: "B", color: "text-yellow-500" },
  { min: 40, label: "C", color: "text-orange-500" },
  { min: 0, label: "D", color: "text-red-500" },
] as const;

/** 점수에 해당하는 등급 반환 */
export function getScoreGrade(score: number) {
  return SCORE_GRADES.find((g) => score >= g.min) ?? SCORE_GRADES[SCORE_GRADES.length - 1];
}
