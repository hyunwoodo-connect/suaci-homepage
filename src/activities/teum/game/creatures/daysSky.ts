import * as THREE from "three";

import { STAGE } from "../hideseek/openTuning";
import { offsetInto } from "../world/sphere";
import type { Creature } from "./creature";
import type { Day } from "./days";
import type { Resident } from "./resident";
import {
  arch,
  between,
  canJoin,
  crossed,
  heartPoint,
  PLACE_REACH,
  pulse,
  ringSpot,
  SNAPPY,
} from "./resident";
import type { Town } from "./town";

// 하늘 종의 하루: 열쇠 · 날개 편지 · 날개 하트 · 날개 찻잔 · 날개 종. 낮게(누를 수 있는 높이 안에서) 날아다닌다.
// 높이는 바라는 값(W.alt)으로만 적는다 — 마을이 끝에 둥실 따라가게 한다. 리본 달린 물건 둘레는 하늘에서도 끼고 돈다

// ---- 열쇠 ----
/** 물건을 살펴보러 가는 거리(m, 사는 자리에서) · 물건 가장자리에서 콕콕 찌르는 자리까지 더 두는 거리(m) · 리본 곁에서 느려지는 거리(m) */
const KEY_REACH = 26,
  PECK_GAP = 0.9,
  SHINY_REACH = 8;
/** 둘이 맴도는 반지름(m)·그 원이 서면 안 되는 자리에서 떨어지는 거리(m)·빠르기(도/초) */
const KEY_ORBIT = 2.6,
  KEY_ORBIT_ROOM = KEY_ORBIT + 0.6,
  KEY_ORBIT_RATE = 86;

// ---- 날개 편지 ----
/** 배달하러 가는 거리(m) · 높이 올라 그리는 원의 높이(m)·반지름(m)·빠르기(도/초) · 내 머리 위를 도는 반지름(m)과 한 바퀴(초) */
const POST_REACH = 28,
  HIGH_ALT = 9,
  HIGH_RING = 10,
  HIGH_RATE = 24,
  HALO_RING = 2.3,
  HALO_SECONDS = 2.4;

// ---- 날개 하트 ----
/** 하트 궤적: 너비(m)·서면 안 되는 자리에서 떨어지는 거리(m)·가운데 높이(m)·반쪽을 그리는 시간(초) · 짝이 곁에 있다고 치는 거리(m) */
const HEART_WIDE = 5.2,
  HEART_ROOM = HEART_WIDE * 0.5 + 0.5,
  HEART_ALT = 3.7,
  HEART_SECONDS = 3.2,
  PAIR_REACH = 7;

// ---- 날개 종 ----
/** 높이 솟아 딸랑: 솟는 높이(m)·걸리는 시간(초)·올려다보는 주민까지의 거리(m)·다시 울릴 때까지(초, 이 사이) */
const RING_RISE = 5,
  RING_SECONDS = 2.6,
  RING_HEARD = 18,
  RING_MIN = 20,
  RING_MAX = 30;

const spot = new THREE.Vector3(),
  dir = new THREE.Vector3(),
  heart = { x: 0, y: 0 };

