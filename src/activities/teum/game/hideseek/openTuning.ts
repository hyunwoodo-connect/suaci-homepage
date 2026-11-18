import data from "./hideseek.data.json";

// 조각 03 의 값: hideseek.data.json 의 ribbon(리본 달린 것만 열린다) · open(열어 보기 연출) · npc(주민 생물) 칸과 candidate.outlinePx.
// 기획이 코드 없이 고친다 — 모양이 틀리면 어느 칸인지 알리며 멈춘다

/** 리본 */
export interface RibbonTuning {
  /** 리본 크기(물건 너비의 몫) */
  scale: number;
  /** 살랑이는 주기(초)와 각(도) */
  swaySeconds: number;
  swayDegrees: number;
  /** 쫑긋: 튀는 높이(리본 키의 몫)와 시간(초) */
  perkLift: number;
  perkSeconds: number;
  /** 먼 데서 눌렀을 때 까딱: 각(도)과 시간(초) */
  flickDegrees: number;
  flickSeconds: number;
  /** 풀린 리본: 세로 배율 · 기울기(도) · 어둡게 하는 몫 */
  undoneSquash: number;
  undoneTilt: number;
  undoneDim: number;
  /** 찾은 물건의 흰 하트 크기(리본 너비의 몫) */
  heart: number;
}

/** 열어 보기 */
export interface OpenTuning {
  // ---- 두근(꽝이든 아니든 같다) ----
  mistSeconds: number;
  flinch: number;
  shakeTimes: number;
  shakeDegrees: number;
  /** 덜컹마다 걸리는 시간(초)과 그때 부푼 크기 — shakeTimes 개 */
  shakeSeconds: readonly number[];
  shakeSwell: readonly number[];
  holdSeconds: number;
  zoomIn: number;
  // ---- 찾음 ----
  hitSwell: number;
  confetti: number;
  flashSeconds: number;
  zoomOut: number;
  zoomOutSeconds: number;
  /** 상자가 솟는 높이(제 키의 배)와 시간(초) · 공중 한 바퀴(초) */
  riseHeights: number;
  riseSeconds: number;
  spinSeconds: number;
  danceSeconds: number;
  danceBeats: number;
  /** 누른 때부터 줄로 떠날 때까지(초) */
  leaveAt: number;
  // ---- 꽝 ----
  missSink: number;
  sinkSeconds: number;
  missBounces: number;
  junkSeconds: number;
  /** 도리도리: 누른 때부터(초) · 횟수 · 각(도) */
  refuseAt: number;
  refuseTimes: number;
  refuseDegrees: number;
  /** 누른 때부터 꽝이 끝날 때까지(초) · 메롱 이사까지(초) */
  missEnd: number;
  tauntAfter: number;
}

/** 주민 생물 */
export interface NpcTuning {
  greetReach: number;
  yieldReach: number;
  greetCooldown: number;
  peekEvery: readonly [number, number];
  peekReach: number;
  peekSeconds: number;
  caughtReach: number;
  cheerReach: number;
  puzzleReach: number;
  nodReach: number;
  stillMax: number;
  choreSeconds: readonly [number, number];
  propRoom: number;
  count: number;
  perSpecies: number;
}

/** 조각 03 의 값 */
export interface StageTuning {
  ribbon: RibbonTuning;
  open: OpenTuning;
  npc: NpcTuning;
  /** 눌릴 거리의 후보 물건에 켜지는 흰 테두리 굵기(폰 화면 px) */
  outlinePx: number;
}

