import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { LayoutLandmark, LayoutTier } from "../maps/layout";
import type { Hold } from "../models/library";
import type { Services } from "../services";
import { LIME, S } from "../settings";
import { from } from "../world/sphere";
import { PLATE_H } from "./decor";
import { SPARKLE_CROSS, SPARKLE_DOT, SparklePoints } from "./sparkles";

// 거인의 케이크 — "나 랜드마크요!"(기획 MAP-03 2장): cake 모델을 랜드마크 높이(70m)로 흰 접시 위에 세우고(체리는 꾸밈이 얹는다),
// 꼭대기 층에 줄무늬 초 다섯과 살랑이는 불꽃(복숭아·흰 — 노랑 금지), 꼭대기 위로 분홍 빛 기둥(안에서 반짝이가 오르고 끝에 라임 리본),
// 5초마다 꼭대기에서 반짝이 분수, 케이크 둘레를 나선으로 오르는 흰 반짝이(60m 안이면 두 배 빠르게).
// 케이크는 발판이다 — 층 윗면에 내려앉을 수 있고 옆면은 막힌다(숨는 자리가 층 위에 있다). 모양은 모델이 오면 높이 2m 띠마다
// 반지름을 재서 쓴다(자리표의 층 tiers 는 모델이 오기 전의 어림 — 둘이 다르면 RESULT 로 기획에 알린다).
// 빛 기둥은 이 지역 게임을 안 했을 때만이다 — 랜드마크 게임이 아직 없어 늘 켠다. 오르골 소리는 기획이 넘기면 붙인다

/** 빛 기둥: 높이(m)·반지름(m)·색 · 끝 리본 크기(m) */
const BEACON = { height: 120, radius: 6, color: 0xffaad2 } as const;
const RIBBON = { w: 9, h: 3.2 } as const;
/** 반짝이 분수: 수 · 몇 초마다 · 솟는 높이(m) · 한 번의 수명(초) · 옆으로 퍼지는 빠르기(m/s) */
const FOUNTAIN = { count: 140, every: 5, rise: 40, life: 5.2, spread: 7 } as const;
/** 나선 반짝이: 수 · 바퀴 수 · 한 번 다 오르는 시간(초) · 빨라지는 거리(m)·배 · 케이크 옆에서 떨어진 거리(m) */
const SPIRAL = { count: 60, turns: 4, climb: 36, near: 60, boost: 2, gap: 2.5 } as const;
/** 빛 기둥 안의 반짝이: 수 · 한 번 다 오르는 시간(초) */
const BEAM_SPARKS = { count: 36, climb: 16 } as const;
/** 초: 수 · 꼭대기 층에서 둘레 반지름(m) · 키(m) · 굵기(반지름 m) */
const CANDLE = { count: 5, ring: 6.5, height: 6, radius: 0.7 } as const;
/** 반짝이 색: 흰·분홍·코발트 */
const SPARK_COLORS = [0xffffff, 0xff8fbe, 0x2a4fd0];
/** 불꽃 색: 복숭아 · 흰 */
const FLAME = { peach: 0xffb48a, white: 0xffffff } as const;
/** 떨어지는 반짝이의 중력(m/s²) · 옆으로 느려지는 몫(1/초) */
const GRAVITY = 9.8,
  DRAG = 0.6;
/** 층 윗면에 올라서는 높이 폭(m) — 이만큼 아래에서 닿아도 윗면으로 올린다 · 몸 반지름(m) */
const STEP_UP = 1.5,
  BODY = 0.9;
/** 모델 모양을 재는 높이 띠(m) */
const BAND = 2;

/** 꼭대기에서 솟는 반짝이 하나 */
interface Spark {
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  color: THREE.Color;
  shape: number;
  size: number;
}

/** 거인의 케이크 */
export class GiantCake implements Thing {
  private readonly root = new THREE.Group();
  private readonly land: LayoutLandmark;
  private readonly tiers: readonly LayoutTier[];
  private readonly v: THREE.Vector3;
  private readonly plateR: number;
  private readonly top: number;
  private readonly flames: THREE.Group[] = [];
  /** 초 다섯(꼭대기 높이가 정해지면 올린다) */
  private readonly candles = new THREE.Group();
  /** 접시 바닥에서 BAND 띠마다 케이크 반지름(m) — 모델이 오면 잰다, 그 전에는 자리표의 층 */
  private profile: number[];
  private readonly ribbon: THREE.Mesh;
  private readonly beamMat: THREE.ShaderMaterial;
  private readonly points: SparklePoints;
  private readonly sparks: Spark[] = [];
  private readonly beamSeeds: { a: number; r: number; phase: number }[] = [];
  private readonly owned: { dispose(): void }[] = [];
  private nextBurst = 1;
  private spiralT = 0;
  private spiralRate = 1;
  private ground = 0;
  private readonly rand: () => number;
  private readonly tmp = new THREE.Vector3();
  private readonly color = new THREE.Color();

