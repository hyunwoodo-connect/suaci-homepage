import * as THREE from "three";

import type { Hold } from "../models/library";
import type { Services } from "../services";
import { S } from "../settings";
import { UP } from "../world/sphere";
import type { PropSpec } from "./findTuning";
import { FIND } from "./findTuning";
import type { PickTarget } from "./picker";
import { sphereAt } from "./spots";

// 후보 물건: 상자가 들어갈 수 있는 물건들(찻잔·바구니·쿠키 단지·화분·선물 더미). 넷에만 상자가 있고 나머지는 꽝이다.
//   내가 candidate.wiggleReach 안에 들어오면 한 번 꿈틀한다 — '이건 누를 수 있다'(글자·테두리 없이). 멀어졌다 다시 오면 또 한다
//   꽝을 누르면 말랑하게 찌그러졌다 펴진다. 상자가 든 물건은 내가 가까이 오면 바스락 흔들린다(뜨거워 차가워)
//   찾은 물건에는 작은 라임 리본이 남고, 더는 꿈틀하지도 눌리지도 않는다
// 무리(같은 물건 넷 이상)·낱개·높은 곳(쌓아 올린 탑 꼭대기, 통통 구름 위) 세 갈래 — 자리는 hideseek.data.json 의 props.
// 물건 속으로는 못 들어가고(막힌다), 위에서 내려오면 꼭대기에 올라선다

/** 후보 물건 하나 */
export interface Candidate {
  spec: PropSpec;
  /** 자리(단위 벡터) · 물건 바닥의 높이(m, 행성 겉에서) · 물건의 키(m) · 뚜껑(몸통 윗면)의 높이(m, 바닥에서 — 상자가 여기서 내민다) · 반너비(m) */
  v: THREE.Vector3;
  base: number;
  tall: number;
  lid: number;
  wide: number;
  /** 속에 든 상자의 크기 배수(물건 옆으로 삐져나오지 않게) */
  fit: number;
  /** 찾았다(리본이 남았다) */
  isFound: boolean;
}

/** 물건 하나의 화면 쪽(틀과 몸짓) */
interface Shown {
  c: Candidate;
  root: THREE.Group;
  /** 움직이는 몸(꼭대기 물건 — 탑의 밑은 가만히 있다) */
  body: THREE.Group;
  /** 발밑 땅 높이(m) · 몸통이 막는 반지름(m — 탑은 밑동의 가장 굵은 칸까지) */
  ground: number;
  core: number;
  isNear: boolean;
  wiggleT: number;
  squishT: number;
  /** 바스락: 남은 시간(초)과 세기(1 이 warm.rustleDegrees) */
  rustleT: number;
  rustleK: number;
  ribbon: THREE.Object3D | null;
}

/** 다시 꿈틀하려면 이만큼(m) 더 멀어졌다 와야 한다 · 바스락 한 번의 길이(초)·빠르기(rad/s) · 혼자 살짝 떨 때의 세기 */
const REARM = 2,
  RUSTLE_SECONDS = 0.55,
  RUSTLE_RATE = 46,
  TREMBLE = 0.4;
/** 이보다 멀면(m, 물건 가장자리에서) 몸짓도 부딪힘도 보지 않는다 */
const FAR = 16;
/** 몸통이 막는 반지름(반너비의 몫) · 꼭대기에서 이만큼(m) 아래까지는 올라선 것으로 친다 */
const BODY_SHARE = 0.8,
  STEP_UP = 1;
/** 찾은 흔적 리본: 크기(m) · 물건 꼭대기 위로(m) */
const RIBBON_SIZE = 1.1,
  RIBBON_OVER = 0.12;
/** 색 없이 온 모델에 칠할 때: 회색 텍스처(밝기 반쯤)에 곱하는 색을 이만큼 밝힌다 */
const PAINT_GAIN = 1.7;
/** 누르는 자리의 반너비·반높이(물건 크기의 몫) */
const PICK_SHARE = 0.5;

const at = new THREE.Vector3(),
  q = new THREE.Quaternion(),
  yawQ = new THREE.Quaternion();

