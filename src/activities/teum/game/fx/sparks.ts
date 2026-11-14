import * as THREE from "three";

import { featGround } from "../world/terrain";
import type { Game } from "../state";
import { LIME, S } from "../state";

// 빛과 입자: 위로 튀어 오르는 빛 방울, 반응한 것 둘레에 번지는 라임 빛, 공기 중에 떠다니는 작은 입자

/** 빛 방울 하나 */
export interface Spark {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  t: number;
  life: number;
  size: number;
}

/** 빛·입자 전체 */
export interface Fx {
  sparks: Spark[];
  glows: THREE.Sprite[];
  /** 이번 프레임에 쓴 빛 수 */
  gi: number;
  glowK: number;
  fxOn: boolean;
  motes: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  motePos: Float32Array;
  moteInit: boolean;
}

const GLOW_N = 80,
  MOTE_N = 240;
const gp = new THREE.Vector3();

/** 빛 방울을 튀긴다(최근 60개까지) */
export function burst(g: Game, pos: THREE.Vector3, n: number, power: number) {
  const sparks = g.fx.sparks;
  for (let k = 0; k < n; k++) {
    const up = pos.clone().normalize();
    // 난수 순서: 흩어지는 방향 x·y·z → 위로 솟는 힘 → 수명 → 크기
    const dirX = Math.random() - 0.5;
    const dirY = Math.random() - 0.5;
    const dirZ = Math.random() - 0.5;
    const spread = power * 0.7;
    const lift = power * (0.6 + Math.random() * 0.7);
    const v = new THREE.Vector3(dirX, dirY, dirZ).multiplyScalar(spread).addScaledVector(up, lift);
    const life = 1.1 + Math.random() * 0.7;
    const size = 1.2 + Math.random() * 1.4;
    const start = pos.clone();
    sparks.push({ pos: start, vel: v, t: 0, life, size });
    if (sparks.length > 60) sparks.shift();
  }
}

