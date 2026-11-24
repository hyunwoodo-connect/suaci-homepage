// 폰에서 직접 재는 기록: 프레임 사이 간격을 받아, 끊긴 프레임과 그때 무슨 일이 있었는지를 적어 둔다.
// 컴퓨터에서 CPU 를 느리게 걸어 재는 것으로는 폰의 그래픽 칩·발열·메모리 수거를 흉내 내지 못한다 — 실제 기기에서 한 판 하며 적고,
// 끝나면 글로 뽑아(report) 붙여 넣어 받는다. 재는 것 자체가 끊김을 만들지 않게, 프레임마다 새로 만드는 것 없이 숫자만 더한다

/** 프레임 하나를 잴 때 같이 적는 것(그 간격이 걸린 프레임의 상태) */
export interface PerfContext {
  /** 땅 위 높이(m) */
  air: number;
  /** 놀이기구에 붙잡혀 있나 */
  isHeld: boolean;
  /** 꾸미기 씬인가 */
  isInStudio: boolean;
  /** 그 프레임에 그린 삼각형·그리기 호출 수 */
  triangles: number;
  calls: number;
  /** 그때까지 만든 셰이더·올린 도형·올린 그림 수(늘었으면 그 프레임에 새로 만든 것이다) */
  programs: number;
  geometries: number;
  textures: number;
  /** 화면 배율 */
  ratio: number;
  /** 에셋이 아직 오는 중인가 */
  isSettling: boolean;
  /** 먹은 물풍선 수 */
  eaten: number;
  /**
   * 그 프레임에 게임이 셈하고 그리라고 시키는 데 쓴 시간(ms). 간격은 긴데 이 값이 짧으면 게임 코드가 아니라
   * 그래픽 칩이 그리는 시간·브라우저의 화면 합성·메모리 수거에서 걸린 것이다
   */
  workMs: number;
}

/** 구간 하나의 길이(초) */
const SPAN_SECONDS = 5;
/** 적어 두는 끊긴 프레임·구간의 최대 수(넘으면 수만 센다 — 20분이면 구간 240개) */
const MAX_DROPS = 80,
  MAX_SPANS = 240;
/** 이보다 긴 간격은 끊김이 아니라 자리를 비운 것(다른 앱·화면 잠금)으로 본다 */
const PAUSE_MS = 500;
/** 끊김: 이 기기의 고른 간격의 1.6 배를 넘고(화면을 한 번 넘게 건너뜀) 적어도 25ms 를 넘는 프레임 */
const DROP_FACTOR = 1.6,
  DROP_FLOOR_MS = 25;
/**
 * 이 기기의 고른 간격: 간격을 작은 것부터 세워 4분의 1 지점의 값(끊긴 프레임이 섞여도 흔들리지 않고, 늘 초당 30장인 기기에서는 33ms 가 된다).
 * 처음 120장은 프레임마다, 그 뒤로는 120장마다 다시 잰다
 */
const STEADY_SHARE = 0.25,
  STEADY_EVERY = 120;
/** 간격 분포의 칸(1ms 씩, 마지막 칸은 그 이상) */
const BINS = 121;
/** 분포를 묶어 보이는 경계(ms): 초당 120장 · 60장 · 한 장 건너뜀 · 두 장 건너뜀 · 그 이상 */
const BUCKET_EDGES = [10, 18, 26, 34, 51, 101];

/** 폰에서 직접 재는 기록 */
export class PerfLog {
  /** 화면에 보일 한 줄(바뀔 때만 새 글이 된다 — 프레임마다 화면을 건드리지 않게) */
  readout = "재는 중…";
  private readonly bins = new Uint32Array(BINS);
  private frames = 0;
  private studioFrames = 0;
  private pauses = 0;
  private sumMs = 0;
  private worstMs = 0;
  private seconds = 0;
  private steadyMs = 0;
  /** 마지막으로 닫힌 구간의 초당 장수(아직 없으면 0) */
  private fps = 0;
  private dropCount = 0;
  private readonly drops: number[][] = [];
  private readonly spans: number[][] = [];
  /** 지금 구간에 쌓는 값 */
  private spanFrames = 0;
  private spanMs = 0;
  private spanWorst = 0;
  private spanAir = 0;
  private spanTriangles = 0;
  private spanCalls = 0;
  private spanWork = 0;
  /** 지난 프레임까지의 셰이더·도형·그림 수(-1 이면 아직 모른다) */
  private programs = -1;
  private geometries = 0;
  private textures = 0;

