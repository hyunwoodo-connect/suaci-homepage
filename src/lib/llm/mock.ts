import type { SkinAnalysisResult } from "@/types/skinAnalysis";
import type { LLMProvider } from "./types";

/** 개발/테스트용 Mock 프로바이더 — API 키 없이 UI 확인 가능 */
export class MockProvider implements LLMProvider {
  async analyzeSkin(): Promise<SkinAnalysisResult> {
    // 실제 API 호출 시간을 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const score = randomBetween(45, 92);

    return {
      score,
      skinType: pickRandom(SKIN_TYPES),
      oneLiner: pickRandom(ONE_LINERS),
      details: {
        moisture: {
          score: randomBetween(30, 95),
          comment: pickRandom(MOISTURE_COMMENTS),
        },
        oil: {
          score: randomBetween(25, 90),
          comment: pickRandom(OIL_COMMENTS),
        },
        elasticity: {
          score: randomBetween(40, 95),
          comment: pickRandom(ELASTICITY_COMMENTS),
        },
        pore: {
          score: randomBetween(35, 90),
          comment: pickRandom(PORE_COMMENTS),
        },
        tone: {
          score: randomBetween(40, 95),
          comment: pickRandom(TONE_COMMENTS),
        },
      },
      advice: pickRandom(ADVICE_LIST),
    };
  }
}

/* ─── 헬퍼 ─────────────────────────── */

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ─── Mock 데이터 ─────────────────────────── */

const SKIN_TYPES = [
  "수분갈증 전사",
  "유분 제국의 황제",
  "꿀피부 요정",
  "새벽감성 건조주의보",
  "탄력의 신",
  "모공 미니멀리스트",
  "글로우 마스터",
  "선크림 수호자",
] as const;

const ONE_LINERS = [
  "당신의 피부는 사하라 사막에서 온 편지를 기다리고 있습니다",
  "이 피부로 면접보면 합격 가능",
  "피부가 이직을 고민하고 있습니다. 더 나은 주인을 찾아서.",
  "수분크림이 당신에게 SOS를 보내고 있습니다",
  "피부결이 실크로드급입니다",
  "AI도 인정한 꿀피부. 부럽다 진짜.",
  "피부가 '나 좀 쉬고 싶다'고 합니다",
  "이 정도면 피부과 의사도 고개를 끄덕일 듯",
] as const;

const MOISTURE_COMMENTS = [
  "사막과 오아시스 그 중간 어딘가",
  "수분이 가출을 고려 중입니다",
  "촉촉함이 뭔지 아는 피부",
  "수분크림 광고 모델 가능",
] as const;

const OIL_COMMENTS = [
  "T존에서 유전 발굴 가능",
  "유분기 컨트롤이 예술적",
  "기름종이 매출에 기여하는 중",
  "유분 밸런스가 나름 괜찮은데요",
] as const;

const ELASTICITY_COMMENTS = [
  "찰떡같은 탄력 보유 중",
  "탄력이 20대 초반에 머물러 있음",
  "중력을 거스르는 피부력",
  "콜라겐이 아직 출근 중",
] as const;

const PORE_COMMENTS = [
  "모공이 숨바꼭질 중 (잘 숨음)",
  "모공 사이즈: 아담함",
  "가끔 모공이 하품하는 정도",
  "모공 관리 좀 하셨죠?",
] as const;

const TONE_COMMENTS = [
  "피부톤이 우유빛깔",
  "은은한 광채가 감지됨",
  "톤 균일함: 상위 30%",
  "햇빛 아래서 더 빛나는 타입",
] as const;

const ADVICE_LIST = [
  "선크림은 사랑입니다. 꼭 바르세요.",
  "물 한 잔 더 마시면 피부가 감사 인사할 거예요",
  "잠이 보약이라는 말, 피부에도 적용됩니다",
  "클렌징을 대충 하면 피부가 삐집니다",
  "수분크림 아끼지 마세요. 피부는 배신 안 해요.",
] as const;
