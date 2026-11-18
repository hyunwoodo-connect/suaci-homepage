import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { Random } from "../core/random";
import { STAGE } from "../hideseek/openTuning";
import type { Services } from "../services";
import { S } from "../settings";
import type { Creature, CreatureRole, Pose } from "./creature";
import type { PuffSink } from "./puffs";
import { createResident } from "./resident";
import { Town } from "./town";

const HUB = new THREE.Vector3(0, 1, 0);
const FRAME = 1 / 30;

/** 광장 가운데에서 east(m)·north(m) 떨어진 자리(작은 거리라 평면으로 친다) */
function at(east: number, north: number): THREE.Vector3 {
  return new THREE.Vector3(east / S.R, 1, north / S.R).normalize();
}

function metres(a: THREE.Vector3, b: THREE.Vector3): number {
  return a.angleTo(b) * S.R;
}

/** 평평한 땅의 마을 하나: 나는 멀리(200m) 서 있다. run 으로 시간을 흘린다 */
function world() {
  const p = at(200, 0),
    camera = {
      position: new THREE.Vector3(0, S.R + 5, 0),
      getWorldDirection: (v: THREE.Vector3) => v.set(0, 0, -1),
    },
    s = {
      player: { p, h: new THREE.Vector3(0, 0, 1), P: p.clone().multiplyScalar(S.R) },
      terrain: { groundAt: () => 0 },
      camera: { camera },
      models: { placements: () => [] },
    } as unknown as Services,
    puffs: PuffSink = { emit: () => {} },
    town = new Town(s, { meet: () => {} }, puffs),
    list: Creature[] = [],
    pose: Pose = { amt: 0, head: 0 };
  let time = 0,
    made = 0;
  town.setStage(HUB, 70, [], 3);
  const add = (k: string, role: CreatureRole, v: THREE.Vector3): Creature => {
    const f = new THREE.Vector3(1, 0, 0);
    f.addScaledVector(v, -f.dot(v)).normalize();
    const c = {
      k,
      role,
      batch: { hh: 1.2, rw: 0.8 },
      rng: new Random(100 + made++),
      an: new THREE.Vector4(1 + made, 0, 0, 0),
      v: v.clone(),
      home: v.clone(),
      f,
      pos: v.clone().multiplyScalar(S.R),
      visible: false,
      a: 0,
      ph: 0,
      st: "live",
      hop: 0,
      hopV: 0,
      gone: false,
      sink: 0,
      pitch: 0,
      roll: 0,
      amt: 0,
      head: 0,
      gait: "walk",
      lp: null,
      tum: 0,
      swell: 1,
      squash: 1,
      yaw: 0,
      res: createResident(),
    } as unknown as Creature;
    town.add(c);
    town.settle(c, v, 0, 0, 1, role === "flock" ? 3 : 0);
    list.push(c);
    return c;
  };
  /** seconds 초를 흘린다(each: 프레임마다, 그때의 시각) */
  const run = (seconds: number, each?: (now: number) => void) => {
    for (let t = 0; t < seconds; t += FRAME) {
      time += FRAME;
      town.begin(FRAME, time, 0, false);
      for (const c of list) {
        pose.amt = 0;
        pose.head = 0;
        town.live(c, metres(c.v, p), -c.a, pose);
        c.amt += (pose.amt - c.amt) * 0.2;
      }
      each?.(time);
    }
  };
  return { town, p, add, run };
}

/** 제자리에 앉아 조는 컵케이크(자리를 옮기지 않는 하루의 일 — 힐끗거리는 때를 재기 좋다) */
function dozing(c: Creature) {
  const r = c.res!;
  r.chore = 1;
  r.choreT = 600;
  r.step = 1;
  r.n = 1;
  r.goal.copy(c.v);
}

