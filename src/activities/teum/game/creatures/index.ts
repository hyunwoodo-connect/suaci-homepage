import * as THREE from "three";

import { CREATURES, herdSpecies } from "../../assets/settings";
import { burst } from "../fx/sparks";
import { ripple, splashAt } from "../fx/ripples";
import type { Hold } from "../models";
import { fit, hasModel } from "../models";
import { freeAt, hubAt, occAdd } from "../scenery/spots";
import type { Game } from "../state";
import { S } from "../state";
import { fr } from "../world/flowers";
import { modelMatData } from "../world/look";
import { from, offset } from "../world/sphere";
import { groundAt } from "../world/terrain";

// 생물: 놀이기구가 아니라 손님이다. 저마다 제 할 일을 하다가 나를 알아채고, 동작이 끊기지 않고 이어진다. 이름은 없다.
// 땅 위의 손님(걷는 찻주전자·카드 병정·뛰는 버섯·풍선 토끼…), 셋씩 낮게 도는 날개 달린 열쇠·하트, 해파리 우산, 호수의 물고기,
// 그리고 온 행성에 세 곳씩뿐인 전설의 손님(라임 사슴·날개 달린 왕관)

/** 생물 하나 */
export interface Creature {
  k: string;
  m: Hold;
  /** 몸 휘기 셰이더 값: x 고유 위상, y 걸음 위상, z 움직임 세기, w 고개 */
  an: THREE.Vector4;
  v: THREE.Vector3;
  home: THREE.Vector3;
  /** 보는 쪽 */
  f: THREE.Vector3;
  /** 땅에서의 높이 */
  a: number;
  ph: number;
  st: string;
  t: number;
  still: number;
  hop: number;
  hopV: number;
  vis: number;
  want: number;
  order: number;
  met: boolean;
  sink: number;
  pitch: number;
  roll: number;
  amt: number;
  head: number;
  spd: number;
  /** sheep 땅 위 무리, flock 하늘을 도는 셋, jelly 해파리, fish 물고기 */
  type: "sheep" | "flock" | "jelly" | "fish";
  sp?: string;
  gait?: "walk" | "hop";
  hv?: THREE.Vector3;
  legend?: number;
  ctr?: THREE.Vector3;
  rad?: number;
  dir?: number;
  alt?: number;
  ang?: number;
  slot?: number;
  g0?: number;
  base?: number;
  jt?: number;
  rt?: number;
  bt?: number;
  goal?: THREE.Vector3;
  rs?: number;
}

/** 내가 멀어지면 내 앞쪽으로 옮겨 가는 무리 */
interface RoamGroup {
  mem: Creature[];
  kind: "sheep" | "flock" | "jelly";
  ctr?: THREE.Vector3;
}

/** 생물 전체 */
export interface Creatures {
  CR: Creature[];
  /** 만난 종류(처음 만나면 더 크게 반짝) */
  MET: Set<string>;
  /** 줄지어 따라오는 손님 */
  FOL: Creature[];
  ROAM: RoamGroup[];
  LEG: Creature[];
  pPrev: THREE.Vector3;
  pspd: number;
}

const cf = new THREE.Vector3(),
  cx = new THREE.Vector3(),
  cm = new THREE.Matrix4(),
  cv = new THREE.Vector3(),
  cw = new THREE.Vector3(),
  cq2 = new THREE.Quaternion(),
  ceu = new THREE.Euler();

const rnd = (a: number, b: number) => a + (b - a) * Math.random(),
  ez = (r: number, dt: number) => 1 - Math.exp(-r * dt);

