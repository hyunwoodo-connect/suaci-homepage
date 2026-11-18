import * as THREE from "three";

import { ease } from "../core/frame";
import { STAGE } from "../hideseek/openTuning";
import { S } from "../settings";
import type { Creature, Pose } from "./creature";
import type { Day } from "./days";
import type { Resident } from "./resident";
import { arch, between, canJoin, crossed, PLACE_REACH, pulse, ringSpot, SNAPPY } from "./resident";
import type { Town } from "./town";

// 땅 위 종의 하루: 컵케이크 · 카드 병정 · 회중시계 · 찻주전자 · 토끼 · 모자 · 주사위 · 장미 · 버섯.
// 하루의 일은 단계(r.step)와 그 단계에 든 시간(r.stepT)으로 흐른다. 인사·버릇은 그것을 한 시간(r.actT)만 본다 — 하던 일의 단계를 건드리지 않아
// 인사를 마치면 하던 데서 이어 간다. 무리 일은 앞장(r.lead)의 값(가운데·시계)을 같이 본다

/** 내가 달려든다고 치는 빠르기(m/s) */
const RUSH = 5;

// ---- 컵케이크 ----
/** 케이크를 올려다보는 거리(m, 케이크 가장자리에서) · 둘러앉는 반지름(m) · 한 번 꾸벅하는 시간(초) · 줄 사이(m) */
const GAZE_GAP = 2.4,
  SIT_RING = 1.7,
  DOZE_SECONDS = 3.4,
  LINE_GAP = 1.9;
/** 체리를 떨어뜨리는 간격(초, 이 사이) · 떨어진 데까지(m) */
const BERRY_MIN = 14,
  BERRY_MAX = 26,
  BERRY_AHEAD = 1.5;

// ---- 카드 병정 ----
/** 행진: 한 번에 가는 거리(m)·빠르기(m/s)·앞뒤 간격(m) · "뒤로 돌아"에 드는 시간(초) · 맨 끝 병정이 늦는 반 박자(초) */
const MARCH_REACH = 10,
  MARCH_SPEED = 1.35,
  MARCH_GAP = 1.7,
  ABOUT_SECONDS = 1.8,
  HALF_BEAT = 0.35;
/** 보초: 랜드마크에서 떨어진 거리(m)·옆 간격(m)·조는 병정이 나오는 간격(초, 이 사이) */
const SENTRY_GAP = 3,
  SENTRY_SPACE = 1.6,
  SENTRY_DOZE_MIN = 5,
  SENTRY_DOZE_MAX = 8;

// ---- 회중시계 ----
/** 째깍 간격(초) · 급히 지나가는 동안 길을 비켜 주지 않는 시간(초)과 내 너머로 가는 거리(m) */
const TICK_SECONDS = 5,
  PASS_SECONDS = 2.6,
  PASS_BEYOND = 7;

// ---- 찻주전자 ----
/** 차를 따르는 거리(m) · 끓는 한 바퀴(초) */
const POUR_GAP = 2.3,
  BOIL_SECONDS = 5;

// ---- 주사위 ----
/** 둘이 눈을 겨루는 한 판(초) */
const DUEL_SECONDS = 4.4;
const FULL_TURN = Math.PI * 2;

// ---- 버섯 ----
/** 튕긴 뒤 갓이 출렁이는 시간(초) */
export const CAP_WOBBLE_SECONDS = 3.6;

const spot = new THREE.Vector3(),
  dir = new THREE.Vector3(),
  best = new THREE.Vector3();

/** 컵케이크 — 느긋한 먹보 */
export const CUPCAKE: Day = {
  chores: [
    {
      // ① 케이크·마카롱으로 뒤뚱뒤뚱 가서 한참 올려다본다
      can: (c, r, t) => t.place(c, "sweet") !== null,
      begin(c, r, t) {
        const cake = t.place(c, "sweet");
        if (!cake) return t.finish(r);
        const gap = cake.r + GAZE_GAP;
        t.beside(r.goal, cake.v, c, gap);
        r.aim.copy(cake.v);
      },
      run(c, r, t, pose) {
        if (r.step === 0) {
          if (t.walk(c, r, r.goal, 0.85, pose) < 0.5) t.next(r);
          dropCherry(c, r, t);
          return;
        }
        const W = t.W,
          swayPhase = t.time * 0.8 + c.an.x;
        t.turn(c, r.aim, 4);
        W.pitch = 0.3;
        W.yaw = 0.16 * Math.sin(swayPhase);
        W.isFree = false;
        pose.head = 1;
        // 군침이 돌아 가끔 폴짝
        r.tick -= t.dt;
        if (r.tick > 0) return;
        r.tick = c.rng.range(2.5, 4.5);
        t.hop(c, 1.9);
      },
    },
    {
      // ② 두세 마리가 둥글게 앉아 꾸벅꾸벅(위의 체리가 까딱). 곁에 없으면 혼자 앉아 존다
      begin(c, r, t) {
        r.goal.copy(c.v);
        t.clear(r.goal, SIT_RING);
        r.n = 1 + recruit(c, r, t, 1, 2);
      },
      run(c, r, t, pose) {
        const lead = r.lead ?? c,
          q = lead.res!,
          W = t.W;
        if (q.n > 1) ringSpot(spot, q.goal, SIT_RING, r.slot, q.n);
        else spot.copy(q.goal);
        if (r.step === 0) {
          if (t.walk(c, r, spot, 0.9, pose) < 0.35 || r.stepT > 9) t.next(r);
          return;
        }
        if (q.n > 1) t.turn(c, q.goal, 4);
        // 천천히 숙였다가 화들짝 든다
        const beat = (r.stepT + c.an.x) % DOZE_SECONDS,
          wakeAt = DOZE_SECONDS - 0.45,
          droop = between(beat, 0.3, wakeAt),
          wake = between(beat, wakeAt, DOZE_SECONDS);
        W.sink = 0.2;
        W.squash = 0.93 + 0.12 * arch(wake);
        W.pitch = -0.42 * droop * (1 - wake);
        W.isFree = false;
        pose.head = -0.6;
      },
    },
    {
      // ③ 한 줄로 산책(앞장은 동네를 돌고 나머지는 앞의 것을 따라간다)
      begin(c, r, t) {
        t.roam(r.goal, c, r, 12);
        recruit(c, r, t, 2, 3);
      },
      run(c, r, t, pose) {
        dropCherry(c, r, t);
        if (!r.lead) {
          if (r.step === 1) {
            if (r.stepT > 1) {
              t.roam(r.goal, c, r, 12);
              t.next(r, 0);
            }
            return;
          }
          if (t.walk(c, r, r.goal, 0.9, pose) < 0.6) t.next(r, 1);
          return;
        }
        const front = r.mate ?? r.lead,
          gap = t.dist(c.v, front.v);
        if (gap < LINE_GAP) {
          t.turn(c, front.v, 3);
          return;
        }
        const speed = gap > 3.4 ? 1.6 : 1;
        t.walk(c, r, front.v, speed, pose);
      },
    },
  ],
  // 체리를 까딱 숙여 인사
  greet(c, r, t) {
    const k = r.actT / 1.3,
      bow = arch(k);
    t.W.pitch = -0.55 * bow;
    t.W.squash = 1 - 0.05 * bow;
    return k >= 1;
  },
  // 걷다가 제 체리를 떨어뜨리고 허둥지둥 주워 올린다: 멈칫 → 종종걸음으로 가서 → 숙여 줍고 폴짝
  quirk(c, r, t, pose) {
    const W = t.W,
      T = r.actT;
    if (T < 0.45) {
      const shake = t.time * 26;
      W.squash = 1.1;
      W.yaw = 0.45 * Math.sin(shake);
      W.rate = SNAPPY;
      return false;
    }
    if (T < 1.5 && t.dist(c.v, r.actAim) > 0.5) {
      t.walk(c, r, r.actAim, 2.4, pose, 9);
      return false;
    }
    const stoop = between(T, 1.5, 1.75) - between(T, 1.95, 2.15);
    W.pitch = -0.75 * stoop;
    W.squash = 1 - 0.15 * stoop;
    if (crossed(T, t.dt, 2)) t.hop(c, 2.2);
    return T > 2.3;
  },
};

