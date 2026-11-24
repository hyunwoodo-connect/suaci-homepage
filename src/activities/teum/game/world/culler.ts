import * as THREE from "three";

import type { Frame } from "../core/frame";
import type { Player } from "../player/player";
import { S } from "../settings";

// 가까운 것만 장면에 둔다. 공이 휘어 있어서 먼 것은 어차피 땅에 가리거나 안개에 묻힌다.
// 먼 것은 장면에서 아예 떼어 낸다 — 보이지 않게(visible) 두기만 하면 three 가 매 프레임 행렬을 다시 셈하고 훑는다.
// 기준: 20 프레임마다, 높이 뜰수록 더 멀리까지(cos(min(1.45, 0.95 + 높이/260)))
//
// 지평선 너머는 그리지 않는다: 행성이 작아서(반지름 520m) 땅에 서 있으면 지평선이 60~100m 앞이다. 그 너머의 낮은 것(꽃·방석·
// 작은 조형물)은 '가까운 것' 기준(땅에서 494m) 안이어도 행성의 둥근 등에 가려 보이지 않는다 — 그리면 삼각형만 쓴다.
// 눈높이 h 에서 지평선까지의 각은 acos(R/(R+h)), 꼭대기 높이 t 인 것은 거기서 acos(R/(R+t)) 만큼 더 가야 가려진다 —
// 그 두 각의 합보다 먼 것은 뺀다. 높은 것(나무·랜드마크·떠 있는 것)은 꼭대기가 높아 저절로 멀리까지 남는다

/** 맡긴 것 하나: 그 물체와 행성 위 자리 */
interface Tracked {
  o: THREE.Object3D;
  v: THREE.Vector3;
}

/** 다시 고르는 간격(프레임) */
const EVERY = 20;
/**
 * 눈높이에 얹는 여유(m) · 눈이 오르는 빠르기를 미리 보는 시간(초, 그 빠르기로 이만큼 더 오른다고 친다 — 가장 많아야 EYE_AHEAD_MAX m),
 * 그리고 지평선 각에 얹는 여유(rad, 약 20m — 그사이 앞으로 나아가는 만큼).
 * 눈이 오르는 빠르기는 눈높이를 프레임마다 재서 얻는다 — 로켓에서는 카메라가 내 위아래 속도보다 훨씬 빨리(초당 60m 넘게) 오른다
 */
const EYE_RISE = 8,
  EYE_AHEAD = 0.4,
  EYE_AHEAD_MAX = 60,
  HORIZON_PAD = 0.04;
/** 이만큼(각 여유의 절반, 약 10m — 코사인으로 견준다) 넘게 나아갔으면 기다리지 않고 다시 고른다 */
const OUTRUN_ANGLE = HORIZON_PAD / 2,
  OUTRUN_COS = Math.cos(OUTRUN_ANGLE);

/** 지평선에 걸리는 각(dip)의 코사인·사인 — 눈과 물건의 각을 삼각함수 없이 더하려고 둘로 둔다 */
export interface Dip {
  cos: number;
  sin: number;
}

/** 높이 height(m, 행성 공 위)인 점이 지평선에 걸리는 각. pad(rad)를 얹을 수 있다 */
export function dipOf(height: number, pad = 0): Dip {
  const up = Math.max(0, height),
    ratio = S.R / (S.R + up),
    angle = Math.acos(ratio) + pad;
  return { cos: Math.cos(angle), sin: Math.sin(angle) };
}

/** 눈(eye)에서 물건(thing)이 행성에 가리지 않고 보일 수 있는 가장 먼 각의 코사인 — 자리끼리의 내적이 이보다 커야 보인다 */
export function horizonCos(eye: Dip, thing: Dip): number {
  return eye.cos * thing.cos - eye.sin * thing.sin;
}

/** 가까운 것만 그리기에 쓰는 거리(cos) — 높이 altA 에서 */
export function reachCos(altA: number): number {
  const reach = 0.95 + altA / 260,
    reachAngle = Math.min(1.45, reach);
  return Math.cos(reachAngle);
}

