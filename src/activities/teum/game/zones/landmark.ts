import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { PLATE_H } from "../garden/decor";
import type { LayoutLandmark, LayoutTier } from "../maps/layout";
import type { Hold } from "../models/library";
import type { Services } from "../services";
import { LIME, S } from "../settings";
import { from } from "../world/sphere";
import type { PlayedGames } from "./played";
import { SPARKLE_CROSS, SPARKLE_DOT, SparklePoints } from "./sparkles";
import type { TopDecor } from "./topDecor";
import { TOP_DECOR } from "./topDecor";
import type { ZoneConfig } from "./zone";

// 랜드마크 공용 부품 — "나 랜드마크요!"(MAP-03 2장, 오너 2026-11-20 2번): 존마다 다른 것은 설정의 모델·높이·꼭대기 장식·색뿐이다.
// - 빛 기둥: 꼭대기 위 120m 반투명(존 색), 안에서 반짝이가 오르고 끝에 라임 리본(리본이라 라임 허용). 그 존의 게임을 했으면 2초에 걸쳐 사라진다
// - 모델이 있으면: 모델을 높이에 맞춰 세우고(접시가 있으면 그 위), 꼭대기 장식, 주기마다 반짝이 분수, 둘레를 나선으로 오르는 반짝이
//   (가까이 오면 빨라진다), 다가올 때 소리 한 번, 모델 모양을 재서 층 윗면은 발판·옆면은 벽
// - 모델이 없으면(설정이 빈 존): 빛 기둥만 — 자리 표시
// 모양은 모델이 오면 높이 2m 띠마다 반지름을 재서 쓴다(자리표의 층 tiers 는 모델이 오기 전의 어림)

/** 빛 기둥: 높이(m)·반지름(m) · 끝 리본 크기(m) · 사라지는 시간(초) */
const BEACON = { height: 120, radius: 6 } as const;
const RIBBON = { w: 9, h: 3.2 } as const;
const BEACON_FADE = 2;
/** 반짝이 분수: 수 · 몇 초마다 · 솟는 높이(m) · 한 번의 수명(초) · 옆으로 퍼지는 빠르기(m/s) */
const FOUNTAIN = { count: 140, every: 5, rise: 40, life: 5.2, spread: 7 } as const;
/** 나선 반짝이: 수 · 바퀴 수 · 한 번 다 오르는 시간(초) · 빨라지는 거리(m)·배 · 모델 옆에서 떨어진 거리(m) */
const SPIRAL = { count: 60, turns: 4, climb: 36, near: 60, boost: 2, gap: 2.5 } as const;
/** 빛 기둥 안의 반짝이: 수 · 한 번 다 오르는 시간(초) */
const BEAM_SPARKS = { count: 36, climb: 16 } as const;
/** 다가올 때 소리: 이 거리(m) 안에 들어오면 한 번, 이만큼 더 멀어지면 다시 낼 수 있다 */
const APPROACH = { near: 60, rearm: 20 } as const;
/** 떨어지는 반짝이의 중력(m/s²) · 옆으로 느려지는 몫(1/초) */
const GRAVITY = 9.8,
  DRAG = 0.6;
/** 층 윗면에 올라서는 높이 폭(m) · 몸 반지름(m) · 모델 모양을 재는 높이 띠(m) */
const STEP_UP = 1.5,
  BODY = 0.9,
  BAND = 2;
/** 접시를 이 랜드마크 것으로 치는 거리(m) */
const PLATE_REACH = 6;

/** 꼭대기에서 솟는 반짝이 하나 */
interface Spark {
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  color: THREE.Color;
  shape: number;
  size: number;
}

