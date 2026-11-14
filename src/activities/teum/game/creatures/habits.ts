import { CREATURES } from "../../assets/settings";
import { burst } from "../fx/sparks";
import type { Game } from "../state";
import { S } from "../state";
import type { Creature, Creatures } from ".";
import { away, ez, face, go, meet, rnd } from "./moves";

// 종마다 다른 버릇: 생김새만 다르고 하는 짓이 같으면 만나는 재미가 없다.
// 땅 위 손님(sheep)의 공통 상태(풀 뜯기·쳐다보기·달아나기…)를 돌기 전에 그 종의 버릇을 먼저 본다.
// 버릇이 쓰는 상태(bow·spin·lead·beckon·bolt·gaze·gift)는 공통 상태 기계가 건드리지 않는다

/** 이번 프레임 움직임 세기와 고개 — 버릇이 정하면 공통 상태 기계가 그 위에서 이어 간다 */
export interface Pose {
  amt: number;
  head: number;
}

/** 버릇이 보는 것: 나와의 거리(dP)·높이 차(dA), 놀라는지(scare)·보이는지(seen) */
export interface HabitSense {
  dP: number;
  dA: number;
  scare: boolean;
  seen: boolean;
}

/** 그 종의 버릇을 한 프레임 돌린다 */
export function habitFrame(g: Game, c: Creature, sense: HabitSense, pose: Pose) {
  const habit = CREATURES[c.k]?.habit;
  if (habit === "roll") rollFrame(g, c);
  else if (habit === "bow") bowFrame(g, c, sense, pose);
  else if (habit === "spin") spinFrame(g, c, sense);
  else if (habit === "bounce") bounceFrame(g, c, sense);
  else if (habit === "lead") leadFrame(g, c, sense, pose);
  else if (habit === "bolt") boltFrame(g, c, sense, pose);
}

/** 구르는 버릇이면 고개 숙임(pitch)을 공통 상태 기계가 되돌리지 않는다(구른 각이 곧 pitch) */
export function rollsItself(c: Creature): boolean {
  return CREATURES[c.k]?.habit === "roll";
}

/* ─── 내부 ─────────────────────────── */

// 주사위는 걷지 않고 데굴데굴 구른다. 멈추면 한 면으로 딱 앉는다
function rollFrame(g: Game, c: Creature) {
  const dt = g.t.dt;
  if (!c.lp) {
    c.lp = c.v.clone();
    c.tum = 0;
  }
  const mv = c.v.angleTo(c.lp) * S.R;
  c.lp.copy(c.v);
  if (mv > 1e-4 && mv < 3) {
    const rollR = c.m.userData.hh * 1.1;
    c.tum! += mv / rollR;
  } else {
    const quarter = Math.PI / 2;
    const quarters = c.tum! / quarter;
    const q = Math.round(quarters) * quarter;
    const settle = ez(9, dt);
    c.tum! += (q - c.tum!) * settle;
  }
  c.pitch = -c.tum!;
  const twice = 2 * c.tum!;
  const bobble = Math.sin(twice);
  c.sink = -0.22 * Math.abs(bobble);
}

// 모자는 다가오면 꾸벅 인사한다
function bowFrame(g: Game, c: Creature, sense: HabitSense, pose: Pose) {
  const dt = g.t.dt,
    p = g.pl.p,
    { dP } = sense;
  if (c.st === "watch" && dP < 9 && !c.bowed) {
    c.st = "bow";
    c.t = 0;
    c.bowed = true;
  }
  if (c.st === "bow") {
    c.t += dt;
    const turn = ez(6, dt);
    face(c, p, turn);
    const bowT = c.t / 1.3;
    const bowK = Math.min(1, bowT);
    const bowAngle = bowK * Math.PI;
    c.pitch = -1.25 * Math.sin(bowAngle);
    pose.head = 0.5;
    if (c.t > 1.3) {
      c.st = "watch";
      c.pitch = 0;
      meet(g, c);
    }
  }
  if (dP > 22) c.bowed = false;
}

// 장미는 빙그르르 돌며 꽃잎을 흩뿌린다
function spinFrame(g: Game, c: Creature, sense: HabitSense) {
  const dt = g.t.dt,
    { dP } = sense;
  if ((c.cd ?? 0) > 0) c.cd! -= dt;
  if (c.st === "watch" && dP < 10 && !((c.cd ?? 0) > 0)) {
    c.st = "spin";
    c.t = 0;
  }
  if (c.st === "spin") {
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
      const petalsAt = c.m.position.clone();
      burst(g, petalsAt, 3, 5);
    }
    if (c.t > 1.8) {
      c.st = "watch";
      c.cd = 7;
      meet(g, c);
    }
  }
}