/** 가까운 것만 장면에 둔다 */
export class Culler {
  private readonly list: Tracked[] = [];
  private readonly holder = new THREE.Group();
  private tick = 0;
  /** 지난번 고를 때 잡은 눈높이(m, 여유까지)와 내 자리 — 그 뒤로 여유를 다 쓸 만큼 오르거나 나아갔는지 본다 */
  private passEye = -Infinity;
  private readonly passAt = new THREE.Vector3();
  /** 지난 프레임의 눈높이(m) — 오르는 빠르기를 잰다 */
  private lastEye: number | null = null;
  /** 지금 기준(cos). 찍어 둔 묶음(Instancer)도 같은 기준으로 칸을 채운다 */
  cut = -1;
  /** 지금 눈높이의 지평선 각(여유 포함). 처음 고르기 전에는 아무것도 가리지 않는 값 */
  eye: Dip = { cos: -1, sin: 0 };
  private readonly listeners: ((cut: number) => void)[] = [];

  /** camera: 눈높이를 재는 카메라(없으면 내 높이로 잰다) */
  constructor(
    scene: THREE.Scene,
    private readonly player: Player,
    private readonly camera?: THREE.Camera,
  ) {
    this.holder.name = "near";
    scene.add(this.holder);
  }

  /** 이 물체를 자리 v 로 맡긴다(다른 부모 밑에 있으면 떼어 온다) */
  track(o: THREE.Object3D, v: THREE.Vector3) {
    o.removeFromParent();
    this.list.push({ o, v });
    o.parent = this.holder;
    this.holder.children.push(o);
  }

  /** 기준을 다시 정할 때마다 부른다(찍어 둔 묶음·꽃처럼 칸을 따로 채우는 것) */
  onCull(fn: (cut: number) => void) {
    this.listeners.push(fn);
  }

  /**
   * 20 프레임마다 가까운 것만 남긴다. 그사이라도 눈이 지난번에 잡은 눈높이의 여유를 절반 넘게 썼거나(로켓·등대 둘러보기 — 프레임이 느린
   * 폰에서는 20 프레임이 길다) 10m 넘게 나아갔으면(구멍으로 순간 이동한 뒤에도) 기다리지 않고 한 번 더 고른다 — 지평선 너머로 뺀 것이
   * 늦게 나타나지 않게. 20 프레임 박자는 그대로 둔다
   */
  update(f: Frame) {
    const isDue = --this.tick <= 0;
    if (isDue) this.tick = EVERY;
    const P = this.player.P,
      p = this.player.p;
    const altA = P.length() - S.R,
      cameraAlt = this.camera ? this.camera.position.length() - S.R : altA,
      eyeNow = Math.max(cameraAlt, altA);
    // 눈이 오르는 빠르기(m/s): 지난 프레임과 견준다
    const risen = this.lastEye === null ? 0 : eyeNow - this.lastEye,
      climbRate = f.dt > 0 ? Math.max(0, risen) / f.dt : 0;
    this.lastEye = eyeNow;
    const hasOutrun = eyeNow > this.passEye - EYE_RISE / 2 || p.dot(this.passAt) < OUTRUN_COS;
    if (!isDue && !hasOutrun) return;
    const cut = reachCos(altA);
    this.cut = cut;
    // 눈높이: 카메라와 나 가운데 높은 쪽에, 지금 빠르기로 더 오를 만큼과 여유를 얹는다
    const climb = climbRate * EYE_AHEAD,
      ahead = Math.min(EYE_AHEAD_MAX, climb),
      eyeAlt = eyeNow + ahead + EYE_RISE;
    this.passEye = eyeAlt;
    this.passAt.copy(p);
    this.eye = dipOf(eyeAlt, HORIZON_PAD);
    const kids = this.holder.children;
    kids.length = 0;
    for (const t of this.list) {
      if (t.v.dot(p) > cut) {
        t.o.parent = this.holder;
        kids.push(t.o);
      } else t.o.parent = null;
    }
    for (const fn of this.listeners) fn(cut);
  }

  /** 맡긴 것을 모두 놓는다 */
  dispose() {
    for (const t of this.list) t.o.parent = null;
    this.holder.children.length = 0;
    this.holder.removeFromParent();
  }
}
