import type { GameGoal } from "@/components/game/GameIntro";

/** '틈'의 목표: 물풍선 열 개를 다 먹는다(수는 기본 지도의 물풍선 수 — goal.test 가 지킨다) */
export const TEUM_GOAL: GameGoal = {
  picture: "/events/teum/balloon.webp",
  name: "물풍선",
  count: 10,
};