/** 후보 물건 전체 */
export class Props {
  readonly list: Candidate[] = [];
  private readonly shown: Shown[] = [];
  private readonly ribbonGeo = new THREE.SphereGeometry(0.5, 14, 10);
  private readonly ribbonMat: THREE.MeshStandardMaterial;

  /** hub: 무대 마을 중심 */
  constructor(
    private readonly s: Services,
    hub: THREE.Vector3,
    rand: () => number,
  ) {
    this.ribbonMat = new THREE.MeshStandardMaterial({
      color: s.mats.lime,
      emissive: s.mats.lime,
      emissiveIntensity: 0.35,
      roughness: 0.5,
    });
    for (const kind of Object.values(FIND.kinds))
      if (kind.paint) this.paint(kind.model, kind.paint);
    for (const spec of FIND.props) this.build(spec, hub, rand);
  }

  /** 판 시작: 찾은 흔적을 거두고 몸짓을 그친다 */
  reset() {
    for (const o of this.shown) {
      o.c.isFound = false;
      o.ribbon?.removeFromParent();
      o.ribbon = null;
      o.wiggleT = o.squishT = -1;
      o.rustleT = 0;
      o.rustleK = 1;
      o.isNear = false;
    }
  }

  /** spec 의 물건 */
  of(spec: PropSpec): Candidate {
    return this.list.find((c) => c.spec === spec)!;
  }

  /** 물건 가운데의 세계 자리 */
  center(c: Candidate, out: THREE.Vector3): THREE.Vector3 {
    const radius = S.R + c.base + c.tall / 2;
    return out.copy(c.v).multiplyScalar(radius);
  }

  /** 나와의 거리(m — 물건 가운데까지) */
  distance(c: Candidate): number {
    return this.center(c, at).distanceTo(this.s.player.P);
  }

  /**
   * 지금 누르면 닿는가: candidate.tapReach 안이고, 높은 곳 물건이면 내 몸이 그 바닥 가까이(candidate.highBelow)까지 올라와 있어야 한다
   * (밑에서 눌러서는 안 된다 — 버섯이나 통통 구름으로 올라가서 누른다)
   */
  canReach(c: Candidate): boolean {
    const C = FIND.candidate;
    if (this.distance(c) > C.tapReach) return false;
    if (c.spec.cls !== "high") return true;
    const mine = this.s.player.P.length() - S.R;
    return mine >= c.base - C.highBelow;
  }

  /** 누를 수 있는 것: 아직 찾지 않은 물건 모두(닿는지는 누른 뒤에 본다 — 멀면 아무 일도 없다) */
  targets(): PickTarget<Candidate>[] {
    const out: PickTarget<Candidate>[] = [];
    for (const c of this.list) {
      if (c.isFound) continue;
      const spot = new THREE.Vector3(),
        center = this.center(c, spot),
        halfH = c.tall * PICK_SHARE;
      out.push({ item: c, center, halfH, halfW: c.wide });
    }
    return out;
  }

  /** 꽝: 말랑하게 찌그러졌다 펴진다 */
  squish(c: Candidate) {
    this.shownOf(c).squishT = 0;
  }

  /** 바스락: 잠깐 흔들린다(상자가 든 물건 — 내가 가까이 있을 때) */
  rustle(c: Candidate) {
    const o = this.shownOf(c);
    o.rustleT = RUSTLE_SECONDS;
    o.rustleK = 1;
  }

  /** 혼자 살짝 떤다(패턴 A — 같은 물건 무리에서 하나만 다르다) */
  tremble(c: Candidate) {
    const o = this.shownOf(c);
    if (o.rustleT > 0) return;
    o.rustleT = RUSTLE_SECONDS;
    o.rustleK = TREMBLE;
  }

  /** 내 발밑의 올라설 곳(물건 꼭대기)의 높이(m, 땅에서 — 없으면 0) */
  floorUnder(): number {
    const p = this.s.player.p;
    let floor = 0;
    for (const o of this.shown) {
      const c = o.c,
        flat = p.angleTo(c.v) * S.R;
      if (flat >= c.wide * BODY_SHARE) continue;
      const top = c.base + c.lid - o.ground;
      floor = Math.max(floor, top);
    }
    return floor;
  }