/** 열쇠 — 뭔가 찾는 탐정. 반짝이는 것(리본) 근처에 오면 속도가 느려진다 */
export const KEY: Day = {
  chores: [
    {
      // ① 낮게 날며 물건마다 앞에 멈춰 콕콕 찔러 본다
      can: (c, r, t) => nextProp(c, r, t, -1) >= 0,
      begin(c, r, t) {
        r.n = nextProp(c, r, t, -1);
        if (r.n < 0) t.finish(r);
      },
      run(c, r, t, pose) {
        const prop = t.props[r.n],
          W = t.W;
        if (!prop) return t.finish(r);
        const gap = prop.r + STAGE.npc.propRoom + PECK_GAP;
        t.beside(spot, prop.v, c, gap);
        if (r.step === 0) {
          const isShiny = t.dist(c.v, prop.v) < SHINY_REACH,
            speed = isShiny ? 1.3 : 3.2;
          if (t.wing(c, r, spot, 1.3, speed, pose) < 0.4 || r.stepT > 9) t.next(r);
          return;
        }
        const jabPhase = r.stepT * 8.5,
          jab = Math.sin(jabPhase),
          poke = Math.max(0, jab);
        t.turn(c, prop.v, 6);
        W.alt = 1.3;
        W.pitch = -0.5 * poke;
        W.rate = SNAPPY;
        W.isFree = false;
        if (r.stepT < 2.1) return;
        r.n = nextProp(c, r, t, r.n);
        t.next(r, 0);
      },
    },
    {
      // ② 다른 열쇠와 둥글게 맴돈다
      can: (c, r, t) => t.find(c, PLACE_REACH, isFreeKin) !== null,
      begin(c, r, t) {
        const pal = t.find(c, PLACE_REACH, isFreeKin);
        if (!pal || !t.enlist(pal, c, 1, 1, r.choreT)) return t.finish(r);
        r.mate = pal;
        r.slot = 0;
        r.goal.copy(c.v).add(pal.v).normalize();
        t.clear(r.goal, KEY_ORBIT_ROOM);
        r.clock = 0;
      },
      run(c, r, t, pose) {
        const lead = r.lead ?? c,
          q = lead.res!;
        if (lead === c) r.clock += t.dt;
        const bearing = q.clock * KEY_ORBIT_RATE + r.slot * 180;
        offsetInto(spot, q.goal, KEY_ORBIT, bearing);
        t.wing(c, r, spot, 2.2, 5, pose);
        t.W.roll = 0.3;
        t.W.isFree = false;
      },
    },
    {
      // ③ 랜드마크 문 앞에서 빙글빙글(잠깐 멈춰 문을 들여다보고 반대로 또 돈다)
      can: (c, r, t) => t.place(c, "landmark") !== null,
      begin(c, r, t) {
        const mark = t.place(c, "landmark");
        if (!mark) return t.finish(r);
        const gap = mark.r + 1.6;
        t.beside(r.goal, mark.v, c, gap);
        r.aim.copy(mark.v);
        r.w = 0;
        r.u = 1;
      },
      run(c, r, t, pose) {
        const W = t.W;
        if (r.step === 0) {
          if (t.wing(c, r, r.goal, 1.6, 3, pose) < 0.5 || r.stepT > 9) t.next(r);
          return;
        }
        W.alt = 1.6;
        W.isFree = false;
        const beat = r.stepT % 3.2;
        if (beat > 2.6) {
          t.turn(c, r.aim, 6);
          r.w = 0;
          if (crossed(beat, t.dt, 2.65)) r.u = -r.u;
          return;
        }
        r.w = (r.w + t.dt * 3.4 * r.u + 6.283) % 6.283;
        c.yaw = r.w;
        W.yaw = r.w;
      },
    },
  ],
  // 빙글 한 바퀴 돌고 까딱
  greet(c, r, t) {
    const T = r.actT,
      turned = T / 0.7,
      dip = between(T, 0.75, 1.2);
    if (turned < 1) t.spinOnce(c, turned);
    t.W.pitch = -0.45 * arch(dip);
    return T > 1.25;
  },
};