describe("반응이 끝나면 하던 일이 그 자리에서 이어진다(반응은 하던 일의 값을 건드리지 않는다)", () => {
  it("우체통 위를 맴도는 편지 곁에서 꽝을 열어도 → 그 높이 그대로 우체통 위를 맴돈다", () => {
    const { town, add, run } = world(),
      letter = add("c_wletter", "flock", at(20, 0)),
      r = letter.res!,
      mailbox = at(22, 0);
    r.chore = 1;
    r.choreT = 600;
    r.aim.copy(mailbox);
    r.u = 3.8;
    run(1);
    town.puzzle(at(25, 0));
    expect(["puzzle", "giggle"]).toContain(r.act);
    run(2.5);
    expect(r.act).toBe("chore");
    expect(r.chore).toBe(1);
    expect(r.u).toBe(3.8);
    expect(metres(r.aim, mailbox)).toBeLessThan(0.01);
    run(4);
    // 땅속으로 가라앉지 않고, 꽝이 난 물건이 아니라 우체통 둘레에 있다
    expect(letter.a).toBeGreaterThan(3);
    expect(metres(letter.v, mailbox)).toBeLessThan(4);
  });

  it("케이크를 올려다보던 컵케이크가 숨은 상자를 힐끗거린 뒤 → 다시 케이크를 본다(상자 쪽을 계속 보지 않는다)", () => {
    const { town, add, run } = world(),
      cupcake = add("c_cupcake", "herd", at(10, 0)),
      r = cupcake.res!,
      cake = at(10, 6),
      box = at(4, 0);
    r.chore = 0;
    r.choreT = 600;
    r.step = 1;
    r.aim.copy(cake);
    town.setHiding([box]);
    run(0.2);
    r.peekWait = 0.01;
    run(0.2);
    expect(r.act).toBe("peek");
    run(2.5);
    expect(r.act).toBe("chore");
    expect(metres(r.aim, cake)).toBeLessThan(0.01);
    run(2);
    const toCake = cake.clone().sub(cupcake.v).normalize(),
      toBox = box.clone().sub(cupcake.v).normalize();
    expect(cupcake.f.dot(toCake)).toBeGreaterThan(0.95);
    expect(cupcake.f.dot(toBox)).toBeLessThan(0.3);
  });

  it("하트를 그리던 날개 하트가 나에게 인사한 뒤 → 하트의 가운데·옆 방향·시계가 그대로다", () => {
    const { p, add, run } = world(),
      lead = add("c_wheart", "flock", at(30, 0)),
      pal = add("c_wheart", "flock", at(32, 0)),
      r = lead.res!,
      center = at(31, 2),
      axis = new THREE.Vector3(1, 0, 0);
    r.chore = 0;
    r.choreT = 600;
    r.mate = pal;
    r.goal.copy(center);
    r.aim.copy(axis);
    r.clock = 1;
    Object.assign(pal.res!, { chore: 0, choreT: 600, lead, slot: 1 });
    run(0.5);
    const clockBefore = r.clock;
    // 내가 9m 앞에 나타난다 → 인사하러 온다
    p.copy(at(30, 9));
    run(0.2);
    expect(r.act).toBe("greet");
    run(3.2);
    p.copy(at(200, 0));
    run(1.5);
    expect(r.act).toBe("chore");
    expect(r.chore).toBe(0);
    expect(r.aim.distanceTo(axis)).toBeLessThan(1e-6);
    expect(metres(r.goal, center)).toBeLessThan(0.01);
    // 시계는 인사하는 동안 멈췄다가 이어진다(다른 값으로 덮이지 않는다)
    expect(r.clock).toBeGreaterThanOrEqual(clockBefore);
    expect(r.clock).toBeLessThan(clockBefore + 2);
  });
});