/** 생물을 놓는다: 출발 앞 첫 무리, 마을마다 아홉 무리, 떠도는 무리, 열쇠 떼, 전설, 물고기, 해파리 */
export function placeCreatures(g: Game): Creatures {
  const CR: Creature[] = [];
  const C: Creatures = {
    CR,
    MET: new Set(),
    FOL: [],
    ROAM: [],
    LEG: [],
    pPrev: g.pl.p.clone(),
    pspd: 0,
  };
  g.creatures = C;
  const { p, h } = g.pl,
    HV = g.scenery.HV,
    SP = herdSpecies();
  const crit = (
    k: string,
    size: number,
    by: string,
    v: THREE.Vector3,
    o: Partial<Creature>,
  ): Creature | null => {
    if (!hasModel(g, k)) return null;
    const an = new THREE.Vector4();
    const m = fit(g, k, size, by, (model) =>
      model.traverse((x) => {
        if (!(x instanceof THREE.Mesh)) return;
        const ud = modelMatData(x.material);
        if (!ud.uAn) return;
        ud.uAn.value = an;
        ud.uAk.value = CREATURES[k]?.motion || 0;
        ud.uAx.value = 0;
      }),
    );
    g.scene.add(m);
    m.visible = false;
    an.set(6.28 * Math.random(), 0, 0, 0);
    const base = {
      k,
      m,
      an,
      v: v.clone().normalize(),
      home: v.clone().normalize(),
      a: groundAt(g, v),
      f: new THREE.Vector3(),
      ph: 6.28 * Math.random(),
      st: "idle",
      t: 0,
      still: 0,
      hop: 0,
      hopV: 0,
      vis: 1,
      want: 1,
      order: -1,
      met: false,
      sink: 0,
      pitch: 0,
      roll: 0,
      amt: 0,
      head: 0,
      spd: 0,
      type: "sheep" as Creature["type"],
    };
    const c: Creature = Object.assign(base, o);
    c.f.copy(offset(c.v, 2, 360 * Math.random())).sub(c.v);
    c.f.addScaledVector(c.v, -c.f.dot(c.v)).normalize();
    CR.push(c);
    return c;
  };
  // 땅 위의 손님: 살아 움직이는 물건들. 첫 무리는 출발하자마자 눈앞에
  const mkHerd = (hv: THREE.Vector3, n: number) => {
    const sp = SP[n % SP.length],
      out: Creature[] = [];
    for (let j = 0; j < sp.count; j++) {
      const c = crit(sp.key, sp.size, "h", offset(hv, 2.8, (j * 360) / sp.count + n * 40), {
        type: "sheep",
        sp: sp.key,
        gait: sp.gait,
        st: "graze",
        t: rnd(1, 6),
        hv,
      });
      if (c) out.push(c);
    }
    return out;
  };
  {
    cv.copy(p)
      .addScaledVector(h, 13 / S.R)
      .normalize();
    const v0 = cv.clone();
    occAdd(g, v0, 5);
    mkHerd(v0, 0);
    for (let hk = 0, n = 1; hk < HV.length; hk++)
      for (let q0 = 0, got = 0; q0 < 60 && got < 9; q0++) {
        const i = hk * 70 + q0,
          v = hubAt(g, hk, 8 + 105 * Math.sqrt(fr(i, 201)), 360 * fr(i, 202));
        if (!freeAt(g, v, 6)) continue;
        got++;
        occAdd(g, v, 5);
        mkHerd(v, n++);
      }
  } // 마을마다 아홉 무리
  // 어디로 가든 앞길에 손님이 있게: 떠도는 무리는 내가 멀어지면 내 앞쪽 먼 곳으로 조용히 옮겨 간다
  const ROAM = C.ROAM;
  for (let i = 0; i < 27; i++) ROAM.push({ mem: mkHerd(p, i + 1), kind: "sheep" });
  for (let i = 0; i < 10; i++) {
    const grp: RoamGroup = { mem: [], kind: "flock" },
      rad = 14 + 16 * fr(i, 243),
      dir = i % 2 ? 1 : -1,
      alt = 4 + 6 * fr(i, 244),
      a0 = 360 * fr(i, 245);
    for (let j = 0; j < 3; j++) {
      const c = crit(i % 2 ? "c_wheart" : "key", 2.2, i % 2 ? "z" : "w", p, {
        type: "flock",
        ctr: p,
        rad,
        dir,
        alt,
        ang: a0 - dir * j * 14,
        slot: j,
        st: "fly",
        g0: 0,
      });
      if (c) grp.mem.push(c);
    }
    ROAM.push(grp);
  }
  for (let i = 0; i < 12; i++) {
    const grp: RoamGroup = { mem: [], kind: "jelly" };
    const c = crit("umbrella", 4.4, "h", p, { type: "jelly", base: 6 });
    if (c) grp.mem.push(c);
    ROAM.push(grp);
  }
  ROAM.forEach((grp) => placeRoam(g, grp, true)); // 빈자리를 못 찾아도 어딘가에는 놓는다
  // 날개 달린 열쇠: 마을 하늘을 셋씩 낮게 돈다
  for (let hk = 0; hk < HV.length; hk++)
    for (let q0 = 0; q0 < 3; q0++) {
      const i = hk * 9 + q0,
        ctr = hubAt(g, hk, 12 + 60 * fr(i, 211), 360 * fr(i, 212)),
        rad = 14 + 16 * fr(i, 213),
        dir = q0 % 2 ? 1 : -1,
        alt = 4 + 6 * fr(i, 214),
        a0 = 360 * fr(i, 215);
      for (let j = 0; j < 3; j++) {
        const c = crit(
          q0 === 1 ? "c_wheart" : "key",
          2.2,
          q0 === 1 ? "z" : "w",
          offset(ctr, rad, a0),
          {
            type: "flock",
            ctr,
            rad,
            dir,
            alt,
            ang: a0 - dir * j * 14,
            slot: j,
            st: "fly",
          },
        );
        if (c) c.g0 = groundAt(g, ctr);
      }
    }
  // 전설의 손님: 라임 사슴과 날개 달린 왕관. 온 행성에 세 곳씩뿐이고 자리를 옮기지 않는다. 곁에는 늘 빛가루가 인다
  const deerAt: [number, number, number][] = [
    [1, 330, 40],
    [3, 350, 200],
    [5, 300, 120],
  ];
  deerAt.forEach(([hk, d, b]) => {
    const v = offset(HV[hk], d, b),
      c = crit("c_deer", 5.2, "h", v, {
        type: "sheep",
        sp: "c_deer",
        gait: "walk",
        st: "graze",
        t: rnd(1, 6),
        hv: v,
        legend: 1,
      });
    if (c) C.LEG.push(c);
  });
  const crownAt: [number, number, number][] = [
    [0, 380, 130],
    [2, 340, 300],
    [4, 360, 20],
  ];
  crownAt.forEach(([hk, d, b]) => {
    const ctr = offset(HV[hk], d, b),
      c = crit("c_wcrown", 6, "z", offset(ctr, 22, 0), {
        type: "flock",
        ctr,
        rad: 22,
        dir: 1,
        alt: 16,
        ang: 0,
        slot: 0,
        st: "fly",
        legend: 1,
      });
    if (c) {
      c.g0 = groundAt(g, ctr);
      C.LEG.push(c);
    }
  });
  // 흔한 손님 3: 물고기 — 호수마다 둘씩, 수면에서 원을 그리며 헤엄친다
  g.lakes.list.forEach((l, i) => {
    for (let j = 0; j < 2; j++) {
      const rad = 3 + j * 1.5,
        c = crit("bfish", 3.0, "x", offset(l.v, l.r * (0.4 + 0.25 * j), i * 67 + j * 170), {
          type: "fish",
          st: "swim",
          rad,
          ang: 360 * Math.random(),
          dir: j ? -1 : 1,
          jt: rnd(2, 8),
        });
      if (c) {
        c.a = 0.25;
        c.v.copy(offset(c.home, rad, c.ang!));
      }
    }
  });
  // 흔한 손님 4: 해파리 — 마을 둘레와 마을 사이 하늘
  {
    const jl = (v: THREE.Vector3) => {
      const c = crit("umbrella", 4.4, "h", v, { type: "jelly" });
      if (c) c.base = groundAt(g, c.v) + 5.5;
    };
    const jellyAt: [number, number][] = [
      [185, 12],
      [185, 100],
      [185, 192],
      [185, 281],
      [560, 45],
    ];
    jellyAt.forEach(([d, b]) => jl(from(d, b)));
    for (let hk = 0; hk < HV.length; hk++)
      for (let j = 0; j < 7; j++)
        jl(hubAt(g, hk, 18 + 95 * fr(hk * 11 + j, 221), 360 * fr(hk * 11 + j, 222)));
  }
  return C;
}