/** 날개 편지 — 바쁜 배달부. 배달받은 생물은 폴짝 좋아한다 */
export const LETTER: Day = {
  isOwnGreet: true,
  chores: [
    {
      // ① 생물에서 생물로 날아가 앞에 잠깐 떠 있다(배달) 다음으로
      can: (c, r, t) => t.find(c, POST_REACH, isAddressee) !== null,
      begin(c, r, t) {
        const roll = c.rng.next() * 12,
          skip = Math.floor(roll);
        r.n = skip;
        r.mate = t.nth(c, POST_REACH, skip, isAddressee);
      },
      run(c, r, t, pose) {
        const pal = r.mate,
          W = t.W;
        if (!pal || pal.st === "guide") return t.finish(r);
        const alt = headOf(pal, c, t) + 0.5;
        if (r.step === 0) {
          t.beside(spot, pal.v, c, 1.7);
          if (t.wing(c, r, spot, alt, 5.2, pose) < 0.5 || r.stepT > 7) t.next(r);
          return;
        }
        const dip = between(r.stepT, 0.3, 0.8);
        t.turn(c, pal.v, 6);
        W.alt = alt;
        W.pitch = -0.3 * arch(dip);
        W.isFree = false;
        if (crossed(r.stepT, t.dt, 0.55)) {
          t.puff("paper", c, -0.2, 0.6);
          t.cue(pal, "joy", 0.8, c.v);
        }
        if (r.stepT < 1.2) return;
        // 다음 받는 이는 몇 칸 건너(같은 이웃만 오가지 않게)
        r.n += 5;
        r.mate = t.nth(c, POST_REACH, r.n, isAddressee);
        t.next(r, 0);
      },
    },
    {
      // ② 우체통이 있으면 그 위를 맴돈다
      can: (c, r, t) => t.place(c, "mailbox") !== null,
      begin(c, r, t) {
        const box = t.place(c, "mailbox");
        if (!box) return t.finish(r);
        r.aim.copy(box.v);
        r.u = box.top + 1.6;
        r.clock = 0;
      },
      run(c, r, t, pose) {
        r.clock += t.dt;
        const bearing = r.clock * 70;
        offsetInto(spot, r.aim, 2.4, bearing);
        t.wing(c, r, spot, r.u, 4, pose);
        t.W.roll = 0.3;
        t.W.isFree = false;
      },
    },
    {
      // ③ 높이 올라 큰 원을 그린다
      begin(c, r) {
        r.clock = c.an.x * 57.3;
      },
      run(c, r, t, pose) {
        r.clock += t.dt * HIGH_RATE;
        offsetInto(spot, r.seat, HIGH_RING, r.clock);
        t.clear(spot, 0.3);
        t.wing(c, r, spot, HIGH_ALT, 6, pose);
        t.W.roll = 0.32;
        t.W.isFree = false;
      },
    },
  ],
  // 내 머리 위를 한 바퀴 돌고 간다
  greet(c, r, t, pose) {
    const T = r.actT,
      bearing = (T * 360) / HALO_SECONDS + c.an.x * 57.3,
      alt = t.myHeight(c) + 2.2;
    offsetInto(spot, t.p, HALO_RING, bearing);
    t.clear(spot, 0.3);
    t.wing(c, r, spot, alt, 7, pose);
    t.W.roll = 0.3;
    return T > HALO_SECONDS + 0.9;
  },
};