  /** land: 모델이 있는 랜드마크(자리표 landmark 의 model) */
  constructor(
    private readonly s: Services,
    land: LayoutLandmark,
  ) {
    this.land = land;
    this.tiers = land.tiers ?? [];
    this.v = from(land.dist, land.bear);
    const plate = s.layout.decor?.find((d) => d.model === "plate");
    this.plateR = plate?.r ?? 0;
    this.top = PLATE_H + land.height;
    const rng = s.rng.fork("cake");
    this.rand = () => rng.next();
    // ---- 케이크 ----
    this.profile = profileOfTiers(this.tiers);
    const model = land.model;
    if (model && s.models.has(model)) {
      const hold = s.models.fit(model, land.height, "h");
      hold.position.y = PLATE_H + hold.userData.hh;
      this.root.add(hold);
      s.models.when(model, () => this.measure(hold));
    }
    this.buildCandles();
    this.root.add(this.candles);
    this.seatCandles();
    // ---- 빛 기둥 ----
    const beamGeo = new THREE.CylinderGeometry(
      BEACON.radius,
      BEACON.radius,
      BEACON.height,
      28,
      1,
      true,
    );
    const halfBeam = BEACON.height / 2;
    beamGeo.translate(0, halfBeam, 0);
    const beamColor = new THREE.Color(BEACON.color);
    this.beamMat = beamMaterial(beamColor);
    const beam = new THREE.Mesh(beamGeo, this.beamMat);
    beam.position.y = this.top;
    beam.renderOrder = 3;
    beam.frustumCulled = false;
    const ribbonGeo = new THREE.PlaneGeometry(RIBBON.w, RIBBON.h, 10, 2);
    const ribbonHalf = RIBBON.w / 2;
    ribbonGeo.translate(ribbonHalf, 0, 0);
    const ribbonMat = new THREE.MeshBasicMaterial({ color: LIME, side: THREE.DoubleSide });
    this.ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    const ribbonY = this.top + BEACON.height;
    this.ribbon.position.y = ribbonY;
    this.root.add(beam, this.ribbon);
    this.owned.push(beamGeo, this.beamMat, ribbonGeo, ribbonMat);
    // ---- 반짝이 ----
    const total = FOUNTAIN.count + SPIRAL.count + BEAM_SPARKS.count;
    this.points = new SparklePoints(total);
    this.root.add(this.points.points);
    for (let i = 0; i < FOUNTAIN.count; i++) {
      const roll = this.rand() * SPARK_COLORS.length;
      const pick = Math.floor(roll);
      const color = new THREE.Color(SPARK_COLORS[pick]);
      const shape = this.rand() < 0.5 ? SPARKLE_DOT : SPARKLE_CROSS;
      const size = 0.9 + this.rand() * 0.9;
      const spark = {
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        age: 1e9,
        color,
        shape,
        size,
      };
      this.sparks.push(spark);
    }
    for (let i = 0; i < BEAM_SPARKS.count; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = this.rand() * BEACON.radius * 0.7;
      const phase = this.rand();
      this.beamSeeds.push({ a, r, phase });
    }
    s.scene.add(this.root);
  }

  /** 땅 높이가 정해진 뒤 자리를 잡는다 */
  layout() {
    this.ground = this.s.terrain.featGround(this.v);
    const radius = S.R + this.ground;
    this.root.position.copy(this.v).multiplyScalar(radius);
    this.root.quaternion.setFromUnitVectors(UP, this.v);
  }

  /** 불꽃이 살랑, 리본이 펄럭, 반짝이가 솟고 오른다 · 층과 접시는 발판 */
  update(f: Frame) {
    const t = f.time,
      dt = f.dt;
    this.flames.forEach((fl, i) => {
      const wave = t * 11 + i * 1.7;
      const stretch = 1 + Math.sin(wave) * 0.14;
      fl.scale.set(1, stretch, 1);
      const sway = t * 3.1 + i;
      fl.rotation.z = Math.sin(sway) * 0.12;
    });
    const flap = t * 3;
    this.ribbon.rotation.y = Math.sin(flap) * 0.5;
    (this.beamMat.uniforms.uT as { value: number }).value = t;
    const d = this.s.player.p.angleTo(this.v) * S.R;
    // 60m 안이면 나선 반짝이가 두 배 빠르게(천천히 바뀐다)
    const want = d < SPIRAL.near ? SPIRAL.boost : 1;
    const easeStep = dt * 2;
    const ease = Math.min(1, easeStep);
    this.spiralRate += (want - this.spiralRate) * ease;
    this.spiralT += dt * this.spiralRate;
    if (t >= this.nextBurst) {
      this.burst();
      this.nextBurst = t + FOUNTAIN.every;
    }
    this.moveSparks(dt);
    this.placeSpiral();
    this.placeBeamSparks(t);
    const cam = this.s.camera.camera;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const viewHeight = innerHeight * dpr;
    this.points.commit(viewHeight, cam.fov);
    this.stand(d);
  }