/** 존 랜드마크 하나 */
export class LandmarkShow implements Thing {
  /** 존 이름(게임을 했는지·다가갈 때 소리에 쓴다) */
  readonly zone: string;
  readonly v: THREE.Vector3;
  private readonly root = new THREE.Group();
  private readonly height: number;
  private readonly base: number;
  private readonly plateR: number;
  private readonly top: number;
  private readonly hasModel: boolean;
  private readonly sound: string | null;
  private readonly sparkColors: THREE.Color[];
  private profile: number[];
  private readonly beam: THREE.Group;
  private readonly beamMat: THREE.ShaderMaterial;
  private readonly ribbon: THREE.Mesh;
  private readonly decor: TopDecor | null;
  private readonly points: SparklePoints | null;
  private readonly sparks: Spark[] = [];
  private readonly beamSeeds: { a: number; r: number; phase: number }[] = [];
  private readonly owned: { dispose(): void }[] = [];
  private beamOn: number;
  private isNear = false;
  private nextBurst = 1;
  private spiralT = 0;
  private spiralRate = 1;
  private readonly rand: () => number;
  private readonly tmp = new THREE.Vector3();
  private readonly color = new THREE.Color();

  /** land: 자리표의 랜드마크(자리·높이) · zone: 그 존 설정(없으면 빛 기둥만) · played: 존 미니게임 기록 */
  constructor(
    private readonly s: Services,
    land: LayoutLandmark,
    zone: ZoneConfig | undefined,
    private readonly played: PlayedGames,
  ) {
    const look = zone?.landmark ?? {};
    this.zone = zone?.id ?? `hub${land.region}`;
    this.v = from(land.dist, land.bear);
    const model = look.model ?? land.model;
    this.height = look.height ?? land.height;
    const tiers = look.tiers ?? land.tiers ?? [];
    const plate = s.layout.decor?.find((d) => {
      const at = from(d.dist, d.bear);
      return d.model === "plate" && at.angleTo(this.v) * S.R < PLATE_REACH;
    });
    this.plateR = plate?.r ?? 0;
    this.base = plate ? PLATE_H : 0;
    this.top = this.base + this.height;
    this.sound = zone?.sound?.landmark ?? null;
    const region = s.map.regions[land.region];
    const beaconHex = look.beacon ?? region?.sky ?? 0xffffff;
    const sparkHexes = look.sparkles ?? [0xffffff, beaconHex];
    this.sparkColors = sparkHexes.map((hex) => new THREE.Color(hex));
    const rng = s.rng.fork(`landmark-${this.zone}`);
    this.rand = () => rng.next();
    this.profile = profileOfTiers(tiers, this.base);
    // ---- 모델 ----
    const isKnown = model !== undefined && s.models.has(model);
    this.hasModel = isKnown;
    if (model && this.hasModel) {
      const hold = s.models.fit(model, this.height, "h");
      const lift = this.base + hold.userData.hh;
      hold.position.y = lift;
      this.root.add(hold);
      s.models.when(model, () => this.measure(hold));
    }
    // ---- 꼭대기 장식 ----
    const make = look.top ? TOP_DECOR[look.top] : undefined;
    this.decor = this.hasModel && make ? make() : null;
    if (this.decor) this.root.add(this.decor.root);
    this.seatDecor();
    // ---- 빛 기둥 ----
    const beaconColor = new THREE.Color(beaconHex);
    this.beamMat = beamMaterial(beaconColor);
    this.beam = new THREE.Group();
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
    const pillar = new THREE.Mesh(beamGeo, this.beamMat);
    pillar.renderOrder = 3;
    pillar.frustumCulled = false;
    const ribbonGeo = new THREE.PlaneGeometry(RIBBON.w, RIBBON.h, 10, 2);
    const ribbonHalf = RIBBON.w / 2;
    ribbonGeo.translate(ribbonHalf, 0, 0);
    const ribbonMat = new THREE.MeshBasicMaterial({ color: LIME, side: THREE.DoubleSide });
    this.ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    this.ribbon.position.y = BEACON.height;
    this.beam.add(pillar, this.ribbon);
    this.beam.position.y = this.top;
    this.root.add(this.beam);
    this.owned.push(beamGeo, this.beamMat, ribbonGeo, ribbonMat);
    this.beamOn = played.has(this.zone) ? 0 : 1;
    this.beamMat.uniforms.uOn.value = this.beamOn;
    this.beam.visible = this.beamOn > 0;
    // ---- 반짝이(모델이 있을 때만) ----
    this.points = this.hasModel ? this.buildSparkles() : null;
    s.scene.add(this.root);
  }