/** 값을 읽는다(모양·규칙이 틀리면 어느 칸인지 알리며 멈춘다) */
export function readStageTuning(raw: unknown): StageTuning {
  const r = record(raw, "(파일)"),
    ribbon = reader(r.ribbon, "ribbon"),
    open = reader(r.open, "open"),
    npc = reader(r.npc, "npc"),
    candidate = reader(r.candidate, "candidate"),
    shakeTimes = open.count("shakeTimes"),
    out: StageTuning = {
      ribbon: {
        scale: ribbon.positive("scale"),
        swaySeconds: ribbon.positive("swaySeconds"),
        swayDegrees: ribbon.positive("swayDegrees"),
        perkLift: ribbon.positive("perkLift"),
        perkSeconds: ribbon.positive("perkSeconds"),
        flickDegrees: ribbon.positive("flickDegrees"),
        flickSeconds: ribbon.positive("flickSeconds"),
        undoneSquash: ribbon.share("undoneSquash"),
        undoneTilt: ribbon.positive("undoneTilt"),
        undoneDim: ribbon.share("undoneDim"),
        heart: ribbon.positive("heart"),
      },
      open: {
        mistSeconds: open.positive("mistSeconds"),
        flinch: open.share("flinch"),
        shakeTimes,
        shakeDegrees: open.positive("shakeDegrees"),
        shakeSeconds: open.list("shakeSeconds", shakeTimes),
        shakeSwell: open.list("shakeSwell", shakeTimes),
        holdSeconds: open.positive("holdSeconds"),
        zoomIn: open.share("zoomIn"),
        hitSwell: open.positive("hitSwell"),
        confetti: open.count("confetti"),
        flashSeconds: open.positive("flashSeconds"),
        zoomOut: open.share("zoomOut"),
        zoomOutSeconds: open.positive("zoomOutSeconds"),
        riseHeights: open.positive("riseHeights"),
        riseSeconds: open.positive("riseSeconds"),
        spinSeconds: open.positive("spinSeconds"),
        danceSeconds: open.positive("danceSeconds"),
        danceBeats: open.count("danceBeats"),
        leaveAt: open.positive("leaveAt"),
        missSink: open.share("missSink"),
        sinkSeconds: open.positive("sinkSeconds"),
        missBounces: open.count("missBounces"),
        junkSeconds: open.positive("junkSeconds"),
        refuseAt: open.positive("refuseAt"),
        refuseTimes: open.count("refuseTimes"),
        refuseDegrees: open.positive("refuseDegrees"),
        missEnd: open.positive("missEnd"),
        tauntAfter: open.positive("tauntAfter"),
      },
      npc: {
        greetReach: npc.positive("greetReach"),
        yieldReach: npc.positive("yieldReach"),
        greetCooldown: npc.positive("greetCooldown"),
        peekEvery: npc.span("peekEvery"),
        peekReach: npc.positive("peekReach"),
        peekSeconds: npc.positive("peekSeconds"),
        caughtReach: npc.positive("caughtReach"),
        cheerReach: npc.positive("cheerReach"),
        puzzleReach: npc.positive("puzzleReach"),
        nodReach: npc.positive("nodReach"),
        stillMax: npc.positive("stillMax"),
        choreSeconds: npc.span("choreSeconds"),
        propRoom: npc.positive("propRoom"),
        count: npc.count("count"),
        perSpecies: npc.count("perSpecies"),
      },
      outlinePx: candidate.positive("outlinePx"),
    };
  // 두근이 끝나는 때(미스트 + 덜컹들 + 숨죽임)보다 뒤에 갈려야 하고, 꽝은 찾음보다 짧아야 한다
  if (out.open.missEnd >= out.open.leaveAt)
    fail("open.missEnd: 꽝은 찾음(open.leaveAt)보다 짧아야 한다");
  if (out.npc.yieldReach >= out.npc.greetReach)
    fail("npc.yieldReach: 인사하는 거리(npc.greetReach)보다 가까워야 한다");
  return out;
}

/** 두근이 끝나고 결과가 갈리는 때(누른 때부터 초): 미스트가 닿고, 덜컹을 다 하고, 숨죽인 뒤 */
export function splitAt(open: OpenTuning): number {
  let t = open.mistSeconds + SETTLE;
  for (const seconds of open.shakeSeconds) t += seconds;
  return t + open.holdSeconds;
}

/** 미스트가 닿아 움찔한 뒤 덜컹이 시작될 때까지(초) */
export const SETTLE = 0.05;

/** 조각 03 의 값(hideseek.data.json) */
export const STAGE: StageTuning = readStageTuning(data);

/* ─── 내부 ─────────────────────────── */

/** 한 칸의 값을 이름으로 꺼내는 창구 */
interface Reader {
  positive(key: string): number;
  /** 0 과 1 사이의 몫 */
  share(key: string): number;
  /** 1 이상의 정수 */
  count(key: string): number;
  /** 0 보다 큰 수 n 개 */
  list(key: string, n: number): number[];
  /** [작은 값, 큰 값] */
  span(key: string): readonly [number, number];
}

function fail(why: string): never {
  throw new Error(`[teum] hideseek.data.json — ${why}`);
}

function record(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${path}: 칸이 없다`);
  return v as Record<string, unknown>;
}

function reader(v: unknown, name: string): Reader {
  const r = record(v, name);
  const positive = (key: string) => {
    const n = r[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0)
      fail(`${name}.${key}: 0 보다 큰 수여야 한다`);
    return n;
  };
  const numbers = (key: string, count: number) => {
    const items = r[key];
    if (!Array.isArray(items) || items.length !== count)
      fail(`${name}.${key}: 수 ${count}개여야 한다`);
    return items.map((n, i) => {
      if (typeof n !== "number" || !Number.isFinite(n) || n <= 0)
        fail(`${name}.${key}[${i}]: 0 보다 큰 수여야 한다`);
      return n as number;
    });
  };
  return {
    positive,
    share: (key) => {
      const n = positive(key);
      if (n >= 1) fail(`${name}.${key}: 1 보다 작아야 한다`);
      return n;
    },
    count: (key) => {
      const n = positive(key);
      if (!Number.isInteger(n)) fail(`${name}.${key}: 정수여야 한다`);
      return n;
    },
    list: numbers,
    span: (key) => {
      const [lo, hi] = numbers(key, 2);
      if (lo > hi) fail(`${name}.${key}: 작은 값이 먼저여야 한다`);
      return [lo, hi];
    },
  };
}
