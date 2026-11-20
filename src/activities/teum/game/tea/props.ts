import * as THREE from "three";

import type { Random } from "../core/random";
import { openPose } from "../hideseek/opening";
import { splitAt, STAGE } from "../hideseek/openTuning";
import type { Ribbons } from "../hideseek/ribbons";
import type { ModelLibrary } from "../models/library";
import type { Spot, SpotKind } from "./spots";
import { KIND_MODEL } from "./spots";

// 리본 달린 물건 12개(기획서 v3.1 6장): 층마다 후보 자리에서 씨앗으로 3곳을 뽑아 놓는다(같은 층에 같은 종류는 둘까지).
// 물건마다 리본을 묶고(라임 — 누를 수 있다는 표시), 열어 보기 몸짓(두근 → 팡/푸슉)과 흔들림(키득·바스락), 꽝 뒤 리본 처짐(20초)을 맡는다

/** 물건 종류마다 키(m) */
const KIND_HEIGHT: Readonly<Record<SpotKind, number>> = {
  flowerpot: 1.4,
  teacup: 1.2,
  jar: 1.5,
  basket: 1.4,
  gift: 1.8,
  macaron: 0.75,
};
/** 마카롱 탑은 마카롱 셋을 쌓는다 */
const MACARON_STACK = 3;
/** 층마다 놓는 물건 수 */
const PER_TIER = 3;
/** 같은 층에 같은 종류는 이만큼까지 */
const SAME_KIND_MAX = 2;
/** 흔들림: 기울기(rad)와 시간(초) */
const SHAKE = { angle: 0.16, seconds: 0.45 } as const;

/** 놓인 리본 물건 하나 */
export interface TeaProp {
  spot: Spot;
  /** 물건을 세운 틀(바닥이 원점, 위가 +y) */
  holder: THREE.Group;
  /** 몸짓을 입히는 틀(열어 보기·흔들림) */
  body: THREE.Group;
  /** 키(m) */
  height: number;
  /** 물건 가운데(세계) */
  center: THREE.Vector3;
  /** 리본 번호 */
  ribbon: number;
  /** 이 시각(판 시간, 초)까지 상자가 들어오지 못한다(꽝·잡아 낸 물건 — 리본이 처져 있다) */
  dudUntil: number;
  /** 열어 보는 중이면 누른 뒤 흐른 시간, 아니면 -1 · 그 결과(상자가 있었나) */
  openT: number;
  openHit: boolean;
  /** 흔들림이 남은 시간과 세기 */
  shakeT: number;
  shakeK: number;
}

/** 리본 물건 12개 */
export class TeaProps {
  readonly list: TeaProp[] = [];
  private readonly root = new THREE.Group();

  constructor(
    scene: THREE.Scene,
    models: ModelLibrary,
    private readonly ribbons: Ribbons,
    spots: readonly Spot[],
    rng: Random,
  ) {
    for (const spot of pickSpots(spots, rng)) {
      const prop = this.build(spot, models);
      this.list.push(prop);
    }
    scene.add(this.root);
  }

  /** 놓은 물건의 모델 키(첫 화면에 받는다) */
  modelKeys(): string[] {
    const keys = this.list.map((p) => KIND_MODEL[p.spot.kind]);
    return [...new Set(keys)];
  }

  /** 열어 보기를 시작한다(hit: 상자가 들어 있나 — 두근은 결과와 상관없이 같다) */
  open(prop: TeaProp, hit: boolean) {
    prop.openT = 0;
    prop.openHit = hit;
    this.ribbons.setTaut(prop.ribbon, true);
  }

  /** 흔든다(k: 세기 0~1 — 키득·바스락) */
  shake(prop: TeaProp, k: number) {
    prop.shakeT = SHAKE.seconds;
    prop.shakeK = k;
  }

  /** 리본만 까딱(멀리서 눌렀다) */
  flick(prop: TeaProp) {
    this.ribbons.flick(prop.ribbon);
  }

  /** 꽝이거나 상자를 잡아 냈다: 리본이 처지고 cooldown 초 동안 상자가 들어오지 못한다 */
  setDud(prop: TeaProp, now: number, cooldown: number) {
    prop.dudUntil = now + cooldown;
    this.ribbons.setLook(prop.ribbon, "undone");
  }

  /** 지금 상자가 들어갈 수 있나 */
  isFree(prop: TeaProp, now: number): boolean {
    return now >= prop.dudUntil && prop.openT < 0;
  }

