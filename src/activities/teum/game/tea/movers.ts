import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { GameEvents } from "../events";
import type { ModelLibrary } from "../models/library";
import type { Carrier, TeaBody } from "./body";
import type { StandShape } from "./stand";
import type { MushroomSpec, RideSpec, TeaSpot, TeaTuning } from "./teaTuning";

// 다니는 법: 버섯(땅 → 1단, 1단 → 2단) · 바람 기둥(땅 → 3단) · 대포(별 뒤편 → 2단) · 스푼 미끄럼틀(3단 → 땅).
// 모두 '실어 가기'다 — 올라서면(누를 필요 없음) 정해진 길을 따라 정해진 접시에 내려 준다. 실력이 필요한 이동은 없다.
// 길은 값 파일의 점을 부드럽게 잇는다(바람 기둥·대포·미끄럼틀). 버섯은 두 자리 사이를 포물선으로 튄다

/** 버섯이 튈 때 두 자리를 잇는 선 위로 더 솟는 높이(m) */
const MUSHROOM_LIFT = 6;
/** 내려 준 뒤 같은 놀이기구를 다시 타지 않는 시간(초) — 내려선 자리가 타는 자리 곁이어도 바로 또 타지 않게 */
const COOLDOWN = 1.2;

/** 놀이기구 하나 */
interface Mover {
  /** 타는 자리(세계, 발 높이)와 그 층 */
  at: THREE.Vector3;
  tier: number;
  reach: number;
  /** 이 놀이기구가 실어 가는 길 */
  carrier: Carrier;
  /** 다시 탈 수 있을 때까지(초) */
  cool: number;
  /** 탔을 때(모양을 꿀렁이는 등) */
  onBoard: () => void;
  /** 매 프레임 모양 */
  pose: (f: Frame) => void;
}

/** 대포 통 색(코발트) */
const COBALT = "#4A63D9";
const TAU = Math.PI * 2,
  HALF_PI = Math.PI / 2;
const Y_UP = new THREE.Vector3(0, 1, 0);

const tmp = new THREE.Vector3(),
  up = new THREE.Vector3();

/** 다니는 법 넷 */
export class Movers implements Thing {
  private readonly list: Mover[] = [];
  private readonly root = new THREE.Group();
  private readonly disposables: { dispose(): void }[] = [];
  /** 탄 횟수(측정: 버섯·바람 기둥·대포·미끄럼틀) */
  readonly used = { mushroom: 0, wind: 0, cannon: 0, slide: 0 };

  constructor(
    scene: THREE.Scene,
    private readonly stand: StandShape,
    private readonly body: TeaBody,
    private readonly events: GameEvents,
    models: ModelLibrary,
    t: TeaTuning,
  ) {
    const m = t.movers;
    for (const spec of m.mushrooms)
      this.addMushroom(spec, m.mushroomSeconds, m.mushroomReach, models, t);
    this.addWind(m.wind, t);
    this.addCannon(m.cannon, models);
    this.addSlide(m.slide, t);
    scene.add(this.root);
  }

  /** 다가가면 태우고, 모양을 움직인다 */
  update(f: Frame) {
    const { body } = this;
    for (const mv of this.list) {
      if (mv.cool > 0) mv.cool -= f.dt;
      mv.pose(f);
      if (body.isHeld || mv.cool > 0 || body.air > 0.6) continue;
      const tier = this.stand.tierAt(body.p, body.alt);
      if (tier !== mv.tier) continue;
      const radius = this.stand.R + body.alt;
      tmp.copy(body.p).multiplyScalar(radius);
      if (tmp.distanceTo(mv.at) > mv.reach) continue;
      mv.cool = COOLDOWN;
      mv.onBoard();
      body.carry(mv.carrier);
    }
  }

  /** 치운다 */
  dispose() {
    this.root.removeFromParent();
    for (const d of this.disposables) d.dispose();
  }

  // ---- 버섯: 올라서면 꿀렁 튀어 바로 위 층에 내려 준다 ----
  private addMushroom(
    spec: MushroomSpec,
    seconds: number,
    reach: number,
    models: ModelLibrary,
    t: TeaTuning,
  ) {
    const { stand } = this;
    const at = spotPoint(stand, spec.at);
    const to = spotPoint(stand, spec.to);
    const holder = new THREE.Group();
    placeUpright(holder, at);
    const cap = mushroomShape(t, this.disposables);
    holder.add(cap);
    if (models.has("mushroom")) {
      const hold = models.fit("mushroom", 2.4, "h");
      hold.position.y = hold.userData.hh;
      hold.rotation.y = Math.PI / 2;
      models.swapWhenReady("mushroom", [cap]);
      holder.add(hold);
    }
    this.root.add(holder);
    let squash = 0;
    const mover: Mover = {
      at,
      tier: spec.at.tier,
      reach,
      carrier: {
        seconds,
        at: (k, out) => hopPoint(at, to, k, out),
        arrived: () => this.events.emit("landed", {}),
      },
      cool: 0,
      onBoard: () => {
        squash = 1;
        this.used.mushroom++;
        this.events.emit("mushroomJumped", {});
      },
      pose: (f) => {
        const settled = squash - f.dt * 2.5;
        squash = Math.max(0, settled);
        const wobble = bump(squash) * 0.35;
        squashScale(holder, wobble);
      },
    };
    this.list.push(mover);
  }

