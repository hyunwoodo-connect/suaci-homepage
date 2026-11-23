import * as THREE from "three";

import { ease } from "../core/frame";
import { S } from "../settings";
import { offset, offsetInto } from "../world/sphere";
import type { Creature, CreatureLinks, Pose, Sense } from "./creature";
import type { HabitCtx } from "./habits";
import { away, face, go } from "./moves";
import type { Species } from "./placement";

// 갈래(땅·하늘·해파리·호수)마다의 공통 상태 기계와, 만난 손님이 줄지어 따라오는 것.
// 종마다 다른 것은 버릇(habits)에게 묻는다 — 버릇이 끼어드는 차례가 곧 손님의 몸짓이라 바꾸지 않는다

/** 상태 기계가 보는 것: 버릇 창구(dt·time·만나기…)에, 생물 전체(Creatures)가 가진 것 몇 가지 */
export interface BehaviorCtx extends HabitCtx {
  links: Pick<CreatureLinks, "footsteps" | "babyLimes">;
  species: ReadonlyMap<string, Species>;
  /** 프레임마다 생물마다 새로 만들지 않게 돌려 쓰는 칸 */
  sense: Sense;
  /** 줄지어 따라오는 손님(여섯까지) */
  followers: Creature[];
}

/**
 * 따라오는 손님 줄: 내 발자취(한 걸음 0.3m) 위에 한 줄로 선다. 아기 라임(여섯 걸음 간격)이 있으면 그 뒤부터.
 * 첫 손님은 FOLLOW_FIRST 걸음 뒤, 그다음은 FOLLOW_GAP 걸음마다 — 손님끼리 거의 닿을 만큼 붙여, 셋까지는 한 화면에 든다
 */
const FOLLOW_FIRST = 7,
  FOLLOW_GAP = 7,
  BABY_GAP = 6;

const fAim = new THREE.Vector3(),
  cv = new THREE.Vector3(),
  cw = new THREE.Vector3(),
  nv = new THREE.Vector3(),
  lookAt = new THREE.Vector3();

/** 생물 하나의 이번 프레임: 따라오는 손님은 줄을 서고, 그 밖에는 갈래마다의 상태 기계를 돈다. 움직임 세기와 고개는 pose 에 */
export function behave(
  c: Creature,
  dP: number,
  dA: number,
  calm: boolean,
  rush: boolean,
  pose: Pose,
  x: BehaviorCtx,
) {
  if (c.st === "follow") follow(c, pose, x);
  else if (c.role === "herd") herd(c, dP, dA, calm, rush, pose, x);
  else if (c.role === "flock") flock(c, dP, dA, pose, x);
  else if (c.role === "fish") fish(c, dP, calm, rush, pose, x);
  else jelly(c, dP, dA, x);
}

/* ─── 내부 ─────────────────────────── */

// 만난 손님은 그 방문 동안 줄지어 따라온다
function follow(c: Creature, pose: Pose, x: BehaviorCtx) {
  const dt = x.dt,
    steps = x.links.footsteps;
  const lastHist = steps.length - 1;
  const babies = BABY_GAP * x.links.babyLimes.joined,
    trailIndex = babies + FOLLOW_FIRST + FOLLOW_GAP * c.order;
  const histIndex = Math.min(lastHist, trailIndex);
  const hg = histIndex >= 0 ? steps.at(histIndex) : undefined;
  if (hg) {
    // 내 발자취를 그대로 밟아 한 줄로 온다. 좌우로 비켜서면 세로 폰 화면(가로 시야가 좁다)에서 대각선으로 빠져 안 보였다 —
    // 카메라는 손님 수만큼 높고 멀어지고 조금 아래를 봐서(CameraRig.setCompany) 내 뒤의 줄이 나를 가리지 않고 화면에 든다
    fAim.copy(hg.p);
    const d = c.v.angleTo(fAim) * S.R;
    if (d > 0.25) {
      const chase = d * 4;
      const sp = Math.min(14, chase);
      const stride = sp > 5 ? 2.6 : 4.6;
      go(c, fAim, sp, dt, stride);
      const pace = 0.4 + sp / 6;
      pose.amt = Math.min(1, pace);
    }
    const gl = x.s.terrain.groundAt(c.v),
      air0 = hg.a - 1.6 - gl;
    const trailAlt = hg.a - 1.6;
    const targetAlt = Math.max(gl, trailAlt);
    const altEase = ease(8, dt);
    c.a += (targetAlt - c.a) * altEase;
    if (air0 > 0.6) pose.amt = 0.3;
  }
  pose.head = 0.3;
  const pitchEase = ease(8, dt),
    sinkEase = ease(10, dt);
  c.pitch += (0 - c.pitch) * pitchEase;
  c.sink += (0 - c.sink) * sinkEase;
  if (c.gait === "hop") {
    if (c.hop > 0 || c.hopV > 0) {
      c.hop += c.hopV * dt;
      c.hopV -= 22 * dt;
      if (c.hop <= 0) {
        c.hop = 0;
        c.hopV = 0;
      }
    } else if (pose.amt > 0.3) {
      c.hopV = 4;
      c.hop = 0.01;
    }
  }
}

