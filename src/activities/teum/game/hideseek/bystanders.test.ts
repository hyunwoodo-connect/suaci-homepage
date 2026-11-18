import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import type { Creature } from "../creatures/creature";
import { S } from "../settings";
import type { BystanderCreatures, KeepOff } from "./bystanders";
import { Bystanders, openSeats, placeGroups, rosterProblems } from "./bystanders";
import { FIND } from "./findTuning";
import { STAGE } from "./openTuning";
import { sphereAt } from "./spots";
import type { Seat } from "./tuning";
import { HIDE } from "./tuning";

const HUB = new THREE.Vector3(0, 1, 0);

/** 판에 부르는 주민(버섯은 mushrooms 가 따로 앉힌다) */
const residents = HIDE.guests.filter((g) => g.species !== "mushroom");

/** 불린 무리와 앉힌 자리를 적어 두는 가짜 생물 창구 */
function fakeCreatures() {
  const seated: { species: string; at: THREE.Vector3 }[] = [];
  const creatures: BystanderCreatures = {
    invite: (species, count) => Array.from({ length: count }, () => ({ k: species }) as Creature),
    seat: (group, at) => {
      seated.push({ species: group[0].k, at: at.clone() });
    },
    escort: vi.fn(),
    dismiss: vi.fn(),
    wobble: vi.fn(),
    setStage: vi.fn(),
    turnAway: vi.fn(),
    cheer: vi.fn(),
    puzzle: vi.fn(),
    watch: vi.fn(),
    setHiding: vi.fn(),
    gather: vi.fn(),
    release: vi.fn(),
  };
  return { creatures, seated };
}

describe("판 영역의 주민 수(조각 03 — 3-4)", () => {
  const perSpecies = new Map<string, number>();
  for (const g of residents) perSpecies.set(g.species, (perSpecies.get(g.species) ?? 0) + g.count);
  const total = [...perSpecies.values()].reduce((n, x) => n + x, 0);

  it("서른 마리 안팎(npc.count), 같은 종은 다섯(npc.perSpecies)을 넘지 않는다, 열 종 넘게", () => {
    expect(rosterProblems(residents, STAGE.npc)).toEqual([]);
    expect(Math.abs(total - STAGE.npc.count)).toBeLessThanOrEqual(3);
    expect(perSpecies.size).toBeGreaterThanOrEqual(10);
  });

  it("광장(과자 언덕)에는 컵케이크가 가장 많다", () => {
    const most = Math.max(...perSpecies.values());
    expect(perSpecies.get("c_cupcake")).toBe(most);
  });

  it("사는 자리(home)는 무리마다 있고, 서로 11m 넘게 떨어져 있다(무리가 겹쳐 서지 않게)", () => {
    residents.forEach((g) => expect(g.home, g.species).not.toBeNull());
    for (let a = 0; a < residents.length; a++)
      for (let b = a + 1; b < residents.length; b++) {
        const A = residents[a].home!,
          B = residents[b].home!;
        expect(Math.hypot(A.x - B.x, A.y - B.y), `${a}-${b}`).toBeGreaterThanOrEqual(11);
      }
  });

  it("사는 자리는 후보 물건의 가장자리에서 5m(리본 둘레 3m + 무리가 둘러서는 2m), 버섯에서 6m 넘게 떨어져 있다", () => {
    for (const g of residents) {
      const home = g.home!;
      for (const p of FIND.props) {
        const widest = Math.max(p.size, ...p.under),
          gap = Math.hypot(p.x - home.x, p.y - home.y) - widest / 2;
        expect(gap, `${g.species}–${p.id}`).toBeGreaterThanOrEqual(STAGE.npc.propRoom + 2);
      }
      for (const m of FIND.mushrooms)
        expect(Math.hypot(m.x - home.x, m.y - home.y), g.species).toBeGreaterThanOrEqual(6);
    }
  });

  it("사는 자리가 막혔을 때 옮겨 앉을 빈자리(seats)가 무리 수만큼은 있다", () => {
    expect(openSeats().length).toBeGreaterThanOrEqual(residents.length - 4);
  });

  it("시작 화면(출발 자리 앞 가운데)에 셋 넘게 산다", () => {
    // 출발 자리에서 광장 가운데를 보는 줄에서 옆으로 6m 안, 앞으로 4~19m
    const start = { x: -18.8, y: -6.8 },
      far = Math.hypot(start.x, start.y),
      ux = -start.x / far,
      uy = -start.y / far;
    let inView = 0;
    for (const g of residents) {
      if (!g.home) continue;
      const dx = g.home.x - start.x,
        dy = g.home.y - start.y,
        ahead = dx * ux + dy * uy,
        across = Math.abs(dx * uy - dy * ux);
      if (ahead > 4 && ahead < 19 && across < 6) inView += g.count;
    }
    expect(inView).toBeGreaterThanOrEqual(2);
  });
});