  // ---- 바람 기둥: 들어가면 둥실 올라가 3단 가장자리에 내려 준다 ----
  private addWind(spec: RideSpec, t: TeaTuning) {
    const { stand } = this;
    const at = spotPoint(stand, spec.at);
    const curve = pathCurve(stand, spec);
    const top = spec.path.reduce((h, p) => Math.max(h, p.h), 0);
    const geo = new THREE.CylinderGeometry(2.2, 1.4, top, 28, 1, true);
    const half = top / 2;
    geo.translate(0, half, 0);
    const mat = windMaterial(t.colors.porcelain);
    const column = new THREE.Mesh(geo, mat);
    column.renderOrder = 2;
    placeUpright(column, at);
    const ringGeo = new THREE.TorusGeometry(1.9, 0.22, 10, 36);
    const ringMat = new THREE.MeshStandardMaterial({ color: t.colors.lavender });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    column.add(ring);
    this.root.add(column);
    this.disposables.push(geo, mat, ringGeo, ringMat);
    const uT = mat.uniforms.uT as { value: number };
    this.list.push({
      at,
      tier: spec.at.tier,
      reach: spec.reach,
      carrier: carrierOf(curve, spec.seconds, () => this.events.emit("landed", {})),
      cool: 0,
      onBoard: () => {
        this.used.wind++;
        this.events.emit("rose", { vy: 8 });
      },
      pose: (f) => {
        uT.value = f.time;
      },
    });
  }

  // ---- 대포: 별 뒤편에서 2단으로 크게 날려 보낸다 ----
  private addCannon(spec: RideSpec, models: ModelLibrary) {
    const { stand } = this;
    const at = spotPoint(stand, spec.at);
    const curve = pathCurve(stand, spec);
    const holder = new THREE.Group();
    placeUpright(holder, at);
    // 포구가 길의 첫 쪽(스탠드 쪽)을 보게
    const second = curve.getPointAt(0.08);
    holder.worldToLocal(second);
    const aim = Math.atan2(second.x, second.z);
    holder.rotation.y += aim;
    const barrelGeo = new THREE.CylinderGeometry(0.55, 0.75, 2.6, 18);
    const tilt = -Math.PI / 3;
    barrelGeo.rotateX(tilt);
    barrelGeo.translate(0, 1.5, 0.5);
    const barrelMat = new THREE.MeshStandardMaterial({ color: COBALT });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    holder.add(barrel);
    this.disposables.push(barrelGeo, barrelMat);
    if (models.has("cannon")) {
      const hold = models.fit("cannon", 3.2, "h");
      hold.position.y = hold.userData.hh;
      hold.rotation.y = -Math.PI / 2;
      models.swapWhenReady("cannon", [barrel]);
      holder.add(hold);
    }
    this.root.add(holder);
    let kick = 0;
    this.list.push({
      at,
      tier: spec.at.tier,
      reach: spec.reach,
      carrier: carrierOf(curve, spec.seconds, () => this.events.emit("landed", {})),
      cool: 0,
      onBoard: () => {
        kick = 1;
        this.used.cannon++;
        this.events.emit("grabbed", { by: "cannon" });
      },
      pose: (f) => {
        const settled = kick - f.dt * 3;
        kick = Math.max(0, settled);
        const recoil = bump(kick) * 0.25;
        squashScale(holder, recoil);
      },
    });
  }

