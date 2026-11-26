// 랜덤박스: 모든 게임이 같은 틀(시작 → 해결 → 랜덤박스 × N)로 끝난다. 게임마다 박스 수와 박스에서 나올 수 있는 것(풀)이 다르고,
// 깨면 그 자리에서 박스를 다 뽑아 둔다(열기 전에 나가도 받은 것은 남는다). 아바타 옷장의 칸은 이 기기에 남기고, 그것을 주는 게임이 있는 칸은
// 받기 전까지 옷장에서 잠긴다. 미스트(실물)는 기기에서 뽑으면 고쳐 받을 수 있으니 서버가 뽑고 확인할 때까지 풀에 넣지 않는다

import type { Locks } from "@/lib/avatar/outfit";

/** 박스에서 나오는 것 하나: 아바타 옷장의 한 칸(부품·무늬·색의 키) 또는 진짜 미스트 */
export type BoxPrize = { kind: "item"; item: string } | { kind: "mist" };

/** 풀의 한 칸: 나올 것과 그 무게(클수록 잘 나온다) */
export interface PrizeSlot {
  prize: BoxPrize;
  weight: number;
}

/** 한 게임(이벤트)의 박스: 그 이벤트, 받는 곳의 이름(옷장의 잠긴 칸에 보인다), 깰 때마다 주는 박스 수, 풀 */
export interface BoxPlan {
  eventId: string;
  from: string;
  count: number;
  pool: readonly PrizeSlot[];
}

/** 이 기기에서 받은 옷장 칸을 두는 자리 */
export const PRIZES_KEY = "suaci.prizes";

/**
 * 박스를 모두 뽑는다(rand: 0 이상 1 미만). 아직 없는 옷이 남아 있으면 그중에서 무게대로 고르고(한 판에서 같은 것이 두 번 나오지 않게 뽑은 것도 뺀다),
 * 다 가졌으면 풀 전체에서 고른다 — 박스가 빈손으로 열리지는 않는다
 */
export function drawBoxes(plan: BoxPlan, rand: () => number = Math.random): BoxPrize[] {
  const owned = readOwned();
  const drawn: BoxPrize[] = [];
  for (let i = 0; i < plan.count; i++) {
    const fresh = plan.pool.filter(
      (slot) => !isOwned(slot.prize, owned) && !drawn.some((d) => samePrize(d, slot.prize)),
    );
    const from = fresh.length > 0 ? fresh : plan.pool;
    const pick = pickWeighted(from, rand);
    if (pick) drawn.push(pick.prize);
  }
  return drawn;
}

/** 뽑은 것 가운데 옷장 칸을 이 기기에 남긴다. 저장을 막아 둔 브라우저면 false(옷장은 잠긴 채다) */
export function keepPrizes(prizes: readonly BoxPrize[]): boolean {
  const owned = readOwned();
  for (const prize of prizes) if (prize.kind === "item") owned.add(prize.item);
  try {
    localStorage.setItem(PRIZES_KEY, JSON.stringify({ v: 1, items: [...owned] }));
    return true;
  } catch {
    return false;
  }
}

/** 아직 받지 못한 옷장 칸(박스에서 나올 수 있는데 이 기기에 없다): 옷장의 키 → 받는 곳의 이름 */
export function lockedPrizes(plans: readonly BoxPlan[]): Locks {
  const owned = readOwned();
  const locks = new Map<string, string>();
  for (const plan of plans) {
    for (const { prize } of plan.pool) {
      if (prize.kind === "item" && !owned.has(prize.item) && !locks.has(prize.item)) {
        locks.set(prize.item, plan.from);
      }
    }
  }
  return locks;
}

/* ─── 내부 ─────────────────────────── */

// 이 기기에서 받은 옷장 칸. 없거나 깨졌으면 빈 것
function readOwned(): Set<string> {
  try {
    const text = localStorage.getItem(PRIZES_KEY);
    if (!text) return new Set();
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== "object" || raw === null || !("items" in raw)) return new Set();
    const items = (raw as { items: unknown }).items;
    if (!Array.isArray(items)) return new Set();
    return new Set(items.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function isOwned(prize: BoxPrize, owned: ReadonlySet<string>): boolean {
  return prize.kind === "item" && owned.has(prize.item);
}

function samePrize(a: BoxPrize, b: BoxPrize): boolean {
  if (a.kind === "item" && b.kind === "item") return a.item === b.item;
  return a.kind === b.kind;
}

function pickWeighted(slots: readonly PrizeSlot[], rand: () => number): PrizeSlot | undefined {
  const total = slots.reduce((sum, slot) => sum + Math.max(0, slot.weight), 0);
  if (total <= 0) return undefined;
  let at = rand() * total;
  for (const slot of slots) {
    at -= Math.max(0, slot.weight);
    if (at < 0) return slot;
  }
  return slots.at(-1);
}