/** 날개 하트 — 애교쟁이. 혼자면 풀이 죽어 낮게 날고, 짝을 만나면 빨라진다 */
export const HEART: Day = {
  isOwnGreet: true,
  always(c, r, t) {
    // 짝이 곁에 있나는 가끔만 본다
    r.tick -= t.dt;
    if (r.tick > 0) return;
    r.tick = 0.6;
    r.w = t.find(c, PAIR_REACH, isKin) ? 1 : 0;
  },
  chores: [
    {
      // ① 두 마리가 붙어 다니며 하트 모양 궤적(둘이 반쪽씩 그린다 — 지나간 자리에 반짝이가 잠깐 남아 모양이 읽힌다)
      can: (c, r, t) => t.find(c, PLACE_REACH, isFreeKin) !== null,
      begin(c, r, t) {
        const pal = t.find(c, PLACE_REACH, isFreeKin);
        if (!pal || !t.enlist(pal, c, 0, 1, r.choreT)) return t.finish(r);
        r.mate = pal;
        r.slot = 0;
        t.roam(r.goal, c, r, 5);
        t.clear(r.goal, HEART_ROOM);
        // 하트가 나를 마주 보게: 옆(aim)은 나와 가운데를 잇는 줄에 수직
        const along = t.p.dot(r.goal);
        dir.copy(t.p).addScaledVector(r.goal, -along);
        if (dir.lengthSq() < 1e-10) dir.copy(c.f);
        r.aim.crossVectors(r.goal, dir).normalize();
        r.clock = 0;
      },
      run(c, r, t, pose) {
        const lead = r.lead ?? c,
          q = lead.res!,
          W = t.W;
        if (lead === c) r.clock += t.dt;
        // 꼭대기 가운데에서 아래 끝으로 내려갔다가 되짚어 올라온다
        const lap = (q.clock / HEART_SECONDS) % 2,
          along = lap < 1 ? lap : 2 - lap,
          half = r.slot === 0 ? 1 : -1;
        heartPoint(along, half, HEART_WIDE, heart);
        const alt = HEART_ALT + heart.y;
        t.ahead(spot, q.goal, q.aim, heart.x);
        t.wing(c, r, spot, alt, 6, pose);
        W.isFree = false;
        if (pulse(t.time, t.dt, 6)) t.puff("trail", c, 0);
      },
    },
    {
      // ② 생물 머리 위에 잠깐 떠서 두근두근(크기 맥동)
      can: (c, r, t) => t.find(c, PLACE_REACH, isWalker) !== null,
      begin(c, r, t) {
        const roll = c.rng.next() * 9,
          skip = Math.floor(roll);
        r.n = skip;
        r.mate = t.nth(c, PLACE_REACH, skip, isWalker);
      },
      run(c, r, t, pose) {
        const pal = r.mate,
          W = t.W;
        if (!pal || pal.st === "guide") return t.finish(r);
        const alt = headOf(pal, c, t) + 0.9,
          speed = 3.6 * moodOf(r),
          left = t.wing(c, r, pal.v, alt, speed, pose);
        if (r.step === 0) {
          if (left < 0.7 || r.stepT > 8) t.next(r);
          return;
        }
        W.swell = 1 + 0.18 * throb(r.stepT);
        W.isFree = false;
        if (r.stepT < 3.2) return;
        r.n += 3;
        r.mate = t.nth(c, PLACE_REACH, r.n, isWalker);
        t.next(r, 0);
      },
    },
    {
      // ③ 살랑살랑 내려앉았다 다시 뜬다
      begin(c, r, t) {
        t.roam(r.goal, c, r, 8);
      },
      run(c, r, t, pose) {
        const W = t.W,
          mood = moodOf(r);
        if (r.step === 0) {
          const alt = r.alt * mood,
            speed = 2.4 * mood;
          if (t.wing(c, r, r.goal, alt, speed, pose) < 0.6) t.next(r);
          return;
        }
        const sway = r.stepT * 4,
          down = between(r.stepT, 0, 1.8) - between(r.stepT, 3.4, 4.6),
          isResting = r.stepT > 1.8 && r.stepT < 3.4;
        W.alt = r.alt + (0.35 - r.alt) * down;
        W.roll = isResting ? 0 : 0.32 * Math.sin(sway);
        W.squash = isResting ? 0.96 : 1;
        W.isCalm = isResting;
        if (isResting) pose.amt = 0.12;
        if (r.stepT < 4.6) return;
        t.roam(r.goal, c, r, 8);
        t.next(r, 0);
      },
    },
  ],
  // 내 앞으로 와서 두근두근 두 번
  greet(c, r, t, pose) {
    const W = t.W,
      T = r.actT,
      alt = t.myHeight(c) + 0.6;
    t.beside(spot, t.p, c, 2.4);
    if (r.actStep === 0) {
      const left = t.wing(c, r, spot, alt, 5, pose);
      if (left > 0.7 && T < 1.4) return false;
      r.actStep = 1;
      r.actClock = T;
      return false;
    }
    const since = T - r.actClock;
    t.turn(c, t.p, 6);
    W.alt = alt;
    W.swell = 1 + 0.22 * throb(since);
    return since > 1.5;
  },
};