  /** 몸짓과 리본 */
  update(dt: number, time: number, now: number) {
    const O = STAGE.open;
    const split = splitAt(O);
    for (const p of this.list) {
      let size = 1,
        tall = 1,
        lean = 0;
      if (p.openT >= 0) {
        p.openT += dt;
        const pose = openPose(p.openT, p.openHit, O);
        size = pose.size;
        tall = pose.tall;
        lean = pose.lean;
        if (p.openT >= split) this.ribbons.setTaut(p.ribbon, false);
        if (p.openT >= O.leaveAt) p.openT = -1;
      }
      if (p.shakeT > 0) {
        p.shakeT -= dt;
        const k = Math.max(0, p.shakeT) / SHAKE.seconds;
        const wobblePhase = time * 38;
        lean += Math.sin(wobblePhase) * SHAKE.angle * p.shakeK * k;
      }
      const wide = size,
        high = size * tall;
      p.body.scale.set(wide, high, wide);
      p.body.rotation.z = lean;
      const isDudOver = p.dudUntil > 0 && now >= p.dudUntil;
      if (isDudOver) {
        p.dudUntil = 0;
        this.ribbons.setLook(p.ribbon, "tied");
      }
    }
    this.ribbons.update(dt, time);
  }

  /** 치운다 */
  dispose() {
    this.root.removeFromParent();
  }

  // 물건 하나: 바닥 자리에 위 쪽으로 세우고 모델을 끼운 뒤 꼭대기에 리본을 묶는다
  private build(spot: Spot, models: ModelLibrary): TeaProp {
    const holder = new THREE.Group();
    holder.position.copy(spot.base);
    holder.quaternion.setFromUnitVectors(Y_UP, spot.up);
    const body = new THREE.Group();
    holder.add(body);
    const key = KIND_MODEL[spot.kind];
    const each = KIND_HEIGHT[spot.kind];
    const stack = spot.kind === "macaron" ? MACARON_STACK : 1;
    for (let i = 0; i < stack; i++) {
      if (!models.has(key)) break;
      const hold = models.fit(key, each, "h");
      const shrink = 1 - i * 0.12;
      hold.scale.multiplyScalar(shrink);
      hold.position.y = each * i * 0.92 + hold.userData.hh * shrink;
      hold.rotation.y = i * 0.7;
      body.add(hold);
    }
    const height = each * stack;
    this.root.add(holder);
    const center = new THREE.Vector3(0, 0, 0);
    center.y = height / 2;
    holder.updateMatrixWorld(true);
    holder.localToWorld(center);
    const tie = new THREE.Vector3(0, height, 0);
    const span = height * 0.55;
    const width = Math.max(0.7, span);
    const ribbon = this.ribbons.add(body, tie, width, 0);
    return {
      spot,
      holder,
      body,
      height,
      center,
      ribbon,
      dudUntil: 0,
      openT: -1,
      openHit: false,
      shakeT: 0,
      shakeK: 0,
    };
  }
}

/** 층마다 후보에서 3곳: 씨앗으로 섞어 앞에서부터, 같은 층에 같은 종류가 둘을 넘지 않게 */
export function pickSpots(spots: readonly Spot[], rng: Random): Spot[] {
  const out: Spot[] = [];
  const tiers = [...new Set(spots.map((s) => s.tier))].sort((a, b) => a - b);
  for (const tier of tiers) {
    const pool = spots.filter((s) => s.tier === tier);
    shuffle(pool, rng);
    const kinds = new Map<SpotKind, number>();
    for (const s of pool) {
      if (out.filter((o) => o.tier === tier).length >= PER_TIER) break;
      const used = kinds.get(s.kind) ?? 0;
      if (used >= SAME_KIND_MAX) continue;
      const count = used + 1;
      kinds.set(s.kind, count);
      out.push(s);
    }
  }
  return out;
}

/* ─── 내부 ─────────────────────────── */

const Y_UP = new THREE.Vector3(0, 1, 0);

// 씨앗 난수로 제자리 섞기
function shuffle<T>(list: T[], rng: Random) {
  for (let i = list.length - 1; i > 0; i--) {
    const roll = rng.next() * (i + 1);
    const j = Math.floor(roll);
    const keep = list[i];
    list[i] = list[j];
    list[j] = keep;
  }
}