/** 카드 병정(셋) — 진지한데 허술하다. 맨 끝 병정은 늘 반 박자 늦는다 */
export const CARD: Day = {
  isDrilled: true,
  chores: [
    {
      // ① 줄 맞춰 행진. 모퉁이에서 "뒤로 돌아"가 엉켜 서로 부딪친다
      begin(c, r, t) {
        t.roam(r.goal, c, r, MARCH_REACH);
      },
      run(c, r, t, pose) {
        const lead = r.lead ?? c,
          q = lead.res!,
          W = t.W;
        W.squash = 1.04;
        W.isFree = false;
        if (q.step === 0) {
          r.mark = 0;
          if (lead !== c) {
            const back = MARCH_GAP * r.slot;
            fallIn(c, r, lead, t, pose, back);
            return;
          }
          const left = t.walk(c, r, r.goal, MARCH_SPEED, pose, 3.2);
          if (left < 0.6 || r.stepT > 9) t.next(r);
          return;
        }
        aboutFace(c, r, q.stepT, t);
        if (lead !== c || r.stepT < ABOUT_SECONDS) return;
        t.roam(r.goal, c, r, MARCH_REACH);
        t.next(r, 0);
      },
    },
    {
      // ② 랜드마크 앞에 나란히 서서 보초. 가끔 한 놈이 졸아 기우뚱 → 옆 놈이 툭 쳐서 깨운다
      can: (c, r, t) => t.place(c, "landmark") !== null,
      begin(c, r, t) {
        const mark = t.place(c, "landmark");
        if (!mark) return t.finish(r);
        const gap = mark.r + SENTRY_GAP;
        t.beside(r.goal, mark.v, c, gap);
        r.aim.copy(mark.v);
        r.u = c.rng.range(SENTRY_DOZE_MIN, SENTRY_DOZE_MAX);
        r.clock = 0;
        r.n = 1;
      },
      run(c, r, t, pose) {
        const lead = r.lead ?? c,
          q = lead.res!,
          W = t.W;
        post(spot, q, r.slot, q.size);
        if (t.dist(c.v, spot) > 0.4 && r.step === 0) {
          t.walk(c, r, spot, MARCH_SPEED, pose, 3.2);
          if (r.stepT > 10) t.next(r);
          return;
        }
        if (r.step === 0) t.next(r);
        // 랜드마크를 등지고 바깥을 본다
        dir.copy(c.v).multiplyScalar(2).sub(q.aim).normalize();
        t.turn(c, dir, 5);
        W.squash = 1.03;
        W.isFree = false;
        // 가끔 고개를 탁 돌려 살핀다
        const watchBeat = (t.time + c.an.x) % 2.8,
          whichWay = c.an.x > 3.14 ? 0.42 : -0.42;
        if (watchBeat < 0.45) {
          W.yaw = whichWay;
          W.rate = SNAPPY;
        }
        if (lead === c) {
          r.clock += t.dt;
          if (r.clock >= r.u) {
            r.clock = 0;
            r.u = c.rng.range(SENTRY_DOZE_MIN, SENTRY_DOZE_MAX);
            r.n++;
          }
        }
        dozeOnDuty(c, r, q, t);
      },
    },
    {
      // ③ 창을 세워 놓고 쉬어: 짝다리를 짚고 두리번, 가끔 기지개
      run(c, r, t) {
        const W = t.W,
          shift = t.time * 0.8 + c.an.x,
          beat = (t.time + c.an.x * 2) % 6.5,
          stretch = between(beat, 5.4, 5.8) - between(beat, 6.1, 6.5);
        W.squash = 0.96 + 0.13 * stretch;
        W.roll = 0.11 * Math.sin(shift);
        W.pitch = 0.14 * stretch;
      },
    },
  ],
  // 셋이 착 차렷, 맨 앞이 창을 들어 경례
  greet(c, r, t) {
    const T = r.actT - lateOf(r),
      W = t.W;
    if (T < 0) return false;
    W.squash = 1.08;
    W.rate = SNAPPY;
    if (r.slot === 0) {
      const lift = between(T, 0.3, 0.45) - between(T, 0.9, 1.1);
      W.squash = 1.08 + 0.1 * lift;
      W.pitch = -0.24 * lift;
      if (crossed(T, t.dt, 0.3)) t.hop(c, 1.6);
    }
    return T > 1.4;
  },
};