  // ---- 스푼 미끄럼틀: 3단 가장자리의 스푼 머리에서 땅까지 한 번에 ----
  private addSlide(spec: RideSpec, t: TeaTuning) {
    const { stand } = this;
    const at = spotPoint(stand, spec.at);
    const curve = pathCurve(stand, spec);
    const handleGeo = new THREE.TubeGeometry(curve, 80, 0.55, 12, false);
    const handleMat = new THREE.MeshStandardMaterial({
      color: t.colors.strawberry,
      roughness: 0.35,
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    const bowlGeo = new THREE.SphereGeometry(1.5, 24, 12, 0, TAU, HALF_PI, HALF_PI);
    bowlGeo.scale(1, 0.45, 1.25);
    const bowlMat = new THREE.MeshStandardMaterial({
      color: t.colors.porcelain,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });
    const bowl = new THREE.Mesh(bowlGeo, bowlMat);
    placeUpright(bowl, at);
    up.copy(at).normalize();
    bowl.position.addScaledVector(up, 0.35);
    this.root.add(handle, bowl);
    this.disposables.push(handleGeo, bowlGeo, handleMat, bowlMat);
    // 미끄럼틀 위를 탄다: 길보다 조금 위로
    const ride = carrierOf(curve, spec.seconds, () => this.events.emit("landed", {}));
    const lifted: Carrier = {
      seconds: ride.seconds,
      at: (k, out) => {
        ride.at(k, out);
        const lift = 0.5 * (1 - k);
        up.copy(out).normalize();
        return out.addScaledVector(up, lift);
      },
      arrived: ride.arrived,
    };
    this.list.push({
      at,
      tier: spec.at.tier,
      reach: spec.reach,
      carrier: lifted,
      cool: 0,
      onBoard: () => {
        this.used.slide++;
        this.events.emit("railed", {});
      },
      pose: () => {},
    });
  }
}

/* ─── 내부 ─────────────────────────── */

// 값 파일 자리의 세계 좌표(새 벡터)
function spotPoint(stand: StandShape, spot: TeaSpot): THREE.Vector3 {
  const out = new THREE.Vector3();
  return stand.worldOf(spot, 0, out);
}

// 0 → 1 사이에서 한 번 솟았다 내려오는 곡선(sin 반 바퀴)
function bump(k: number): number {
  const phase = Math.PI * k;
  return Math.sin(phase);
}

// 꿀렁: 옆으로 퍼지고 위로 눌린다
function squashScale(o: THREE.Object3D, k: number) {
  const wide = 1 + k,
    flat = 1 - k;
  o.scale.set(wide, flat, wide);
}

// 값 파일의 길 점을 잇는 부드러운 길(세계 좌표)
function pathCurve(stand: StandShape, spec: RideSpec): THREE.CatmullRomCurve3 {
  const points = spec.path.map((p) => stand.pathPoint(p, new THREE.Vector3()));
  return new THREE.CatmullRomCurve3(points, false, "centripetal");
}

// 길을 고르게(길이로) 따라가는 운반
function carrierOf(curve: THREE.CatmullRomCurve3, seconds: number, arrived: () => void): Carrier {
  return {
    seconds,
    at: (k, out) => curve.getPointAt(k, out),
    arrived,
  };
}

// 버섯 튐: 두 자리 사이 큰 원을 따라가며, 높이는 두 높이를 잇는 선 위로 포물선만큼 솟는다
function hopPoint(
  from: THREE.Vector3,
  to: THREE.Vector3,
  k: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const r0 = from.length(),
    r1 = to.length();
  const a = from.clone().normalize(),
    b = to.clone().normalize();
  const angle = a.angleTo(b);
  const axis = a.clone().cross(b).normalize();
  const turn = angle * k;
  out.copy(a).applyAxisAngle(axis, turn);
  const base = r0 + (r1 - r0) * k,
    arch = bump(k) * MUSHROOM_LIFT;
  const radius = base + arch;
  return out.multiplyScalar(radius);
}

// 물체를 별 표면의 그 자리에 바로 세운다(위 = 별 바깥쪽)
function placeUpright(o: THREE.Object3D, at: THREE.Vector3) {
  o.position.copy(at);
  const dir = at.clone().normalize();
  o.quaternion.setFromUnitVectors(Y_UP, dir);
}

// 모델이 오기 전의 버섯(라벤더 갓·크림 대)
function mushroomShape(t: TeaTuning, disposables: { dispose(): void }[]): THREE.Group {
  const g = new THREE.Group();
  const stemGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.2, 14);
  stemGeo.translate(0, 0.6, 0);
  const capGeo = new THREE.SphereGeometry(1.2, 22, 12, 0, TAU, 0, HALF_PI);
  capGeo.scale(1, 0.6, 1);
  capGeo.translate(0, 1.15, 0);
  const stemMat = new THREE.MeshStandardMaterial({ color: t.colors.cream });
  const capMat = new THREE.MeshStandardMaterial({ color: t.colors.lavender, roughness: 0.4 });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  const cap = new THREE.Mesh(capGeo, capMat);
  g.add(stem, cap);
  disposables.push(stemGeo, capGeo, stemMat, capMat);
  return g;
}

// 바람 기둥의 결(위로 감겨 오르는 흰 띠 — 지금 게임의 상승 기류와 같은 결)
function windMaterial(hex: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color(hex) } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader:
      "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `varying vec2 vUv; uniform float uT; uniform vec3 uCol;
    void main() { float band = 0.5 + 0.5 * sin(vUv.x * 18.85 + vUv.y * 9.0 - uT * 3.2), band2 = 0.5 + 0.5 * sin(vUv.x * 12.57 - vUv.y * 6.0 + uT * 1.7);
      float a = (0.1 + 0.4 * pow(band, 3.0) + 0.14 * pow(band2, 4.0)) * (1.0 - vUv.y * 0.6) * smoothstep(0.0, 0.03, vUv.y);
      gl_FragColor = vec4(uCol, a);
      #include <colorspace_fragment>
    }`,
  });
}