// 땅 위 무리: 풀 뜯기·쳐다보기·다가오기·기대기·놀라 달아나기·돌아보기·집으로. 종마다의 버릇이 그 앞뒤에 끼어든다
function herd(
  c: Creature,
  dP: number,
  dA: number,
  calm: boolean,
  rush: boolean,
  pose: Pose,
  x: BehaviorCtx,
) {
  const dt = x.dt,
    p = x.s.player.p,
    sp = x.species.get(c.k)!;
  c.a = x.s.terrain.groundAt(c.v);
  const sinkEase = ease(10, dt),
    rollEase = ease(6, dt);
  c.sink += (0 - c.sink) * sinkEase;
  c.roll += (0 - c.roll) * rollEase;
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
  const sense = x.sense;
  sense.dP = dP;
  sense.dA = dA;
  sense.scare = scare;
  sense.seen = seen;
  for (const h of sp.habits) h.before?.(c, sense, pose, x);
  let pitchOwned = false;
  for (const h of sp.habits) if (h.pitch?.(c, x)) pitchOwned = true;
  if (!pitchOwned) {
    const pitchEase = ease(8, dt);
    c.pitch += (0 - c.pitch) * pitchEase;
  }
  for (const h of sp.habits) h.touch?.(c, sense, x);
  const st = c.st;
  if (st === "graze" || st === "wander" || st === "watch") {
    if (scare) {
      c.st = sp.scaredTo;
      c.t = 0;
    } else if (seen) {
      // 풀 뜯다 말고 고개를 들어 쳐다본다
      c.st = "watch";
      pose.head = 0.75;
      const turn = ease(2.2, dt);
      face(c, p, turn);
      if (calm && dP < 6.5 && Math.abs(dA) < 4) {
        c.still += dt;
        if (c.still > 2.2) c.st = "come";
      } else {
        const stillLeft = c.still - dt;
        c.still = Math.max(0, stillLeft);
      }
    } else if (st === "watch") {
      c.st = "graze";
      c.t = c.rng.range(2, 5);
    } else if (st === "graze") {
      pose.head = -1;
      c.t -= dt;
      if (c.t <= 0) {
        c.st = "wander";
        // 난수 순서: 거리 → 방향
        const wanderDist = c.rng.range(1, 5.5);
        const wanderBearing = 360 * c.rng.next();
        c.goal = offset(c.hv!, wanderDist, wanderBearing);
      }
    } else {
      pose.amt = 0.7;
      if (go(c, c.goal!, 0.9, dt) < 0.4) {
        c.st = "graze";
        c.t = c.rng.range(3, 8);
      }
    }
  } else if (st === "startle") {
    // 움찔 — 몸을 낮췄다가
    c.t += dt;
    pose.head = 1;
    c.sink = 0.14;
    if (c.t > 0.16) {
      c.st = "run";
      c.t = 2.3;
      c.rs = 8.5;
      c.hopV = 5.5;
      c.hop = 0.01;
    }
  } else if (st === "run") {
    // 통통 뛰어 달아나다가 점점 느려진다
    away(c, p, c.rs!, dt);
    pose.amt = 1;
    pose.head = 0.4;
    const slowed = c.rs! - 3.1 * dt;
    c.rs = Math.max(1.4, slowed);
    c.t -= dt;
    if (c.hop <= 0 && c.rs > 2.6) {
      c.hopV = 2.2 + c.rs * 0.35;
      c.hop = 0.01;
    }
    if (c.t <= 0 && c.hop <= 0) {
      c.st = "lookback";
      c.t = c.rng.range(1.4, 2.2);
    }
  } else if (st === "lookback") {
    pose.head = 0.8;
    const turn = ease(3, dt);
    face(c, p, turn);
    c.t -= dt;
    if (scare) {
      c.st = "startle";
      c.t = 0;
    } else if (c.t <= 0) c.st = "home";
  } else if (st === "home") {
    pose.amt = 0.8;
    if (scare) {
      c.st = "startle";
      c.t = 0;
    } else if (go(c, c.home, 1.4, dt) < 1.2) {
      c.st = "graze";
      c.t = c.rng.range(2, 5);
      c.still = 0;
    }
  } else if (st === "come") {
    // 가만히 있으면 걸어와서
    pose.head = 0.5;
    if (scare) {
      c.st = "startle";
      c.t = 0;
    } else if (dP > 16) c.st = "home";
    else if (dP > 2.1) {
      go(c, p, 1.7, dt);
      pose.amt = 0.9;
    } else {
      c.st = "nuzzle";
      c.t = 0;
    }
  } else if (st === "nuzzle") {
    // 머리를 비비며 기댄다
    c.t += dt;
    const turn = ease(4, dt);
    face(c, p, turn);
    const nuzzlePhase = c.t * 5;
    pose.head = 0.2 + 0.6 * Math.sin(nuzzlePhase);
    const leanT = c.t / 1.6;
    const lean = Math.min(1, leanT) * Math.PI;
    c.roll = 0.12 * Math.sin(lean);
    if (c.t > 0.5) x.meet(c);
    if (c.t > 1.7 && !join(c, x)) {
      c.st = "graze";
      c.t = c.rng.range(3, 6);
      c.still = 0;
    }
  } else {
    // 버릇이 맡는 상태(카드의 넘어짐처럼 공통 상태 기계 안에서 도는 것)
    for (const h of sp.habits) h.states?.[st]?.(c, x);
  }
  if (c.gait === "hop" && pose.amt > 0.3 && c.hop <= 0 && c.hopV <= 0 && c.st !== "run") {
    c.hopV = 4;
    c.hop = 0.01;
  } // 뛰는 손님은 걸음 대신 통통
}

