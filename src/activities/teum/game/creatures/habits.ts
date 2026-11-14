import * as THREE from "three";

import type { HabitName } from "../../assets/settings";
import { ease } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import { offsetInto } from "../world/sphere";
import type { Creature, Pose, Sense } from "./creature";
import { away, face, go } from "./moves";

// 종마다 다른 버릇: 생김새만 다르고 하는 짓이 같으면 만나는 재미가 없다.
// 버릇은 종 설정(assets/settings 의 habits)에 끼우는 상태 묶음이다 — 공통 상태 기계는 종 이름을 보지 않고 버릇에게 묻는다.
// 끼우는 자리(공통 상태 기계와의 차례는 시제품 그대로):
//   before 공통 상태 기계보다 먼저(구르기·인사·돌기·폴짝·앞장서기·달아나기) → pitch 고개 숙임을 맡나 → touch 나와 닿았을 때 →
//   (공통 상태 기계: states 로 이 버릇이 맡는 상태가 끼어든다, 놀라면 scaredTo 로) / 하늘을 도는 것은 fly

/** 버릇이 쓰는 창구 */
export interface HabitCtx {
  s: Services;
  dt: number;
  time: number;
  /** 만났다(처음 보는 종류면 더 크게 반짝, 전설이면 도장) */
  meet(c: Creature): void;
  /** 35m 밖에서 가장 가까운 다른 땅 위 무리의 중심과 거리 */
  nearestOtherHerd(c: Creature): { ctr: THREE.Vector3 | null; d: number };
  /** 한 번에 한 무리만 찾아온다: 지금 찾아온 무리(중심)와 남은 시간 */
  visit: { t: number; ctr: THREE.Vector3 | null };
}

/** 종에 끼우는 버릇 하나 */
export interface Habit {
  /** 공통 상태 기계보다 먼저(땅 위 무리) */
  before?(c: Creature, sense: Sense, pose: Pose, x: HabitCtx): void;
  /** 고개 숙임(pitch)을 이번 프레임 이 버릇이 맡았나 — 맡으면 공통이 0 으로 되돌리지 않는다 */
  pitch?(c: Creature, x: HabitCtx): boolean;
  /** 나와 닿았을 때(공통 상태 기계 앞) */
  touch?(c: Creature, sense: Sense, x: HabitCtx): void;
  /** 놀랐을 때 갈 상태(없으면 움찔 startle) */
  readonly scaredTo?: string;
  /** 공통 상태 기계 안에서 이 버릇이 맡는 상태 */
  readonly states?: Readonly<Record<string, (c: Creature, x: HabitCtx) => void>>;
  /** 하늘을 도는 것: 이번 프레임 나를 찾아와 둘레를 돌았나(돌았으면 움직임 세기는 pose 에) */
  fly?(c: Creature, sense: Sense, pose: Pose, x: HabitCtx): boolean;
}

const cv = new THREE.Vector3(),
  nv = new THREE.Vector3(),
  lookAt = new THREE.Vector3();

