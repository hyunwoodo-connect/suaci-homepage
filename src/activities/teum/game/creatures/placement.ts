import * as THREE from "three";

import type { CreatureSetting } from "../../assets/settings";
import { CREATURES, herdSpecies, lakeSpecies, skySpecies } from "../../assets/settings";
import type { Random } from "../core/random";
import { within } from "../maps/map";
import type { ModelBatch } from "../models/batch";
import type { Services } from "../services";
import { S } from "../settings";
import { fr } from "../world/hash";
import { from, offset, offsetInto } from "../world/sphere";
import type { Creature, CreatureLinks, CreatureRole } from "./creature";
import type { Habit } from "./habits";
import { HABITS } from "./habits";

// 생물을 놓는 규칙: 수와 자리는 지도(creatures)가 정하고, 여기는 그 차례와 셈만 둔다.
// 생물마다의 난수 갈래는 만든 차례로 이름이 붙고(c0, c1…), 떠도는 무리의 자리도 같은 난수에서 뽑으니 놓는 차례가 곧 배치다

/** 내가 멀어지면 내 앞쪽으로 옮겨 가는 무리 */
export interface RoamGroup {
  mem: Creature[];
  kind: "herd" | "flock" | "jelly";
  ctr: THREE.Vector3;
}

/** 종 하나: 설정·그리는 묶음·버릇 */
export interface Species {
  set: CreatureSetting;
  batch: ModelBatch;
  habits: Habit[];
  /** 하늘을 돌다 나를 찾아오는 버릇이 있다(제 궤도로 천천히 돌아온다) */
  tame: boolean;
  /** 놀랐을 때 갈 상태 */
  scaredTo: string;
}

/** 놓는 데 쓰는 것과 놓은 것: 목록·종·묶음·무리는 생물 전체(Creatures)와 같은 것을 본다 */
export interface PlaceCtx {
  s: Services;
  /** 떠도는 무리 자리와, 생물마다 갈라 주는 난수 갈래의 뿌리 */
  rng: Random;
  links: Pick<CreatureLinks, "lakes">;
  list: Creature[];
  species: Map<string, Species>;
  batches: ModelBatch[];
  roam: RoamGroup[];
  legends: Creature[];
  /** 마을 무리에 매기는 번호(무리 안에서 둘러선 각을 엇갈리게) */
  herdN: number;
}

/** 종마다 그리는 묶음 하나의 칸 수(가장 많은 종도 이 안에 든다) */
const CAPACITY = 128;
/** 마을마다 자리를 찾는 고정 난수 번호의 간격(땅 무리·하늘 무리·해파리 — 지도의 tries·perHub 는 이보다 작다) */
const HERD_STRIDE = 70,
  FLOCK_STRIDE = 9,
  JELLY_STRIDE = 11;

const cv = new THREE.Vector3(),
  cw = new THREE.Vector3();

/**
 * 생물을 놓는다(수와 자리는 지도 creatures): 출발 앞 첫 무리, 마을마다의 무리, 떠도는 무리, 마을 하늘의 무리, 전설, 호수, 해파리.
 * 오늘의 축제 지역에 더 놓은 무리를 돌려준다
 */