// 하늘을 도는 셋: 제 궤도를 돌다가, 버릇(visit)이 있으면 다가온 나를 찾아와 몸 둘레를 돈다
function flock(c: Creature, dP: number, dA: number, pose: Pose, x: BehaviorCtx) {
  const dt = x.dt,
    sp = x.species.get(c.k)!,
    sense = x.sense;
  sense.dP = dP;
  sense.dA = dA;
  sense.scare = false;
  sense.seen = false;
  let visiting = false;
  for (const h of sp.habits) if (h.fly?.(c, sense, pose, x)) visiting = true;
  if (visiting) return;
  c.ph += dt * (9 + 6 * c.amt);
  c.ang! += ((c.dir! * 6.5) / c.rad!) * 57.3 * dt;
  offsetInto(nv, c.ctr!, c.rad!, c.ang!);
  const lookAng = c.ang! + c.dir! * 10;
  offsetInto(lookAt, c.ctr!, c.rad!, lookAng);
  const turn = ease(8, dt);
  face(c, lookAt, turn);
  // 길들인 것(나를 찾아오는 것)은 제 궤도로 천천히 돌아온다
  const settleRate = sp.tame ? 2.5 : 30;
  const settle = ease(settleRate, dt);
  c.v.lerp(nv, settle).normalize();
  const bobPhase = x.time * 0.6 + c.an.x;
  const targetA = c.g0! + c.alt! + 1.2 * Math.sin(bobPhase) + c.slot! * 0.5;
  c.a += (targetA - c.a) * settle;
  const flapPhase = x.time * 0.9 + c.an.x * 2;
  pose.amt = 0.55 + 0.45 * Math.sin(flapPhase);
  c.roll = -c.dir! * 0.3;
  if (dP < 9 && Math.abs(dA) < 6) x.meet(c);
}