/** 버릇 이름 → 버릇 */
export const HABITS: Readonly<Record<HabitName, Habit>> = {
  // 찻주전자는 가끔 몸을 기울여 김을 뿜는다
  pour: {
    pitch(c, x) {
      const pourPhase = x.time * 0.7 + c.an.x;
      const pour = c.st === "graze" && Math.sin(pourPhase) > 0.25;
      const pourTilt = pour ? -0.34 : 0;
      const tiltEase = ease(3, x.dt);
      c.pitch += (pourTilt - c.pitch) * tiltEase;
      if (pour && c.pitch < -0.25) {
        c.bt = (c.bt || 0) - x.dt;
        if (c.bt <= 0) {
          c.bt = 0.5;
          cv.copy(c.pos).addScaledVector(c.f, 1.3).addScaledVector(c.v, 0.3);
          x.s.fx.burst(cv, 1, 2.5);
        }
      }
      return true;
    },
  },
  // 버섯은 밟으면 튕긴다
  springy: {
    touch(c, sense, x) {
      const pl = x.s.player,
        hh = c.batch.hh;
      const { dP, dA } = sense;
      if (!pl.held && dP < 1.5 && dA > hh * 1.2 && dA < hh * 2 + 2 && pl.vy <= 0.5) {
        pl.bounce(9.5);
        c.sink = 0.3;
        x.meet(c);
      }
    },
  },
  // 카드 병정은 놀라면 벌렁 넘어졌다가 일어난다
  fallOver: {
    scaredTo: "fall",
    pitch: (c) => c.st === "fall",
    states: {
      fall(c, x) {
        c.t += x.dt;
        const dn = c.t < 1.9;
        const fallTilt = dn ? 1.5 : 0;
        const fallRate = dn ? 10 : 5;
        const fallEase = ease(fallRate, x.dt);
        c.pitch += (fallTilt - c.pitch) * fallEase;
        const fallDepth = Math.abs(c.pitch) / 1.5;
        c.sink = 0.64 * Math.min(1, fallDepth);
        if (c.t > 2.7) {
          c.st = "lookback";
          c.t = 1.2;
        }
      },
    },
  },
  // 주사위는 걷지 않고 데굴데굴 구른다. 멈추면 한 면으로 딱 앉는다
  roll: {
    before(c, sense, pose, x) {
      if (!c.lp) {
        c.lp = c.v.clone();
        c.tum = 0;
      }
      const mv = c.v.angleTo(c.lp) * S.R;
      c.lp.copy(c.v);
      if (mv > 1e-4 && mv < 3) {
        const rollR = c.batch.hh * 1.1;
        c.tum! += mv / rollR;
      } else {
        const quarter = Math.PI / 2;
        const quarters = c.tum! / quarter;
        const q = Math.round(quarters) * quarter;
        const settle = ease(9, x.dt);
        c.tum! += (q - c.tum!) * settle;
      }
      c.pitch = -c.tum!;
      const twice = 2 * c.tum!;
      const bobble = Math.sin(twice);
      c.sink = -0.22 * Math.abs(bobble);
    },
    pitch: () => true,
  },
  // 모자는 다가오면 꾸벅 인사한다
  bow: {
    before(c, sense, pose, x) {
      const { dP } = sense;
      if (c.st === "watch" && dP < 9 && !c.bowed) {
        c.st = "bow";
        c.t = 0;
        c.bowed = true;
      }
      if (c.st === "bow") {
        c.t += x.dt;
        const turn = ease(6, x.dt);
        face(c, x.s.player.p, turn);
        const bowT = c.t / 1.3;
        const bowK = Math.min(1, bowT);
        const bowAngle = bowK * Math.PI;
        c.pitch = -1.25 * Math.sin(bowAngle);
        pose.head = 0.5;
        if (c.t > 1.3) {
          c.st = "watch";
          c.pitch = 0;
          x.meet(c);
        }
      }
      if (dP > 22) c.bowed = false;
    },
    pitch: (c) => c.st === "bow",
  },
  // 장미는 빙그르르 돌며 꽃잎을 흩뿌린다
  spin: {
    before(c, sense, pose, x) {
      const dt = x.dt;
      if ((c.cd ?? 0) > 0) c.cd! -= dt;
      if (c.st === "watch" && sense.dP < 10 && !((c.cd ?? 0) > 0)) {
        c.st = "spin";
        c.t = 0;
      }
      if (c.st !== "spin") return;
      c.t += dt;
      const spinT = c.t / 1.8;
      const spinK = Math.min(1, spinT);
      const spinAngle = spinK * Math.PI;
      const k = Math.sin(spinAngle);
      const turn = 9 * k * dt;
      c.f.applyAxisAngle(c.v, turn).normalize();
      c.sink = -0.12 * k;
      c.bt = (c.bt || 0) - dt;
      if (c.bt <= 0) {
        c.bt = 0.16;
        x.s.fx.burst(c.pos, 3, 5);
      }
      if (c.t > 1.8) {
        c.st = "watch";
        c.cd = 7;
        x.meet(c);
      }
    },
  },
  // 컵케이크는 반가우면 제자리에서 폴짝폴짝 뛴다
  hopForJoy: {
    before(c, sense, pose, x) {
      if (c.st !== "watch" || sense.dP >= 10) return;
      c.jt = (c.jt || 0) - x.dt;
      if (c.jt <= 0 && c.hop <= 0) {
        c.jt = 0.75;
        c.hopV = 6.5;
        c.hop = 0.01;
        x.s.fx.burst(c.pos, 4, 6);
      }
    },
  },
  // 회중시계는 늦은 듯 허둥지둥 달려가다 뒤돌아 재촉한다. 따라가면 다른 무리에게 데려다준다
  lead: {
    before(c, sense, pose, x) {
      const dt = x.dt,
        p = x.s.player.p,
        { dP, scare, seen } = sense;
      const isIdle = c.st === "graze" || c.st === "wander" || c.st === "watch";
      if (isIdle && seen && !scare && !c.led) {
        const best = x.nearestOtherHerd(c);
        if (best.ctr && best.d < 170) {
          c.goal = best.ctr.clone();
          c.st = "lead";
          c.led = true;
          c.t = 0;
        }
      }
      if (c.st === "lead") {
        pose.head = 0.3;
        if (dP > 21) {
          c.st = "beckon";
          c.t = 0;
          return;
        }
        const d = go(c, c.goal!, 7.5, dt, 2.2);
        pose.amt = 1;
        if (c.hop <= 0 && c.hopV <= 0) {
          c.hopV = 3.2;
          c.hop = 0.01;
        }
        if (d < 7) {
          c.st = "graze";
          c.t = c.rng.range(3, 6);
          c.home.copy(c.v);
          c.hv = c.v.clone();
          x.meet(c);
          x.s.fx.burst(c.pos, 8, 8);
        }
      } else if (c.st === "beckon") {
        c.t += dt;
        const turn = ease(5, dt);
        face(c, p, turn);
        pose.head = 0.9;
        const urgePhase = c.t * 6;
        if (c.hop <= 0 && c.hopV <= 0 && Math.sin(urgePhase) > 0.9) {
          c.hopV = 4.5;
          c.hop = 0.01;
        }
        if (dP < 11) c.st = "lead";
        else if (c.t > 9 || dP > 70) {
          c.st = "graze";
          c.t = c.rng.range(2, 4);
          c.home.copy(c.v);
          c.hv = c.v.clone();
        }
      }
    },
  },
  // 전설의 라임 사슴: 달아나며 빛길을 남기고, 멈춰 서서 돌아본다. 세 번을 따라가면 기다렸다가 하늘 높이 쏘아 올려 준다
  bolt: {
    before(c, sense, pose, x) {
      const pl = x.s.player,
        dt = x.dt,
        { dP, dA } = sense;
      if ((c.cd ?? 0) > 0) c.cd! -= dt;
      const isIdle = c.st === "graze" || c.st === "wander" || c.st === "watch";
      if (isIdle && !((c.cd ?? 0) > 0) && dP < 18 && Math.abs(dA) < 8) {
        c.st = "bolt";
        c.t = 0;
        c.n = 0;
      }
      if (c.st === "bolt") {
        away(c, pl.p, 13, dt, 1.6);
        pose.amt = 1;
        pose.head = 0.4;
        c.t += dt;
        if (c.hop <= 0 && c.hopV <= 0) {
          c.hopV = 6;
          c.hop = 0.01;
        }
        c.bt = (c.bt || 0) - dt;
        if (c.bt <= 0) {
          c.bt = 0.07;
          x.s.fx.burst(c.pos, 2, 3);
        }
        if (c.t > 2.6 || dP > 45) {
          c.st = "gaze";
          c.t = 0;
          c.n!++;
        }
      } else if (c.st === "gaze") {
        const turn = ease(4, dt);
        face(c, pl.p, turn);
        pose.head = 0.9;
        c.t += dt;
        if (dP < 16 && Math.abs(dA) < 8) {
          c.st = c.n! >= 3 ? "gift" : "bolt";
          c.t = 0;
        } else if (c.t > 25 || dP > 140) settleHere(c, 3);
      } else if (c.st === "gift") {
        const turn = ease(4, dt);
        face(c, pl.p, turn);
        const nodPhase = x.time * 4;
        pose.head = 0.6 + 0.3 * Math.sin(nodPhase);
        c.bt = (c.bt || 0) - dt;
        if (c.bt <= 0) {
          c.bt = 0.12;
          x.s.fx.burst(c.pos, 3, 7);
        }
        if (!pl.held && dP < 4.5 && Math.abs(dA) < 5) {
          pl.bounce(17);
          x.meet(c);
          x.s.fx.burst(pl.P, 24, 14);
          settleHere(c, 4);
          c.cd = 40;
        } else if (dP > 90) settleHere(c, 3);
      }
    },
  },
  // 하늘의 날개 무리(열쇠 빼고)·날개 왕관: 다가오면 궤도를 벗어나 내 몸 둘레를 돈다. 한 번에 한 무리만
  // (여럿이 몰려들면 화면이 어수선하다). 왕관(전설)은 크게 빨라지게도 해 준다
  visit: {
    fly(c, sense, pose, x) {
      const pl = x.s.player,
        dt = x.dt,
        { dP, dA } = sense,
        V = x.visit;
      if ((c.vt ?? 0) > 0) c.vt! -= dt;
      else {
        c.vc = (c.vc || 0) - dt;
        const reach = c.legend ? 26 : 17,
          reachUp = c.legend ? 24 : 12;
        const isFree = V.t <= 0 || V.ctr === c.ctr;
        if (c.vc <= 0 && !pl.held && isFree && dP < reach && Math.abs(dA) < reachUp) {
          c.vt = 6;
          c.vc = 28;
          V.t = 9;
          V.ctr = c.ctr ?? null;
          x.meet(c);
          if (c.legend) {
            pl.boostAtLeast(2);
            x.s.fx.burst(pl.P, 20, 12);
          }
        }
      }
      if (!((c.vt ?? 0) > 0)) return false;
      const altA = pl.P.length() - S.R;
      const rr = c.legend ? 7 : 4.2,
        an = c.ang! + c.slot! * 120;
      c.ph += dt * 15;
      c.ang! += c.dir! * 75 * dt;
      offsetInto(nv, pl.p, rr, an);
      const lookAng = an + c.dir! * 14;
      offsetInto(lookAt, pl.p, rr, lookAng);
      const turn = ease(8, dt);
      face(c, lookAt, turn);
      const follow = ease(4, dt);
      c.v.lerp(nv, follow).normalize();
      const bobPhase = x.time * 2 + c.slot!;
      const targetA = altA + 0.7 + 0.5 * Math.sin(bobPhase);
      c.a += (targetA - c.a) * follow;
      pose.amt = 1;
      c.roll = -c.dir! * 0.42;
      return true;
    },
  },
};

/* ─── 내부 ─────────────────────────── */

// 달아나기를 마치고 그 자리를 새 집으로 삼아 풀을 뜯는다
function settleHere(c: Creature, t: number) {
  c.st = "graze";
  c.t = t;
  c.home.copy(c.v);
  c.hv = c.v.clone();
}