describe("하루의 한 가지는 적어도 npc.choreSeconds 의 짧은 쪽만큼 한다", () => {
  it("이웃이 무리 일을 시작해도 → 제 일을 막 시작한 주민은 끌려가지 않는다(오래 한 주민은 낀다)", () => {
    const { town, add, run } = world(),
      lead = add("c_cupcake", "herd", at(10, 0)),
      fresh = add("c_cupcake", "herd", at(13, 0)),
      old = add("c_cupcake", "herd", at(10, 3));
    for (const c of [fresh, old]) dozing(c);
    run(0.2);
    fresh.res!.choreAge = 0.3;
    old.res!.choreAge = STAGE.npc.choreSeconds[0] + 1;
    expect(town.enlist(fresh, lead, 2, 1, 10)).toBe(false);
    expect(fresh.res!.chore).toBe(1);
    expect(fresh.res!.lead).toBeNull();
    expect(town.enlist(old, lead, 2, 1, 10)).toBe(true);
    expect(old.res!.lead).toBe(lead);
  });
});

describe("힐끗거리기 — npc.peekEvery 초에 한 번", () => {
  const [soonest, latest] = STAGE.npc.peekEvery;

  it("찾기가 시작된 뒤 첫 힐끗도 그만큼 기다리고, 한 상자를 여럿이 한꺼번에 보지 않는다", () => {
    const { town, add, run } = world(),
      box = at(0, 20),
      three = [add("c_cupcake", "herd", at(4, 20)), add("c_cupcake", "herd", at(-4, 22))];
    three.push(add("c_cupcake", "herd", at(1, 15)));
    three.forEach(dozing);
    town.setHiding([box]);
    const firstAt = three.map(() => -1);
    let mostAtOnce = 0;
    run(latest + 14, (now) => {
      let peeking = 0;
      three.forEach((c, i) => {
        if (c.res!.act !== "peek") return;
        peeking++;
        if (firstAt[i] < 0) firstAt[i] = now;
      });
      mostAtOnce = Math.max(mostAtOnce, peeking);
    });
    for (const first of firstAt) {
      expect(first).toBeGreaterThanOrEqual(soonest - 0.1);
      expect(first).toBeLessThan(latest + 14);
    }
    expect(mostAtOnce).toBe(1);
  });

  it("힐끗거리다 8m 안의 나와 눈이 마주치면 → 깜짝 놀라 딴청을 부리고, 하던 일로 돌아간다", () => {
    // 카메라는 광장 가운데 위에서 -z 쪽을 본다 — 그쪽 30m 에 있는 컵케이크가 화면 가운데에 든다
    const { town, p, add, run } = world(),
      cupcake = add("c_cupcake", "herd", at(0, -30)),
      r = cupcake.res!;
    dozing(cupcake);
    cupcake.pos.copy(cupcake.v).multiplyScalar(S.R);
    r.greetCd = 60;
    town.setHiding([at(5, -30)]);
    run(0.2);
    // 내가 멀리 있으면 그냥 힐끗거린다
    r.peekWait = 0.01;
    run(0.5);
    expect(r.act).toBe("peek");
    run(2.5);
    expect(r.act).toBe("chore");
    // 내가 7m 곁에서 그쪽을 보고 있으면 들킨다
    p.copy(at(0, -23));
    town.setHiding([at(5, -30)]);
    r.peekWait = 0.01;
    run(0.5);
    expect(r.act).toBe("caught");
    run(2);
    expect(r.act).toBe("chore");
    expect(r.chore).toBe(1);
  });

  it("멀리 있는 동안에는 세지 않는다 → 한참 뒤 상자 곁에 와도 바로 힐끗거리지 않는다", () => {
    const { town, add, run } = world(),
      box = at(0, 20),
      cupcake = add("c_cupcake", "herd", at(30, 20));
    dozing(cupcake);
    town.setHiding([box]);
    run(soonest + 5);
    cupcake.v.copy(at(5, 20));
    cupcake.res!.goal.copy(cupcake.v);
    let peekedAt = -1;
    run(soonest - 1, (now) => {
      if (cupcake.res!.act === "peek" && peekedAt < 0) peekedAt = now;
    });
    expect(peekedAt).toBe(-1);
  });
});