/** 날개 찻잔 — 덤벙이. 찻주전자가 따라 주면 김이 나고 한 바퀴 돈다 */
export const CUP: Day = {
  joy(c, r, t) {
    const k = r.actT / 0.9;
    t.spinOnce(c, k);
    if (pulse(t.time, t.dt, 8)) t.puff("steam", c, 0.4);
    return k >= 1;
  },
  chores: [
    {
      // ① 찻주전자를 졸졸 따라다닌다(차를 받으려고)
      can: (c, r, t) => t.find(c, PLACE_REACH, isTeapot) !== null,
      begin(c, r, t) {
        r.mate = t.find(c, PLACE_REACH, isTeapot);
      },
      run(c, r, t, pose) {
        const pot = r.mate,
          W = t.W;
        if (!pot || pot.st === "guide") return t.finish(r);
        dir.copy(pot.f).negate();
        t.ahead(spot, pot.v, dir, 2.3);
        const gap = t.dist(c.v, spot),
          speed = gap > 3 ? 4 : 2.2;
        if (gap > 0.6) {
          t.wing(c, r, spot, 1.7, speed, pose);
          return;
        }
        // 다 따라붙으면 주전자를 보며 조른다
        const beg = t.time * 6;
        t.turn(c, pot.v, 5);
        W.alt = 1.7;
        W.pitch = -0.14 * Math.sin(beg);
        W.isFree = false;
      },
    },
    {
      // ② 날다가 기우뚱해서 물방울을 흘린다(그러고는 당황해 허둥지둥)
      begin(c, r, t) {
        t.roam(r.goal, c, r, 10);
        r.clock = c.rng.range(2, 3.5);
        r.u = 1;
      },
      run(c, r, t, pose) {
        const W = t.W;
        if (t.wing(c, r, r.goal, 2.6, 2.5, pose) < 0.8) t.roam(r.goal, c, r, 10);
        r.clock -= t.dt;
        if (r.clock < 0.6) {
          const tip = 1 - r.clock / 0.6;
          W.roll = 0.75 * r.u * arch(tip);
          W.rate = SNAPPY * 0.5;
          W.isFree = false;
          if (pulse(t.time, t.dt, 9)) t.puff("drop", c, -0.2);
        }
        if (r.clock <= 0) {
          r.clock = c.rng.range(2.4, 4);
          r.u = -r.u;
          r.wobble = 0.6;
        }
        fluster(c, r, t);
      },
    },
    {
      // ③ 받침 접시처럼 생긴 것 위에 앉아 쉰다
      can: (c, r, t) => t.place(c, "saucer") !== null,
      begin(c, r, t) {
        const saucer = t.place(c, "saucer");
        if (!saucer) return t.finish(r);
        r.aim.copy(saucer.v);
        r.u = saucer.top;
        r.isPerching = true;
      },
      run(c, r, t, pose) {
        const W = t.W;
        if (r.step === 0) {
          const above = r.u + 0.5;
          if (t.wing(c, r, r.aim, above, 2.5, pose) < 0.4 || r.stepT > 9) t.next(r);
          return;
        }
        const sigh = t.time * 1.4;
        W.alt = r.u + 0.1;
        W.squash = 0.97;
        W.roll = 0.05 * Math.sin(sigh);
        W.isCalm = true;
        pose.amt = 0.1;
      },
    },
  ],
  // 까딱하다 물방울을 흘리고 당황
  greet(c, r, t) {
    const W = t.W,
      T = r.actT,
      dip = between(T, 0, 0.45);
    t.turn(c, t.p, 6);
    W.pitch = -0.5 * arch(dip);
    if (T > 0.3 && T < 0.55 && pulse(t.time, t.dt, 14)) t.puff("drop", c, -0.2, 0.4);
    if (crossed(T, t.dt, 0.5)) r.wobble = 0.9;
    fluster(c, r, t);
    return T > 1.4;
  },
};