/** 전설의 손님 곁에는 늘 빛가루가 인다 */
export function legendsFrame(g: Game) {
  for (const c of g.creatures.LEG)
    if (c.m.visible && Math.random() < g.t.dt * 5) burst(g, c.m.position.clone(), 2, 4);
}

/** 생물 프레임: 멀어진 무리는 앞쪽으로 옮기고, 가까운 생물은 저마다의 상태대로 움직인다 */
export function creaturesFrame(g: Game) {
  const { pl, t, time } = g,
    { p, h, P } = pl,
    dt = t.dt,
    held = t.held,
    C = g.creatures,
    hist = g.scenery.hist,
    babyN = g.scenery.babyN;
  const altA = P.length() - S.R;
  {
    const sp = (p.angleTo(C.pPrev) * S.R) / Math.max(dt, 1e-3);
    if (sp < 60) C.pspd += (sp - C.pspd) * 0.25;
    C.pPrev.copy(p);
  } // 순간 이동은 빠르기로 치지 않는다
  const calm = !held && C.pspd < 1.5,
    rush = !held && C.pspd > 7;
  for (const grp of C.ROAM) {
    const d = grp.ctr!.angleTo(p) * S.R;
    if (d > 250 || (d > 150 && cw.copy(grp.ctr!).sub(p).dot(h) < 0)) placeRoam(g, grp, false);
  }
  if (g.rides.whale.on) C.MET.add("whale");
  for (const c of C.CR) {
    if (c.v.dot(p) < 0.8 && c.st !== "follow" && c.st !== "fly") {
      c.m.visible = false;
      continue;
    } // 아주 먼 것은 쉬게 둔다
    const dP = c.v.angleTo(p) * S.R,
      dA = altA - c.a;
    let amt = 0,
      head = 0;
    if (c.st === "follow") {
      // 만난 손님은 그 방문 동안 줄지어 따라온다
      const hg = hist[Math.min(hist.length - 1, 5 * (babyN + c.order + 1) + 2)];
      if (hg) {
        const d = c.v.angleTo(hg.p) * S.R;
        if (d > 0.25) {
          const sp = Math.min(14, d * 4);
          go(g, c, hg.p, sp, dt, sp > 5 ? 2.6 : 4.6);
          amt = Math.min(1, 0.4 + sp / 6);
        }
        const gl = groundAt(g, c.v),
          air0 = hg.a - 1.6 - gl;
        c.a += (Math.max(gl, hg.a - 1.6) - c.a) * ez(8, dt);
        if (air0 > 0.6) amt = 0.3;
      }
      head = 0.3;
      c.pitch += (0 - c.pitch) * ez(8, dt);
      c.sink += (0 - c.sink) * ez(10, dt);
      if (c.gait === "hop") {
        if (c.hop > 0 || c.hopV > 0) {
          c.hop += c.hopV * dt;
          c.hopV -= 22 * dt;
          if (c.hop <= 0) {
            c.hop = 0;
            c.hopV = 0;
          }
        } else if (amt > 0.3) {
          c.hopV = 4;
          c.hop = 0.01;
        }
      }
    } else if (c.type === "sheep") {
      const gr = groundAt(g, c.v);
      c.a = gr;
      c.sink += (0 - c.sink) * ez(10, dt);
      c.roll += (0 - c.roll) * ez(6, dt);
      if (c.hop > 0 || c.hopV > 0) {
        c.hop += c.hopV * dt;
        c.hopV -= 22 * dt;
        if (c.hop <= 0) {
          c.hop = 0;
          c.hopV = 0;
        }
      }
      const scare = dP < 9 && rush && Math.abs(dA) < 6,
        seen = dP < 13 && Math.abs(dA) < 7;
      if (c.sp === "teapot") {
        const pour = c.st === "graze" && Math.sin(time * 0.7 + c.an.x) > 0.25;
        c.pitch += ((pour ? -0.34 : 0) - c.pitch) * ez(3, dt);
        if (pour && c.pitch < -0.25) {
          c.bt = (c.bt || 0) - dt;
          if (c.bt <= 0) {
            c.bt = 0.5;
            cv.copy(c.m.position).addScaledVector(c.f, 1.3).addScaledVector(c.v, 0.3);
            burst(g, cv.clone(), 1, 2.5);
          }
        }
      } // 찻주전자는 가끔 몸을 기울여 김을 뿜는다
      else if (c.st !== "fall") c.pitch += (0 - c.pitch) * ez(8, dt);
      if (
        c.sp === "mushroom" &&
        !held &&
        dP < 1.5 &&
        dA > c.m.userData.hh * 1.2 &&
        dA < c.m.userData.hh * 2 + 2 &&
        pl.vy <= 0.5
      ) {
        pl.vy = 9.5;
        if (pl.air <= 0) pl.air = 0.01;
        c.sink = 0.3;
        meet(g, c);
      } // 버섯은 밟으면 튕긴다
      if (c.st === "graze" || c.st === "wander" || c.st === "watch") {
        if (scare) {
          c.st = c.sp === "card" ? "fall" : "startle";
          c.t = 0;
        } else if (seen) {
          // 풀 뜯다 말고 고개를 들어 쳐다본다
          c.st = "watch";
          head = 0.75;
          face(c, p, ez(2.2, dt));
          if (calm && dP < 6.5 && Math.abs(dA) < 4) {
            c.still += dt;
            if (c.still > 2.2) {
              c.st = "come";
            }
          } else c.still = Math.max(0, c.still - dt);
        } else if (c.st === "watch") {
          c.st = "graze";
          c.t = rnd(2, 5);
        } else if (c.st === "graze") {
          head = -1;
          c.t -= dt;
          if (c.t <= 0) {
            c.st = "wander";
            c.goal = offset(c.hv!, rnd(1, 5.5), 360 * Math.random());
          }
        } else {
          amt = 0.7;
          if (go(g, c, c.goal!, 0.9, dt) < 0.4) {
            c.st = "graze";
            c.t = rnd(3, 8);
          }
        }
      } else if (c.st === "fall") {
        // 카드 병정은 놀라면 벌렁 넘어졌다가 일어난다
        c.t += dt;
        const dn = c.t < 1.9;
        c.pitch += ((dn ? 1.5 : 0) - c.pitch) * ez(dn ? 10 : 5, dt);
        c.sink = 0.64 * Math.min(1, Math.abs(c.pitch) / 1.5);
        if (c.t > 2.7) {
          c.st = "lookback";
          c.t = 1.2;
        }
      } else if (c.st === "startle") {
        // 움찔 — 몸을 낮췄다가
        c.t += dt;
        head = 1;
        c.sink = 0.14;
        if (c.t > 0.16) {
          c.st = "run";
          c.t = 2.3;
          c.rs = 8.5;
          c.hopV = 5.5;
          c.hop = 0.01;
        }
      } else if (c.st === "run") {
        // 통통 뛰어 달아나다가 점점 느려진다
        away(g, c, c.rs!, dt);
        amt = 1;
        head = 0.4;
        c.rs = Math.max(1.4, c.rs! - 3.1 * dt);
        c.t -= dt;
        if (c.hop <= 0 && c.rs > 2.6) {
          c.hopV = 2.2 + c.rs * 0.35;
          c.hop = 0.01;
        }
        if (c.t <= 0 && c.hop <= 0) {
          c.st = "lookback";
          c.t = rnd(1.4, 2.2);
        }
      } else if (c.st === "lookback") {
        head = 0.8;
        face(c, p, ez(3, dt));
        c.t -= dt;
        if (scare) {
          c.st = "startle";
          c.t = 0;
        } else if (c.t <= 0) c.st = "home";
      } else if (c.st === "home") {
        amt = 0.8;
        if (scare) {
          c.st = "startle";
          c.t = 0;
        } else if (go(g, c, c.home, 1.4, dt) < 1.2) {
          c.st = "graze";
          c.t = rnd(2, 5);
          c.still = 0;
        }
      } else if (c.st === "come") {
        // 가만히 있으면 걸어와서
        head = 0.5;
        if (scare) {
          c.st = "startle";
          c.t = 0;
        } else if (dP > 16) c.st = "home";
        else if (dP > 2.1) {
          go(g, c, p, 1.7, dt);
          amt = 0.9;
        } else {
          c.st = "nuzzle";
          c.t = 0;
        }
      } else if (c.st === "nuzzle") {
        // 머리를 비비며 기댄다
        c.t += dt;
        face(c, p, ez(4, dt));
        head = 0.2 + 0.6 * Math.sin(c.t * 5);
        c.roll = 0.12 * Math.sin(Math.min(1, c.t / 1.6) * Math.PI);
        if (c.t > 0.5) meet(g, c);
        if (c.t > 1.7) {
          if (!join(g, c)) {
            c.st = "graze";
            c.t = rnd(3, 6);
            c.still = 0;
          }
        }
      }
      if (c.gait === "hop" && amt > 0.3 && c.hop <= 0 && c.hopV <= 0 && c.st !== "run") {
        c.hopV = 4;
        c.hop = 0.01;
      } // 뛰는 손님은 걸음 대신 통통
    } else if (c.type === "flock") {
      c.ph += dt * (9 + 6 * c.amt);
      c.ang! += ((c.dir! * 6.5) / c.rad!) * 57.3 * dt;
      const nv = offset(c.ctr!, c.rad!, c.ang!);
      face(c, offset(c.ctr!, c.rad!, c.ang! + c.dir! * 10), ez(8, dt));
      c.v.copy(nv);
      c.a = c.g0! + c.alt! + 1.2 * Math.sin(time * 0.6 + c.an.x) + c.slot! * 0.5;
      amt = 0.55 + 0.45 * Math.sin(time * 0.9 + c.an.x * 2);
      c.roll = -c.dir! * 0.3;
      if (dP < 9 && Math.abs(dA) < 6) meet(g, c);
    } else if (c.type === "fish") {
      const wsp = c.st === "jump" ? 5.5 : c.st === "visit" ? 0 : c.st === "dive" ? 4.5 : 1.3;
      c.ph += dt * (5 + wsp * 2.2);
      if (wsp > 0) {
        c.ang! += ((c.dir! * wsp) / c.rad!) * 57.3 * dt;
        const nv = offset(c.home, c.rad!, c.ang!);
        face(c, offset(c.home, c.rad!, c.ang! + c.dir! * 12), ez(6, dt));
        c.v.copy(nv);
      }
      const scare = dP < 9 && rush;
      if (c.st === "swim") {
        c.a += (0.25 + 0.07 * Math.sin(time * 1.4 + c.an.x) - c.a) * ez(5, dt);
        c.pitch += (0 - c.pitch) * ez(5, dt);
        amt = 0.35;
        c.rt = (c.rt || 0) - dt;
        if (c.rt <= 0 && dP < 60) {
          c.rt = rnd(0.9, 1.6);
          ripple(g, c.v, 0.45, 0);
        }
        c.jt! -= dt;
        if (c.jt! <= 0) {
          c.st = "jump";
          c.t = 0;
          c.jt = rnd(4, 9);
          splash(g, c, 4);
        }
        if (dP < 12 && calm) {
          c.still += dt;
          if (c.still > 1.5) {
            c.st = "visit";
            c.t = 0;
            c.bt = 1;
          }
        } else c.still = 0;
        if (scare) {
          c.st = "dive";
          c.t = 0;
          splash(g, c, 5);
        }
      } else if (c.st === "jump") {
        // 물 위로 뛰어올랐다가 머리부터 들어간다
        c.t += dt;
        const k = c.t / 0.95;
        c.a = 0.25 + 9 * k * (1 - k);
        c.pitch = 0.95 * (1 - 2 * k);
        amt = 1;
        if (k >= 1) {
          c.st = "swim";
          splash(g, c, 5);
        }
      } else if (c.st === "visit") {
        // 멈춰 선 사람 쪽으로 몸을 돌리고 고개를 내밀어 방울을 분다
        face(c, p, ez(3, dt));
        c.a += (0.5 + 0.08 * Math.sin(time * 2) - c.a) * ez(4, dt);
        c.pitch += (0.4 - c.pitch) * ez(4, dt);
        amt = 0.15;
        c.t += dt;
        c.bt! -= dt;
        if (c.bt! <= 0) {
          c.bt = 2.3;
          cv.copy(c.m.position).addScaledVector(c.v, 0.9);
          burst(g, cv.clone(), 3, 4);
          ripple(g, c.v, 0.7, 0);
        }
        if (c.t > 2.5) meet(g, c);
        if (scare) {
          c.st = "dive";
          c.t = 0;
          splash(g, c, 5);
        } else if (dP > 17) c.st = "swim";
      } else if (c.st === "dive") {
        // 고개를 숙이고 물속으로
        c.t += dt;
        c.pitch += (-1.1 - c.pitch) * ez(12, dt);
        c.a += (-3 - c.a) * ez(5, dt);
        amt = 1;
        if (c.t > 0.9) {
          c.st = "under";
          c.t = rnd(3, 5);
        }
      } else if (c.st === "under") {
        c.a = -3;
        c.pitch = 0.9;
        c.t -= dt;
        if (c.t <= 0 && !scare) {
          c.st = "jump";
          c.t = 0;
          splash(g, c, 4);
        }
      }
    } else if (c.type === "jelly") {
      // 갓을 오므릴 때마다 조금씩 솟고, 천천히 가라앉는다
      c.ph += dt * 2.1;
      cw.copy(c.f).applyAxisAngle(c.v, dt * 0.12);
      c.f.copy(cw);
      if (c.v.angleTo(c.home) * S.R > 40) face(c, c.home, 0.05);
      c.v.addScaledVector(c.f, (0.6 * dt) / S.R).normalize();
      c.a = c.base! + 0.8 * Math.sin(c.ph - 1.9) + Math.sin(time * 0.3 + c.an.x) * 0.8;
      if (c.hop !== 0 || c.hopV !== 0) {
        c.hopV += (-60 * c.hop - 7 * c.hopV) * dt;
        c.hop += c.hopV * dt;
        if (Math.abs(c.hop) < 0.01 && Math.abs(c.hopV) < 0.05) {
          c.hop = 0;
          c.hopV = 0;
        }
      } // 밟히면 출렁
      const u = c.m.userData;
      if (!held && dP < 2.4 && dA > u.hh * 0.6 && dA < u.hh * 2 + 1.6 && pl.vy <= 0.5) {
        pl.vy = 9;
        if (pl.air <= 0) pl.air = 0.01;
        c.hopV = -5;
        c.hop = -0.01;
        c.ph = 4.7;
        meet(g, c);
      }
      if (dP < 7 && Math.abs(dA - u.hh) < 6) meet(g, c);
    }
    c.amt += (amt - c.amt) * ez(7, dt);
    c.head += (head - c.head) * ez(5, dt); // 동작과 동작 사이는 늘 부드럽게 넘어간다
    putCreature(g, c, dt);
  }
}