describe("날아가는 상자를 눈으로 쫓기", () => {
  it("그만하라는 말이 없어도 상자가 멈춰 있으면 → 몇 초 뒤 하던 일로 돌아간다", () => {
    const { town, add, run } = world(),
      cupcake = add("c_cupcake", "herd", at(10, 0)),
      box = at(14, 0).multiplyScalar(S.R + 4);
    dozing(cupcake);
    town.watch(box);
    run(0.5);
    expect(cupcake.res!.act).toBe("look");
    // 상자가 날아가는 동안은 계속 쫓는다
    run(4, () => (box.y += 0.02));
    expect(cupcake.res!.act).toBe("look");
    run(4);
    expect(cupcake.res!.act).toBe("chore");
  });

  it("판이 끝나거나(release) 다 찾아 모이거나(gather) 등을 돌리면(turnAway) → 쫓던 상자를 놓는다", () => {
    for (const drop of ["release", "gather", "turnAway"] as const) {
      const { town, add, run } = world(),
        cupcake = add("c_cupcake", "herd", at(10, 0)),
        box = at(14, 0).multiplyScalar(S.R + 4);
      dozing(cupcake);
      town.watch(box);
      run(0.5);
      expect(cupcake.res!.act).toBe("look");
      if (drop === "release") town.release();
      if (drop === "gather") town.gather(at(10, 30));
      if (drop === "turnAway") town.turnAway(true);
      town.release();
      run(1.5, () => (box.y += 0.02));
      expect(cupcake.res!.act, drop).not.toBe("look");
    }
  });
});

describe("꼭꼭 숨어라", () => {
  it("등을 돌리고 있다가 → 끝나면 정반대에 있는 나를 향해 돌아선다", () => {
    const { town, p, add, run } = world(),
      cupcake = add("c_cupcake", "herd", at(10, 0));
    dozing(cupcake);
    p.copy(at(20, 0));
    cupcake.res!.greetCd = 60;
    const toMe = () => {
      const dir = p.clone().sub(cupcake.v).normalize();
      return cupcake.f.dot(dir);
    };
    town.turnAway(true);
    run(2);
    expect(cupcake.res!.act).toBe("away");
    expect(toMe()).toBeLessThan(-0.99);
    town.turnAway(false);
    run(1);
    expect(cupcake.res!.act).toBe("chore");
    expect(toMe()).toBeGreaterThan(0.95);
  });
});

describe("몸짓", () => {
  it("하늘 생물도 폴짝한 뒤에는 제 높이로 돌아온다(뛴 채로 남지 않는다)", () => {
    const { town, add, run } = world(),
      key = add("key", "flock", at(10, 0));
    key.res!.chore = 2;
    key.res!.choreT = 0;
    run(0.5);
    expect(town.cue(key, "joy", 0.8, at(12, 0))).toBe(true);
    let highest = 0;
    run(0.5, () => (highest = Math.max(highest, key.hop)));
    expect(highest).toBeGreaterThan(0.1);
    run(3);
    expect(key.hop).toBe(0);
    expect(key.hopV).toBe(0);
  });

  it("가만히 한곳을 쳐다보는 동안에도 → npc.stillMax 초 넘게 멈춰 있지 않는다", () => {
    const { town, add, run } = world(),
      cupcake = add("c_cupcake", "herd", at(10, 0));
    dozing(cupcake);
    run(0.5);
    town.cue(cupcake, "look", 12, at(10, 9));
    let still = 0,
      longest = 0,
      last = "",
      sinceSample = 0;
    run(11, () => {
      // 0.1초마다 본다: 자리·뛴 높이·몸짓(숨쉬기는 빼고)
      sinceSample += FRAME;
      if (sinceSample < 0.1) return;
      sinceSample = 0;
      const c = cupcake,
        now = [c.v.x * S.R, c.v.z * S.R, c.hop, c.yaw, c.pitch, c.roll, c.squash, c.sink]
          .map((n) => n.toFixed(2))
          .join(",");
      still = now === last ? still + 0.1 : 0;
      last = now;
      longest = Math.max(longest, still);
    });
    expect(longest).toBeLessThan(STAGE.npc.stillMax);
    expect(longest).toBeGreaterThan(1);
  });
});