export function placeCreatures(x: PlaceCtx): Creature[] {
  const s = x.s,
    { player, occ } = s,
    plan = s.map.creatures,
    p = player.p,
    h = player.h,
    HV = occ.hubs,
    FLK = skySpecies(),
    LAKE = lakeSpecies();
  let festivalHerds: Creature[] = [];
  // 땅 위의 손님: 첫 무리는 출발하자마자 눈앞에 — 그날 축제 지역에 사는 첫 종
  const festival = s.today.festival;
  const startStep = plan.firstHerdAhead / S.R;
  const v0 = p.clone().addScaledVector(h, startStep).normalize();
  occ.fill(v0, 5);
  const firstKey = s.map.regions[festival]?.herds[0];
  if (firstKey) mkHerd(x, v0, 0, firstKey, plan.firstHerd);
  // 마을마다 그 지역에 사는 종만 한두 마리씩(축제 지역은 더 많이)
  for (let hk = 0; hk < HV.length; hk++) {
    const own = s.map.regions[hk].herds.length;
    placeHerds(x, hk, 0, own);
    // 축제 지역은 그다음 빈자리에 더(날이 바뀌면 이것만 떠나고 새 축제 지역에 새로 온다)
    const extra = own * plan.festival;
    if (hk === festival) festivalHerds = placeHerds(x, hk, own, extra);
  }
  // 어디로 가든 앞길에 손님이 있게: 떠도는 무리는 내가 멀어지면 내 앞쪽 먼 곳으로 조용히 옮겨 간다
  for (let i = 0; i < plan.roaming.herds; i++) {
    const herdN = i + 1;
    const here = p.clone();
    const mem = mkHerd(x, here, herdN);
    x.roam.push({ mem, kind: "herd", ctr: here });
  }
  for (let i = 0; i < plan.roaming.flocks; i++) {
    const grp: RoamGroup = { mem: [], kind: "flock", ctr: p.clone() },
      rad = 14 + 16 * fr(i, 243),
      dir = i % 2 ? 1 : -1,
      alt = 4 + 6 * fr(i, 244),
      a0 = 360 * fr(i, 245);
    const kind = FLK[i % FLK.length];
    for (let j = 0; j < 3; j++) {
      const ang = a0 - dir * j * 14;
      const o = { ctr: grp.ctr, rad, dir, alt, ang, slot: j, st: "fly", g0: 0 };
      const c = crit(x, kind.key, "flock", grp.ctr, o);
      if (c) grp.mem.push(c);
    }
    x.roam.push(grp);
  }
  for (let i = 0; i < plan.roaming.jellies; i++) {
    const grp: RoamGroup = { mem: [], kind: "jelly", ctr: p.clone() };
    const c = crit(x, "umbrella", "jelly", grp.ctr, { base: 6 });
    if (c) grp.mem.push(c);
    x.roam.push(grp);
  }
  for (const grp of x.roam) placeRoam(x, grp, true); // 빈자리를 못 찾아도 어딘가에는 놓는다
  // 하늘 무리: 마을 하늘을 셋씩 낮게 돈다(마을마다 몇 무리, 하늘 종을 돌려 가며)
  for (let hk = 0; hk < HV.length; hk++)
    for (let q0 = 0; q0 < s.map.regions[hk].flocks; q0++) {
      const i = hk * FLOCK_STRIDE + q0;
      const ctrRoll = fr(i, 211);
      const ctrDist = within(plan.townFlocks.dist, ctrRoll);
      const ctrBearing = 360 * fr(i, 212);
      const ctr = occ.hubAt(hk, ctrDist, ctrBearing),
        rad = 14 + 16 * fr(i, 213),
        dir = q0 % 2 ? 1 : -1,
        alt = 4 + 6 * fr(i, 214),
        a0 = 360 * fr(i, 215);
      const kindAt = q0 % FLK.length;
      const kind = FLK[kindAt];
      const g0 = s.terrain.groundAt(ctr);
      for (let j = 0; j < 3; j++) {
        const start = offset(ctr, rad, a0);
        const ang = a0 - dir * j * 14;
        crit(x, kind.key, "flock", start, { ctr, rad, dir, alt, ang, slot: j, st: "fly", g0 });
      }
    }
  // 전설의 손님: 지도가 정한 자리뿐이고 자리를 옮기지 않는다. 곁에는 늘 빛가루가 인다(설정표의 차례로 놓는다)
  for (const [key, set] of Object.entries(CREATURES)) {
    const L = set.legend,
      spots = plan.legends[key];
    if (!L || !spots) continue;
    for (const [hk, d, b] of spots) {
      const at = offset(HV[hk], d, b);
      if (L.kind === "ground") {
        const c = crit(x, key, "herd", at, { gait: "walk", st: "graze", hv: at, legend: 1 });
        if (!c) continue;
        c.t = c.rng.range(1, 6);
        x.legends.push(c);
      } else {
        const start = offset(at, 22, 0);
        const o = { ctr: at, rad: 22, dir: 1, alt: 16, ang: 0, slot: 0, st: "fly", legend: 1 };
        const c = crit(x, key, "flock", start, o);
        if (!c) continue;
        c.g0 = s.terrain.groundAt(at);
        x.legends.push(c);
      }
    }
  }
  // 호수: 호수마다 몇씩, 호수 종을 돌려 가며 수면에서 원을 그리며 헤엄친다
  x.links.lakes.list.forEach((l, i) => {
    for (let j = 0; j < plan.perLake; j++) {
      const rad = 3 + j * 1.5;
      const pondDist = l.r * (0.4 + 0.25 * j);
      const pondBearing = i * 67 + j * 170;
      const pondAt = offset(l.v, pondDist, pondBearing);
      const kindAt = (i + j) % LAKE.length;
      const kind = LAKE[kindAt];
      const dir = j ? -1 : 1;
      const c = crit(x, kind.key, "fish", pondAt, { st: "swim", rad, dir });
      if (!c) continue;
      c.ang = 360 * c.rng.next();
      c.jt = c.rng.range(2, 8);
      c.a = 0.25;
      offsetInto(c.v, c.home, rad, c.ang);
    }
  });
  // 해파리: 마을 둘레와 마을 사이 하늘
  const jl = (v: THREE.Vector3) => {
    const c = crit(x, "umbrella", "jelly", v, {});
    if (c) c.base = s.terrain.groundAt(c.v) + 5.5;
  };
  const jellies = plan.jellies;
  for (const [d, b] of jellies.at) {
    const spot = from(d, b);
    jl(spot);
  }
  for (let hk = 0; hk < HV.length; hk++)
    for (let j = 0; j < s.map.regions[hk].jellies; j++) {
      const jellySeed = hk * JELLY_STRIDE + j;
      const distRoll = fr(jellySeed, 221);
      const dist = within(jellies.dist, distRoll);
      const bearing = 360 * fr(jellySeed, 222);
      const spot = occ.hubAt(hk, dist, bearing);
      jl(spot);
    }
  return festivalHerds;
}