  /** 치운다 */
  dispose() {
    this.root.removeFromParent();
    this.points.dispose();
    for (const o of this.owned) o.dispose();
  }

  // 모델이 오면 높이 띠마다 반지름을 재고, 초를 꼭대기 윗면에 다시 세운다
  private measure(hold: Hold) {
    this.root.updateMatrixWorld(true);
    const toRoot = this.root.matrixWorld.clone().invert();
    const radii: number[] = [];
    const p = new THREE.Vector3();
    hold.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const pos = o.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(toRoot);
        const level = p.y / BAND;
        const band = Math.floor(level);
        if (band < 0) continue;
        const r = Math.hypot(p.x, p.z);
        radii[band] = Math.max(radii[band] ?? 0, r);
      }
    });
    for (let k = 0; k < radii.length; k++) radii[k] = radii[k] ?? 0;
    this.profile = radii;
    this.seatCandles();
  }

  // 초 둘레 반지름의 윗면 높이에 초를 세운다
  private seatCandles() {
    const surface = this.surfaceAt(CANDLE.ring);
    this.candles.position.y = surface;
  }

  // 꼭대기 층 둘레에 줄무늬 초 다섯과 불꽃(초 무리의 바닥이 0 — seatCandles 가 올린다)
  private buildCandles() {
    const baseY = 0;
    const tex = stripeTexture();
    const bodyGeo = new THREE.CylinderGeometry(CANDLE.radius, CANDLE.radius, CANDLE.height, 18);
    const halfCandle = CANDLE.height / 2;
    bodyGeo.translate(0, halfCandle, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
    const outerGeo = new THREE.SphereGeometry(0.75, 16, 12);
    const innerGeo = new THREE.SphereGeometry(0.38, 12, 8);
    const outerMat = new THREE.MeshBasicMaterial({
      color: FLAME.peach,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      fog: false,
    });
    const innerMat = new THREE.MeshBasicMaterial({ color: FLAME.white, fog: false });
    this.owned.push(tex, bodyGeo, bodyMat, outerGeo, innerGeo, outerMat, innerMat);
    for (let i = 0; i < CANDLE.count; i++) {
      const a = (i / CANDLE.count) * Math.PI * 2;
      const x = Math.cos(a) * CANDLE.ring,
        z = Math.sin(a) * CANDLE.ring;
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.set(x, baseY, z);
      const flame = new THREE.Group();
      const outer = new THREE.Mesh(outerGeo, outerMat);
      outer.scale.set(1, 1.9, 1);
      const inner = new THREE.Mesh(innerGeo, innerMat);
      inner.scale.set(1, 1.6, 1);
      inner.position.y = -0.2;
      flame.add(outer, inner);
      const flameY = baseY + CANDLE.height + 1.1;
      flame.position.set(x, flameY, z);
      this.flames.push(flame);
      this.candles.add(body, flame);
    }
  }

  // 반짝이 분수 한 번: 꼭대기에서 위로 퐁(40m 쯤 솟는 빠르기), 옆으로 흩어진다
  private burst() {
    const upSq = 2 * GRAVITY * FOUNTAIN.rise;
    const up = Math.sqrt(upSq);
    const startY = this.top + 2;
    for (const sp of this.sparks) {
      const a = this.rand() * Math.PI * 2;
      const out = FOUNTAIN.spread * (0.3 + this.rand());
      const rise = up * (0.75 + 0.35 * this.rand());
      const vx = Math.cos(a) * out,
        vz = Math.sin(a) * out;
      sp.p.set(0, startY, 0);
      sp.v.set(vx, rise, vz);
      sp.age = 0;
    }
  }

  // 분수 반짝이: 떨어지며 옆으로 느려지고, 수명 끝에 옅어진다
  private moveSparks(dt: number) {
    const keep = 1 - DRAG * dt;
    this.sparks.forEach((sp, i) => {
      sp.age += dt;
      if (sp.age > FOUNTAIN.life) {
        this.points.hide(i);
        return;
      }
      sp.v.y -= GRAVITY * dt;
      sp.v.x *= keep;
      sp.v.z *= keep;
      sp.p.addScaledVector(sp.v, dt);
      const left = 1 - sp.age / FOUNTAIN.life;
      const bright = left * 2.5;
      const alpha = Math.min(1, bright);
      this.points.set(i, sp.p, sp.color, sp.shape, sp.size, alpha);
    });
  }

  // 나선 반짝이: 케이크 옆을 따라 바닥에서 꼭대기까지 돌며 오른다
  private placeSpiral() {
    const from0 = FOUNTAIN.count;
    this.color.setHex(0xffffff);
    for (let i = 0; i < SPIRAL.count; i++) {
      const lap = this.spiralT / SPIRAL.climb + i / SPIRAL.count;
      const share = lap - Math.floor(lap);
      const y = PLATE_H + share * this.land.height;
      const angle = share * SPIRAL.turns * Math.PI * 2 + i * 2.39996;
      const reach = this.radiusAt(y) + SPIRAL.gap;
      const x = Math.cos(angle) * reach,
        z = Math.sin(angle) * reach;
      this.tmp.set(x, y, z);
      const rising = share * 8,
        leaving = (1 - share) * 8;
      const fadeIn = Math.min(1, rising),
        fadeOut = Math.min(1, leaving);
      const alpha = Math.min(fadeIn, fadeOut);
      const slot = from0 + i;
      this.points.set(slot, this.tmp, this.color, SPARKLE_DOT, 0.8, alpha);
    }
  }

  // 빛 기둥 안의 반짝이: 천천히 오르며 위로 갈수록 옅다
  private placeBeamSparks(t: number) {
    const from0 = FOUNTAIN.count + SPIRAL.count;
    this.beamSeeds.forEach((seed, i) => {
      const lap = t / BEAM_SPARKS.climb + seed.phase;
      const share = lap - Math.floor(lap);
      const y = this.top + share * BEACON.height;
      const x = Math.cos(seed.a) * seed.r,
        z = Math.sin(seed.a) * seed.r;
      this.tmp.set(x, y, z);
      const pick = i % 2;
      this.color.setHex(SPARK_COLORS[pick]);
      const alpha = (1 - share) * 0.9;
      const shape = pick === 0 ? SPARKLE_CROSS : SPARKLE_DOT;
      const slot = from0 + i;
      this.points.set(slot, this.tmp, this.color, shape, 1.1, alpha);
    });
  }

  // 그 높이(접시 바닥에서 m)의 케이크 반지름
  private radiusAt(y: number): number {
    const level = y / BAND;
    const band = Math.floor(level);
    return this.profile[band] ?? 0;
  }

  // 가운데에서 d(m) 떨어진 곳의 케이크 윗면 높이(접시 바닥에서 m): 반지름이 d 보다 큰 가장 높은 띠의 위
  private surfaceAt(d: number): number {
    for (let k = this.profile.length - 1; k >= 0; k--) {
      if (this.profile[k] <= d) continue;
      const above = k + 1;
      return above * BAND;
    }
    return 0;
  }

  // 접시와 층은 발판: 위에서 닿으면 윗면에 세우고, 옆에서는 막는다
  private stand(d: number) {
    const { player } = this.s;
    if (player.held || d > this.plateR + 2) return;
    const onPlate = d < this.plateR ? PLATE_H : 0;
    const onCake = this.surfaceAt(d);
    const floor = Math.max(onPlate, onCake);
    const air = player.air;
    if (air >= floor - STEP_UP) {
      player.keepAbove(floor);
      return;
    }
    const wall = this.radiusAt(air);
    if (wall > 0) {
      const core = wall + BODY;
      player.blockBody(this.v, core);
    }
  }
}

