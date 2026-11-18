import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { S } from "../settings";
import type { Creature } from "./creature";
import type { Circle, Resident } from "./resident";
import {
  arch,
  between,
  canJoin,
  canNod,
  clearance,
  createResident,
  crossed,
  heartPoint,
  pickChore,
  pulse,
  pushOut,
  ringSpot,
  shouldGreet,
} from "./resident";

/** 행성 위에서 hub 로부터 east(m)·north(m) 떨어진 자리(작은 거리라 평면으로 친다) */
function at(east: number, north: number): THREE.Vector3 {
  return new THREE.Vector3(east / S.R, 1, north / S.R).normalize();
}

function metres(a: THREE.Vector3, b: THREE.Vector3): number {
  return a.angleTo(b) * S.R;
}

/** 까딱할 수 있는지 볼 때 쓰는 생물(주민 상태만 쓴다) */
function folk(edit: (r: Resident) => void = () => {}): Creature {
  const res = createResident();
  edit(res);
  return { res } as Creature;
}

describe("pickChore", () => {
  it("할 수 있는 일이 없으면 → -1", () => {
    expect(pickChore([false, false, false], 0, 0.5)).toBe(-1);
  });

  it("할 수 있는 일이 방금 한 것 하나뿐이면 → 그 일을 또 한다", () => {
    expect(pickChore([false, true, false], 1, 0.9)).toBe(1);
  });

  it("다른 일이 있으면 → 방금 한 일은 고르지 않는다", () => {
    for (const roll of [0, 0.3, 0.6, 0.999])
      expect(pickChore([true, true, true], 1, roll)).not.toBe(1);
  });

  it("주사위(roll)가 남은 일을 고르게 나눈다", () => {
    expect(pickChore([true, true, true], 1, 0.1)).toBe(0);
    expect(pickChore([true, true, true], 1, 0.9)).toBe(2);
    expect(pickChore([true, true, true], -1, 0.5)).toBe(1);
  });

  it("자리가 없어 못 하는 일은 건너뛴다", () => {
    for (const roll of [0, 0.5, 0.999]) expect(pickChore([false, true, true], 2, roll)).toBe(1);
  });
});

describe("shouldGreet", () => {
  it("인사하는 거리 안이고 쉬었으면 → 인사한다", () => {
    expect(shouldGreet(11, 0, 0, 12)).toBe(true);
  });

  it("방금 인사했으면(30초 안) → 다시 안 한다", () => {
    expect(shouldGreet(5, 0, 12, 12)).toBe(false);
  });

  it("멀거나 내가 하늘 높이 있으면 → 안 한다", () => {
    expect(shouldGreet(13, 0, 0, 12)).toBe(false);
    expect(shouldGreet(3, 20, 0, 12)).toBe(false);
  });
});

describe("canNod", () => {
  it("서로 다른 무리의 한가한 둘 → 까딱한다", () => {
    expect(canNod(folk(), folk())).toBe(true);
  });

  it("같은 무리끼리는 → 까딱하지 않는다(줄 선 병정이 서로 멈춰 세우지 않게)", () => {
    const a = folk((r) => (r.squad = 3)),
      b = folk((r) => (r.squad = 3));
    expect(canNod(a, b)).toBe(false);
  });

  it("한쪽이 인사 중이거나 방금 까딱했으면 → 안 한다", () => {
    expect(
      canNod(
        folk((r) => (r.act = "greet")),
        folk(),
      ),
    ).toBe(false);
    expect(
      canNod(
        folk((r) => (r.nodCd = 5)),
        folk(),
      ),
    ).toBe(false);
  });

  it("같이 하는 일의 짝이면 → 안 한다", () => {
    const a = folk(),
      b = folk((r) => (r.mate = a));
    expect(canNod(a, b)).toBe(false);
    const lead = folk(),
      c = folk((r) => (r.lead = lead)),
      d = folk((r) => (r.lead = lead));
    expect(canNod(c, d)).toBe(false);
    expect(canNod(lead, c)).toBe(false);
  });
});

describe("canJoin — 남의 무리 일에 끼어도 되나", () => {
  it("아직 일이 없거나, 제 일을 8초 넘게 했으면 → 된다", () => {
    expect(canJoin(createResident(), 8)).toBe(true);
    const busy = createResident();
    busy.chore = 0;
    busy.choreAge = 9;
    expect(canJoin(busy, 8)).toBe(true);
  });

  it("제 일을 막 시작했으면 → 안 된다(이웃이 가로채지 않는다)", () => {
    const fresh = createResident();
    fresh.chore = 0;
    fresh.choreAge = 0.2;
    expect(canJoin(fresh, 8)).toBe(false);
  });

  it("이미 남의 일에 끼었거나 인사·반응 중이면 → 안 된다", () => {
    const led = createResident();
    led.lead = folk();
    expect(canJoin(led, 8)).toBe(false);
    const greeting = createResident();
    greeting.act = "greet";
    expect(canJoin(greeting, 8)).toBe(false);
  });
});