/** 빛 방울 목록, 라임 빛 스프라이트, 떠다니는 입자를 만든다 */
export function createFx(g: Game): Fx {
  const glowTex = createGlowTexture();
  const glows: THREE.Sprite[] = [];
  for (let i = 0; i < GLOW_N; i++) {
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: LIME,
      transparent: true,
      depthWrite: false,
      fog: false,
      opacity: 0,
    });
    const sp = new THREE.Sprite(glowMat);
    sp.visible = false;
    g.scene.add(sp);
    glows.push(sp);
  }
  const moteFloats = MOTE_N * 3;
  const motePos = new Float32Array(moteFloats),
    moteCol = new Float32Array(moteFloats),
    moteGeo = new THREE.BufferGeometry();
  for (let i = 0; i < MOTE_N; i++) {
    const isLime = i % 3 === 0;
    const rgb = isLime ? [0.66, 1, 0.22] : [1, 1, 1];
    const offset = i * 3;
    moteCol.set(rgb, offset);
  }
  const posAttr = new THREE.BufferAttribute(motePos, 3);
  moteGeo.setAttribute("position", posAttr);
  const colAttr = new THREE.BufferAttribute(moteCol, 3);
  moteGeo.setAttribute("color", colAttr);
  const moteMat = new THREE.PointsMaterial({
    map: glowTex,
    size: 0.55,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    vertexColors: true,
    fog: false,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  motes.visible = false;
  g.scene.add(motes);
  return { sparks: [], glows, gi: 0, glowK: 0.7, fxOn: false, motes, motePos, moteInit: false };
}

/** 빛 하나를 그 자리에 둔다(이번 프레임) */
export function glowAt(g: Game, pos: THREE.Vector3, size: number, a: number) {
  const fx = g.fx;
  if (fx.gi >= GLOW_N || a < 0.03) return;
  const sp = fx.glows[fx.gi++];
  sp.visible = true;
  sp.position.copy(pos);
  sp.scale.setScalar(size);
  sp.material.opacity = Math.min(1, a) * fx.glowK;
}

/** 빛·입자·땅 시간·하늘 위치를 이번 프레임에 맞춘다 */
export function fxFrame(g: Game, pulse: number) {
  const fx = g.fx,
    { pl, time } = g,
    dt = g.t.dt,
    p = pl.p,
    P = pl.P;
  fx.gi = 0;
  g.ground.GND.uT.value = time;
  g.sky.mesh.position.copy(g.camera.position);
  g.sky.SKY.uUp.value.copy(p);
  if (fx.fxOn) {
    const PV = g.places.PV,
      PLZ = g.places.PLZ;
    for (const st of g.sites)
      if (st.lit > 0.02) {
        const size = st.kind === "land" ? 30 : 14;
        const alpha = st.lit * 0.7;
        glowAt(g, st.pos, size, alpha);
      }
    gp.copy(PV[3]);
    const beaconR = S.R + featGround(g, PV[3]) + 24;
    gp.multiplyScalar(beaconR);
    const beaconSize = 42 + pulse * 30;
    const beaconAlpha = 0.55 + pulse * 0.4;
    glowAt(g, gp, beaconSize, beaconAlpha);
    g.me.cat.getWorldPosition(gp);
    glowAt(g, gp, 1.8, 0.5);
    for (const st of g.stars.list)
      if (st.st === 1) glowAt(g, st.pos, 2.4, 0.85);
      else if (st.st === 2) {
        const fade = 1 - st.t / 2.4;
        glowAt(g, st.pos, 3.4, fade);
      }
    for (const r of g.rings) if (r.lit > 0) glowAt(g, r.pos, 15, r.lit);
    for (const pll of g.pillars.list)
      if (pll.lit > 0) {
        const alpha = pll.lit * 0.8;
        glowAt(g, pll.head.position, 6.5, alpha);
      }
    for (const c of g.chimes)
      if (c.lit > 0) {
        gp.copy(c.g.position).addScaledVector(c.v, 2.6);
        glowAt(g, gp, 3.6, c.lit);
      }
    for (const b of g.bumpers) if (b.lit > 0) glowAt(g, b.m.position, 8, b.lit);
    for (const pd of g.pads.list)
      if (pd.sq > 0) {
        const size = pd.hop ? 7 : 11;
        const squashPhase = pd.sq * Math.PI;
        const alpha = Math.sin(squashPhase);
        glowAt(g, pd.m.position, size, alpha);
      }
    for (const c of g.cannons)
      if (c.lit > 0) {
        gp.copy(c.g.position).addScaledVector(c.v, 3);
        glowAt(g, gp, 11, c.lit);
      }
    for (const ho of g.holes) if (ho.lit > 0) glowAt(g, ho.g.position, 10, ho.lit);
    for (const sg of g.slings) if (sg.lit > 0) glowAt(g, sg.mid, 6, sg.lit);
    for (let i = 0; i < 3; i++)
      if (PLZ[i].lit > 0) {
        gp.copy(PV[i]);
        const placeR = S.R + featGround(g, PV[i]) + PLZ[i].top * 0.7;
        gp.multiplyScalar(placeR);
        const alpha = PLZ[i].lit * 0.8;
        glowAt(g, gp, 24, alpha);
      }
    for (const sk of fx.sparks) {
      const remain = 1 - sk.t / sk.life;
      const size = sk.size * remain + 0.3;
      glowAt(g, sk.pos, size, remain);
    }
    for (const sp of g.seeds.sprouts)
      if (sp.on) {
        const alpha = 0.45 + sp.sq;
        glowAt(g, sp.m.position, 5.5, alpha);
      }
    for (const f of g.funnels)
      if (f.lit > 0) {
        const alpha = f.lit * 0.7;
        glowAt(g, f.g.position, 26, alpha);
      }
    if (g.rails.railOn) glowAt(g, P, 3.2, 0.8);
    for (const sw of g.swings)
      if (sw.lit > 0) {
        const alpha = sw.lit * 0.7;
        glowAt(g, sw.end, 4, alpha);
      }
    // 입자: 내 둘레 45 안에서 천천히 떠오른다. 멀어지면 내 둘레에 다시 놓는다
    const motePos = fx.motePos;
    for (let i = 0; i < MOTE_N; i++) {
      const j = i * 3;
      gp.fromArray(motePos, j);
      if (!fx.moteInit || gp.distanceToSquared(P) > 2025) {
        // 난수 순서: 방향 x·y·z → 거리
        const dirX = Math.random() - 0.5;
        const dirY = Math.random() - 0.5;
        const dirZ = Math.random() - 0.5;
        const dist = 8 + Math.random() * 36;
        gp.set(dirX, dirY, dirZ).normalize().multiplyScalar(dist).add(P);
      }
      const rise = dt * (0.25 + (i % 5) * 0.08);
      gp.addScaledVector(p, rise);
      const swayPhase = time * 0.7 + i;
      gp.x += Math.sin(swayPhase) * dt * 0.3;
      motePos[j] = gp.x;
      motePos[j + 1] = gp.y;
      motePos[j + 2] = gp.z;
    }
    fx.moteInit = true;
    fx.motes.geometry.attributes.position.needsUpdate = true;
  }
  const sparks = fx.sparks;
  const fall = -9 * dt;
  for (let k = sparks.length - 1; k >= 0; k--) {
    // 빛 방울: 떠올랐다 떨어지며 사라진다
    const sk = sparks[k];
    sk.t += dt;
    if (sk.t >= sk.life) {
      sparks.splice(k, 1);
      continue;
    }
    gp.copy(sk.pos).normalize();
    sk.vel.addScaledVector(gp, fall);
    sk.pos.addScaledVector(sk.vel, dt);
  }
  for (let k = fx.gi; k < GLOW_N; k++) fx.glows[k].visible = false;
}

/* ─── 내부 ─────────────────────────── */

// 빛 스프라이트와 입자가 같이 쓰는 둥근 번짐 그림(가운데 흰색 → 가장자리 투명)
function createGlowTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const c = cv.getContext("2d")!;
  const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.3, "rgba(255,255,255,.5)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gr;
  c.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}