  /** 땅 높이가 정해진 뒤 자리를 잡는다 */
  layout() {
    const ground = this.s.terrain.featGround(this.v);
    const radius = S.R + ground;
    this.root.position.copy(this.v).multiplyScalar(radius);
    this.root.quaternion.setFromUnitVectors(UP, this.v);
  }

  /** 리본이 펄럭, 장식이 움직이고, 반짝이가 솟고 오른다 · 다가오면 소리 한 번 · 모델은 발판 */
  update(f: Frame) {
    const t = f.time,
      dt = f.dt;
    this.fadeBeam(dt);
    const flap = t * 3;
    this.ribbon.rotation.y = Math.sin(flap) * 0.5;
    (this.beamMat.uniforms.uT as { value: number }).value = t;
    this.decor?.update(t);
    const d = this.s.player.p.angleTo(this.v) * S.R;
    this.approach(d);
    if (!this.points) return;
    // 가까이 오면 나선 반짝이가 빨라진다(천천히 바뀐다)
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
    this.points?.dispose();
    this.decor?.dispose();
    for (const o of this.owned) o.dispose();
  }

  // 빛 기둥: 그 존의 게임을 했으면 2초에 걸쳐 사라진다
  private fadeBeam(dt: number) {
    const want = this.played.has(this.zone) ? 0 : 1;
    if (this.beamOn === want) return;
    const step = dt / BEACON_FADE;
    const toward = want > this.beamOn ? step : -step;
    const next = this.beamOn + toward;
    const floor = Math.max(0, next);
    this.beamOn = Math.min(1, floor);
    this.beamMat.uniforms.uOn.value = this.beamOn;
    this.beam.visible = this.beamOn > 0;
  }

  // 다가올 때 한 번: 그 존의 소리(없으면 조용히)
  private approach(d: number) {
    if (this.isNear) {
      const far = APPROACH.near + APPROACH.rearm;
      if (d > far) this.isNear = false;
      return;
    }
    if (d >= APPROACH.near) return;
    this.isNear = true;
    this.s.events.emit("landmarkApproached", { zone: this.zone, sound: this.sound });
  }

  // 반짝이 점 묶음: 분수 · 나선 · 빛 기둥 안
  private buildSparkles(): SparklePoints {
    const total = FOUNTAIN.count + SPIRAL.count + BEAM_SPARKS.count;
    const points = new SparklePoints(total);
    this.root.add(points.points);
    for (let i = 0; i < FOUNTAIN.count; i++) {
      const roll = this.rand() * this.sparkColors.length;
      const pick = Math.floor(roll);
      const color = this.sparkColors[pick];
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
    return points;
  }

  // 모델이 오면 높이 띠마다 반지름을 재고, 장식을 꼭대기 윗면에 다시 올린다
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
    this.seatDecor();
  }

  // 장식이 서는 반지름의 윗면 높이에 장식을 올린다
  private seatDecor() {
    if (!this.decor) return;
    const surface = this.surfaceAt(this.decor.ring);
    this.decor.root.position.y = surface;
  }

