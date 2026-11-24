import type * as THREE from "three";

import type { PerfContext } from "./perfLog";
import { PerfLog } from "./perfLog";

// 폰에서 직접 재는 기록(perfLog.ts)의 화면: 주소에 ?perf 를 붙이면 왼쪽 위에 작은 한 줄(초당 장수 · 끊긴 수)과 '기록 복사' 단추가 뜬다.
// 한 판 하고 단추를 누르면 기록이 글로 복사된다 — 그 글을 붙여 넣어 받는다.
// 미리 보기(운영 빌드)의 실제 폰에서 켜야 하므로, 개발 빌드에서만 사는 debug.ts 의 시험용 인자와 달리 빌드에 남는다.
// ?perf 가 없으면 아무것도 만들지 않는다
// TODO(출시): 폰 실기 확인이 끝나면 이 폴더와 Game 의 연결을 뺀다

const FONT = "13px/1.2 -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif";
/** 복사됐다는 말을 보이는 시간(ms) */
const COPIED_MS = 2500;
const COPY_LABEL = "기록 복사";

/** 주소에 ?perf 가 있나 */
export function isPerfLogOn(): boolean {
  return new URLSearchParams(location.search).has("perf");
}

/** 폰에서 직접 재는 기록의 화면 */
export class PerfPanel {
  private readonly log = new PerfLog();
  private readonly box: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly copy: HTMLButtonElement;
  /** 복사가 막힌 브라우저에서 글을 직접 골라 복사하게 보이는 칸(그때 만든다) */
  private sheet: HTMLTextAreaElement | null = null;
  private shown = "";
  private copiedTimer = 0;

  constructor(
    parent: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
  ) {
    this.box = document.createElement("div");
    Object.assign(this.box.style, {
      position: "fixed",
      left: "12px",
      top: "calc(72px + env(safe-area-inset-top))",
      zIndex: "30",
      font: FONT,
      color: "#141414",
    });
    this.label = document.createElement("div");
    Object.assign(this.label.style, {
      padding: "4px 8px",
      borderRadius: "8px",
      background: "rgba(255,255,255,.82)",
      pointerEvents: "none",
    });
    this.copy = document.createElement("button");
    this.copy.type = "button";
    this.copy.textContent = COPY_LABEL;
    Object.assign(this.copy.style, {
      display: "block",
      marginTop: "6px",
      minHeight: "44px",
      padding: "0 14px",
      border: "0",
      borderRadius: "22px",
      background: "#141414",
      color: "#fff",
      font: FONT,
    });
    this.copy.addEventListener("click", this.onCopy);
    this.box.append(this.label, this.copy);
    parent.appendChild(this.box);
    this.show(this.log.readout);
  }

  /** 프레임 하나를 적는다. 화면의 한 줄은 글이 바뀔 때만 고친다(프레임마다 화면을 건드리면 재는 것이 끊김을 만든다) */
  frame(intervalMs: number, now: PerfContext) {
    this.log.frame(intervalMs, now);
    if (this.log.readout !== this.shown) this.show(this.log.readout);
  }

  /** 치운다 */
  dispose() {
    clearTimeout(this.copiedTimer);
    this.copy.removeEventListener("click", this.onCopy);
    this.box.remove();
    this.sheet?.remove();
  }

  private show(text: string) {
    this.shown = text;
    this.label.textContent = text;
  }

  // 기록을 글로 뽑아 복사한다. 복사가 막혀 있으면 글을 칸에 띄워 직접 골라 복사하게 한다
  private readonly onCopy = () => {
    const device = this.device(),
      text = this.log.report(device);
    const done = () => this.say("복사됐어요 · 채팅에 붙여 주세요"),
      blocked = () => this.offer(text);
    if (!navigator.clipboard) {
      blocked();
      return;
    }
    navigator.clipboard.writeText(text).then(done, blocked);
  };

  private say(text: string) {
    this.copy.textContent = text;
    clearTimeout(this.copiedTimer);
    this.copiedTimer = window.setTimeout(() => {
      this.copy.textContent = COPY_LABEL;
    }, COPIED_MS);
  }

  // 글을 칸에 띄운다: 길게 눌러 전체 선택 → 복사. 다시 '기록 복사'를 누르면 새 기록으로 바뀐다
  private offer(text: string) {
    if (!this.sheet) {
      this.sheet = document.createElement("textarea");
      this.sheet.readOnly = true;
      Object.assign(this.sheet.style, {
        display: "block",
        marginTop: "6px",
        width: "min(300px, 78vw)",
        height: "120px",
        font: "11px/1.3 ui-monospace, monospace",
      });
      this.box.appendChild(this.sheet);
    }
    this.sheet.value = text;
    this.sheet.focus();
    this.sheet.select();
    this.say("아래 글을 모두 골라 복사해 주세요");
  }

  // 어떤 기기인지: 브라우저 · 화면 크기와 배율 · 그리는 크기와 가장자리 다듬기 · 그래픽 칩 · 코어 수
  private device(): Record<string, string | number> {
    const gl = this.renderer.getContext(),
      names = gl.getExtension("WEBGL_debug_renderer_info"),
      chip: unknown = names ? gl.getParameter(names.UNMASKED_RENDERER_WEBGL) : "",
      isSmoothed = gl.getContextAttributes()?.antialias ?? false;
    return {
      ua: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      canvas: `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`,
      antialias: isSmoothed ? 1 : 0,
      gpu: String(chip),
      cores: navigator.hardwareConcurrency ?? 0,
    };
  }
}