/* ─── 내부 ─────────────────────────── */

// 떠도는 무리를 옮긴다: 처음엔 내 둘레 아무 데나, 그 뒤엔 내 앞쪽 먼 곳
function placeRoam(g: Game, grp: RoamGroup, first: boolean) {
  const p = g.pl.p;
  let ctr: THREE.Vector3 | null = null;
  for (let k = 0; k < 24; k++) {
    ctr = first ? offset(p, rnd(25, 210), 360 * Math.random()) : ahead(g, 125, 200, 1.2);
    if (grp.kind !== "sheep" || freeAt(g, ctr, 6)) break;
  }
  setGroup(g, grp, ctr!);
}

function ahead(g: Game, dmin: number, dmax: number, spread: number): THREE.Vector3 {
  const { p, h } = g.pl;
  cw.copy(h).applyAxisAngle(p, rnd(-spread, spread));
  return p
    .clone()
    .addScaledVector(cw, Math.tan(rnd(dmin, dmax) / S.R))
    .normalize();
}

function setGroup(g: Game, grp: RoamGroup, ctr: THREE.Vector3) {
  grp.ctr = ctr;
  grp.mem.forEach((c, j) => {
    if (c.st === "follow") return;
    if (c.type === "sheep") {
      c.hv = ctr;
      c.home.copy(offset(ctr, 2.8, (j * 360) / grp.mem.length + 20));
      c.pitch = 0;
      c.sink = 0;
      c.v.copy(c.home);
      c.st = "graze";
      c.t = rnd(1, 6);
      c.still = 0;
      c.hop = 0;
      c.hopV = 0;
      c.met = false;
    } else if (c.type === "flock") {
      c.ctr = ctr;
      c.g0 = groundAt(g, ctr);
      c.v.copy(offset(ctr, c.rad!, c.ang!));
      c.met = false;
    } else {
      c.home.copy(ctr);
      c.v.copy(ctr);
      c.base = groundAt(g, ctr) + 5.5;
      c.met = false;
    }
  });
}

