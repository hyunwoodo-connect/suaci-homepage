// 물풍선 놀이 한 판의 상태: 무엇을 먹었나 · 몇 개째 · 걸린 시간 · 어디까지 왔나.
// 장면도 화면도 모른다 — 물풍선(waterBalloons.ts)이 이 상태를 보고 그리고 알린다

/**
 * 한 판의 단계: waiting 첫 움직임을 기다린다(시계 멈춤) → running 먹는 중(시계가 간다) → cleared 다 먹었다(시계 멈춤)
 * → over '계속 놀기'를 골라 물풍선 없이 떠다닌다. '한 번 더'는 어디서든 waiting 으로 돌아간다
 */
export type RoundStage = "waiting" | "running" | "cleared" | "over";

/** 물풍선 놀이 한 판 */
export class BalloonRound {
  private readonly _eaten: boolean[];
  private _count = 0;
  private _seconds = 0;
  private _stage: RoundStage = "waiting";

  /** total: 이 지도의 물풍선 수 */
  constructor(readonly total: number) {
    this._eaten = Array.from({ length: total }, () => false);
  }

  /** 물풍선마다 먹었나(자리 차례) */
  get eaten(): readonly boolean[] {
    return this._eaten;
  }
  /** 먹은 수 */
  get count(): number {
    return this._count;
  }
  /** 걸린 시간(초) — 첫 움직임부터 마지막 물풍선까지 */
  get seconds(): number {
    return this._seconds;
  }
  get stage(): RoundStage {
    return this._stage;
  }
  /** 물풍선이 떠 있는 동안(먹을 수 있다) */
  get isOpen(): boolean {
    return this._stage === "waiting" || this._stage === "running";
  }

  /** 첫 움직임에 시계를 켠다(이미 켰거나 끝났으면 그대로) */
  begin() {
    if (this._stage === "waiting") this._stage = "running";
  }

  /** 프레임 시계만큼 시간이 간다(먹는 중에만) */
  tick(dt: number) {
    if (this._stage === "running") this._seconds += dt;
  }

  /** i 번째를 먹는다. 먹었으면 true(이미 먹은 것·끝난 판이면 false). 마지막이면 판이 cleared 가 된다 */
  eat(i: number): boolean {
    if (!this.isOpen || this._eaten[i] !== false) return false;
    // 움직이지 않고도(놀이기구에 실려) 먹을 수 있다 — 그때는 이 순간부터 잰다
    this._stage = "running";
    this._eaten[i] = true;
    this._count++;
    if (this._count === this.total) this._stage = "cleared";
    return true;
  }

  /** 한 번 더: 물풍선이 모두 돌아오고 수와 시계가 0 으로 */
  restart() {
    this._eaten.fill(false);
    this._count = 0;
    this._seconds = 0;
    this._stage = "waiting";
  }

  /** 계속 놀기: 물풍선 없이 떠다닌다 */
  leave() {
    this._stage = "over";
  }
}
