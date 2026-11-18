import type { Creature, Pose } from "./creature";
import { CARD, CUPCAKE, DICE, HAT, MUSHROOM, RABBIT, ROSE, TEAPOT, WATCH } from "./daysGround";
import { BELL, CUP, HEART, KEY, LETTER } from "./daysSky";
import type { Resident } from "./resident";
import type { Town } from "./town";

// 종마다의 하루: 성격 · 하루 세 가지 · 나를 보면 하는 인사 · 버릇. 생김새만 다르고 하는 짓이 같으면 구조물처럼 보인다.
// 뼈대가 없으니 몸짓은 통째 움직임(뒤뚱·납작-늘어남·돌기·기울기·부풀기)과 작은 효과(김·반짝이·종이·물방울·음표)로 만든다.
// 하루의 세 가지는 차례 없이 돌려 쓰고, 한 가지를 8~20초 한다. 자리(케이크·벤치·큰 꽃)나 짝이 20m 안에 없으면 그 일은 건너뛴다.
// 땅 위 종은 daysGround, 하늘 종은 daysSky. 새 종은 거기에 하루를 쓰고 아래 표에 한 줄

/** 하루의 한 가지 */
export interface Chore {
  /** 지금 할 수 있나(자리·짝이 20m 안에 있나) — 없으면 늘 할 수 있다 */
  can?(c: Creature, r: Resident, t: Town): boolean;
  /** 시작: 갈 곳을 정하고 같이 할 짝을 모은다 */
  begin?(c: Creature, r: Resident, t: Town): void;
  /** 한 프레임 */
  run(c: Creature, r: Resident, t: Town, pose: Pose): void;
}

/** 한 종의 하루 */
export interface Day {
  chores: readonly [Chore, Chore, Chore];
  /** 나를 보면 하는 인사(끝났으면 true) */
  greet(c: Creature, r: Resident, t: Town, pose: Pose): boolean;
  /** 인사를 마친 뒤(급히 지나가는 회중시계) */
  afterGreet?(c: Creature, r: Resident, t: Town): void;
  /** 늘 도는 버릇(dP: 나와의 거리 m) — 버릇 몸짓을 시작하거나 몸에 늘 걸리는 것(구르기·째깍)을 한다 */
  always?(c: Creature, r: Resident, t: Town, pose: Pose, dP: number): void;
  /** 버릇 몸짓(끝났으면 true) */
  quirk?(c: Creature, r: Resident, t: Town, pose: Pose): boolean;
  /** 반가워하는 몸짓(끝났으면 true) — 없으면 폴짝폴짝 */
  joy?(c: Creature, r: Resident, t: Town, pose: Pose): boolean;
  /** 자리를 옮기지 않는다(버섯) */
  isRooted?: boolean;
  /** 무리의 맨 앞이 하루를 고르고 나머지는 따라 한다(카드 병정) */
  isDrilled?: boolean;
  /** 동네 알림이: 내가 상자를 찾으면 제일 먼저 운다(날개 종) */
  isCrier?: boolean;
  /** 수줍음이 많다: 다른 생물이 다가오면 붉어진다(장미) */
  isShy?: boolean;
  /** 인사하는 동안 스스로 움직인다(내 머리 위를 도는 편지) — 공통의 '멈춰서 나를 본다'를 하지 않는다 */
  isOwnGreet?: boolean;
}

/** 종(에셋 키) → 하루 */
export const DAYS: Readonly<Record<string, Day>> = {
  c_cupcake: CUPCAKE,
  card: CARD,
  c_watch: WATCH,
  teapot: TEAPOT,
  brabbit: RABBIT,
  c_hat: HAT,
  c_dice: DICE,
  c_rose: ROSE,
  mushroom: MUSHROOM,
  key: KEY,
  c_wletter: LETTER,
  c_wheart: HEART,
  c_wcup: CUP,
  c_wbell: BELL,
};