// 생물을 그린다: 보는 쪽으로 세우고, 숙이고(pitch) 기울이고(roll), 땅 높이·뛰기·가라앉기를 더한다
function putCreature(g: Game, c: Creature, dt: number) {
  c.vis += (c.want - c.vis) * ez(5, dt);
  const near = c.v.dot(g.pl.p) > 0.9 && c.vis > 0.03;
  c.m.visible = near;
  if (!near) return;
  const u = c.m.userData;
  cx.crossVectors(c.f, c.v).normalize();
  cf.crossVectors(c.v, cx).normalize();
  cm.makeBasis(cf, c.v, cx);
  c.m.quaternion.setFromRotationMatrix(cm);
  if (c.pitch || c.roll) {
    cq2.setFromEuler(ceu.set(c.roll, 0, c.pitch));
    c.m.quaternion.multiply(cq2);
  }
  c.m.position.copy(c.v).multiplyScalar(S.R + c.a + c.hop + u.hh * (1 - c.sink));
  c.m.scale.setScalar(u.k * c.vis);
  c.an.y = c.ph;
  c.an.z = c.amt;
  c.an.w = c.head;
}

// 그쪽(tv)을 본다(k 만큼 돌린다)
function face(c: Creature, tv: THREE.Vector3, k?: number) {
  cv.copy(tv).addScaledVector(c.v, -tv.dot(c.v));
  if (cv.lengthSq() < 1e-10) return;
  cv.normalize();
  c.f.lerp(cv, k === undefined ? 0.15 : k).normalize();
}