/** 회중시계 — 늘 바쁜 걱정꾼. 5초마다 째깍 하며 몸이 살짝 튄다 */
export const WATCH: Day = {
  always(c, r, t) {
    r.tick -= t.dt;
    if (r.tick > 0) return;
    r.tick = TICK_SECONDS;
    t.hop(c, 1.5);
    c.squash = 1.08;
  },
  chores: [
    {
      // ① 종종걸음으로 서둘러 감 → 멈춰서 제 뚜껑을 열어 시간 확인 → 깜짝 놀라 반대로 달림
      begin(c, r, t) {
        t.roam(r.goal, c, r, 14);
      },
      run(c, r, t, pose) {
        const W = t.W;
        if (r.step === 0) {
          const left = t.walk(c, r, r.goal, 3.1, pose, 8);
          if (left < 0.6 || r.stepT > 3.2) t.next(r);
          return;
        }
        if (r.step === 1) {
          W.pitch = -0.6;
          W.squash = 0.95;
          W.isFree = false;
          pose.head = -1;
          if (r.stepT < 1) return;
          t.hop(c, 3.2);
          t.next(r);
          return;
        }
        if (r.step === 2) {
          const shake = t.time * 40;
          W.squash = 1.14;
          W.pitch = 0.2;
          W.yaw = 0.3 * Math.sin(shake);
          W.rate = SNAPPY;
          W.isFree = false;
          if (r.stepT < 0.35) return;
          // 오던 쪽으로 되돌아 달린다
          dir.copy(c.f).negate();
          t.ahead(r.goal, c.v, dir, 9);
          if (t.dist(r.goal, t.hub) > t.radius - 2) t.roam(r.goal, c, r, 8);
          t.next(r);
          return;
        }
        const left = t.walk(c, r, r.goal, 4.4, pose, 6);
        if (left > 0.8 && r.stepT < 2.4) return;
        t.roam(r.goal, c, r, 14);
        t.next(r, 0);
      },
    },
    {
      // ② 벤치 옆을 왔다 갔다 서성인다
      can: (c, r, t) => t.place(c, "bench") !== null,
      begin(c, r, t) {
        const bench = t.place(c, "bench");
        if (!bench) return t.finish(r);
        const gap = bench.r + 1.6;
        t.beside(r.aim, bench.v, c, gap);
        r.goal.copy(r.aim);
        r.u = 1;
      },
      run(c, r, t, pose) {
        if (r.step === 2) {
          // 돌아설 때마다 시계를 본다
          t.W.pitch = -0.5;
          t.W.isFree = false;
          if (r.stepT > 0.55) t.next(r, 1);
          return;
        }
        if (t.walk(c, r, r.goal, 1.8, pose, 6) > 0.4 && r.stepT < 5) return;
        // 벤치를 끼고 좌우로 2.2m 씩
        dir.crossVectors(r.aim, c.f).normalize();
        r.u = -r.u;
        const far = 2.2 * r.u;
        t.ahead(r.goal, r.aim, dir, far);
        t.next(r, 2);
      },
    },
    {
      // ③ 토끼를 만나면 같이 달린다(토끼가 서 있으면 곁에서 발을 구르며 재촉한다)
      can: (c, r, t) => t.find(c, PLACE_REACH, isRabbit) !== null,
      begin(c, r, t) {
        r.mate = t.find(c, PLACE_REACH, isRabbit);
      },
      run(c, r, t, pose) {
        const pal = r.mate;
        if (!pal || pal.st === "guide") return t.finish(r);
        dir.crossVectors(pal.f, pal.v).normalize();
        t.ahead(spot, pal.v, dir, 1.6);
        const gap = t.dist(c.v, spot);
        if (gap > 0.7) {
          const speed = gap > 3 ? 4.6 : 3;
          t.walk(c, r, spot, speed, pose, 7);
          if (pal.hop > 0) t.hop(c, 2);
          return;
        }
        const peekPhase = t.time * 3;
        t.turn(c, pal.v, 5);
        t.hop(c, 1.3);
        t.W.pitch = Math.sin(peekPhase) > 0.6 ? -0.45 : 0;
        t.W.isFree = false;
      },
    },
  ],
  // 뚜껑을 탁 열어 보이고
  greet(c, r, t) {
    const T = r.actT,
      flip = between(T, 0.15, 0.28) - between(T, 0.62, 0.8);
    t.W.pitch = 0.5 * flip;
    t.W.squash = 1 + 0.1 * flip;
    t.W.rate = SNAPPY;
    return T > 0.9;
  },
  // 급히 지나간다: 내 옆을 스쳐 내 너머로 달린다(그동안은 길을 비키지 않는다)
  afterGreet(c, r, t) {
    const along = t.p.dot(c.v);
    dir.copy(t.p).addScaledVector(c.v, -along);
    if (dir.lengthSq() < 1e-12) dir.copy(c.f);
    dir.normalize();
    const far = t.dist(c.v, t.p) + PASS_BEYOND;
    t.ahead(r.goal, c.v, dir, far);
    // 나를 뚫고 가지 않게 옆으로 두 걸음 비껴 잡는다
    spot.crossVectors(c.v, dir).normalize();
    t.ahead(r.goal, r.goal, spot, 2.5);
    r.chore = 0;
    r.choreT = 6;
    r.lead = null;
    r.bold = PASS_SECONDS;
    t.next(r, 3);
  },
};

