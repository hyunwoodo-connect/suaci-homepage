import type { PersonalColorResult } from "@/types/personalColor";
import type { LLMProvider } from "./types";

/** 개발/테스트용 Mock 프로바이더 — API 키 없이 UI 확인 가능 */
export class MockProvider implements LLMProvider {
  async analyzePersonalColor(): Promise<PersonalColorResult> {
    // 실제 API 호출 시간을 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const result = pickRandom(MOCK_RESULTS);
    return result;
  }
}

/* ─── 헬퍼 ─────────────────────────── */

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ─── Mock 데이터 ─────────────────────────── */

const MOCK_RESULTS: readonly PersonalColorResult[] = [
  {
    tone: "cool",
    season: "summer",
    subTone: "mute",
    typeName: "여름 쿨 뮤트",
    typeDescription: "부드럽고 차분한 톤이 어울리는 타입이에요. 파스텔과 그레이시한 색감이 당신의 매력을 200% 끌어올려요.",
    oneLiner: "당신은 카페 라떼 같은 사람이에요. 부드럽지만 중독성 있는 매력의 소유자.",
    bestColors: [
      { hex: "#B5C7D3", name: "더스티 블루" },
      { hex: "#D4A5A5", name: "로즈 핑크" },
      { hex: "#C3B1E1", name: "라벤더" },
      { hex: "#A7C4BC", name: "세이지 그린" },
      { hex: "#E8D5D5", name: "피치 베이지" },
      { hex: "#9BB5CE", name: "스카이 블루" },
      { hex: "#C9B1D0", name: "라일락" },
    ],
    worstColors: [
      { hex: "#FF6600", name: "강렬한 오렌지는 얼굴을 칙칙하게 해요" },
      { hex: "#FFD700", name: "골드 옐로는 피부가 노랗게 보여요" },
      { hex: "#8B4513", name: "진한 브라운은 얼굴이 묻혀요" },
      { hex: "#FF0000", name: "순수 빨강은 피부가 창백해 보여요" },
    ],
    recommendations: [
      {
        category: "패션 코디",
        items: [
          "더스티 블루 니트 + 그레이 와이드팬츠 = 세련미 폭발",
          "라벤더 블라우스 + 화이트 스커트 = 청순 + 고급",
          "로즈 핑크 코트 + 네이비 부츠 = 도시적인 감성",
        ],
      },
      {
        category: "립 & 메이크업",
        items: [
          "MLBB 컬러 립스틱이 찰떡 (모브 핑크, 로즈 베이지)",
          "아이섀도우는 라벤더, 더스티 로즈 계열",
          "블러셔는 쿨 핑크 계열로 자연스럽게",
        ],
      },
      {
        category: "헤어 컬러",
        items: [
          "애쉬 브라운 or 애쉬 그레이가 가장 잘 어울려요",
          "라벤더 브라운도 분위기 UP",
        ],
      },
      {
        category: "액세서리",
        items: [
          "실버 주얼리가 피부를 더 환하게 해줘요",
          "로즈골드도 OK, 골드는 피해주세요",
        ],
      },
    ],
  },
  {
    tone: "warm",
    season: "autumn",
    subTone: "deep",
    typeName: "가을 웜 딥",
    typeDescription: "깊고 풍부한 색감이 어울리는 고급스러운 타입. 자연에서 온 듯한 따뜻한 색이 당신을 빛나게 해요.",
    oneLiner: "당신은 숙성된 와인 같은 존재. 시간이 갈수록 깊어지는 매력의 소유자.",
    bestColors: [
      { hex: "#8B4513", name: "초콜릿 브라운" },
      { hex: "#B8860B", name: "다크 골드" },
      { hex: "#556B2F", name: "올리브 그린" },
      { hex: "#CD853F", name: "페루 탄" },
      { hex: "#800020", name: "버건디" },
      { hex: "#D2691E", name: "시에나" },
      { hex: "#DAA520", name: "골든 로드" },
      { hex: "#704214", name: "세피아" },
    ],
    worstColors: [
      { hex: "#00FFFF", name: "네온 민트는 얼굴이 떠 보여요" },
      { hex: "#FF69B4", name: "핫핑크는 피부가 칙칙해 보여요" },
      { hex: "#C0C0C0", name: "실버 그레이는 생기가 없어 보여요" },
      { hex: "#E6E6FA", name: "연한 라벤더는 얼굴이 누렇게 보여요" },
      { hex: "#87CEEB", name: "파스텔 블루는 안색이 탁해 보여요" },
    ],
    recommendations: [
      {
        category: "패션 코디",
        items: [
          "카멜 코트 + 버건디 머플러 = 가을 감성 끝판왕",
          "올리브 재킷 + 베이지 팬츠 = 세련된 어스톤",
          "초콜릿 브라운 원피스 + 골드 벨트 = 고급미",
        ],
      },
      {
        category: "립 & 메이크업",
        items: [
          "브릭 레드, 테라코타 립이 환상의 궁합",
          "아이섀도우는 브론즈, 골드, 카키 계열",
          "블러셔는 피치, 코랄 계열이 자연스러워요",
        ],
      },
      {
        category: "헤어 컬러",
        items: [
          "다크 초콜릿 브라운이 가장 잘 어울려요",
          "웜 브라운, 카라멜 하이라이트도 추천",
        ],
      },
      {
        category: "액세서리",
        items: [
          "골드 주얼리가 피부톤과 완벽 조화",
          "가죽 소재 액세서리로 고급스러움 UP",
        ],
      },
    ],
  },
  {
    tone: "warm",
    season: "spring",
    subTone: "bright",
    typeName: "봄 웜 브라이트",
    typeDescription: "밝고 선명한 색감이 어울리는 화사한 타입! 생기 있는 컬러가 당신의 에너지를 그대로 보여줘요.",
    oneLiner: "당신은 화창한 봄날 벚꽃 아래 서 있는 사람. 존재 자체가 봄이에요.",
    bestColors: [
      { hex: "#FF6B6B", name: "코랄 레드" },
      { hex: "#FFA07A", name: "라이트 살몬" },
      { hex: "#FFD700", name: "골든 옐로" },
      { hex: "#98FB98", name: "페일 그린" },
      { hex: "#FFB347", name: "피치 오렌지" },
      { hex: "#FF69B4", name: "핫 핑크" },
      { hex: "#87CEEB", name: "스카이 블루" },
    ],
    worstColors: [
      { hex: "#2F4F4F", name: "다크 슬레이트는 생기를 죽여요" },
      { hex: "#800000", name: "딥 와인은 얼굴이 어두워 보여요" },
      { hex: "#4B0082", name: "인디고는 피부가 칙칙해져요" },
      { hex: "#696969", name: "차콜 그레이는 활기가 사라져요" },
    ],
    recommendations: [
      {
        category: "패션 코디",
        items: [
          "코랄 니트 + 화이트 데님 = 화사한 봄 룩",
          "피치 원피스 + 골드 샌들 = 데이트 필수템",
          "라이트 옐로 셔츠 + 스카이 블루 팬츠 = 상큼 그 자체",
        ],
      },
      {
        category: "립 & 메이크업",
        items: [
          "코랄 핑크, 피치 립이 생기 넘치는 얼굴 만들어줘요",
          "아이섀도우는 샴페인 골드, 피치 계열",
          "블러셔는 코랄, 피치 컬러로 화사하게",
        ],
      },
      {
        category: "헤어 컬러",
        items: [
          "밝은 브라운, 카라멜 브라운이 봄 느낌 물씬",
          "애프리콧 오렌지 염색도 도전해볼 만해요",
        ],
      },
      {
        category: "액세서리",
        items: [
          "골드, 로즈골드 주얼리가 완벽",
          "파스텔 컬러 가방으로 포인트 주기",
        ],
      },
    ],
  },
  {
    tone: "cool",
    season: "winter",
    subTone: "bright",
    typeName: "겨울 쿨 브라이트",
    typeDescription: "선명하고 강렬한 색이 어울리는 시크한 타입. 임팩트 있는 컬러가 당신의 카리스마를 폭발시켜요.",
    oneLiner: "당신은 도시의 네온사인 같은 존재. 어디서든 시선을 강탈하는 타입.",
    bestColors: [
      { hex: "#FF0000", name: "트루 레드" },
      { hex: "#0000FF", name: "로얄 블루" },
      { hex: "#FF00FF", name: "핫 핑크" },
      { hex: "#000000", name: "제트 블랙" },
      { hex: "#FFFFFF", name: "퓨어 화이트" },
      { hex: "#4B0082", name: "인디고" },
      { hex: "#00CED1", name: "다크 터콰이즈" },
      { hex: "#C0C0C0", name: "아이시 실버" },
    ],
    worstColors: [
      { hex: "#F5DEB3", name: "베이지는 얼굴이 묻혀요" },
      { hex: "#FFD700", name: "머스터드는 피부가 노래져요" },
      { hex: "#D2691E", name: "카멜은 생기가 빠져요" },
      { hex: "#DEB887", name: "탄 컬러는 얼굴을 칙칙하게 해요" },
    ],
    recommendations: [
      {
        category: "패션 코디",
        items: [
          "블랙 수트 + 트루 레드 이너 = 압도적 카리스마",
          "로얄 블루 코트 + 화이트 팬츠 = 시크 & 클린",
          "올 블랙 + 실버 액세서리 = 도시적 매력",
        ],
      },
      {
        category: "립 & 메이크업",
        items: [
          "트루 레드, 체리 립이 당신의 시그니처",
          "아이섀도우는 실버, 쿨 그레이, 네이비",
          "블러셔는 쿨 로즈, 푸시아 계열",
        ],
      },
      {
        category: "헤어 컬러",
        items: [
          "블루 블랙이 가장 잘 어울려요",
          "애쉬 블랙, 다크 에스프레소도 추천",
        ],
      },
      {
        category: "액세서리",
        items: [
          "실버, 플래티넘 주얼리가 피부를 더 빛나게",
          "블랙 레더 아이템으로 시크함 극대화",
        ],
      },
    ],
  },
] as const;
