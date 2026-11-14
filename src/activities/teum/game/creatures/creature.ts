import type * as THREE from "three";

import type { Random } from "../core/random";
import type { ModelBatch } from "../models/batch";

// 생물 하나의 상태. 모양은 종마다 한 번에 그리는 묶음(ModelBatch)이 그리고, 여기에는 자리·상태만 있다.
// 모든 칸을 처음부터 같은 모양으로 채운다(없는 값은 0·null) — 생물마다 칸이 달라지면 JS 엔진이 수를 상자에 담아
// 매 프레임 가비지를 만든다(재 보니 초당 수 MB)

/** 생물의 갈래: herd 땅 위 무리, flock 하늘을 도는 셋, jelly 해파리, fish 호수 */
export type CreatureRole = "herd" | "flock" | "jelly" | "fish";

/** 생물 하나 */
export interface Creature {
  /** 종(에셋 키) */
  k: string;
  role: CreatureRole;
  /** 이 종을 그리는 묶음(크기·키의 절반도 여기서 읽는다) */
  batch: ModelBatch;
  /** 이 생물만의 난수(멀리 있어 쉬는 동안에는 뽑지 않는다 — 다른 생물의 흐름은 그대로) */
  rng: Random;
  /** 몸 휘기 값: x 고유 위상, y 걸음 위상, z 움직임 세기, w 고개 */
  an: THREE.Vector4;
  v: THREE.Vector3;
  home: THREE.Vector3;
  /** 보는 쪽 */
  f: THREE.Vector3;
  /** 그린 자리(가까이 있을 때만 갱신된다 — 빛가루·물방울이 여기서 튄다) */
  pos: THREE.Vector3;
  /** 지금 그려지는가 */
  visible: boolean;
  /** 땅에서의 높이 */
  a: number;
  ph: number;
  st: string;
  t: number;
  still: number;
  hop: number;
  hopV: number;
  vis: number;
  want: number;
  /** 줄지어 따라오는 차례(-1 이면 아님) */
  order: number;
  met: boolean;
  sink: number;
  pitch: number;
  roll: number;
  amt: number;
  head: number;
  gait: "walk" | "hop";
  /** 무리의 중심(땅 위 무리) */
  hv: THREE.Vector3 | null;
  /** 전설이면 1 */
  legend: number;
  // ---- 하늘을 도는 셋 ----
  ctr: THREE.Vector3 | null;
  rad: number;
  dir: number;
  alt: number;
  ang: number;
  slot: number;
  g0: number;
  // ---- 해파리·물고기 ----
  base: number;
  jt: number;
  rt: number;
  bt: number;
  goal: THREE.Vector3 | null;
  rs: number;
  // ---- 버릇이 쓰는 값 ----
  /** 구르기: 지난 자리와 구른 각 */
  lp: THREE.Vector3 | null;
  tum: number;
  /** 인사했나(멀어지면 다시) */
  bowed: boolean;
  /** 다시 할 때까지(장미 돌기·사슴 달아나기) */
  cd: number;
  /** 사슴을 따라간 횟수 */
  n: number;
  /** 회중시계가 이미 앞장섰나 */
  led: boolean;
  /** 내 둘레를 도는 남은 시간과 다시 돌 때까지 */
  vt: number;
  vc: number;
}

/** 이번 프레임 움직임 세기와 고개 — 버릇이 정하면 공통 상태 기계가 그 위에서 이어 간다 */
export interface Pose {
  amt: number;
  head: number;
}

/** 버릇이 보는 것: 나와의 거리(dP)·높이 차(dA), 놀라는지(scare)·보이는지(seen) */
export interface Sense {
  dP: number;
  dA: number;
  scare: boolean;
  seen: boolean;
}