/** 찻주전자 — 수다쟁이 어른. 화나면(내가 3m 안으로 달려들면) 김을 확 뿜고 뒤뚱뒤뚱 물러난다 */
export const TEAPOT: Day = {
  always(c, r, t, pose, dP) {
    const isRushed = dP < 3 && t.pspd > RUSH;
    if (!isRushed || r.quirkCd > 0 || r.act === "quirk" || t.isBusy) return;
    r.quirkCd = 8;
    t.quirk(r, 2.2, t.p);
  },
  quirk(c, r, t, pose) {
    const W = t.W,
      top = c.batch.hh * 0.9;
    if (r.actT < 0.4) {
      W.squash = 1.16;
      W.rate = SNAPPY;
      if (pulse(t.time, t.dt, 16)) t.puff("steam", c, top);
      return false;
    }
    t.backOff(c, r.actAim, 1.6, pose);
    return false;
  },
  chores: [
    {
      // ① 다른 생물 앞에 가서 몸을 기울여 차를 따라 준다(김 한 줄기)
      can: (c, r, t) => t.find(c, PLACE_REACH, isTeaGuest) !== null,
      begin(c, r, t) {
        const roll = c.rng.next() * 8,
          skip = Math.floor(roll);
        r.n = skip;
        r.mate = t.nth(c, PLACE_REACH, skip, isTeaGuest);
      },
      run(c, r, t, pose) {
        const pal = r.mate,
          W = t.W;
        if (!pal || pal.st === "guide") return t.finish(r);
        if (r.step === 0) {
          t.beside(spot, pal.v, c, POUR_GAP);
          if (t.walk(c, r, spot, 1.05, pose) < 0.4 || r.stepT > 7) t.next(r);
          return;
        }
        t.turn(c, pal.v, 5);
        W.isFree = false;
        if (r.step === 1) {
          const lean = between(r.stepT, 0, 0.5),
            spout = c.batch.rw * 0.9;
          W.pitch = -0.45 * lean;
          if (r.stepT > 0.5 && pulse(t.time, t.dt, 5)) t.puff("steam", c, 0.2, spout);
          if (crossed(r.stepT, t.dt, 1.1)) t.cue(pal, "joy", 0.9, c.v);
          if (r.stepT > 2.4) t.next(r);
          return;
        }
        // 허리를 펴고 다음 손님에게
        if (r.stepT < 0.7) return;
        r.n++;
        r.mate = t.nth(c, PLACE_REACH, r.n, isTeaGuest);
        t.next(r, 0);
      },
    },
    {
      // ② 제자리에서 뚜껑을 들썩이며 끓는다: 달아오르다 → 삐익 김을 뿜고 → 한숨
      run(c, r, t) {
        const W = t.W,
          beat = r.stepT % BOIL_SECONDS,
          heat = between(beat, 0, 3.2),
          isBlowing = beat > 3.2 && beat < 3.8,
          rattlePhase = t.time * 40,
          rattle = 0.045 * heat * Math.sin(rattlePhase),
          top = c.batch.hh * 0.9,
          steamRate = isBlowing ? 14 : 0.6 + 4 * heat;
        W.squash = isBlowing ? 1.15 : beat > 3.8 ? 0.96 : 1 + rattle;
        W.rate = SNAPPY;
        W.isFree = beat > 3.8;
        if (pulse(t.time, t.dt, steamRate)) t.puff("steam", c, top);
        if (isBlowing) t.hop(c, 1.8);
      },
    },
    {
      // ③ 뒷짐 진 듯 천천히 순찰. 멈춰 서면 헛기침 한 번
      begin(c, r, t) {
        t.roam(r.goal, c, r, 14);
      },
      run(c, r, t, pose) {
        const W = t.W,
          top = c.batch.hh * 0.9;
        W.pitch = 0.08;
        if (r.step === 0) {
          const lookPhase = t.time * 0.9 + c.an.x;
          W.yaw = 0.4 * Math.sin(lookPhase);
          W.isFree = false;
          if (t.walk(c, r, r.goal, 0.7, pose) < 0.6) t.next(r);
          return;
        }
        const hem = between(r.stepT, 0.4, 0.6) - between(r.stepT, 0.7, 0.9);
        W.squash = 1 + 0.07 * hem;
        if (crossed(r.stepT, t.dt, 0.6)) t.puff("steam", c, top);
        if (r.stepT < 1.7) return;
        t.roam(r.goal, c, r, 14);
        t.next(r, 0);
      },
    },
  ],
  // 뚜껑을 한 번 들었다 놓는다(모자 인사)
  greet(c, r, t) {
    const T = r.actT,
      lift = between(T, 0.25, 0.4) - between(T, 0.7, 0.9);
    t.W.squash = 1 + 0.15 * lift;
    if (crossed(T, t.dt, 0.25)) t.hop(c, 1.2);
    return T > 1.2;
  },
};

/** 토끼 — 호기심 많은 겁쟁이. 내가 빨리 다가가면 3m 물러났다가 슬금슬금 돌아온다 */
export const RABBIT: Day = {
  always(c, r, t, pose, dP) {
    const isRushed = dP < 7 && t.pspd > RUSH;
    if (!isRushed || r.quirkCd > 0 || r.act === "quirk" || t.isBusy) return;
    r.quirkCd = 10;
    t.quirk(r, 0, c.v);
  },
  quirk(c, r, t, pose) {
    const W = t.W;
    if (r.actT < 0.75) {
      t.backOff(c, t.p, 4.2, pose);
      t.hop(c, 3.4);
      return false;
    }
    // 몸을 낮추고 살금살금 제자리로(통통 뛰지 않는다)
    W.squash = 0.88;
    W.pitch = -0.1;
    W.isGliding = true;
    const left = t.walk(c, r, r.actAim, 0.75, pose);
    return left < 0.5 || r.actT > 6 || t.dist(c.v, t.p) < 2.5;
  },
  chores: [
    {
      // ① 깡충깡충 뛰다 멈춰 몸을 쭉 세워 둘러본다
      begin(c, r, t) {
        t.roam(r.goal, c, r, 10);
      },
      run(c, r, t, pose) {
        const W = t.W;
        if (r.step === 0) {
          if (t.walk(c, r, r.goal, 3.2, pose, 3) < 0.6) t.next(r);
          return;
        }
        const sweep = r.stepT * 2.6;
        W.squash = 1.22;
        W.pitch = 0.1;
        W.yaw = 0.65 * Math.sin(sweep);
        W.isFree = false;
        pose.head = 1;
        if (r.stepT < 2.4) return;
        t.roam(r.goal, c, r, 10);
        t.next(r, 0);
      },
    },
    {
      // ② 큰 꽃 밑에서 냄새 맡듯 까딱까딱
      can: (c, r, t) => t.place(c, "flower") !== null,
      begin(c, r, t) {
        const flower = t.place(c, "flower");
        if (!flower) return t.finish(r);
        const gap = flower.r + 1.2;
        t.beside(r.goal, flower.v, c, gap);
        r.aim.copy(flower.v);
      },
      run(c, r, t, pose) {
        const W = t.W;
        if (r.step === 0) {
          if (t.walk(c, r, r.goal, 2.6, pose, 3) < 0.5) t.next(r);
          return;
        }
        const sniff = t.time * 10;
        t.turn(c, r.aim, 5);
        W.pitch = -0.32 - 0.09 * Math.sin(sniff);
        W.squash = 0.95;
        W.isFree = false;
        pose.head = -0.6;
        // 자리를 조금 옮겨 다시 맡는다
        if (r.stepT < 3) return;
        t.hop(c, 2.4);
        t.next(r, 1);
      },
    },
    {
      // ③ 다른 토끼와 술래잡기(잡히면 술래가 바뀐다)
      can: (c, r, t) => t.find(c, PLACE_REACH, isFreeKin) !== null,
      begin(c, r, t) {
        const pal = t.find(c, PLACE_REACH, isFreeKin);
        if (!pal || !t.enlist(pal, c, 2, 1, r.choreT)) return t.finish(r);
        r.mate = pal;
        r.u = 1;
        r.w = 0;
      },
      run(c, r, t, pose) {
        const lead = r.lead ?? c,
          q = lead.res!,
          pal = r.lead ?? r.mate,
          W = t.W;
        if (!pal || pal.st === "guide" || pal.res?.chore !== 2) return t.finish(r);
        if (lead === c) {
          r.w -= t.dt;
          if (t.dist(c.v, pal.v) < 1.4 && r.w <= 0) {
            r.u = 1 - r.u;
            r.w = 0.7;
            t.hop(c, 3.6);
            t.hop(pal, 3.6);
          }
        }
        const isIt = lead === c ? q.u === 1 : q.u === 0;
        if (isIt) {
          // 방금 술래가 됐으면 잠깐 웅크려 센다
          if (q.w > 0) {
            W.squash = 0.86;
            W.isFree = false;
            t.turn(c, pal.v, 8);
            return;
          }
          t.walk(c, r, pal.v, 4.7, pose, 3);
          return;
        }
        const isLost = r.step === 0 || r.stepT > 2.2 || t.dist(c.v, r.goal) < 1.2;
        if (isLost) {
          fleeSpot(c, r, t, pal);
          t.next(r, 1);
        }
        t.walk(c, r, r.goal, 4.3, pose, 3);
      },
    },
  ],
  // 몸을 세워 나를 보다가 한 번 폴짝
  greet(c, r, t, pose) {
    const T = r.actT;
    t.W.squash = T < 0.95 ? 1.2 : 1;
    t.W.pitch = 0.08;
    pose.head = 1;
    if (crossed(T, t.dt, 0.95)) t.hop(c, 3.8);
    return T > 1.5;
  },
};