  /** 통 튄다(상자가 튀어나오는 순간) */
  bump(c: Candidate) {
    this.shownOf(c).wiggleT = 0;
  }

  /** 찾았다: 꼭대기에 작은 라임 리본이 남고 더는 꿈틀하지도 눌리지도 않는다 */
  markFound(c: Candidate) {
    const o = this.shownOf(c);
    c.isFound = true;
    if (o.ribbon) return;
    const ribbon = this.makeRibbon();
    ribbon.position.y = c.lid + RIBBON_OVER;
    ribbon.scale.setScalar(RIBBON_SIZE);
    o.body.add(ribbon);
    o.ribbon = ribbon;
  }

  /** 한 프레임: 가까이 오면 꿈틀, 하던 몸짓, 속으로 못 들어가게 막고 위에서 오면 올려 세운다 */
  update(dt: number, isRound: boolean) {
    const { player } = this.s,
      C = FIND.candidate;
    for (const o of this.shown) {
      const c = o.c,
        flat = player.p.angleTo(c.v) * S.R,
        isIdle = o.wiggleT < 0 && o.squishT < 0 && o.rustleT <= 0;
      if (flat > c.wide + FAR) {
        o.isNear = false;
        if (isIdle) continue;
      }
      const dist = this.distance(c);
      // 판이 도는 동안, 찾지 않은 물건만 꿈틀한다
      if (isRound && !c.isFound && !o.isNear && dist <= C.wiggleReach) {
        o.isNear = true;
        o.wiggleT = 0;
      } else if (o.isNear && dist > C.wiggleReach + REARM) o.isNear = false;
      this.pose(o, dt);
      if (!player.held) this.collide(o, flat);
    }
  }

  dispose() {
    for (const o of this.shown) o.root.removeFromParent();
    this.ribbonGeo.dispose();
    this.ribbonMat.dispose();
  }

  /* ─── 내부 ─────────────────────────── */

