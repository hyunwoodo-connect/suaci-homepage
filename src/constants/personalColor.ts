/** 퍼스널 컬러 분석 LLM 시스템 프롬프트 */
export const PERSONAL_COLOR_PROMPT = `당신은 SUACI의 퍼스널 컬러 전문 AI 뷰티 어드바이저입니다.
사용자가 보낸 얼굴 사진을 분석하여 퍼스널 컬러를 진단해주세요.

## 분석 기준
- 피부 언더톤 (쿨/웜)
- 눈동자 색상
- 머리카락 색상
- 전체적인 피부 밝기와 채도

## 퍼스널 컬러 분류 체계
대분류: cool(쿨톤) / warm(웜톤)
4계절: spring(봄웜) / summer(여름쿨) / autumn(가을웜) / winter(겨울쿨)
세부톤:
- 봄웜: light(라이트), bright(브라이트), true(트루)
- 여름쿨: light(라이트), mute(뮤트), true(트루)
- 가을웜: mute(뮤트), true(트루), deep(딥)
- 겨울쿨: bright(브라이트), true(트루), deep(딥)

## 톤 & 매너
- 전문적이면서도 MZ세대가 좋아할 유머러스한 말투
- 한줄 평은 SNS에 공유하고 싶을 만큼 재밌고 공감되는 문구
- 색상 추천은 실용적이고 구체적으로

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "tone": "cool 또는 warm",
  "season": "spring, summer, autumn, winter 중 하나",
  "subTone": "light, bright, true, mute, deep 중 하나",
  "typeName": "한국어 타입명 (예: 여름 쿨 뮤트)",
  "typeDescription": "이 타입의 특징을 1-2문장으로 설명",
  "oneLiner": "재밌는 한줄 평 (SNS 공유하고 싶을 정도로, 비유나 유머 포함)",
  "bestColors": [
    { "hex": "#HEX코드", "name": "색상명" },
    ... (6~8개)
  ],
  "worstColors": [
    { "hex": "#HEX코드", "name": "이 색이 안 어울리는 짧은 이유" },
    ... (4~6개)
  ],
  "recommendations": [
    {
      "category": "패션 코디",
      "items": ["구체적인 색상 조합 추천 1", "추천 2", "추천 3"]
    },
    {
      "category": "립 & 메이크업",
      "items": ["립스틱/아이섀도우 색상 추천 1", "추천 2", "추천 3"]
    },
    {
      "category": "헤어 컬러",
      "items": ["어울리는 염색 색상 1", "추천 2"]
    },
    {
      "category": "액세서리",
      "items": ["골드/실버/로즈골드 등 추천 1", "추천 2"]
    }
  ]
}` as const;

/** 분석 중 로딩 멘트 (순환 표시) */
export const LOADING_MESSAGES = [
  "피부 언더톤 분석 중...",
  "눈동자 색상 확인 중...",
  "쿨톤인지 웜톤인지 판별 중...",
  "최적의 컬러 팔레트 조합 중...",
  "당신만의 색을 찾고 있어요...",
  "어울리는 립 컬러 고르는 중...",
  "셀럽 컬러 매칭 중...",
  "완벽한 색 조합을 만드는 중...",
] as const;

/** 로딩 멘트 교체 간격 (ms) */
export const LOADING_MESSAGE_INTERVAL = 2000;

/** 계절별 테마 컬러 (UI 표시용) */
export const SEASON_THEMES = {
  spring: {
    label: "봄 웜톤",
    emoji: "🌸",
    gradient: "from-amber-200 via-rose-200 to-orange-200",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-300",
    accentColor: "#F59E0B",
  },
  summer: {
    label: "여름 쿨톤",
    emoji: "🌊",
    gradient: "from-blue-200 via-purple-200 to-pink-200",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-300",
    accentColor: "#6366F1",
  },
  autumn: {
    label: "가을 웜톤",
    emoji: "🍂",
    gradient: "from-orange-300 via-amber-200 to-yellow-200",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-300",
    accentColor: "#EA580C",
  },
  winter: {
    label: "겨울 쿨톤",
    emoji: "❄️",
    gradient: "from-slate-300 via-blue-300 to-indigo-300",
    bgColor: "bg-slate-50",
    textColor: "text-slate-700",
    borderColor: "border-slate-300",
    accentColor: "#475569",
  },
} as const;

/** 세부톤 라벨 */
export const SUB_TONE_LABELS = {
  light: "라이트",
  bright: "브라이트",
  true: "트루",
  mute: "뮤트",
  deep: "딥",
} as const;

/** 톤 라벨 */
export const TONE_LABELS = {
  cool: "쿨톤",
  warm: "웜톤",
} as const;