/** 날개 종 — 동네 알림이. 20~30초마다 높이 솟아 딸랑(근처 생물이 한 번씩 올려다본다). 내가 상자를 찾으면 제일 먼저 운다 */
export const BELL: Day = {
  isCrier: true,
  always(c, r, t) {
    r.tick -= t.dt;
    if (r.tick > 0 || r.act !== "chore" || t.isBusy) return;
    r.tick = c.rng.range(RING_MIN, RING_MAX);
    t.quirk(r, RING_SECONDS, c.v);
  },
  quirk(c, r, t) {
    soarAndRing(c, r, t, r.actT);
    return false;
  },
  chores: [
    {
      // ① 높이 솟아 딸랑 — 한 바퀴 돌아보고 또 솟는다
      begin(c, r, t) {
        t.roam(r.goal, c, r, 9);
      },
      run(c, r, t, pose) {
        if (r.step === 0) {
          if (t.wing(c, r, r.goal, r.alt, 2.2, pose) < 0.7) t.next(r);
          return;
        }
        soarAndRing(c, r, t, r.stepT);
        if (r.stepT < RING_SECONDS) return;
        r.tick = c.rng.range(RING_MIN, RING_MAX);
        t.roam(r.goal, c, r, 9);
        t.next(r, 0);
      },
    },
    {
      // ② 천천히 좌우로 흔들리며 순회
      begin(c, r, t) {
        t.roam(r.goal, c, r, 12);
      },
      run(c, r, t, pose) {
        const swing = t.time * 1.9 + c.an.x;
        if (t.wing(c, r, r.goal, r.alt, 1.5, pose) < 0.8) t.roam(r.goal, c, r, 12);
        t.W.roll = 0.38 * Math.sin(swing);
        t.W.isFree = false;
      },
    },
    {
      // ③ 다른 종과 번갈아 울린다
      can: (c, r, t) => t.find(c, PLACE_REACH, isFreeKin) !== null,
      begin(c, r, t) {
        const pal = t.find(c, PLACE_REACH, isFreeKin);
        if (!pal || !t.enlist(pal, c, 2, 1, r.choreT)) return t.finish(r);
        r.mate = pal;
        r.slot = 0;
        r.goal.copy(c.v).add(pal.v).normalize();
        t.clear(r.goal, 2.8);
        r.clock = 0;
      },
      run(c, r, t, pose) {
        const lead = r.lead ?? c,
          q = lead.res!,
          W = t.W;
        ringSpot(spot, q.goal, 2.2, r.slot, 2);
        if (t.dist(c.v, spot) > 0.6) {
          t.wing(c, r, spot, r.alt, 3, pose);
          return;
        }
        if (lead === c) r.clock += t.dt;
        const rounds = q.clock / 1.3,
          turnOf = Math.floor(rounds) % 2,
          beat = q.clock % 1.3,
          isMine = turnOf === r.slot,
          swing = t.time * 17,
          idle = t.time * 2;
        t.turn(c, q.goal, 5);
        W.roll = isMine ? 0.5 * Math.sin(swing) : 0.1 * Math.sin(idle);
        W.isFree = false;
        if (isMine && crossed(beat, t.dt, 0.1)) t.puff("note", c, 0.6);
      },
    },
  ],
  // 작게 딸랑 한 번
  greet(c, r, t) {
    const T = r.actT,
      swing = T * 15,
      fade = 1 - between(T, 0, 0.9);
    t.W.roll = 0.36 * fade * Math.sin(swing);
    if (crossed(T, t.dt, 0.1)) t.puff("note", c, 0.6);
    return T > 0.9;
  },
};

/* ─── 내부 ─────────────────────────── */