// 호수: 수면에서 원을 그리며 헤엄치다가 뛰어오르고, 멈춘 사람에게 다가와 방울을 불고, 놀라면 잠수한다
function fish(c: Creature, dP: number, calm: boolean, rush: boolean, pose: Pose, x: BehaviorCtx) {
  const dt = x.dt,
    p = x.s.player.p,
    ripples = x.s.ripples;
  const wsp = c.st === "jump" ? 5.5 : c.st === "visit" ? 0 : c.st === "dive" ? 4.5 : 1.3;
  c.ph += dt * (5 + wsp * 2.2);
  if (wsp > 0) {
    c.ang! += ((c.dir! * wsp) / c.rad!) * 57.3 * dt;
    offsetInto(nv, c.home, c.rad!, c.ang!);
    const lookAng = c.ang! + c.dir! * 12;
    offsetInto(lookAt, c.home, c.rad!, lookAng);
    const turn = ease(6, dt);
    face(c, lookAt, turn);
    c.v.copy(nv);
  }
  const scare = dP < 9 && rush;
  if (c.st === "swim") {
    const swimPhase = x.time * 1.4 + c.an.x;
    const swimAlt = 0.25 + 0.07 * Math.sin(swimPhase);
    const altEase = ease(5, dt),
      pitchEase = ease(5, dt);
    c.a += (swimAlt - c.a) * altEase;
    c.pitch += (0 - c.pitch) * pitchEase;
    pose.amt = 0.35;
    c.rt = (c.rt || 0) - dt;
    if (c.rt <= 0 && dP < 60) {
      c.rt = c.rng.range(0.9, 1.6);
      ripples.ripple(c.v, 0.45, 0);
    }
    c.jt! -= dt;
    if (c.jt! <= 0) {
      c.st = "jump";
      c.t = 0;
      c.jt = c.rng.range(4, 9);
      splash(c, 4, x);
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
      splash(c, 5, x);
    }
  } else if (c.st === "jump") {
    // 물 위로 뛰어올랐다가 머리부터 들어간다
    c.t += dt;
    const k = c.t / 0.95;
    c.a = 0.25 + 9 * k * (1 - k);
    c.pitch = 0.95 * (1 - 2 * k);
    pose.amt = 1;
    if (k >= 1) {
      c.st = "swim";
      splash(c, 5, x);
    }
  } else if (c.st === "visit") {
    // 멈춰 선 사람 쪽으로 몸을 돌리고 고개를 내밀어 방울을 분다
    const turn = ease(3, dt);
    face(c, p, turn);
    const bobPhase = x.time * 2;
    const visitAlt = 0.5 + 0.08 * Math.sin(bobPhase);
    const altEase = ease(4, dt);
    c.a += (visitAlt - c.a) * altEase;
    c.pitch += (0.4 - c.pitch) * altEase;
    pose.amt = 0.15;
    c.t += dt;
    c.bt! -= dt;
    if (c.bt! <= 0) {
      c.bt = 2.3;
      cv.copy(c.pos).addScaledVector(c.v, 0.9);
      x.s.fx.burst(cv, 3, 4);
      ripples.ripple(c.v, 0.7, 0);
    }
    if (c.t > 2.5) x.meet(c);
    if (scare) {
      c.st = "dive";
      c.t = 0;
      splash(c, 5, x);
    } else if (dP > 17) c.st = "swim";
  } else if (c.st === "dive") {
    // 고개를 숙이고 물속으로
    c.t += dt;
    const pitchEase = ease(12, dt),
      altEase = ease(5, dt);
    c.pitch += (-1.1 - c.pitch) * pitchEase;
    c.a += (-3 - c.a) * altEase;
    pose.amt = 1;
    if (c.t > 0.9) {
      c.st = "under";
      c.t = c.rng.range(3, 5);
    }
  } else if (c.st === "under") {
    c.a = -3;
    c.pitch = 0.9;
    c.t -= dt;
    if (c.t <= 0 && !scare) {
      c.st = "jump";
      c.t = 0;
      splash(c, 4, x);
    }
  }
}

// 해파리: 갓을 오므릴 때마다 조금씩 솟고, 천천히 가라앉는다. 밟으면 출렁하며 튕겨 준다
function jelly(c: Creature, dP: number, dA: number, x: BehaviorCtx) {
  const dt = x.dt,
    pl = x.s.player;
  c.ph += dt * 2.1;
  const drift = dt * 0.12;
  cw.copy(c.f).applyAxisAngle(c.v, drift);
  c.f.copy(cw);
  if (c.v.angleTo(c.home) * S.R > 40) face(c, c.home, 0.05);
  const glide = (0.6 * dt) / S.R;
  c.v.addScaledVector(c.f, glide).normalize();
  const pulsePhase = c.ph - 1.9;
  const swayPhase = x.time * 0.3 + c.an.x;
  c.a = c.base! + 0.8 * Math.sin(pulsePhase) + Math.sin(swayPhase) * 0.8;
  if (c.hop !== 0 || c.hopV !== 0) {
    c.hopV += (-60 * c.hop - 7 * c.hopV) * dt;
    c.hop += c.hopV * dt;
    if (Math.abs(c.hop) < 0.01 && Math.abs(c.hopV) < 0.05) {
      c.hop = 0;
      c.hopV = 0;
    }
  } // 밟히면 출렁
  const hh = c.batch.hh;
  if (!pl.held && dP < 2.4 && dA > hh * 0.6 && dA < hh * 2 + 1.6 && pl.vy <= 0.5) {
    pl.bounce(9);
    c.hopV = -5;
    c.hop = -0.01;
    c.ph = 4.7;
    x.meet(c);
  }
  const headGap = dA - hh;
  if (dP < 7 && Math.abs(headGap) < 6) x.meet(c);
}

// 줄지어 따라오기에 넣는다(여섯까지)
function join(c: Creature, x: BehaviorCtx): boolean {
  const FOL = x.followers;
  if (FOL.length >= 6 || c.order >= 0) return false;
  c.order = FOL.length;
  FOL.push(c);
  c.st = "follow";
  return true;
}

function splash(c: Creature, n: number, x: BehaviorCtx) {
  const power = 0.5 + n * 0.12;
  const drops = n * 2;
  x.s.ripples.splash(c.v, power, drops);
}