/** 모자 — 장난꾸러기 마술사. 가끔 제풀에 뒤집혀서 버둥대다 일어난다 */
export const HAT: Day = {
  always(c, r, t) {
    const isCalm = r.act === "chore" && r.lift < 0.2 && !r.isGliding;
    if (!isCalm || r.quirkCd > 0 || t.isBusy) return;
    r.quirkCd = c.rng.range(20, 34);
    t.quirk(r, 2.4, c.v);
  },
  quirk(c, r, t) {
    const W = t.W,
      T = r.actT,
      down = between(T, 0, 0.35) - between(T, 1.9, 2.3),
      flail = t.time * 15,
      shiver = t.time * 22;
    W.pitch = 2.9 * down;
    W.roll = 0.3 * down * Math.sin(flail);
    W.squash = 1 + 0.06 * down * Math.sin(shiver);
    W.rate = SNAPPY * 0.6;
    if (crossed(T, t.dt, 1.9)) t.hop(c, 2.6);
    return false;
  },
  chores: [
    {
      // ① 통통 튀어 다니다 멈춰서 뒤집혀 안에서 뭔가(꽃·쪽지·리본) 꺼냈다 도로 삼킨다
      begin(c, r, t) {
        t.roam(r.goal, c, r, 8);
      },
      run(c, r, t, pose) {
        const W = t.W;
        if (r.step === 0) {
          if (t.walk(c, r, r.goal, 2.3, pose, 3) < 0.6) t.next(r);
          return;
        }
        const T = r.stepT,
          flip = between(T, 0, 0.45) - between(T, 1.9, 2.3),
          gulp = between(T, 1.6, 1.75) - between(T, 1.8, 1.95),
          brim = c.batch.hh * 0.8;
        W.pitch = -Math.PI * flip;
        W.squash = 1 - 0.15 * gulp;
        W.rate = SNAPPY * 0.6;
        W.isFree = false;
        const trick = HAT_TRICKS[r.n % 3];
        if (crossed(T, t.dt, 0.6)) t.puff(trick, c, brim);
        if (crossed(T, t.dt, 1.9)) t.hop(c, 2.4);
        if (T < 2.5) return;
        r.n++;
        t.roam(r.goal, c, r, 8);
        t.next(r, 0);
      },
    },
    {
      // ② 다른 생물 머리 위에 슬쩍 올라앉았다 들키면 달아난다
      can: (c, r, t) => t.find(c, PLACE_REACH, isHatStand) !== null,
      begin(c, r, t) {
        r.mate = t.find(c, PLACE_REACH, isHatStand);
        r.u = c.rng.range(2.5, 4);
      },
      run(c, r, t, pose) {
        const host = r.mate,
          W = t.W;
        if (!host || host.st === "guide") return t.finish(r);
        if (r.step === 0) {
          // 가까워지면 몸을 낮추고 살금살금
          const gap = t.dist(c.v, host.v),
            isSneaking = gap < 6;
          r.isGliding = isSneaking;
          if (isSneaking) {
            W.squash = 0.9;
            t.hop(c, 1.7);
          }
          const speed = isSneaking ? 1.5 : 2.4;
          t.walk(c, r, host.v, speed, pose, 3);
          if (gap < 1.6) {
            t.hop(c, 3.2);
            t.next(r);
          } else if (r.stepT > 9) t.finish(r);
          return;
        }
        if (r.step === 1) {
          // 머리 위에 올라앉아 시치미
          const smug = t.time * 2;
          r.isGliding = true;
          c.v.copy(host.v);
          dir.copy(host.v).addScaledVector(host.f, 0.01);
          t.turn(c, dir, 3);
          W.lift = host.batch.hh * 2 * host.squash + host.hop;
          W.squash = 0.94;
          W.yaw = 0.25 * Math.sin(smug);
          W.isFree = false;
          if (r.stepT < r.u) return;
          // 들켰다: 밑의 생물이 움찔하고 모자는 뛰어내려 달아난다
          t.cue(host, "joy", 0.5, c.v);
          t.roam(r.goal, c, r, 9);
          t.hop(c, 3.2);
          t.next(r);
          return;
        }
        r.isGliding = false;
        const left = t.walk(c, r, r.goal, 4.2, pose, 3);
        if (left > 1 && r.stepT < 2.5) return;
        r.n++;
        r.mate = t.nth(c, PLACE_REACH, r.n, isHatStand);
        r.u = c.rng.range(2.5, 4);
        t.next(r, 0);
      },
    },
    {
      // ③ 빙글빙글 돌며 낮게 떠다닌다
      begin(c, r, t) {
        t.roam(r.goal, c, r, 9);
        r.w = 0;
      },
      run(c, r, t, pose) {
        const W = t.W,
          bob = t.time * 1.6 + c.an.x;
        r.isGliding = true;
        r.w = (r.w + t.dt * 2.6) % 6.283;
        c.yaw = r.w;
        W.yaw = r.w;
        W.lift = 0.75 + 0.2 * Math.sin(bob);
        W.isFree = false;
        if (t.walk(c, r, r.goal, 0.8, pose) < 0.6) t.roam(r.goal, c, r, 9);
        pose.amt = 0.1;
      },
    },
  ],
  // 챙을 까딱(위아래로 한 번 기울인다)
  greet(c, r, t) {
    const k = r.actT / 1;
    t.W.pitch = -0.55 * arch(k);
    return k >= 1;
  },
};