  // 색 없이(회색 텍스처로) 온 모델을 칠한다: 재질 색을 곱한다(그 모델을 쓰는 물건 모두 — 재질을 같이 쓴다)
  private paint(key: string, hex: string) {
    const color = new THREE.Color(hex).multiplyScalar(PAINT_GAIN);
    this.s.models.when(key, (root) => {
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const material: THREE.MeshStandardMaterial = o.material;
        material.color.copy(color);
      });
    });
  }

  private shownOf(c: Candidate): Shown {
    return this.shown.find((o) => o.c === c)!;
  }

  // 물건 하나를 놓는다: 높은 곳이면 밑에 같은 물건을 쌓거나(탑) 정해 둔 높이(통통 구름 위)에 올린다
  private build(spec: PropSpec, hub: THREE.Vector3, rand: () => number) {
    const { models, terrain, scene } = this.s,
      kind = FIND.kinds[spec.kind];
    const spot = new THREE.Vector3(),
      v = sphereAt(spot, hub, spec.x, spec.y).clone(),
      ground = terrain.groundAt(v),
      root = new THREE.Group(),
      body = new THREE.Group();
    models.need(kind.model);
    let lift = spec.base ?? 0,
      widest = 0;
    for (const size of spec.under) {
      const part = models.fit(kind.model, size, kind.by),
        tall = part.userData.hh * 2;
      widest = Math.max(widest, part.userData.rw);
      part.position.y = lift + part.userData.hh;
      part.rotation.y = rand() * Math.PI * 2;
      root.add(part);
      lift += tall * kind.nest;
    }
    const hold: Hold = models.fit(kind.model, spec.size, kind.by);
    hold.position.y = hold.userData.hh;
    body.position.y = lift;
    body.add(hold);
    root.add(body);
    q.setFromUnitVectors(UP, v);
    const yaw = rand() * Math.PI * 2;
    yawQ.setFromAxisAngle(UP, yaw);
    root.quaternion.copy(q).multiply(yawQ);
    const radius = S.R + ground;
    root.position.copy(v).multiplyScalar(radius);
    scene.add(root);
    // 속에 든 상자의 크기: 그 종류의 기본 크기일 때의 배수를 이 물건 크기에 맞춘다
    const fitted = (kind.fit * spec.size) / kind.size;
    const c: Candidate = {
      spec,
      v,
      base: ground + lift,
      tall: hold.userData.hh * 2,
      lid: hold.userData.hh * 2 * kind.lid,
      wide: hold.userData.rw,
      fit: Math.min(1, fitted),
      isFound: false,
    };
    this.list.push(c);
    const girth = Math.max(widest, c.wide);
    this.shown.push({
      c,
      root,
      body,
      ground,
      core: girth * BODY_SHARE,
      isNear: false,
      wiggleT: -1,
      squishT: -1,
      rustleT: 0,
      rustleK: 1,
      ribbon: null,
    });
  }

  // 찾은 흔적: 작은 라임 리본(나비 매듭 — 납작한 공 둘과 가운데 매듭)
  private makeRibbon(): THREE.Group {
    const bow = new THREE.Group();
    for (const side of [-1, 1]) {
      const loop = new THREE.Mesh(this.ribbonGeo, this.ribbonMat);
      loop.scale.set(0.62, 0.4, 0.26);
      const across = side * 0.3;
      loop.position.set(across, 0.2, 0);
      loop.rotation.z = side * 0.35;
      bow.add(loop);
    }
    const knot = new THREE.Mesh(this.ribbonGeo, this.ribbonMat);
    knot.scale.setScalar(0.24);
    knot.position.y = 0.16;
    bow.add(knot);
    return bow;
  }

  // 몸짓을 몸에 입힌다: 꿈틀(한 번 늘었다 줄기) · 찌그러짐(납작 → 튕겨 올라옴 → 제자리) · 바스락(좌우로 떨기)
  private pose(o: Shown, dt: number) {
    const C = FIND.candidate,
      M = FIND.miss,
      W = FIND.warm;
    let tall = 1,
      lean = 0;
    if (o.wiggleT >= 0) {
      o.wiggleT += dt;
      const u = o.wiggleT / C.wiggleSeconds,
        turn = u * Math.PI * 2;
      tall += C.wiggleScale * Math.sin(turn);
      if (u >= 1) o.wiggleT = -1;
    }
    if (o.squishT >= 0) {
      o.squishT += dt;
      const u = o.squishT / M.squishSeconds;
      tall *= squishAt(u);
      if (u >= 1) o.squishT = -1;
    }
    if (o.rustleT > 0) {
      o.rustleT -= dt;
      const left = Math.max(0, o.rustleT) / RUSTLE_SECONDS,
        phase = o.rustleT * RUSTLE_RATE,
        swing = THREE.MathUtils.degToRad(W.rustleDegrees) * o.rustleK;
      lean = Math.sin(phase) * swing * left;
    }
    const wide = 1 + (1 - tall) * 0.6;
    o.body.scale.set(wide, tall, wide);
    o.body.rotation.z = lean;
  }

  // 몸통은 막히고(쌓은 탑은 밑동부터), 위에서 내려오면 꼭대기에 올라선다
  private collide(o: Shown, flat: number) {
    const { player } = this.s,
      c = o.c;
    if (flat > o.core + 1) return;
    const top = c.base + c.lid - o.ground;
    if (player.air >= top - STEP_UP) {
      if (flat < c.wide * BODY_SHARE) player.keepAbove(top);
      return;
    }
    player.block(c.v, o.core, top);
  }
}

/* ─── 내부 ─────────────────────────── */

// 찌그러짐: 0.35 까지 납작(72%), 0.7 에 살짝 넘치게(106%), 끝에 제자리
function squishAt(u: number): number {
  if (u >= 1) return 1;
  if (u < 0.35) return 1 - 0.28 * (u / 0.35);
  if (u < 0.7) return 0.72 + 0.34 * ((u - 0.35) / 0.35);
  return 1.06 - 0.06 * ((u - 0.7) / 0.3);
}