// 걸어서 간다: 몸을 먼저 돌리고, 보는 쪽으로 나아간다. 걸음 수는 간 거리만큼. 남은 거리를 돌려준다
function go(
  g: Game,
  c: Creature,
  tv: THREE.Vector3,
  spd: number,
  dt: number,
  stride?: number,
): number {
  const d = c.v.angleTo(tv) * S.R;
  if (d < 0.05) return d;
  face(c, tv, ez(5, dt));
  const st = Math.min(d, spd * dt);
  c.v.addScaledVector(c.f, Math.tan(st / S.R)).normalize();
  c.f.addScaledVector(c.v, -c.f.dot(c.v)).normalize();
  c.ph += st * (stride || 4.6);
  return d;
}

// 나에게서 멀어진다
function away(g: Game, c: Creature, spd: number, dt: number, stride?: number) {
  cv.copy(c.v).sub(g.pl.p);
  cv.addScaledVector(c.v, -cv.dot(c.v));
  if (cv.lengthSq() < 1e-10) cv.copy(c.f);
  cv.normalize();
  c.f.lerp(cv, ez(7, dt)).normalize();
  c.v.addScaledVector(c.f, Math.tan((spd * dt) / S.R)).normalize();
  c.f.addScaledVector(c.v, -c.f.dot(c.v)).normalize();
  c.ph += spd * dt * (stride || 2.6);
}

// 만났다: 처음 보는 종류면 더 크게 반짝
function meet(g: Game, c: Creature) {
  if (c.met) return;
  c.met = true;
  const MET = g.creatures.MET,
    first = !MET.has(c.k);
  MET.add(c.k);
  cv.copy(c.m.position);
  burst(g, cv.clone(), first ? 16 : 6, first ? 9 : 6);
  if (first) burst(g, cv.clone(), 10, 13);
}

// 줄지어 따라오기에 넣는다(여섯까지)
function join(g: Game, c: Creature): boolean {
  const FOL = g.creatures.FOL;
  if (FOL.length >= 6 || c.order >= 0) return false;
  c.order = FOL.length;
  FOL.push(c);
  c.st = "follow";
  return true;
}

function splash(g: Game, c: Creature, n: number) {
  splashAt(g, c.v, 0.5 + n * 0.12, n * 2);
}