  // 반짝이 분수 한 번: 꼭대기에서 위로 퐁, 옆으로 흩어진다
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
    const points = this.points!;
    const keep = 1 - DRAG * dt;
    this.sparks.forEach((sp, i) => {
      sp.age += dt;
      if (sp.age > FOUNTAIN.life) {
        points.hide(i);
        return;
      }
      sp.v.y -= GRAVITY * dt;
      sp.v.x *= keep;
      sp.v.z *= keep;
      sp.p.addScaledVector(sp.v, dt);
      const left = 1 - sp.age / FOUNTAIN.life;
      const bright = left * 2.5;
      const alpha = Math.min(1, bright);
      points.set(i, sp.p, sp.color, sp.shape, sp.size, alpha);
    });
  }

  // 나선 반짝이: 모델 옆을 따라 바닥에서 꼭대기까지 돌며 오른다
  private placeSpiral() {
    const points = this.points!;
    const from0 = FOUNTAIN.count;
    this.color.setHex(0xffffff);
    for (let i = 0; i < SPIRAL.count; i++) {
      const lap = this.spiralT / SPIRAL.climb + i / SPIRAL.count;
      const share = lap - Math.floor(lap);
      const y = this.base + share * this.height;
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
      points.set(slot, this.tmp, this.color, SPARKLE_DOT, 0.8, alpha);
    }
  }

  // 빛 기둥 안의 반짝이: 천천히 오르며 위로 갈수록 옅다(기둥이 사라지면 같이)
  private placeBeamSparks(t: number) {
    const points = this.points!;
    const from0 = FOUNTAIN.count + SPIRAL.count;
    this.beamSeeds.forEach((seed, i) => {
      const lap = t / BEAM_SPARKS.climb + seed.phase;
      const share = lap - Math.floor(lap);
      const y = this.top + share * BEACON.height;
      const x = Math.cos(seed.a) * seed.r,
        z = Math.sin(seed.a) * seed.r;
      this.tmp.set(x, y, z);
      const pick = i % this.sparkColors.length;
      const alpha = (1 - share) * 0.9 * this.beamOn;
      const shape = pick === 0 ? SPARKLE_CROSS : SPARKLE_DOT;
      const slot = from0 + i;
      points.set(slot, this.tmp, this.sparkColors[pick], shape, 1.1, alpha);
    });
  }

  // 그 높이(바닥에서 m)의 모델 반지름
  private radiusAt(y: number): number {
    const level = y / BAND;
    const band = Math.floor(level);
    return this.profile[band] ?? 0;
  }

  // 가운데에서 d(m) 떨어진 곳의 모델 윗면 높이(바닥에서 m): 반지름이 d 보다 큰 가장 높은 띠의 위
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
    const body = this.radiusAt(this.base);
    const reach = Math.max(this.plateR, body) + 2;
    if (player.held || d > reach) return;
    const onPlate = d < this.plateR ? this.base : 0;
    const onModel = this.surfaceAt(d);
    const floor = Math.max(onPlate, onModel);
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

// 자리표의 층(윗면 높이·반지름)을 바닥에서의 띠마다 반지름으로 — 모델이 오기 전의 어림
function profileOfTiers(tiers: readonly LayoutTier[], base: number): number[] {
  const out: number[] = [];
  let from0 = 0;
  for (const tier of tiers) {
    const top = base + tier.h;
    const level = top / BAND;
    const last = Math.ceil(level);
    for (let k = from0; k < last; k++) out[k] = tier.r;
    from0 = last;
  }
  return out;
}

// 반투명 빛 기둥: 위로 갈수록 흐려지고, 결이 천천히 오른다(uOn 으로 사라진다)
function beamMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCol: { value: color }, uOn: { value: 1 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader:
      "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `varying vec2 vUv; uniform float uT; uniform vec3 uCol; uniform float uOn;
    void main() { float band = 0.5 + 0.5 * sin(vUv.y * 36.0 - uT * 1.6);
      float a = (0.55 + 0.15 * band) * (1.0 - vUv.y * 0.85) * smoothstep(0.0, 0.03, vUv.y) * uOn;
      gl_FragColor = vec4(uCol, a);
      #include <colorspace_fragment>
    }`,
  });
}
