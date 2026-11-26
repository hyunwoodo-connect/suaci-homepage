import type { BoxPlan } from "@/lib/prize-box";

// 게임을 깨면 받는 랜덤박스: 이벤트마다 박스 수와 풀. 레코드에 아직 없는 내용이라 여기 둔다(같은 필드가 레코드에 생기면 그쪽으로 옮긴다).
// 풀의 옷장 칸은 박스에서 받기 전까지 옷장에서 잠긴다(받는 곳 이름이 "'틈'에서 받아요"처럼 보인다).
// 풀은 시안이다 — 박스에 무엇을 얼마나 넣을지는 오너가 정한다

const PLANS: readonly BoxPlan[] = [
  {
    eventId: "teum01",
    from: "틈",
    count: 3,
    pool: [
      { prize: { kind: "item", item: "board" }, weight: 1 },
      { prize: { kind: "item", item: "glass_heart" }, weight: 1 },
      { prize: { kind: "item", item: "bouquet" }, weight: 1 },
    ],
  },
];

/** 박스를 주는 이벤트 모두 — 옷장이 아직 받지 못한 칸을 잠그는 데 쓴다(목록에 보이지 않는 이벤트의 것도 잠겨 있어야 한다) */
export function listBoxPlans(): readonly BoxPlan[] {
  return PLANS;
}

/** 그 이벤트를 깨면 받는 박스(없으면 undefined) */
export function getBoxPlan(eventId: string): BoxPlan | undefined {
  return PLANS.find((plan) => plan.eventId === eventId);
}
