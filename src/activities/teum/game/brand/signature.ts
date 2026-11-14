import * as THREE from "three";

import { burst } from "../fx/sparks";
import { say } from "../hud";
import { hubAt } from "../scenery/spots";
import type { Game } from "../state";
import { S } from "../state";
import { fr } from "../world/flowers";
import { offset, START, UP } from "../world/sphere";
import { groundAt } from "../world/terrain";
import type { Lawn } from "./lawn";
import { createLawnMesh } from "./lawn";
import { createLogoTextures } from "./logo";

// suaci 의 서명: 크게 말하지 않고, 스스로 알아차리게 둔다(브랜드 원칙 '넛지'). 제품도 문구도 구매 단추도 없다. suaci 것은 라임.
// 1) 로고 풍선 — 마을마다 하나, 마을 사이에 드문드문. 줄을 잡으면 잠깐 태워 올려 준다(take suaci = 잡으면 떠오른다)
// 2) 잔디 로고 — lawn.ts
// 3) 높은 풍선 — 출발 마을에서 가장 가까운 로켓 바로 위, 로켓으로만 닿는 높이. 뚫고 지나가면 라임 안개가 터진다
// 4) 라임 안개 — 쉬는 곳에 들어서는 순간 한 번 퍼진다(칙, 하고 뿌린 듯). 병은 보이지 않고 안개만 있다
// 5) 쉬는 곳의 라임 깃발 — 글자 없이 색만. 멀리서 '저기 쉴 곳'이라고 알려 준다
// 6) 전설의 도장 — 전설의 손님을 만난 자리에 작은 라임 워드마크가 그 방문 동안 남는다. 만난 사람만 가진 흔적

/** 로고 풍선 하나: 제자리(home)·떠 있는 높이(top)·태워 올리는 중(ride)·다시 뜰 때까지(cool)·크기(k) */
interface LogoBalloon {
  g: THREE.Group;
  home: THREE.Vector3;
  v: THREE.Vector3;
  g0: number;
  alt: number;
  top: number;
  ph: number;
  ride: number;
  cool: number;
  k: number;
  /** 높은 풍선이면 그 배율(0 이면 보통 풍선) */
  big: number;
}

/** 라임 안개 한 번 */
interface Mist {
  m: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  t: number;
  s: number;
}

/** 쉬는 곳 깃발 */
interface Flag {
  s: Game["sites"][number];
  fl: THREE.Mesh;
  inn: boolean;
}

/** 전설의 도장 */
interface Stamp {
  m: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  k: number;
  on: boolean;
}

/** suaci 서명 전체 */
export interface Signature {
  BAL: LogoBalloon[];
  lawn: THREE.Mesh;
  MIST: Mist[];
  mI: number;
  FLAGS: Flag[];
  STAMPS: Stamp[];
  stI: number;
  /** "take suaci." 는 한 번만 */
  saidTake: boolean;
}

const q0b = new THREE.Vector3(),
  bq = new THREE.Quaternion(),
  by = new THREE.Quaternion(),
  sm = new THREE.Matrix4(),
  sx = new THREE.Vector3(),
  su = new THREE.Vector3();