// 컵케이크는 반가우면 제자리에서 폴짝폴짝 뛴다
function bounceFrame(g: Game, c: Creature, sense: HabitSense) {
  const dt = g.t.dt;
  if (c.st === "watch" && sense.dP < 10) {
    c.jt = (c.jt || 0) - dt;
    if (c.jt <= 0 && c.hop <= 0) {
      c.jt = 0.75;
      c.hopV = 6.5;
      c.hop = 0.01;
      const hopAt = c.m.position.clone();
      burst(g, hopAt, 4, 6);
    }
  }
}

// 회중시계는 늦은 듯 허둥지둥 달려가다 뒤돌아 재촉한다. 따라가면 다른 무리에게 데려다준다
function leadFrame(g: Game, c: Creature, sense: HabitSense, pose: Pose) {
  const dt = g.t.dt,
    p = g.pl.p,
    { dP, scare, seen } = sense;
  const isIdle = c.st === "graze" || c.st === "wander" || c.st === "watch";
  if (isIdle && seen && !scare && !c.led) {
    const best = nearestOtherHerd(g.creatures, c);
    if (best.group && best.d < 170) {
      c.goal = best.group.ctr!.clone();
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
    } else {
      const d = go(g, c, c.goal!, 7.5, dt, 2.2);
      pose.amt = 1;
      if (c.hop <= 0 && c.hopV <= 0) {
        c.hopV = 3.2;
        c.hop = 0.01;
      }
      if (d < 7) {
        c.st = "graze";
        c.t = rnd(3, 6);
        c.home.copy(c.v);
        c.hv = c.v.clone();
        meet(g, c);
        const arriveAt = c.m.position.clone();
        burst(g, arriveAt, 8, 8);
      }
    }
  } else if (c.st === "beckon") {
    c.t += dt;
    const turn = ez(5, dt);
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
      c.t = rnd(2, 4);
      c.home.copy(c.v);
      c.hv = c.v.clone();
    }
  }
}

// 35m 밖에서 가장 가까운 다른 땅 위 무리(제 무리는 뺀다)
function nearestOtherHerd(C: Creatures, c: Creature) {
  let group: Creatures["ROAM"][number] | null = null,
    d = 1e9;
  for (const grp of C.ROAM) {
    if (grp.kind !== "sheep" || grp.mem.includes(c)) continue;
    const gd = grp.ctr!.angleTo(c.v) * S.R;
    if (gd > 35 && gd < d) {
      d = gd;
      group = grp;
    }
  }
  return { group, d };
}

// 전설의 라임 사슴: 달아나며 빛길을 남기고, 멈춰 서서 돌아본다. 세 번을 따라가면 기다렸다가 하늘 높이 쏘아 올려 준다
function boltFrame(g: Game, c: Creature, sense: HabitSense, pose: Pose) {
  const { pl, t, time } = g,
    { p, P } = pl,
    dt = t.dt,
    { dP, dA } = sense;
  if ((c.cd ?? 0) > 0) c.cd! -= dt;
  const isIdle = c.st === "graze" || c.st === "wander" || c.st === "watch";
  if (isIdle && !((c.cd ?? 0) > 0) && dP < 18 && Math.abs(dA) < 8) {
    c.st = "bolt";
    c.t = 0;
    c.n = 0;
  }
  if (c.st === "bolt") {
    away(g, c, 13, dt, 1.6);
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
      const trailAt = c.m.position.clone();
      burst(g, trailAt, 2, 3);
    }
    if (c.t > 2.6 || dP > 45) {
      c.st = "gaze";
      c.t = 0;
      c.n!++;
    }
  } else if (c.st === "gaze") {
    const turn = ez(4, dt);
    face(c, p, turn);
    pose.head = 0.9;
    c.t += dt;
    if (dP < 16 && Math.abs(dA) < 8) {
      c.st = c.n! >= 3 ? "gift" : "bolt";
      c.t = 0;
    } else if (c.t > 25 || dP > 140) {
      c.st = "graze";
      c.t = 3;
      c.home.copy(c.v);
      c.hv = c.v.clone();
    }
  } else if (c.st === "gift") {
    const turn = ez(4, dt);
    face(c, p, turn);
    const nodPhase = time * 4;
    pose.head = 0.6 + 0.3 * Math.sin(nodPhase);
    c.bt = (c.bt || 0) - dt;
    if (c.bt <= 0) {
      c.bt = 0.12;
      const glowAt = c.m.position.clone();
      burst(g, glowAt, 3, 7);
    }
    if (!t.held && dP < 4.5 && Math.abs(dA) < 5) {
      pl.vy = 17;
      if (pl.air <= 0) pl.air = 0.01;
      meet(g, c);
      const giftAt = P.clone();
      burst(g, giftAt, 24, 14);
      c.st = "graze";
      c.t = 4;
      c.cd = 40;
      c.home.copy(c.v);
      c.hv = c.v.clone();
    } else if (dP > 90) {
      c.st = "graze";
      c.t = 3;
      c.home.copy(c.v);
      c.hv = c.v.clone();
    }
  }
}
