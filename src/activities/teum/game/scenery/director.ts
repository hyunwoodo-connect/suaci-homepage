import * as THREE from "three";

import { burst } from "../fx/sparks";
import { nextSprout } from "../rides/seeds";
import type { Game } from "../state";
import { S } from "../state";
import { groundAt } from "../world/terrain";
import { corNear, freeAt } from "./spots";

// 지루함 감독(오너 목표: 적어도 5초에 한 번은 다른 걸 만나거나 다른 경험을 한다).
// 3초 넘게 아무 일도 없으면, 가는 길 바로 앞(2초쯤 뒤에 닿을 자리)에 무언가를 피워 올린다.
// 땅에서는 방울 길 → 구름 싹 → 바람 고리 차례로 돌려서 같은 것이 연달아 나오지 않게 하고,
// 높이 떠 있을 때는 떨어질 길을 어림해서 그 위에 방울을 놓는다(마지막 방울이 다시 튕겨 올려 하늘에서 이어 탄다).
// '일이 있었다'로 치는 것: 방울·고리를 터뜨림, 놀이기구에 붙잡힘, 위로 튕김(vy 가 5 를 넘는 순간), 생물을 새로 마주친 순간

/** 바람 고리 하나(지나가면 빨라진다) */
interface Gust {
  m: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  v: THREE.Vector3;
  alt: number;
  on: boolean;
  t: number;
}

/** 감독 상태 */
export interface Director {
  GUST: Gust[];
  /** 아무 일 없이 지난 시간 */
  bored: number;
  lastPops: number;
  /** 지난 프레임의 vy(튕김을 '넘는 순간'으로 센다) */
  pvy: number;
  /** 생물 곁인지 다시 볼 때까지 */
  crT: number;
  /** 다음에 피울 것(방울 길·구름 싹·바람 고리 차례) */
  dirK: number;
  gI: number;
  wasNear: boolean;
}

const td = new THREE.Vector3(),
  gm = new THREE.Matrix4(),
  gx = new THREE.Vector3(),
  gz = new THREE.Vector3();

/** 감독이 피우는 바람 고리 둘을 만든다(라임과 겹치지 않게 연노랑) */
export function createDirector(g: Game): Director {
  const GUST: Gust[] = [];
  for (let i = 0; i < 2; i++) {
    const ringGeo = new THREE.TorusGeometry(2.7, 0.2, 10, 44);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfff3b0,
      transparent: true,
      opacity: 0.9,
      fog: false,
    });
    const m = new THREE.Mesh(ringGeo, ringMat);
    m.visible = false;
    m.frustumCulled = false;
    g.scene.add(m);
    const gust: Gust = { m, v: new THREE.Vector3(), alt: 0, on: false, t: 0 };
    GUST.push(gust);
  }
  return { GUST, bored: 0, lastPops: 0, pvy: 0, crT: 0, dirK: 0, gI: 0, wasNear: false };
}

/** 바람 고리를 움직이고, 빈 구간을 재고, 3초(떠 있으면 2.2초) 넘으면 앞길에 하나 피운다. 방울 길 프레임 바로 뒤에 부른다 */
export function directorFrame(g: Game) {
  const { pl, t, time } = g,
    { p, P } = pl,
    dt = t.dt,
    held = t.held,
    D = g.director,
    B = g.bubbleTrail;
  const altA = P.length() - S.R;
  for (const gu of D.GUST) {
    if (!gu.on) {
      if (gu.m.visible) {
        gu.m.material.opacity -= dt * 3;
        const grow = 1 + dt * 2.5;
        gu.m.scale.multiplyScalar(grow);
        if (gu.m.material.opacity <= 0) gu.m.visible = false;
      }
      continue;
    }
    gu.t += dt;
    gu.m.visible = true;
    const fadeIn = gu.t * 3;
    const shown = Math.min(1, fadeIn);
    gu.m.material.opacity = 0.9 * shown;
    const pulsePhase = time * 5;
    const pulse = 1 + 0.06 * Math.sin(pulsePhase);
    const ringScale = shown * pulse;
    gu.m.scale.setScalar(ringScale);
    const altGap = altA - gu.alt;
    if (!held && gu.v.dot(p) > 0.9999 && p.angleTo(gu.v) * S.R < 3 && Math.abs(altGap) < 3.4) {
      gu.on = false;
      pl.boost = Math.max(pl.boost, 1.6);
      pl.vy = Math.max(pl.vy, 3.2);
      if (pl.air <= 0) pl.air = 0.01;
      B.pops++;
      const popAt = gu.m.position.clone();
      burst(g, popAt, 12, 10);
    } else if (gu.t > 14 || p.angleTo(gu.v) * S.R > 120) gu.on = false;
  }
  D.bored += dt;
  if (B.pops !== D.lastPops) {
    D.lastPops = B.pops;
    D.bored = 0;
  }
  if (held || (pl.vy > 5 && D.pvy <= 5)) D.bored = 0;
  D.pvy = pl.vy;
  D.crT -= dt;
  if (D.crT <= 0) {
    D.crT = 0.25;
    const nearC = isCreatureNear(g);
    // 새로 마주친 순간만 '일이 있었다'로 친다. 곁에 계속 있는 것은 치지 않는다
    if (nearC && !D.wasNear) D.bored = 0;
    D.wasNear = nearC;
  }
  const patience = pl.air > 2.5 ? 2.2 : 3;
  if (!B.off && D.bored > patience && B.moved > 0.3 && !held) D.bored = direct(g, altA) ? 0.8 : 2.4;
}