describe("pushOut — 리본 달린 물건 둘레에는 서지 않는다", () => {
  const prop: Circle = { v: at(0, 0), r: 1 };

  it("물건 둘레 3m 안의 자리 → 가장자리에서 3m 밖으로 밀려난다", () => {
    const v = at(2, 0);
    expect(pushOut(v, [prop], 3)).toBe(true);
    expect(metres(v, prop.v) - prop.r).toBeGreaterThanOrEqual(3);
    // 물건에서 멀어지는 쪽 그대로(옆으로 새지 않는다)
    expect(metres(v, at(4, 0))).toBeLessThan(0.1);
  });

  it("이미 밖인 자리 → 그대로", () => {
    const v = at(4.5, 0),
      before = v.clone();
    expect(pushOut(v, [prop], 3)).toBe(false);
    expect(v.equals(before)).toBe(true);
  });

  it("물건 한가운데 → 어느 쪽으로든 밖으로 나온다", () => {
    const v = at(0, 0);
    pushOut(v, [prop], 3);
    expect(metres(v, prop.v) - prop.r).toBeGreaterThanOrEqual(3);
  });

  it("둘레가 겹친 물건 둘 사이 → 둘 다에서 3m 밖", () => {
    const other: Circle = { v: at(5, 0), r: 1 },
      v = at(2.4, 0.5);
    pushOut(v, [prop, other], 3);
    expect(clearance(v, [prop, other])).toBeGreaterThanOrEqual(3 - 1e-6);
  });

  it("끼고 도는 쪽(side) → 물건을 향하지 않는 접선", () => {
    const v = at(2, 0),
      side = new THREE.Vector3();
    pushOut(v, [prop], 3, side);
    const outward = v.clone().sub(prop.v).normalize();
    expect(Math.abs(side.dot(outward))).toBeLessThan(0.01);
    expect(Math.abs(side.dot(v))).toBeLessThan(0.01);
  });
});

describe("clearance", () => {
  it("가장 가까운 물건의 가장자리까지의 거리, 안이면 음수", () => {
    const props: Circle[] = [
      { v: at(0, 0), r: 1 },
      { v: at(10, 0), r: 2 },
    ];
    expect(clearance(at(5, 0), props)).toBeCloseTo(3, 2);
    expect(clearance(at(0.2, 0), props)).toBeLessThan(0);
    expect(clearance(at(0, 0), [])).toBe(Infinity);
  });
});

describe("ringSpot", () => {
  it("가운데 둘레에 고르게 둘러선다", () => {
    const center = at(0, 0),
      spots = [0, 1, 2, 3].map((i) => ringSpot(new THREE.Vector3(), center, 7.5, i, 4));
    for (const spot of spots) expect(metres(spot, center)).toBeCloseTo(7.5, 3);
    // 넷이면 마주 선 둘 사이는 지름, 이웃은 그 1/√2
    expect(metres(spots[0], spots[2])).toBeCloseTo(15, 2);
    expect(metres(spots[0], spots[1])).toBeCloseTo(7.5 * Math.SQRT2, 2);
  });
});

describe("몸짓의 박자", () => {
  it("between: 구간을 지나는 동안 0→1", () => {
    expect(between(0, 1, 2)).toBe(0);
    expect(between(1.5, 1, 2)).toBeCloseTo(0.5);
    expect(between(3, 1, 2)).toBe(1);
  });

  it("arch: 0→1→0", () => {
    expect(arch(0)).toBeCloseTo(0);
    expect(arch(0.5)).toBeCloseTo(1);
    expect(arch(1)).toBeCloseTo(0);
    expect(arch(2)).toBeCloseTo(0);
  });

  it("pulse: 1초에 hz 번만 울린다(프레임 수와 상관없이)", () => {
    let count = 0;
    const dt = 1 / 64;
    for (let frame = 1; frame <= 128; frame++) if (pulse(frame * dt, dt, 5)) count++;
    expect(count).toBe(10);
  });

  it("crossed: 그 시각을 지나는 프레임에 한 번만", () => {
    const dt = 0.016;
    let hits = 0;
    for (let now = 0; now < 1; now += dt) if (crossed(now, dt, 0.55)) hits++;
    expect(hits).toBe(1);
  });
});

describe("heartPoint", () => {
  const out = { x: 0, y: 0 };

  it("꼭대기 가운데에서 시작해 아래 끝에서 만난다(두 반쪽이 같은 점)", () => {
    const top = { ...heartPoint(0, 1, 5, out) },
      tip = { ...heartPoint(1, 1, 5, out) },
      tipLeft = { ...heartPoint(1, -1, 5, out) };
    expect(top.x).toBeCloseTo(0);
    expect(tip.x).toBeCloseTo(0);
    expect(tip.y).toBeLessThan(top.y);
    expect(tipLeft.x).toBeCloseTo(tip.x);
    expect(tipLeft.y).toBeCloseTo(tip.y);
  });

  it("두 반쪽은 좌우가 뒤집힌 같은 모양이고 너비가 width", () => {
    let widest = 0;
    for (let t = 0; t <= 1; t += 0.02) {
      const right = { ...heartPoint(t, 1, 5, out) },
        left = { ...heartPoint(t, -1, 5, out) };
      expect(left.x).toBeCloseTo(-right.x);
      expect(left.y).toBeCloseTo(right.y);
      widest = Math.max(widest, right.x);
    }
    expect(widest * 2).toBeCloseTo(5, 1);
  });
});