/* ─── 내부 ─────────────────────────── */

const UP = new THREE.Vector3(0, 1, 0);

// 자리표의 층(윗면 높이·반지름)을 접시 바닥에서의 띠마다 반지름으로 — 모델이 오기 전의 어림
function profileOfTiers(tiers: readonly LayoutTier[]): number[] {
  const out: number[] = [];
  let from0 = 0;
  for (const tier of tiers) {
    const top = PLATE_H + tier.h;
    const level = top / BAND;
    const last = Math.ceil(level);
    for (let k = from0; k < last; k++) out[k] = tier.r;
    from0 = last;
  }
  return out;
}

// 분홍 반투명 기둥: 위로 갈수록 흐려지고, 결이 천천히 오른다
function beamMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCol: { value: color } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader:
      "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `varying vec2 vUv; uniform float uT; uniform vec3 uCol;
    void main() { float band = 0.5 + 0.5 * sin(vUv.y * 36.0 - uT * 1.6);
      float a = (0.55 + 0.15 * band) * (1.0 - vUv.y * 0.85) * smoothstep(0.0, 0.03, vUv.y);
      gl_FragColor = vec4(uCol, a);
      #include <colorspace_fragment>
    }`,
  });
}

// 초 몸통: 흰 바탕에 분홍 사선 줄
function stripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, 64, 128);
  c.strokeStyle = "#ff6fa5";
  c.lineWidth = 12;
  for (let y = -64; y < 192; y += 32) {
    c.beginPath();
    c.moveTo(0, y);
    const end = y + 64;
    c.lineTo(64, end);
    c.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