describe("rosterProblems", () => {
  const npc = { count: 30, perSpecies: 5 };
  const roster = (card: number, others: number) => [
    { species: "card", count: 3 },
    { species: "card", count: card - 3 },
    ...Array.from({ length: others }, (_, i) => ({ species: `kind${i}`, count: 5 })),
  ];

  it("한 종이 npc.perSpecies 를 넘으면 → 어느 종이 몇 마리인지 알린다(무리를 합쳐 센다)", () => {
    const problems = rosterProblems(roster(6, 5), npc);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"card" 가 6마리');
  });

  it("모두 합쳐 npc.count 에서 멀면 → 알린다", () => {
    expect(rosterProblems(roster(5, 2), npc)[0]).toContain("주민이 15마리");
    expect(rosterProblems(roster(5, 8), npc)[0]).toContain("주민이 45마리");
  });

  it("안팎이면 → 문제없다", () => {
    expect(rosterProblems(roster(5, 5), npc)).toEqual([]);
    expect(rosterProblems(roster(4, 6), npc)).toEqual([]);
  });
});

describe("placeGroups", () => {
  const seats: Seat[] = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 40, y: 0 },
  ];
  const all = () => true;

  it("사는 자리가 비어 있으면 → 거기 그대로 앉는다", () => {
    const home = { x: 33, y: 9 };
    expect(placeGroups([{ home }], seats, all, () => 0)).toEqual([home]);
  });

  it("사는 자리가 리본 달린 물건에 막혔으면 → 거기서 가장 가까운 빈자리", () => {
    const home = { x: 33, y: 9 },
      isClear = (seat: Seat) => seat !== home;
    expect(placeGroups([{ home }], seats, isClear, () => 0)).toEqual([seats[2]]);
  });

  it("막힌 두 무리가 같은 빈자리를 바라면 → 먼저 온 무리가 앉고 다음은 그다음 가까운 자리", () => {
    const first = { x: 1, y: 3 },
      second = { x: 2, y: 3 },
      isClear = (seat: Seat) => seat !== first && seat !== second,
      picked = placeGroups([{ home: first }, { home: second }], seats, isClear, () => 0);
    expect(picked).toEqual([seats[0], seats[1]]);
  });

  it("사는 자리가 없는 무리 → 남은 빈자리 아무 데나(남의 집 곁은 빼고)", () => {
    const home = { x: 1, y: 1 },
      picked = placeGroups([{ home: null }, { home }], seats, all, () => 0);
    expect(picked[1]).toBe(home);
    expect(picked[0]).toBe(seats[1]);
  });

  it("빈자리가 모자라면 → null", () => {
    const groups = [{ home: null }, { home: null }, { home: null }, { home: null }];
    expect(placeGroups(groups, seats, all, () => 0).filter((seat) => seat === null)).toHaveLength(
      1,
    );
  });
});

describe("Bystanders", () => {
  it("판 시작 → 판 영역과 리본 달린 물건을 알리고(npc.propRoom), 무리마다 서로 다른 자리에 앉힌다", () => {
    const { creatures, seated } = fakeCreatures(),
      bystanders = new Bystanders(creatures, () => 0.5);
    bystanders.seat(HUB, []);
    expect(creatures.setStage).toHaveBeenCalledWith(HUB, HIDE.stage.radius, [], STAGE.npc.propRoom);
    expect(seated).toHaveLength(residents.length);
    for (let a = 0; a < seated.length; a++)
      for (let b = a + 1; b < seated.length; b++)
        expect(seated[a].at.angleTo(seated[b].at) * S.R).toBeGreaterThan(11);
  });

  it("리본 달린 물건이 사는 자리에 놓였으면 → 그 자리 말고 다른 빈자리에 앉힌다", () => {
    const { creatures, seated } = fakeCreatures(),
      bystanders = new Bystanders(creatures, () => 0.5),
      home = residents[0].home!,
      onHome: KeepOff = { v: sphereAt(new THREE.Vector3(), HUB, home.x, home.y), r: 1 };
    bystanders.seat(HUB, [onHome]);
    const least = onHome.r + STAGE.npc.propRoom;
    for (const s of seated) expect(s.at.angleTo(onHome.v) * S.R, s.species).toBeGreaterThan(least);
    expect(seated).toHaveLength(residents.length);
    // 그 무리는 가장 가까운 빈 seats 로 옮겨 앉았다
    const moved = seated[0].at.angleTo(onHome.v) * S.R;
    expect(moved).toBeLessThan(25);
  });

  it("판에서 일어난 일을 주민에게 그대로 알린다", () => {
    const { creatures } = fakeCreatures(),
      bystanders = new Bystanders(creatures, () => 0.5),
      where = new THREE.Vector3(0, 1, 0);
    bystanders.turnAway(true);
    bystanders.cheer(where);
    bystanders.puzzle(where);
    bystanders.watch(where);
    bystanders.setHiding([where]);
    bystanders.gather(where);
    bystanders.release();
    expect(creatures.turnAway).toHaveBeenCalledWith(true);
    expect(creatures.cheer).toHaveBeenCalledWith(where);
    expect(creatures.puzzle).toHaveBeenCalledWith(where);
    expect(creatures.watch).toHaveBeenCalledWith(where);
    expect(creatures.setHiding).toHaveBeenCalledWith([where]);
    expect(creatures.gather).toHaveBeenCalledWith(where);
    expect(creatures.release).toHaveBeenCalledOnce();
  });
});
