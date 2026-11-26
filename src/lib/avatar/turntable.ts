import { ease } from "./motion";

// 초상의 돌림판: 카메라가 아바타 둘레를 얼마나 돌았는지(각)를 정한다.
// 가만히 두면 저절로 천천히 돈다 — 서 있기만 하면 그림처럼 보인다. 손을 대면 멈춰 민 만큼만 돌고,
// 떼면 그 빠르기로 조금 더 돌다 멎은 뒤 잠깐 쉬었다가 민 쪽으로 다시 저절로 돈다

/** 가로로 민 만큼 도는 각(라디안/px — 꾸미기 씬과 같다) */
const TURN_PER_PX = 0.012;
/** 손을 뗀 뒤 도는 빠르기가 줄어드는 비율(초당)과 가장 빠르게(라디안/초) */
const SPIN_DAMP = 3.2,
  SPIN_MAX = 9;
/** 저절로 도는 빠르기(라디안/초 — 한 바퀴에 16초쯤), 멈춘 뒤 쉬는 시간(초), 다시 돌 때 빠르기가 붙는 비율(초당) */
const ORBIT_RATE = 0.4,
  ORBIT_REST = 1.6,
  ORBIT_GAIN = 1.5;

/** 초상의 돌림판 */
export class Turntable {
  /** 카메라가 아바타 둘레를 돈 각(라디안) */
  angle = 0;
  private readonly isStill: boolean;
  // 손을 뗀 뒤 도는 빠르기(라디안/초)
  private spin = 0;
  // 저절로 도는 세기(0~1)와 그 방향 — 마지막으로 민 쪽. 처음에는 얼굴 앞을 지나가는 쪽으로 돈다(초상은 얼굴 앞에서 조금 옆에 서서 시작한다)
  private orbit: number;
  private side = -1;
  // 멈춘 뒤 흐른 시간(초)
  private rest = ORBIT_REST;
  private isHeld = false;

  /** isStill: 움직임 줄이기를 켠 사람 — 저절로 돌지 않고 손을 뗀 자리에서 멎는다(밀어서는 돌릴 수 있다) */
  constructor(isStill: boolean) {
    this.isStill = isStill;
    this.orbit = isStill ? 0 : 1;
  }

  /** 손을 댔다 — 돌던 것이 멈춘다 */
  hold() {
    this.isHeld = true;
    this.halt();
  }

  /** 가로로 dx(px) 밀었다 */
  move(dx: number) {
    this.angle -= dx * TURN_PER_PX;
    if (dx !== 0) this.side = dx < 0 ? 1 : -1;
  }

  /** 손을 뗐다. speed: 떼는 순간의 빠르기(px/초) */
  release(speed: number) {
    this.isHeld = false;
    const spin = this.isStill ? 0 : -speed * TURN_PER_PX,
      capped = Math.min(SPIN_MAX, spin);
    this.spin = Math.max(-SPIN_MAX, capped);
  }

  /** 돌던 것을 멈춰 세운다(옷장을 여닫을 때) — 쉬었다가 다시 저절로 돈다 */
  pause() {
    this.isHeld = false;
    this.halt();
  }

  /** dt 초만큼 흐른다 */
  step(dt: number) {
    if (this.isHeld) return;
    this.rest += dt;
    const wanted = !this.isStill && this.rest >= ORBIT_REST ? 1 : 0,
      damp = -SPIN_DAMP * dt;
    this.orbit += (wanted - this.orbit) * ease(ORBIT_GAIN, dt);
    this.angle += (this.spin + ORBIT_RATE * this.orbit * this.side) * dt;
    this.spin *= Math.exp(damp);
  }

  private halt() {
    this.spin = 0;
    this.orbit = 0;
    this.rest = 0;
  }
}