/** 주사위 — 변덕쟁이. 걷지 않고 데굴데굴 구르고, 멈춘 뒤 0.5초 흔들흔들하다 선다 */
export const DICE: Day = {
  always(c, r, t) {
    const W = t.W;
    if (!c.lp) {
      c.lp = c.v.clone();
      c.tum = 0;
    }
    const moved = t.dist(c.v, c.lp),
      isRolling = moved > 1e-4 && moved < 3;
    c.lp.copy(c.v);
    if (isRolling) {
      const wheel = c.batch.hh * 1.1;
      c.tum += moved / wheel;
    } else if (r.spin !== 0) c.tum += r.spin * t.dt;
    else {
      // 멈추면 한 면으로 딱 앉는다
      const quarter = Math.PI / 2,
        turns = c.tum / quarter,
        face = Math.round(turns) * quarter,
        settle = ease(9, t.dt);
      c.tum += (face - c.tum) * settle;
    }
    // 구른 각은 한 바퀴 안에서만 센다(몇 바퀴째인지는 보이지 않는다)
    if (c.tum > FULL_TURN) c.tum -= FULL_TURN;
    if (r.wasMoving && !isRolling && r.spin === 0) r.wobble = 0.5;
    r.wasMoving = isRolling || r.spin !== 0;
    r.spin = 0;
    const twice = 2 * c.tum,
      bobble = Math.sin(twice),
      rock = t.time * 24,
      fade = Math.max(0, r.wobble) / 0.5;
    W.tumble = -c.tum;
    W.sink = -0.22 * Math.abs(bobble);
    W.roll = 0.2 * fade * Math.sin(rock);
    r.isGliding = true;
  },
  chores: [
    {
      // ① 데굴데굴 굴러 다니다, 멈출 때마다 윗면을 확인하고 좋아하거나(폴짝) 실망(납작)
      begin(c, r, t) {
        t.roam(r.goal, c, r, 10);
      },
      run(c, r, t, pose) {
        const W = t.W;
        if (r.step === 0) {
          if (rollTo(c, r, t, pose, r.goal, 2.6) < 0.5) t.next(r);
          return;
        }
        if (r.step === 1) {
          // 윗면을 들여다본다
          W.squash = r.stepT > 0.5 ? 1.07 : 1;
          if (r.stepT < 1.1) return;
          r.u = c.rng.next() < 0.5 ? 1 : -1;
          if (r.u > 0) t.hop(c, 3.4);
          t.next(r);
          return;
        }
        W.squash = r.u > 0 ? 1.08 : 0.7;
        if (r.stepT < 1) return;
        t.roam(r.goal, c, r, 10);
        t.next(r, 0);
      },
    },
    {
      // ② 둘이 만나면 서로 굴려 눈을 겨룬다: 하나씩 높이 던져 구르고, 이긴 쪽은 폴짝·진 쪽은 납작
      can: (c, r, t) => t.find(c, PLACE_REACH, isFreeKin) !== null,
      begin(c, r, t) {
        const pal = t.find(c, PLACE_REACH, isFreeKin);
        if (!pal || !t.enlist(pal, c, 1, 1, r.choreT)) return t.finish(r);
        r.mate = pal;
        r.slot = 0;
        r.goal.copy(c.v).add(pal.v).normalize();
        t.clear(r.goal, 1.6);
        r.clock = 0;
        r.u = 0;
      },
      run(c, r, t, pose) {
        const lead = r.lead ?? c,
          q = lead.res!,
          W = t.W;
        ringSpot(spot, q.goal, 1.4, r.slot, 2);
        if (r.step === 0) {
          if (rollTo(c, r, t, pose, spot, 2.4) < 0.4 || r.stepT > 8) t.next(r);
          return;
        }
        t.turn(c, q.goal, 5);
        if (lead === c) {
          r.clock += t.dt;
          // 판마다 이기는 쪽을 새로 정한다
          const isNewRound = r.clock % DUEL_SECONDS < t.dt;
          if (isNewRound) r.u = c.rng.next() < 0.5 ? 0 : 1;
        }
        const beat = q.clock % DUEL_SECONDS,
          tossAt = r.slot * 1.1,
          launchAt = tossAt + 0.05;
        if (crossed(beat, t.dt, launchAt)) t.hop(c, 5.2);
        if (beat > tossAt && beat < tossAt + 1 && c.hop > 0) r.spin = 11;
        if (beat < 2.4) return;
        if (q.u === r.slot) t.hop(c, 3);
        else W.squash = 0.72;
      },
    },
    {
      // ③ 경사에서 일부러 굴러 내려간다(다시 느릿느릿 올라와 또)
      can: (c, r, t) => t.downhill(spot, c),
      begin(c, r, t) {
        if (!t.downhill(r.goal, c)) return t.finish(r);
        r.aim.copy(c.v);
      },
      run(c, r, t, pose) {
        if (r.step === 0) {
          if (rollTo(c, r, t, pose, r.goal, 4.6) < 0.5) t.next(r);
          return;
        }
        if (r.step === 1) {
          if (r.stepT > 0.9) t.next(r);
          return;
        }
        if (rollTo(c, r, t, pose, r.aim, 1.1) < 0.5 || r.stepT > 9) t.next(r, 0);
      },
    },
  ],
  // 한 바퀴 굴러 보이고 멈춘다
  greet(c, r, t) {
    const T = r.actT;
    if (crossed(T, t.dt, 0.1)) t.hop(c, 1.8);
    if (T > 0.15 && T < 0.75) r.spin = 10.5;
    return T > 1.4;
  },
};

