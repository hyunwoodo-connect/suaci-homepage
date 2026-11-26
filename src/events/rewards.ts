import type { ClearReward } from "@/lib/play-record";

// 놀이를 깨면 받는 것: 이벤트마다 아바타 옷장의 한 칸(부품·무늬·색의 키 — lib/avatar). 레코드에 아직 없는 내용이라 여기 둔다
// (같은 필드가 레코드에 생기면 그쪽으로 옮긴다). 받는 곳의 이름(from)은 옷장의 잠긴 칸이 "'틈'에서 받아요"처럼 보인다.
// 받았는지는 이 기기의 놀이 결과(lib/play-record)로 안다 — 그 이벤트를 깬 적이 있으면 받은 것이다

const REWARDS: readonly ClearReward[] = [{ eventId: "teum01", item: "board", from: "틈" }];

/** 깨면 옷을 받는 이벤트 모두 — 옷장이 아직 받지 못한 칸을 잠그는 데 쓴다(목록에 보이지 않는 이벤트의 것도 잠겨 있어야 한다) */
export function eventRewards(): readonly ClearReward[] {
  return REWARDS;
}

/** 그 이벤트를 깨면 받는 것(없으면 undefined) */
export function getEventReward(eventId: string): ClearReward | undefined {
  return REWARDS.find((reward) => reward.eventId === eventId);
}
