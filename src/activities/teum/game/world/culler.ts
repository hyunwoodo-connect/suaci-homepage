import * as THREE from "three";

import type { Frame } from "../core/frame";
import type { Player } from "../player/player";
import { S } from "../settings";

// 가까운 것만 장면에 둔다. 공이 휘어 있어서 먼 것은 어차피 땅에 가리거나 안개에 묻힌다.
// 먼 것은 장면에서 아예 떼어 낸다 — 보이지 않게(visible) 두기만 하면 three 가 매 프레임 행렬을 다시 셈하고 훑는다.
// 기준: 20 프레임마다, 높이 뜰수록 더 멀리까지(cos(min(1.45, 0.95 + 높이/260)))
//
// 지평선 너머는 그리지 않는다: 행성이 작아서(반지름 520m) 땅에 서 있으면 지평선이 60~100m 앞이다. 그 너머의 낮은 것(꽃·방석·
// 작은 조형물)은 행성의 둥근 등에 가려 보이지 않는데도 '가까운 것' 기준(땅에서 494m) 안이라 다 그려졌다.
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
 * 눈높이에 얹는 여유: 다시 고르기까지(20 프레임) 카메라가 더 오를 수 있는 만큼(m) · 위로 솟는 빠르기를 미리 보는 시간(초),
 * 그리고 지평선 각에 얹는 여유(rad, 약 20m — 그사이 앞으로 나아가는 만큼)
 */
const EYE_RISE = 8,
  EYE_AHEAD = 0.5,
  HORIZON_PAD = 0.04;

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

  /** 20 프레임마다 가까운 것만 남긴다 */
  update(f: Frame) {
    void f;
    if (--this.tick > 0) return;
    this.tick = EVERY;
    const P = this.player.P,
      p = this.player.p;
    const altA = P.length() - S.R;
    const cut = reachCos(altA);
    this.cut = cut;
    // 눈높이: 카메라와 나 가운데 높은 쪽에, 그사이 더 오를 만큼을 얹는다
    const cameraAlt = this.camera ? this.camera.position.length() - S.R : altA,
      climb = Math.max(0, this.player.vy) * EYE_AHEAD,
      eyeAlt = Math.max(cameraAlt, altA) + climb + EYE_RISE;
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