/** 장미 — 수줍음이 많다. 다른 생물이 가까이 오면 살짝 붉어진다(마을이 본다 — isShy) */
export const ROSE: Day = {
  isShy: true,
  always(c, r) {
    if (r.wobble > 0) c.swell = 1.06;
  },
  chores: [
    {
      // ① 양지에서 꽃잎을 활짝 폈다 오므렸다
      run(c, r, t) {
        const W = t.W,
          phase = r.stepT * 1.5,
          open = Math.sin(phase),
          top = c.batch.hh * 0.8;
        W.squash = 1 - 0.13 * open;
        W.swell = 1 + 0.05 * open;
        W.pitch = 0.08 * open;
        if (open > 0.92 && pulse(t.time, t.dt, 3)) t.puff("spark", c, top);
      },
    },
    {
      // ② 큰 꽃 옆에 가서 나란히 서서 꽃인 척(바람에 흔들리는 것만 따라 한다)
      can: (c, r, t) => t.place(c, "flower") !== null,
      begin(c, r, t) {
        const flower = t.place(c, "flower");
        if (!flower) return t.finish(r);
        const gap = flower.r + 1.4;
        t.beside(r.goal, flower.v, c, gap);
      },
      run(c, r, t, pose) {
        const W = t.W;
        r.isGliding = true;
        if (r.step === 0) {
          if (t.walk(c, r, r.goal, 0.6, pose) < 0.4) t.next(r);
          pose.amt = 0;
          return;
        }
        const wind = t.time * 1.3;
        W.squash = 1.06;
        W.roll = 0.07 * Math.sin(wind);
        W.isFree = false;
      },
    },
    {
      // ③ 천천히 미끄러지듯 자리를 옮긴다
      begin(c, r, t) {
        t.roam(r.goal, c, r, 9);
      },
      run(c, r, t, pose) {
        const W = t.W,
          breath = t.time * 2;
        r.isGliding = true;
        if (r.step === 1) {
          if (r.stepT < 1.3) return;
          t.roam(r.goal, c, r, 9);
          t.next(r, 0);
          return;
        }
        W.pitch = -0.05;
        W.swell = 1 + 0.02 * Math.sin(breath);
        if (t.walk(c, r, r.goal, 0.55, pose) < 0.5) t.next(r, 1);
        pose.amt = 0;
      },
    },
  ],
  // 봉오리로 오므리고 반쯤 숙인다. 내가 지나가면 다시 핀다
  greet(c, r, t) {
    const W = t.W,
      T = r.actT,
      isNear = t.dist(c.v, t.p) < STAGE.npc.greetReach * 0.95 && T < 5;
    if (r.actStep === 0) {
      const fold = between(T, 0, 0.6);
      W.squash = 1 + 0.17 * fold;
      W.swell = 1 - 0.1 * fold;
      W.pitch = -0.45 * fold;
      if (isNear || T < 1.2) return false;
      r.actStep = 1;
      r.actClock = T;
      return false;
    }
    const k = (T - r.actClock) / 0.7,
      bloom = arch(k),
      top = c.batch.hh * 0.8;
    W.squash = 1 - 0.14 * bloom;
    W.swell = 1 + 0.08 * bloom;
    if (k < 0.5 && pulse(t.time, t.dt, 9)) t.puff("spark", c, top);
    return k >= 1;
  },
};

/** 버섯 — 태평한 낮잠꾼. 자리를 옮기지 않는다. 올라선 나를 튕긴 뒤에는 갓이 한참 출렁인다 */
export const MUSHROOM: Day = {
  isRooted: true,
  always(c, r, t) {
    if (r.wobble <= 0) return;
    const W = t.W,
      k = r.wobble / CAP_WOBBLE_SECONDS,
      bounce = t.time * 13,
      lean = t.time * 9;
    W.squash = 1 + 0.17 * k * k * Math.sin(bounce);
    W.roll = 0.08 * k * Math.sin(lean);
    W.rate = SNAPPY;
    W.isFree = false;
  },
  chores: [
    {
      // ① 갓을 부풀렸다 줄였다(숨)
      run(c, r, t) {
        if (r.wobble > 0) return;
        const breath = r.stepT * 1.7,
          swell = Math.sin(breath);
        t.W.squash = 1 + 0.08 * swell;
        t.W.swell = 1 - 0.03 * swell;
      },
    },
    {
      // ② 꾸벅꾸벅 졸다 갓이 기울어 화들짝
      run(c, r, t) {
        if (r.wobble > 0) return;
        const W = t.W,
          beat = r.stepT % 5.2,
          droop = between(beat, 0.4, 3.8),
          isAwake = beat > 4.2,
          whichWay = c.an.x > 3.14 ? 1 : -1,
          shake = t.time * 30;
        W.roll = isAwake ? 0 : 0.42 * whichWay * droop;
        W.pitch = isAwake ? 0 : -0.12 * droop;
        W.squash = isAwake && beat < 4.5 ? 1.14 : 1;
        W.yaw = isAwake && beat < 4.7 ? 0.3 * Math.sin(shake) : 0;
        W.rate = isAwake ? SNAPPY : W.rate;
        W.isFree = isAwake && beat > 4.7;
      },
    },
    {
      // ③ 비 오듯 포자 반짝이를 톡 뿜는다
      run(c, r, t) {
        if (r.wobble > 0) return;
        const W = t.W,
          beat = r.stepT % 3.4,
          crouch = between(beat, 2.5, 2.9) - between(beat, 2.9, 3),
          pop = between(beat, 2.95, 3.05) - between(beat, 3.2, 3.4),
          top = c.batch.hh * 0.9;
        W.squash = 1 - 0.14 * crouch + 0.13 * pop;
        if (beat > 3 && beat < 3.22 && pulse(t.time, t.dt, 30)) t.puff("spark", c, top);
      },
    },
  ],
  // 갓을 한 번 통 튕긴다
  greet(c, r, t) {
    const T = r.actT,
      press = between(T, 0, 0.15) - between(T, 0.25, 0.35),
      spring = between(T, 0.3, 0.4) - between(T, 0.55, 0.8);
    t.W.squash = 1 - 0.2 * press + 0.16 * spring;
    t.W.rate = SNAPPY;
    return T > 0.9;
  },
};

/* ─── 내부 ─────────────────────────── */

/** 모자가 꺼내는 것(돌려 가며) */
const HAT_TRICKS = ["flower", "slip", "charm"] as const;

// 같은 종이고 내 무리 일에 끼워도 되는(제 하루를 살고, 남의 일에 끼지 않았고, 제 일을 막 시작한 것이 아닌) 주민인가
function isFreeKin(other: Creature, self: Creature): boolean {
  const q = other.res;
  return other.k === self.k && q !== null && canJoin(q, STAGE.npc.choreSeconds[0]);
}

function isRabbit(other: Creature): boolean {
  return other.k === "brabbit";
}

// 차를 받을 손님: 찻주전자가 아닌 주민(날개 찻잔도 받는다)
function isTeaGuest(other: Creature, self: Creature): boolean {
  return other.k !== self.k && other.res?.act === "chore";
}

// 모자가 올라앉을 머리: 땅 위를 걷는 다른 종(버섯은 내가 올라설 자리라 비워 둔다)
function isHatStand(other: Creature, self: Creature): boolean {
  const isWalker = other.role === "herd" && other.k !== "mushroom" && other.k !== self.k;
  return isWalker && other.res?.act === "chore" && other.res.lift < 0.2;
}

