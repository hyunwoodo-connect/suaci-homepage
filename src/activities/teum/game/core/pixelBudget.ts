// 느린 기기에서 화면 배율을 스스로 낮춘다. 그리는 픽셀 수는 배율의 제곱이라(2 → 1.5 면 44% 줄어든다) 프레임이 계속 느릴 때 가장 크게 듣는다.
// 화질이 바뀌는 일이라 조심스럽게 한다:
//  · 시작하고 얼마 동안과 배율을 바꾼 직후는 재지 않는다(불러오고 셰이더를 만드느라 원래 느리다)
//  · 한참 멈춘 프레임(탭이 가려졌다 돌아옴)은 세지 않는다
//  · 두 번 이어서 재도 느릴 때만 한 단계 낮춘다 — 잠깐 끊긴 것으로는 낮추지 않는다
//  · 낮췄는데 나아지지 않으면(저전력 모드처럼 기기가 초당 30장으로 묶어 둔 경우) 되돌리고 그 뒤로는 건드리지 않는다
//  · 다시 올리지는 않는다(오르내리면 화면이 출렁인다)

/** 낮추는 차례(이보다 낮은 배율로 시작한 기기는 제 배율 아래의 것만 쓴다) */
const STEPS: readonly number[] = [2, 1.5, 1.25];
/** 한 번 재는 프레임 수 · 이보다 느리면(평균 ms — 초당 42장 아래) 느린 것 · 이보다 긴 프레임은 멈춘 것으로 보고 세지 않는다 */
const WINDOW = 90,
  SLOW_MS = 24,
  STALL_MS = 100;
/** 재지 않는 프레임 수: 시작한 뒤 · 배율을 바꾼 뒤 */
const SKIP_AT_START = 180,
  SKIP_AFTER_CHANGE = 45;
/** 낮춘 뒤 프레임이 이 비율보다 더 짧아져야 나아진 것으로 친다 */
const BETTER = 0.88;

/** 화면 배율 조절 */
export class PixelBudget {
  private current: number;
  private skip = SKIP_AT_START;
  private sum = 0;
  private count = 0;
  /** 이어서 느렸던 횟수 */
  private slowRuns = 0;
  /** 낮춰 보는 중이면 낮추기 전의 배율과 그때의 평균(ms) */
  private trial: { from: number; before: number } | null = null;
  private isLocked = false;

  /** start: 시작 배율(기기 배율과 2 가운데 작은 쪽) */
  constructor(start: number) {
    this.current = start;
  }

  /** 프레임 사이 간격(ms)을 알린다. 배율을 바꿔야 하면 새 배율을, 아니면 null 을 돌려준다 */
  feed(intervalMs: number): number | null {
    if (this.isLocked || intervalMs > STALL_MS) return null;
    if (this.skip > 0) {
      this.skip--;
      return null;
    }
    this.sum += intervalMs;
    this.count++;
    if (this.count < WINDOW) return null;
    const mean = this.sum / this.count;
    this.sum = 0;
    this.count = 0;
    if (this.trial) return this.judge(mean);
    this.slowRuns = mean > SLOW_MS ? this.slowRuns + 1 : 0;
    if (this.slowRuns < 2) return null;
    return this.lower(mean);
  }

  /* ─── 내부 ─────────────────────────── */

  // 한 단계 낮춰 본다. 더 낮출 단계가 없으면 그만둔다
  private lower(mean: number): number | null {
    const next = STEPS.find((step) => step < this.current);
    if (next === undefined) {
      this.isLocked = true;
      return null;
    }
    this.trial = { from: this.current, before: mean };
    return this.change(next);
  }

  // 낮춘 것이 들었나: 나아졌으면 그대로 두고 계속 보고, 아니면 되돌리고 그만둔다
  private judge(mean: number): number | null {
    const { from, before } = this.trial!;
    this.trial = null;
    this.slowRuns = 0;
    if (mean < before * BETTER) return null;
    this.isLocked = true;
    return this.change(from);
  }

  private change(ratio: number): number {
    this.current = ratio;
    this.skip = SKIP_AFTER_CHANGE;
    return ratio;
  }
}