function isKin(other: Creature, self: Creature): boolean {
  return other.k === self.k;
}

// 같은 종이고 내 무리 일에 끼워도 되는(제 하루를 살고, 남의 일에 끼지 않았고, 제 일을 막 시작한 것이 아닌) 주민인가
function isFreeKin(other: Creature, self: Creature): boolean {
  const q = other.res;
  return other.k === self.k && q !== null && canJoin(q, STAGE.npc.choreSeconds[0]);
}

// 편지를 받을 이: 편지가 아닌 주민
function isAddressee(other: Creature, self: Creature): boolean {
  return other.k !== self.k;
}

// 땅 위를 걷는 주민(머리 위에 뜰 수 있다)
function isWalker(other: Creature): boolean {
  return other.role === "herd";
}

function isTeapot(other: Creature): boolean {
  return other.k === "teapot";
}

// pal 의 머리 높이를 c 가 선 땅에서 잰 값(m) — 하늘 생물의 높이(W.alt)는 제가 선 땅에서 잰다
function headOf(pal: Creature, c: Creature, t: Town): number {
  const top = pal.role === "flock" ? 0.6 : pal.batch.hh * 2;
  return pal.a + top - t.groundAt(c.v);
}

// 살펴볼 다음 물건(사는 자리에서 KEY_REACH 안, 방금 본 것 last 말고 아무거나 — 없으면 -1)
function nextProp(c: Creature, r: Resident, t: Town, last: number): number {
  let count = 0;
  for (let i = 0; i < t.props.length; i++)
    if (i !== last && t.dist(r.seat, t.props[i].v) < KEY_REACH) count++;
  if (!count) return -1;
  const roll = c.rng.next() * count;
  let want = Math.floor(roll);
  for (let i = 0; i < t.props.length; i++) {
    if (i === last || t.dist(r.seat, t.props[i].v) >= KEY_REACH) continue;
    if (want === 0) return i;
    want--;
  }
  return -1;
}

// 하트의 기분: 짝이 곁에 있으면 빨라지고(1.3), 혼자면 풀이 죽는다(0.6)
function moodOf(r: Resident): number {
  return r.w > 0 ? 1.3 : 0.6;
}

// 두근두근: 한 번에 두 번씩 뛴다(0..1)
function throb(time: number): number {
  const beat = (time * 1.25) % 1,
    first = between(beat, 0, 0.12) - between(beat, 0.12, 0.3),
    second = between(beat, 0.3, 0.42) - between(beat, 0.42, 0.62);
  return Math.max(first, second);
}

// 당황: 좌우로 파르르 떨다 잦아든다(r.wobble 이 남은 동안)
function fluster(c: Creature, r: Resident, t: Town) {
  if (r.wobble <= 0) return;
  const shake = t.time * 25,
    tilt = t.time * 31,
    left = r.wobble / 0.5,
    fade = Math.min(1, left);
  t.W.yaw = 0.5 * fade * Math.sin(shake);
  t.W.roll += 0.14 * fade * Math.sin(tilt);
  t.W.isFree = false;
}

// 높이 솟아 딸랑딸랑 울리고 내려온다(T: 시작부터 초). 울리기 시작할 때 근처 주민이 한 번씩 올려다본다
function soarAndRing(c: Creature, r: Resident, t: Town, T: number) {
  const W = t.W,
    up = between(T, 0, 0.8) - between(T, 1.9, RING_SECONDS),
    isRinging = T > 0.8 && T < 1.9,
    swing = t.time * 17;
  W.alt = r.alt + RING_RISE * up;
  W.roll = isRinging ? 0.6 * Math.sin(swing) : 0;
  W.rate = SNAPPY;
  W.isFree = false;
  if (crossed(T, t.dt, 0.8)) t.callEyes(c, RING_HEARD);
  if (isRinging && pulse(t.time, t.dt, 3)) t.puff("note", c, 0.6);
}