/* ─── 내부 ─────────────────────────── */

// 따라오지 않는 생물 하나라도 14m 안에 있나(무리는 무리 중심으로 본다)
function isCreatureNear(g: Game): boolean {
  const p = g.pl.p;
  for (const c of g.creatures.CR) {
    if (c.st === "follow") continue;
    const cv = c.hv || c.v || c.ctr || c.home;
    if (cv && cv.dot(p) > 0.9996 && p.angleTo(cv) * S.R < 14) return true;
  }
  return false;
}

// 가는 쪽에서 side 라디안 비튼 방향으로 d 만큼 앞의 자리
function onPath(g: Game, d: number, side: number): THREE.Vector3 {
  const { p, h } = g.pl;
  td.copy(h).applyAxisAngle(p, side);
  const arc = d / S.R;
  const stepLen = Math.tan(arc);
  return p.clone().addScaledVector(td, stepLen).normalize();
}

// 쉬는 방울 줄 하나를 v 부터 가는 쪽으로 5m 간격에 세운다. 높이는 altOf(번째, 자리)
function layTrail(g: Game, v: THREE.Vector3, altOf: (j: number, bv: THREE.Vector3) => number) {
  const TR = g.bubbleTrail.TR,
    h = g.pl.h;
  const tr = TR.find((row) => !row.live) || TR[0];
  td.copy(h);
  tr.bs.forEach((b, j) => {
    b.v.copy(v);
    b.alt = altOf(j, v);
    b.on = true;
    b.pop = 0;
    b.m.visible = true;
    b.m.scale.setScalar(0.01);
    const upPart = td.dot(v);
    td.addScaledVector(v, -upPart).normalize();
    const gapArc = 5 / S.R;
    const gapStep = Math.tan(gapArc);
    v.addScaledVector(td, gapStep).normalize();
  });
  tr.live = true;
  tr.age = 0;
}

// 앞길에 하나 피운다. 놀이기구 길목(corNear)과 막힌 자리(freeAt)에는 놓지 않는다(입구 앞에서 튕겨 내면 기구를 못 탄다)
function direct(g: Game, altA: number): boolean {
  const pl = g.pl,
    D = g.director,
    spd = g.bubbleTrail.spd;
  const leadFar = spd * 1.9;
  const lead = Math.max(15, leadFar);
  if (pl.air > 2.5) {
    // 떠 있을 때: 떨어질 길 위에 방울
    const dropFar = spd * 1.1;
    const dropDist = Math.max(8, dropFar);
    const v = onPath(g, dropDist, 0);
    const pace = Math.max(4, spd);
    const step = 5 / pace;
    let a = altA,
      vv = pl.vy * 2.2;
    for (let k = 0; k < 22; k++) {
      const fall = vv - 7.04 * 0.05;
      vv = Math.max(-9.2, fall);
      a += vv * 0.05;
    }
    const ticks = step / 0.05;
    const ticksPerBubble = Math.round(ticks);
    layTrail(g, v, (j, bv) => {
      for (let k = 0; k < ticksPerBubble; k++) {
        const fall = vv - 7.04 * 0.05;
        vv = Math.max(-9.2, fall);
        a += vv * 0.05;
      }
      const ground = groundAt(g, bv);
      const floor = Math.max(ground, 0) + S.hover + 0.2;
      return Math.max(a, floor);
    });
    return true;
  }
  let v: THREE.Vector3 | null = null;
  for (const s of [0, 0.1, -0.1, 0.2, -0.2]) {
    const c = onPath(g, lead, s);
    if (freeAt(g, c, 3) && !corNear(g, c, 5)) {
      v = c;
      break;
    }
  }
  if (!v) return false;
  const kind = D.dirK++ % 3;
  if (kind === 0) {
    layTrail(g, v, (j, bv) => {
      const ground = groundAt(g, bv);
      return Math.max(ground, 0) + S.hover + 0.2;
    });
  } else if (kind === 1) {
    const sp = nextSprout(g);
    sp.on = true;
    sp.v.copy(v);
    sp.t = 0;
    const ground = groundAt(g, v);
    sp.g = Math.max(ground, 0);
    sp.cool = 0;
    sp.sq = 0;
  } else {
    const gu = D.GUST[D.gI++ % D.GUST.length];
    gu.v.copy(v);
    const ground = groundAt(g, v);
    gu.alt = Math.max(ground, 0) + S.hover + 0.4;
    gu.on = true;
    gu.t = 0;
    const h = pl.h;
    const hUp = h.dot(v);
    gz.copy(h).addScaledVector(v, -hUp).normalize();
    gx.crossVectors(v, gz).normalize();
    gm.makeBasis(gx, v, gz);
    gu.m.quaternion.setFromRotationMatrix(gm);
    const ringR = S.R + gu.alt;
    gu.m.position.copy(v).multiplyScalar(ringR);
  }
  return true;
}