/** 서명을 놓는다(풍경을 다 놓고 고래 길을 정한 뒤, 방울 길보다 먼저 — 시제품 순서) */
export function createSignature(g: Game, lawnSpot: Lawn): Signature {
  const tex = createLogoTextures();
  const bGeo = new THREE.SphereGeometry(1.75, 36, 24),
    kGeo = new THREE.ConeGeometry(0.24, 0.4, 12),
    bMat = new THREE.MeshStandardMaterial({
      map: tex.balloon,
      roughness: 0.28,
      metalness: 0,
      emissive: 0xffffff,
      emissiveMap: tex.balloon,
      emissiveIntensity: 0.55,
    }),
    kMat = new THREE.MeshBasicMaterial({ color: 0x141414 }),
    sMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  const BAL: LogoBalloon[] = [];
  const mkBal = (home: THREE.Vector3 | null, alt: number, big?: number) => {
    if (!home) return;
    const gr = new THREE.Group(),
      body = new THREE.Mesh(bGeo, bMat),
      knot = new THREE.Mesh(kGeo, kMat),
      L = big ? 6 : alt - 2.4;
    const strGeo = new THREE.CylinderGeometry(0.03, 0.03, L, 5);
    const str = new THREE.Mesh(strGeo, sMat);
    body.scale.set(1, 1.14, 1);
    knot.position.y = -2.1;
    str.position.y = -2.3 - L / 2;
    gr.add(body, knot, str);
    if (big) gr.userData.big = big;
    gr.traverse((c) => {
      c.frustumCulled = false;
    });
    gr.visible = false;
    g.scene.add(gr);
    const ground = groundAt(g, home);
    BAL.push({
      g: gr,
      home: home.clone().normalize(),
      v: home.clone().normalize(),
      g0: Math.max(ground, 0),
      alt,
      top: alt,
      ph: Math.random() * 6.28,
      ride: 0,
      cool: 0,
      k: 1,
      big: big || 0,
    });
  };
  const HV = g.scenery.HV;
  for (let hk = 0; hk < HV.length; hk++) {
    const hubBear = 35 + hk * 67;
    const spot = hubAt(g, hk, 34, hubBear);
    mkBal(spot, 13); // 마을마다 하나
  }
  for (let i = 0; i < 6; i++) {
    const far = 250 + 40 * fr(i, 901),
      bear = 60 * i + 360 * fr(i, 902);
    const hub = HV[i % HV.length];
    const spot = offset(hub, far, bear);
    mkBal(spot, 17); // 마을 사이
  }
  const lawn = createLawnMesh(g, lawnSpot, tex.lawn);
  // 높은 풍선: 출발 마을에서 가장 가까운 로켓 바로 위 138m
  {
    let rk: Game["rockets"][number] | null = null,
      rd = 1e9;
    for (const r of g.rockets) {
      const d = r.v.angleTo(START);
      if (d < rd) {
        rd = d;
        rk = r;
      }
    }
    if (rk) mkBal(rk.v, 138, 4.2);
  }
  const MIST: Mist[] = [];
  for (let i = 0; i < 4; i++) {
    const mistGeo = new THREE.SphereGeometry(1, 16, 12);
    const mistMat = new THREE.MeshBasicMaterial({
      color: 0xa9ff39,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    const m = new THREE.Mesh(mistGeo, mistMat);
    m.visible = false;
    m.frustumCulled = false;
    g.scene.add(m);
    MIST.push({ m, t: 9, s: 1 });
  }
  const FLAGS: Flag[] = [];
  {
    const tri = new THREE.BufferGeometry();
    const triPos = new THREE.Float32BufferAttribute([0, 0, 0, 0, -1.1, 0, 2.3, -0.55, 0], 3);
    tri.setAttribute("position", triPos);
    tri.computeVertexNormals();
    const fMat = new THREE.MeshBasicMaterial({ color: 0xa9ff39, side: THREE.DoubleSide }),
      pGeo = new THREE.CylinderGeometry(0.06, 0.06, 7, 6);
    for (const s of g.sites) {
      if (s.kind !== "rest") continue;
      const flagFar = (s.r || 6) * 0.95;
      const v = offset(s.v, flagFar, 40),
        gr = new THREE.Group(),
        pole = new THREE.Mesh(pGeo, sMat),
        fl = new THREE.Mesh(tri, fMat);
      pole.position.y = 3.5;
      fl.position.y = 6.9;
      gr.add(pole, fl);
      gr.traverse((c) => {
        c.frustumCulled = false;
      });
      const ground = groundAt(g, v);
      const baseR = S.R + Math.max(ground, 0);
      gr.position.copy(v).multiplyScalar(baseR);
      gr.quaternion.setFromUnitVectors(UP, v);
      g.scene.add(gr);
      FLAGS.push({ s, fl, inn: false });
    }
  }
  const STAMPS: Stamp[] = [];
  for (let i = 0; i < 6; i++) {
    const stampH = (9 * 256) / 1024;
    const stampGeo = new THREE.PlaneGeometry(9, stampH);
    const stampMat = new THREE.MeshBasicMaterial({
      map: tex.lawn,
      color: 0xa9ff39,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const m = new THREE.Mesh(stampGeo, stampMat);
    m.visible = false;
    m.frustumCulled = false;
    m.renderOrder = 1;
    g.scene.add(m);
    STAMPS.push({ m, k: 0, on: false });
  }
  return { BAL, lawn, MIST, mI: 0, FLAGS, STAMPS, stI: 0, saidTake: false };
}

/** 전설의 손님을 만난 자리(v)에 작은 라임 워드마크를 찍고 안개를 한 번 뿌린다 */
export function stampAt(g: Game, v: THREE.Vector3) {
  const sig = g.signature,
    h = g.pl.h;
  const o = sig.STAMPS[sig.stI++ % sig.STAMPS.length];
  const hUp = h.dot(v);
  su.copy(h).addScaledVector(v, -hUp).normalize();
  sx.crossVectors(su, v).normalize();
  sm.makeBasis(sx, su, v);
  o.m.quaternion.setFromRotationMatrix(sm);
  const ground = groundAt(g, v);
  const stampR = S.R + Math.max(ground, 0) + 0.3;
  o.m.position.copy(v).multiplyScalar(stampR);
  o.m.visible = true;
  o.on = true;
  o.k = 0;
  const at = o.m.position.clone();
  mist(g, at, 9);
}

/** 서명 프레임: 안개가 퍼졌다 사라지고, 깃발이 나부끼고(쉬는 곳에 들어서면 안개), 도장이 떠오르고, 풍선이 뜨거나 태워 올린다 */
export function signatureFrame(g: Game) {
  const { pl, t, time } = g,
    { p, P } = pl,
    dt = t.dt,
    held = t.held,
    sig = g.signature;
  const altA = P.length() - S.R;
  for (const o of sig.MIST) {
    if (o.t > 1.6) {
      o.m.visible = false;
      continue;
    }
    o.t += dt;
    const k = o.t / 1.6;
    const left = 1 - k;
    const easeOut = 1 - Math.pow(left, 3);
    const spread = 0.25 + 0.75 * easeOut;
    const size = o.s * spread;
    o.m.scale.setScalar(size);
    const fadeK = k * 8;
    const fadeIn = Math.min(1, fadeK);
    o.m.material.opacity = 0.42 * (1 - k) * fadeIn;
  }
  for (const f of sig.FLAGS) {
    const flutterA = time * 2.2 + f.s.dist,
      flutterB = time * 5.1;
    f.fl.rotation.y = 0.5 * Math.sin(flutterA) + 0.25 * Math.sin(flutterB);
    const restR = f.s.r || 6;
    const inn = pl.air < 4 && p.angleTo(f.s.v) * S.R < restR;
    if (inn && !f.inn) {
      const at = P.clone();
      mist(g, at, 8);
    }
    f.inn = inn;
  }
  for (const o of sig.STAMPS)
    if (o.on && o.k < 1) {
      const grown = o.k + dt * 1.2;
      o.k = Math.min(1, grown);
      o.m.material.opacity = 0.9 * o.k;
    }
  for (const b of sig.BAL) balloonFrame(g, b, altA, held);
}

/* ─── 내부 ─────────────────────────── */

function ezb(r: number, dt: number) {
  const decay = -r * dt;
  return 1 - Math.exp(decay);
}

// 다음 안개 하나를 그 자리에서 퍼뜨린다
function mist(g: Game, pos: THREE.Vector3, size?: number) {
  const sig = g.signature;
  const o = sig.MIST[sig.mI++ % sig.MIST.length];
  o.m.position.copy(pos);
  o.t = 0;
  o.s = size || 7;
  o.m.visible = true;
}

// 처음 잡거나 처음 뚫을 때 한 번만 "take suaci."
function sayTakeOnce(g: Game) {
  if (g.signature.saidTake) return;
  g.signature.saidTake = true;
  say(g, "take suaci.");
}

// 풍선 하나: 잡으면 머리 위에서 끌어 올리고(약 3초), 놓으면 날아갔다가 한참 뒤 제자리에 다시 뜬다. 높은 풍선은 뚫으면 안개
function balloonFrame(g: Game, b: LogoBalloon, altA: number, held: boolean) {
  const { pl, t, time } = g,
    { p, P } = pl,
    dt = t.dt;
  const near = b.v.dot(p) > 0.9;
  b.g.visible = near && b.k > 0.02;
  if (!near && b.ride <= 0 && b.cool <= 0) return;
  if (b.ride > 0) {
    // 줄을 잡았다: 풍선이 머리 위에서 끌어 올린다
    b.ride -= dt;
    pl.vy = Math.max(pl.vy, 5.4);
    if (pl.air <= 0) pl.air = 0.01;
    const pull = ezb(9, dt);
    b.v.lerp(p, pull).normalize();
    b.top += (altA + 4.6 - b.g0 - b.top) * pull;
    if (b.ride <= 0) b.cool = 22;
  } else if (b.cool > 0) {
    // 놓고 나면 풍선은 위로 날아가며 작아지고, 한참 뒤 제자리에 다시 뜬다
    b.cool -= dt;
    if (b.cool > 18) {
      b.top += 7 * dt;
      const shrunk = b.k - dt * 0.45;
      b.k = Math.max(0, shrunk);
    } else if (b.cool > 2) {
      b.k = 0;
      b.v.copy(b.home);
      b.top = b.alt;
    } else {
      const grown = b.k + dt * 0.6;
      b.k = Math.min(1, grown);
    }
  } else if (b.big) {
    b.v.copy(b.home);
    const swayPhase = time * 0.5 + b.ph;
    const target = b.alt + 1.5 * Math.sin(swayPhase);
    const ease = ezb(2, dt);
    b.top += (target - b.top) * ease;
    b.k = 1;
    const altGap = altA - (b.g0 + b.top);
    if (!held && p.angleTo(b.v) * S.R < 9 && Math.abs(altGap) < 10) {
      b.cool = 22;
      const burstAt = P.clone();
      burst(g, burstAt, 30, 14);
      const mistAt = P.clone();
      mist(g, mistAt, 22);
      pl.vy = Math.max(pl.vy, 2.5);
      sayTakeOnce(g);
    }
  } else {
    const circleBear = time * 5 + b.ph * 57.3;
    const circleSpot = offset(b.home, 4.5, circleBear);
    q0b.copy(circleSpot);
    const drift = ezb(2, dt);
    b.v.lerp(q0b, drift).normalize();
    const swayPhase = time * 0.8 + b.ph;
    const target = b.alt + 0.7 * Math.sin(swayPhase);
    const ease = ezb(2, dt);
    b.top += (target - b.top) * ease;
    b.k = 1;
    if (
      !held &&
      b.v.dot(p) > 0.99995 &&
      p.angleTo(b.v) * S.R < 2.5 &&
      altA < b.g0 + b.top + 1 &&
      altA > b.g0 + 0.8
    ) {
      b.ride = 3;
      const burstAt = P.clone();
      burst(g, burstAt, 10, 9);
      sayTakeOnce(g);
    }
  }
  bq.setFromUnitVectors(UP, b.v);
  const spinAngle = time * 0.25 + b.ph;
  by.setFromAxisAngle(UP, spinAngle);
  b.g.quaternion.copy(bq).multiply(by);
  const radius = S.R + b.g0 + b.top;
  b.g.position.copy(b.v).multiplyScalar(radius);
  const scale = b.k * (b.big || 1);
  b.g.scale.setScalar(scale);
}