  /** 프레임 하나: 지난 프레임부터의 간격(ms)과 그 프레임의 상태 */
  frame(intervalMs: number, now: PerfContext) {
    const shaders = this.programs < 0 ? 0 : now.programs - this.programs,
      shapes = this.programs < 0 ? 0 : now.geometries - this.geometries,
      images = this.programs < 0 ? 0 : now.textures - this.textures;
    this.programs = now.programs;
    this.geometries = now.geometries;
    this.textures = now.textures;
    // 맨 첫 프레임은 간격이 없다(0 이거나, 시계를 읽은 차례에 따라 음수로 온다)
    if (intervalMs <= 0) return;
    if (intervalMs > PAUSE_MS) {
      this.pauses++;
      return;
    }
    if (now.isInStudio) {
      this.studioFrames++;
      return;
    }
    this.frames++;
    this.sumMs += intervalMs;
    this.seconds += intervalMs / 1000;
    this.worstMs = Math.max(this.worstMs, intervalMs);
    const rounded = Math.round(intervalMs),
      lastBin = BINS - 1,
      bin = Math.min(lastBin, rounded);
    this.bins[bin]++;
    if (this.frames <= STEADY_EVERY || this.frames % STEADY_EVERY === 0)
      this.steadyMs = this.intervalAt(STEADY_SHARE);
    if (intervalMs > this.dropAt) {
      this.dropCount++;
      if (this.drops.length < MAX_DROPS) {
        const drop = [
          round1(this.seconds),
          rounded,
          Math.round(now.air),
          now.isHeld ? 1 : 0,
          thousands(now.triangles),
          now.calls,
          shaders,
          shapes,
          images,
          now.ratio,
          now.isSettling ? 1 : 0,
          now.eaten,
          round1(now.workMs),
        ];
        this.drops.push(drop);
      }
      this.refresh();
    }
    this.spanFrames++;
    this.spanMs += intervalMs;
    this.spanWorst = Math.max(this.spanWorst, intervalMs);
    this.spanAir += now.air;
    this.spanTriangles += now.triangles;
    this.spanCalls += now.calls;
    this.spanWork += now.workMs;
    if (this.spanMs >= SPAN_SECONDS * 1000) this.closeSpan();
  }

  /**
   * 붙여 넣을 글: 사람이 읽는 두 줄과, 그대로 읽어 들일 수 있는 값(JSON) 한 줄.
   * spans 는 [끝난 때(초), 프레임 수, 평균 간격, 가장 긴 간격, 평균 높이, 삼각형(천), 그리기 호출, 게임이 쓴 시간],
   * dropList 는 [때(초), 간격, 높이, 붙잡힘, 삼각형(천), 그리기 호출, 새 셰이더, 새 도형, 새 그림, 화면 배율, 에셋 오는 중, 먹은 풍선, 게임이 쓴 시간]
   */
  report(device: Record<string, string | number>): string {
    const typical = this.intervalAt(0.5),
      average = this.frames ? this.sumMs / this.frames : 0,
      fps = average ? 1000 / average : 0;
    const data = {
      v: 1,
      device,
      frames: this.frames,
      studioFrames: this.studioFrames,
      pauses: this.pauses,
      seconds: Math.round(this.seconds),
      typicalMs: typical,
      steadyMs: this.steadyMs,
      averageMs: round1(average),
      dropAtMs: round1(this.dropAt),
      drops: this.dropCount,
      worstMs: Math.round(this.worstMs),
      buckets: this.buckets(),
      spans: this.spans,
      dropList: this.drops,
    };
    const head = `틈 측정 · ${this.frames}장 · 평균 ${fps.toFixed(0)}fps(보통 ${typical}ms) · 끊김 ${this.dropCount}장 · 가장 긴 것 ${data.worstMs}ms`;
    return `${head}\n${JSON.stringify(data)}`;
  }

  // 끊김으로 보는 간격(ms)
  private get dropAt(): number {
    const skipped = this.steadyMs * DROP_FACTOR;
    return Math.max(DROP_FLOOR_MS, skipped);
  }

  // 간격을 작은 것부터 세웠을 때 share(0..1) 지점의 값(ms): 분포의 칸을 앞에서부터 그만큼 센다. 아직 한 장도 없으면 0
  private intervalAt(share: number): number {
    const target = this.frames * share;
    let seen = 0;
    for (let ms = 0; ms < BINS; ms++) {
      seen += this.bins[ms];
      if (seen > 0 && seen >= target) return ms;
    }
    return 0;
  }

  // 분포를 경계마다 묶은 수(마지막은 가장 큰 경계 이상)
  private buckets(): number[] {
    const counts = BUCKET_EDGES.map(() => 0);
    counts.push(0);
    for (let ms = 0; ms < BINS; ms++) {
      const at = BUCKET_EDGES.findIndex((edge) => ms < edge),
        bucket = at < 0 ? BUCKET_EDGES.length : at;
      counts[bucket] += this.bins[ms];
    }
    return counts;
  }

  // 구간 하나를 닫아 적고, 화면에 보일 한 줄을 고친다
  private closeSpan() {
    const n = this.spanFrames,
      average = this.spanMs / n,
      air = this.spanAir / n,
      triangles = this.spanTriangles / n,
      calls = this.spanCalls / n,
      work = this.spanWork / n;
    if (this.spans.length < MAX_SPANS) {
      const span = [
        Math.round(this.seconds),
        n,
        round1(average),
        Math.round(this.spanWorst),
        Math.round(air),
        thousands(triangles),
        Math.round(calls),
        round1(work),
      ];
      this.spans.push(span);
    }
    this.spanFrames = 0;
    this.spanMs = 0;
    this.spanWorst = 0;
    this.spanAir = 0;
    this.spanTriangles = 0;
    this.spanCalls = 0;
    this.spanWork = 0;
    this.refresh(average);
  }

  // 화면에 보일 한 줄: 요즘 초당 장수(구간이 닫힐 때만 바뀐다)와 끊긴 수
  private refresh(spanAverageMs?: number) {
    if (spanAverageMs !== undefined) {
      const perSecond = 1000 / spanAverageMs;
      this.fps = Math.round(perSecond);
    }
    const speed = this.fps ? `${this.fps}fps` : "재는 중";
    this.readout = `${speed} · 끊김 ${this.dropCount}`;
  }
}

/* ─── 내부 ─────────────────────────── */

function round1(x: number): number {
  const tenths = x * 10;
  return Math.round(tenths) / 10;
}

function thousands(x: number): number {
  const k = x / 1000;
  return Math.round(k);
}
