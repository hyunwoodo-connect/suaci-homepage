// 미니게임 입구의 흐름(오너 2026-11-20 3번 — 존과 상관없이 한 곳): 시작 자리에 올라서기 → 짧은 연출 → 판 시작 → 판 끝 → 결과 →
// 자유 놀이로. 결과 뒤에는 시작 자리에서 내려와야 다시 시작한다(서 있는 채로 곧바로 다시 시작하지 않게). 게임을 열 수 없으면 올라서도 그대로다

/** 흐름의 단계: 자유 놀이 · 올라서는 중 · 연출 · 판 · 결과 · 내려오기를 기다림 */
export type EntryPhase = "free" | "stepping" | "intro" | "playing" | "result" | "leaving";

/** 한 프레임에 흐름이 보는 것 */
export interface EntryInput {
  dt: number;
  /** 시작 자리 위에 서 있나 */
  isOnPad: boolean;
  /** 게임을 열 수 있나 */
  isReady: boolean;
  /** 판이 끝났나(판 동안만 본다) */
  isOver: boolean;
}

/** 그 프레임에 할 일 */
export type EntryAction = "intro" | "start" | "result" | "finish" | null;

/** 올라서 있어야 하는 시간 · 연출 · 결과(초) */
export const ENTRY_SECONDS = { step: 0.6, intro: 1.2, result: 2 } as const;

/** 미니게임 입구의 흐름 하나(존 하나) */
export class EntryFlow {
  phase: EntryPhase = "free";
  private t = 0;

  /** 한 프레임 — 할 일을 돌려준다 */
  step(input: EntryInput): EntryAction {
    this.t += input.dt;
    switch (this.phase) {
      case "free":
        if (input.isOnPad && input.isReady) this.go("stepping");
        return null;
      case "stepping":
        if (!input.isOnPad) {
          this.go("free");
          return null;
        }
        if (this.t < ENTRY_SECONDS.step) return null;
        this.go("intro");
        return "intro";
      case "intro":
        if (this.t < ENTRY_SECONDS.intro) return null;
        this.go("playing");
        return "start";
      case "playing":
        if (!input.isOver) return null;
        this.go("result");
        return "result";
      case "result":
        if (this.t < ENTRY_SECONDS.result) return null;
        this.go("leaving");
        return "finish";
      case "leaving":
        if (!input.isOnPad) this.go("free");
        return null;
    }
  }

  private go(phase: EntryPhase) {
    this.phase = phase;
    this.t = 0;
  }
}