/**
 * 마을 hk 의 땅 위 무리 가운데 from 번째부터 to 번째 앞까지(빈자리를 차례로 찾는다 — 앞의 것이 놓인 뒤라면 그다음 자리부터).
 * 종은 그 지역의 herds 를 돌려 가며, 한 마리·두 마리를 번갈아
 */
export function placeHerds(x: PlaceCtx, hk: number, from: number, to: number): Creature[] {
  const { occ, map } = x.s,
    herds = map.creatures.herds,
    kinds = map.regions[hk].herds,
    out: Creature[] = [];
  for (let q0 = 0, got = from; q0 < herds.tries && got < to; q0++) {
    const i = hk * HERD_STRIDE + q0;
    const distHash = fr(i, 201);
    const far = Math.sqrt(distHash);
    const dist = within(herds.dist, far);
    const bearing = 360 * fr(i, 202);
    const v = occ.hubAt(hk, dist, bearing);
    if (!occ.isFree(v, herds.clear)) continue;
    occ.fill(v, 5);
    const key = kinds[got % kinds.length],
      count = 1 + (got % 2);
    const members = mkHerd(x, v, x.herdN, key, count);
    out.push(...members);
    x.herdN++;
    got++;
  }
  return out;
}

/**
 * 떠도는 무리를 옮긴다: 처음엔 내 둘레 아무 데나, 그 뒤엔 내 앞쪽 먼 곳(가는 방향 쪽으로 좁혔다).
 * 옮긴 손님을 움직일 것에 넣는 일은 부른 쪽(Creatures)이 한다
 */
export function placeRoam(x: PlaceCtx, grp: RoamGroup, first: boolean) {
  const { player, occ } = x.s,
    p = player.p,
    r = x.rng;
  for (let k = 0; k < 24; k++) {
    if (first) {
      // 난수 순서: 거리 → 방향
      const dist = r.range(25, 210);
      const bearing = 360 * r.next();
      offsetInto(cv, p, dist, bearing);
    } else ahead(x, 110, 190, 0.6);
    if (grp.kind !== "herd" || occ.isFree(cv, 6)) break;
  }
  setGroup(x, grp, cv);
}

/* ─── 내부 ─────────────────────────── */

// 땅 위 무리 하나: key 가 없으면 무리 종을 차례로 돌려 쓰고(떠도는 무리), count 가 없으면 그 종의 마릿수
function mkHerd(
  x: PlaceCtx,
  hv: THREE.Vector3,
  n: number,
  key?: string,
  count?: number,
): Creature[] {
  const SP = herdSpecies();
  const named = key ? SP.find((q) => q.key === key) : undefined;
  const sp = named ?? SP[n % SP.length],
    N = count || sp.count,
    out: Creature[] = [];
  for (let j = 0; j < N; j++) {
    const bearing = (j * 360) / N + n * 40;
    const spot = offset(hv, 2.8, bearing);
    const c = crit(x, sp.key, "herd", spot, { gait: sp.gait, st: "graze", hv });
    if (!c) continue;
    c.t = c.rng.range(1, 6);
    out.push(c);
  }
  return out;
}