// 곁의 같은 종을 내 일에 끼운다(most 마리까지 — 끼운 수). 앞의 것을 따라가게 차례로 잇는다
function recruit(c: Creature, r: Resident, t: Town, chore: number, most: number): number {
  let joined = 0,
    front = c;
  r.slot = 0;
  for (let k = 0; k < most; k++) {
    const pal = t.find(c, PLACE_REACH, isFreeKin),
      slot = joined + 1;
    if (!pal || !t.enlist(pal, c, chore, slot, r.choreT)) break;
    pal.res!.mate = front;
    front = pal;
    joined++;
  }
  return joined;
}

// 컵케이크의 버릇: 걷다가 가끔 제 체리를 떨어뜨린다(떨어진 자리로 허둥지둥 주우러 간다)
function dropCherry(c: Creature, r: Resident, t: Town) {
  if (r.quirkCd > 0 || t.isBusy || !c.visible) return;
  r.quirkCd = c.rng.range(BERRY_MIN, BERRY_MAX);
  t.dropBerry(c);
  t.ahead(spot, c.v, c.f, BERRY_AHEAD);
  t.quirk(r, 0, spot);
}

// 맨 끝 병정이 늦는 시간(초)
function lateOf(r: Resident): number {
  return r.size > 1 && r.slot === r.size - 1 ? HALF_BEAT : 0;
}

// 줄을 맞춘다: 앞장의 뒤 back(m) 자리로. 맨 끝 병정은 처지다가 폴짝 뛰어 따라붙는다
function fallIn(c: Creature, r: Resident, lead: Creature, t: Town, pose: Pose, back: number) {
  dir.copy(lead.f).negate();
  t.ahead(spot, lead.v, dir, back);
  const gap = t.dist(c.v, spot),
    isLast = lateOf(r) > 0;
  if (gap < 0.35) {
    dir.copy(c.v).addScaledVector(lead.f, 0.01);
    t.turn(c, dir, 5);
    return;
  }
  const hurry = gap > 1.5 ? 1.5 : 1,
    lag = isLast ? 0.85 : 1,
    speed = MARCH_SPEED * hurry * lag;
  t.walk(c, r, spot, speed, pose, 3.2);
  if (isLast && gap > 1.3) t.hop(c, 1.7);
}

// "뒤로 돌아": 맨 앞은 왼쪽으로, 둘째는 오른쪽으로(틀렸다), 맨 끝은 반 박자 늦게 돈다 → 서로 부딪쳐 휘청
function aboutFace(c: Creature, r: Resident, clock: number, t: Town) {
  const W = t.W,
    T = clock - r.slot * 0.08 - lateOf(r),
    whichWay = r.slot % 2 === 0 ? 1 : -1,
    turned = between(T, 0, 0.45);
  W.rate = SNAPPY;
  if (r.mark === 0) {
    W.yaw = Math.PI * whichWay * turned;
    if (turned >= 1) {
      // 다 돌았다: 보는 쪽을 뒤집고 더 돌린 각을 거둔다(그림은 그대로 이어진다)
      c.f.negate();
      c.yaw -= Math.PI * whichWay;
      W.yaw = 0;
      r.mark = 1;
    }
    return;
  }
  // 부딪쳐 휘청(맨 앞은 뒤를 힐끗 돌아본다)
  const bump = between(clock, 1, 1.1) - between(clock, 1.3, 1.6),
    rock = t.time * 15;
  if (r.slot === 0 && r.size > 1) {
    W.yaw = 0.7 * bump;
    return;
  }
  W.roll = 0.3 * bump * Math.sin(rock);
  W.squash = 1.04 - 0.12 * bump;
  if (crossed(clock, t.dt, 1)) t.hop(c, 2);
}

// 보초 설 자리: 랜드마크를 등지고 옆으로 나란히(slot 이 클수록 오른쪽)
function post(into: THREE.Vector3, q: Resident, slot: number, size: number) {
  const along = q.goal.dot(q.aim);
  dir.copy(q.goal).addScaledVector(q.aim, -along).normalize();
  best.crossVectors(dir, q.goal).normalize();
  const mid = (size - 1) / 2,
    across = (slot - mid) * SENTRY_SPACE,
    arc = across / S.R,
    reach = Math.tan(arc);
  into.copy(q.goal).addScaledVector(best, reach).normalize();
}

// 보초를 서다 한 놈이 존다: 옆으로 기우뚱 → 옆 놈이 툭 → 화들짝(앞장의 시계 q.clock, 조는 놈은 q.n 이 돌아가며 정한다)
function dozeOnDuty(c: Creature, r: Resident, q: Resident, t: Town) {
  const W = t.W,
    sleeper = q.size > 1 ? 1 + (q.n % (q.size - 1)) : 0,
    waker = sleeper - 1,
    left = q.u - q.clock,
    droopFrom = q.u - 3.4,
    droopTo = q.u - 0.7,
    droop = between(q.clock, droopFrom, droopTo),
    isPoked = left < 0.7 && left > 0.45,
    isStartled = left < 0.45;
  if (r.slot === sleeper && q.clock > droopFrom) {
    // 깨워 주는 옆 놈(왼쪽) 쪽으로 기운다
    W.roll = isStartled ? 0 : -0.42 * droop;
    W.pitch = isStartled ? 0 : -0.14 * droop;
    W.squash = isStartled ? 1.13 : 1.03;
    W.rate = isStartled ? SNAPPY : W.rate;
    if (crossed(-left, t.dt, -0.45)) t.hop(c, 2.6);
    return;
  }
  if (r.slot === waker && isPoked && q.size > 1) {
    W.roll = 0.32;
    W.rate = SNAPPY;
  }
}

// 술래에게서 가장 먼 빈자리로 달아난다(셋을 뽑아 본다)
function fleeSpot(c: Creature, r: Resident, t: Town, from: Creature) {
  let most = -1;
  for (let k = 0; k < 3; k++) {
    t.roam(spot, c, r, 11);
    const far = t.dist(spot, from.v);
    if (far <= most) continue;
    most = far;
    best.copy(spot);
  }
  r.goal.copy(best);
}

// 주사위는 굴러서 간다(발을 구르지 않는다 — 구르는 각은 간 거리만큼 늘 붙는다)
function rollTo(c: Creature, r: Resident, t: Town, pose: Pose, to: THREE.Vector3, speed: number) {
  const left = t.walk(c, r, to, speed, pose);
  pose.amt = 0;
  return left;
}
