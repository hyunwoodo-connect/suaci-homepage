import * as THREE from "three";

import type { Services } from "../services";
import { FIND } from "./findTuning";

// 뜨거워 차가워: 가장 가까운, 아직 못 찾은 상자까지의 거리로 정한다. 화면에 표시는 없다 — 소리와 세계 안의 움직임으로만 알린다.
//   warm.far 밖: 없음 · far~mid: every[0] 초마다 작은 키득 · mid~near: every[1] 초마다 키득 + 고양이 꼬리 반짝임이 빨라진다 ·
//   near 안: every[2] 초마다 키득 + 숨은 물건이 바스락(눈에 보이게 흔들리고 바스락 소리)
// 키득 셋을 번갈아, 음높이를 조금씩 바꿔 낸다. 소리에는 방향이 있다(상자가 화면 왼쪽이면 왼쪽에서, 멀면 작게).
// 소리가 꺼져 있어도 통한다: mid 안에서는 고양이가, near 안에서는 물건의 흔들림이 알려 준다

/** 뜨거워 차가워의 단계: 0 멀다(없음) · 1 far 안 · 2 mid 안 · 3 near 안 */
export type Warmth = 0 | 1 | 2 | 3;

/** 가장 가까운 못 찾은 상자: 거리(m)·세계 자리·바스락거릴 때 할 일(그 물건을 흔든다) */
export interface WarmTarget {
  dist: number;
  at: THREE.Vector3;
  rustle(): void;
}

/** 고양이: 꼬리 반짝임 간격(초) */
export interface WarmCat {
  setCatTwinkle(every: number): void;
  /** 꽝을 열었다: 한숨(납작) */
  catSigh(): void;
  /** 상자를 찾았다: 한 바퀴 */
  catCheer(): void;
}

/** 키득 가짓수 · far 안에 막 들어왔을 때 첫 키득까지(초) */
const GIGGLES = 3,
  FIRST_WAIT = 0.8;
/** 좌우 치우침을 키우는 배수(화면 가장자리쯤이면 한쪽으로 다 간다) */
const PAN_GAIN = 1.6;

const toBox = new THREE.Vector3(),
  right = new THREE.Vector3(),
  eye = new THREE.Vector3();

/** 거리(m)의 단계 */
export function warmthOf(dist: number): Warmth {
  const W = FIND.warm;
  if (dist > W.far) return 0;
  if (dist > W.mid) return 1;
  return dist > W.near ? 2 : 3;
}

/** 그 단계의 키득 간격(초). 멀면(0) null */
export function giggleEvery(level: Warmth): number | null {
  return level === 0 ? null : FIND.warm.every[level - 1];
}

/** 거리(m)의 키득 크기: far 에서 volume[0], near 안에서 volume[1] — 그 사이는 고르게 */
export function giggleVolume(dist: number): number {
  const { far, near, volume } = FIND.warm,
    span = far - near,
    share = (far - dist) / span,
    k = THREE.MathUtils.clamp(share, 0, 1);
  return volume[0] + (volume[1] - volume[0]) * k;
}

/** 음높이 배수: warm.pitch 반음 폭 안에서 r(0..1)로 고른다 */
export function giggleRate(r: number): number {
  const semitones = (r * 2 - 1) * FIND.warm.pitch,
    octaves = semitones / 12;
  return Math.pow(2, octaves);
}

/** 뜨거워 차가워 */
export class Warm {
  private level: Warmth = 0;
  private wait = 0;
  private turn = 0;
  private rustleWait = 0;

  constructor(
    private readonly s: Services,
    private readonly cat: WarmCat,
    private readonly rand: () => number,
  ) {}

  /** 판 시작·끝: 조용히 */
  stop() {
    this.level = 0;
    this.wait = 0;
    this.rustleWait = 0;
    this.cat.setCatTwinkle(0);
  }

  /** 한 프레임: 가장 가까운 못 찾은 상자(없으면 null)로 단계를 정하고, 때가 되면 키득·바스락 */
  update(dt: number, target: WarmTarget | null) {
    const level = target ? warmthOf(target.dist) : 0,
      was = this.level;
    this.level = level;
    const W = FIND.warm,
      twinkle = level >= 3 ? W.sparkle[2] : level === 2 ? W.sparkle[1] : W.sparkle[0];
    this.cat.setCatTwinkle(twinkle);
    const every = giggleEvery(level);
    if (!target || every === null) {
      this.wait = FIRST_WAIT;
      return;
    }
    // 더 가까운 단계로 들어서면 기다리던 시간을 그 단계의 간격으로 줄인다
    if (level > was) this.wait = Math.min(this.wait, every);
    this.wait -= dt;
    if (this.wait <= 0) {
      this.wait = every;
      this.giggle(target);
    }
    if (level < 3) {
      this.rustleWait = 0;
      return;
    }
    this.rustleWait -= dt;
    if (this.rustleWait > 0) return;
    this.rustleWait = W.rustleEvery;
    target.rustle();
    const pan = this.panOf(target.at),
      volume = giggleVolume(target.dist);
    this.s.events.emit("findRustled", { pan, volume });
  }

  /* ─── 내부 ─────────────────────────── */

  private giggle(target: WarmTarget) {
    const which = this.turn % GIGGLES;
    this.turn++;
    const pan = this.panOf(target.at),
      volume = giggleVolume(target.dist),
      pitch = this.rand(),
      rate = giggleRate(pitch);
    this.s.events.emit("findGiggled", { which, pan, volume, rate });
  }

  // 화면에서 본 좌우(-1 왼쪽 … 1 오른쪽): 카메라에서 상자 쪽이 카메라 오른쪽으로 얼마나 치우쳤나
  private panOf(at: THREE.Vector3): number {
    const camera = this.s.camera.camera;
    camera.getWorldPosition(eye);
    toBox.copy(at).sub(eye).normalize();
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const side = toBox.dot(right) * PAN_GAIN;
    return THREE.MathUtils.clamp(side, -1, 1);
  }
}