// 생물 하나를 만든다(그 종의 그리기 묶음에 자리를 하나 더한다). 모델이 manifest 에 없으면 null
function crit(
  x: PlaceCtx,
  k: string,
  role: CreatureRole,
  v: THREE.Vector3,
  o: Partial<Creature>,
): Creature | null {
  const sp = speciesOf(x, k);
  if (!sp) return null;
  const index = x.list.length;
  const name = "c" + index;
  const rng = x.rng.fork(name);
  const bendPhase = 6.28 * rng.next();
  const at = v.clone().normalize();
  const base: Creature = {
    k,
    role,
    batch: sp.batch,
    rng,
    an: new THREE.Vector4(bendPhase, 0, 0, 0),
    v: at,
    home: at.clone(),
    f: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    visible: false,
    a: x.s.terrain.groundAt(v),
    ph: 6.28 * rng.next(),
    st: "idle",
    t: 0,
    still: 0,
    hop: 0,
    hopV: 0,
    vis: 1,
    want: 1,
    order: -1,
    met: false,
    gone: false,
    sink: 0,
    pitch: 0,
    roll: 0,
    amt: 0,
    head: 0,
    gait: "walk",
    hv: null,
    legend: 0,
    ctr: null,
    rad: 0,
    dir: 0,
    alt: 0,
    ang: 0,
    slot: 0,
    g0: 0,
    base: 0,
    jt: 0,
    rt: 0,
    bt: 0,
    goal: null,
    rs: 0,
    lp: null,
    tum: 0,
    bowed: false,
    cd: 0,
    n: 0,
    led: false,
    vt: 0,
    vc: 0,
  };
  const c: Creature = Object.assign(base, o);
  const faceBearing = 360 * rng.next();
  const facePoint = offset(c.v, 2, faceBearing);
  c.f.copy(facePoint).sub(c.v);
  const fUp = c.f.dot(c.v);
  c.f.addScaledVector(c.v, -fUp).normalize();
  x.list.push(c);
  return c;
}

// 종 하나를 준비한다: 설정·그리는 묶음(크기는 종마다 하나)·버릇
function speciesOf(x: PlaceCtx, k: string): Species | null {
  const known = x.species.get(k);
  if (known) return known;
  const set = CREATURES[k];
  if (!set || !x.s.models.has(k)) return null;
  const { size, by } = sizeOf(set);
  const batch = x.s.models.batch(k, CAPACITY, size, by, set.motion);
  if (!batch) return null;
  const habits = (set.habits ?? []).map((name) => HABITS[name]);
  const tame = habits.some((h) => h.fly);
  const scaredHabit = habits.find((h) => h.scaredTo);
  const scaredTo = scaredHabit?.scaredTo ?? "startle";
  const sp: Species = { set, batch, habits, tame, scaredTo };
  x.species.set(k, sp);
  x.batches.push(batch);
  return sp;
}

// 가는 쪽에서 ±spread 라디안, dmin~dmax 앞의 자리를 cv 에
function ahead(x: PlaceCtx, dmin: number, dmax: number, spread: number) {
  const { p, h } = x.s.player,
    r = x.rng;
  // 난수 순서: 방향 → 거리
  const turn = r.range(-spread, spread);
  cw.copy(h).applyAxisAngle(p, turn);
  const dist = r.range(dmin, dmax);
  const arc = dist / S.R;
  const stepLen = Math.tan(arc);
  cv.copy(p).addScaledVector(cw, stepLen).normalize();
}

// 무리 하나를 새 중심(at)으로. 앞장서는 중인 회중시계·따라오는 손님은 하던 것을 마저 한다
function setGroup(x: PlaceCtx, grp: RoamGroup, at: THREE.Vector3) {
  const terrain = x.s.terrain;
  grp.ctr = at.clone();
  const ctr = grp.ctr;
  grp.mem.forEach((c, j) => {
    if (c.st === "follow" || c.st === "lead" || c.st === "beckon") return;
    c.led = false;
    c.bowed = false;
    if (c.role === "herd") {
      c.hv = ctr;
      const bearing = (j * 360) / grp.mem.length + 20;
      offsetInto(c.home, ctr, 2.8, bearing);
      c.pitch = 0;
      c.sink = 0;
      c.v.copy(c.home);
      c.st = "graze";
      c.t = c.rng.range(1, 6);
      c.still = 0;
      c.hop = 0;
      c.hopV = 0;
      c.met = false;
    } else if (c.role === "flock") {
      c.ctr = ctr;
      c.g0 = terrain.groundAt(ctr);
      offsetInto(c.v, ctr, c.rad!, c.ang!);
      c.met = false;
    } else {
      c.home.copy(ctr);
      c.v.copy(ctr);
      c.base = terrain.groundAt(ctr) + 5.5;
      c.met = false;
    }
  });
}

// 종의 크기와 재는 쪽: 땅 위 무리·해파리는 키(h), 하늘 무리는 너비(w), 호수는 앞뒤(x), 전설은 정한 대로
function sizeOf(set: CreatureSetting): { size: number; by: string } {
  if (set.herd) return { size: set.herd.size, by: "h" };
  if (set.sky) return { size: set.sky.size, by: "w" };
  if (set.lake) return { size: set.lake.size, by: "x" };
  if (set.jelly) return { size: set.jelly.size, by: "h" };
  if (set.legend) return { size: set.legend.size, by: set.legend.by };
  return { size: 2.5, by: "h" };
}
