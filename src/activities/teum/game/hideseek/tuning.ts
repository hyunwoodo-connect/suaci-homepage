import data from "./hideseek.data.json";

// 숨바꼭질 값(숨는 자리·묶음·언박싱 내용물·문구·거리·시간)은 hideseek.data.json 한 파일에 있고, 기획이 코드 없이 직접 고친다.
// 여기서는 그 파일을 읽어 모양을 확인하고 이름 붙은 값으로 내준다. 모양이 틀리면 어느 칸이 왜 틀렸는지 알리고 멈춘다(시험이 먼저 잡는다)

/** 코드가 아는 언박싱 내용물 다섯 */
export const CONTENTS = ["nested", "lime", "bubbles", "giant", "whale"] as const;

/** 내용물 */
export type Content = (typeof CONTENTS)[number];

/** 숨는 수법 */
export type HideKind = "behind" | "high";

/**
 * 뒤에 숨기: 가리는 것의 가운데(무대 마을 중심에서 잰 평면 m)와 상자 높이에서 눈으로 잰 반너비,
 * 비켜설 쪽(출발 자리에서 봐서 1 왼쪽, -1 오른쪽)
 */
export interface BehindSpot {
  id: string;
  kind: "behind";
  x: number;
  y: number;
  /** 가리는 것의 반너비(m) — 나무 줄기는 밑동이 퍼져 충돌 반지름의 1.6배쯤 */
  w: number;
  side: 1 | -1;
}

/** 높이 숨기: 꼭대기의 가운데(평면 m), 앉을 높이(땅에서 m), 가운데에서 출발 쪽으로 나앉는 거리(m) */
export interface HighSpot {
  id: string;
  kind: "high";
  x: number;
  y: number;
  top: number;
  edge: number;
}

/** 숨는 자리 하나 */
export type HideSpot = BehindSpot | HighSpot;

/** 숨바꼭질 값 전체 */
export interface HideTuning {
  /** 화면 위 글: 가림막·찾음·꾀꼬리 단추·언박싱 단추·다시 하기 단추 */
  copy: { curtain: string; found: string; kkoekkori: string; open: string; again: string };
  /** 판 시작: 상자 줄이 플레이어 앞(m)·사이(m), 줄 서 있는 시간·가려진 시간(초) */
  start: { lineAhead: number; lineGap: number; readySeconds: number; coveredSeconds: number };
  /** 칙: 닿는 거리(m)·같은 상자가 다시 재채기하기까지(초) */
  chik: { reach: number; sneezeCooldown: number };
  /** 이만큼(m, 3차원) 닿으면 찾았다 */
  find: { reach: number };
  /** 못 찾을 때: 저절로 재채기(초마다)·꾀꼬리 단추(초) */
  stuck: { autoSneezeEvery: number; kkoekkoriAfter: number };
  /** 상자: 키(m)·뒤에 숨어 비어져 나오는 몫·숨쉬기·재채기·들킴·고개 내밀기 */
  box: {
    height: number;
    showShare: number;
    breathSeconds: number;
    breathSquash: number;
    sneezeHop: number;
    sneezeSeconds: number;
    leapHop: number;
    leapSeconds: number;
    /** 고개 내미는 간격(초, 이 둘 사이 아무 때나) */
    peekEvery: readonly [number, number];
    peekSeconds: number;
    peekReach: number;
  };
  /** 보너스 상자: 다 찾고 떨어지기까지(초)·떨어지는 높이(m)·크기 배수 */
  bonus: { waitSeconds: number; dropHeight: number; scale: number };
  /** 언박싱: 꽝·일어나는 일, 다섯 상자 중 꽝 수, 커지는 배수·시간(초) */
  unbox: {
    duds: readonly Content[];
    happenings: readonly Content[];
    dudCount: number;
    giantSize: number;
    giantSeconds: number;
  };
  /** 멈춰서 둘러보기(?look=1): 끌지 않고 누르고 있을 시간(초) */
  look: { holdSeconds: number };
  /** 잰 값: 끌기 직후 이 안(ms)의 칙을 '끌다 나간 칙'으로 센다 */
  measure: { dragTapMs: number };
  /** 무대: 자리표의 마을 차례(0 이 광장) */
  stage: { hub: number };
  spots: readonly HideSpot[];
  /** 시험 묶음(?hide=1·2·3…): 자리 id 넷씩 */
  rounds: readonly (readonly string[])[];
}

/** 한 판의 상자 수(보너스 빼고) */
export const ROUND_BOXES = 4;

/** 데이터 파일을 읽어 모양을 확인한다. 틀리면 어느 칸이 왜 틀렸는지 알리며 멈춘다 */
export function readTuning(raw: unknown): HideTuning {
  const r = record(raw, "");
  const copy = record(r.copy, "copy"),
    start = record(r.start, "start"),
    chik = record(r.chik, "chik"),
    find = record(r.find, "find"),
    stuck = record(r.stuck, "stuck"),
    box = record(r.box, "box"),
    bonus = record(r.bonus, "bonus"),
    unbox = record(r.unbox, "unbox"),
    look = record(r.look, "look"),
    measure = record(r.measure, "measure"),
    stage = record(r.stage, "stage");
  const spots = list(r.spots, "spots").map((s, i) => spotOf(s, `spots[${i}]`));
  const ids = new Set<string>();
  for (const s of spots) {
    if (ids.has(s.id)) fail(`spots: id "${s.id}" 가 두 번 나온다`);
    ids.add(s.id);
  }
  const rounds = list(r.rounds, "rounds").map((round, i) => {
    const path = `rounds[${i}]`;
    const picked = list(round, path).map((id, j) => text(id, `${path}[${j}]`));
    if (picked.length !== ROUND_BOXES) fail(`${path}: 자리 ${ROUND_BOXES}개여야 한다`);
    for (const id of picked) if (!ids.has(id)) fail(`${path}: spots 에 없는 id "${id}"`);
    return picked;
  });
  if (!rounds.length) fail("rounds: 묶음이 하나는 있어야 한다");
  const duds = contents(unbox.duds, "unbox.duds"),
    happenings = contents(unbox.happenings, "unbox.happenings");
  if (!happenings.length)
    fail("unbox.happenings: 보너스 상자에 넣을 일어나는 일이 하나는 있어야 한다");
  for (const c of duds)
    if (happenings.includes(c)) fail(`unbox: "${c}" 가 꽝과 일어나는 일에 같이 있다`);
  const dudCount = count(unbox.dudCount, "unbox.dudCount");
  const dudLimit = Math.min(ROUND_BOXES, duds.length);
  if (dudCount > dudLimit) fail(`unbox.dudCount: 0~${dudLimit} 이어야 한다`);
  const peek = list(box.peekEvery, "box.peekEvery").map((n, i) =>
    positive(n, `box.peekEvery[${i}]`),
  );
  if (peek.length !== 2 || peek[0] > peek[1])
    fail("box.peekEvery: [가장 짧게, 가장 길게] 두 수여야 한다");
  return {
    copy: {
      curtain: text(copy.curtain, "copy.curtain"),
      found: text(copy.found, "copy.found"),
      kkoekkori: text(copy.kkoekkori, "copy.kkoekkori"),
      open: text(copy.open, "copy.open"),
      again: text(copy.again, "copy.again"),
    },
    start: {
      lineAhead: positive(start.lineAhead, "start.lineAhead"),
      lineGap: positive(start.lineGap, "start.lineGap"),
      readySeconds: positive(start.readySeconds, "start.readySeconds"),
      coveredSeconds: positive(start.coveredSeconds, "start.coveredSeconds"),
    },
    chik: {
      reach: positive(chik.reach, "chik.reach"),
      sneezeCooldown: positive(chik.sneezeCooldown, "chik.sneezeCooldown"),
    },
    find: { reach: positive(find.reach, "find.reach") },
    stuck: {
      autoSneezeEvery: positive(stuck.autoSneezeEvery, "stuck.autoSneezeEvery"),
      kkoekkoriAfter: positive(stuck.kkoekkoriAfter, "stuck.kkoekkoriAfter"),
    },
    box: {
      height: positive(box.height, "box.height"),
      showShare: share(box.showShare, "box.showShare"),
      breathSeconds: positive(box.breathSeconds, "box.breathSeconds"),
      breathSquash: share(box.breathSquash, "box.breathSquash"),
      sneezeHop: positive(box.sneezeHop, "box.sneezeHop"),
      sneezeSeconds: positive(box.sneezeSeconds, "box.sneezeSeconds"),
      leapHop: positive(box.leapHop, "box.leapHop"),
      leapSeconds: positive(box.leapSeconds, "box.leapSeconds"),
      peekEvery: [peek[0], peek[1]],
      peekSeconds: positive(box.peekSeconds, "box.peekSeconds"),
      peekReach: positive(box.peekReach, "box.peekReach"),
    },
    bonus: {
      waitSeconds: positive(bonus.waitSeconds, "bonus.waitSeconds"),
      dropHeight: positive(bonus.dropHeight, "bonus.dropHeight"),
      scale: positive(bonus.scale, "bonus.scale"),
    },
    unbox: {
      duds,
      happenings,
      dudCount,
      giantSize: positive(unbox.giantSize, "unbox.giantSize"),
      giantSeconds: positive(unbox.giantSeconds, "unbox.giantSeconds"),
    },
    look: { holdSeconds: positive(look.holdSeconds, "look.holdSeconds") },
    measure: { dragTapMs: positive(measure.dragTapMs, "measure.dragTapMs") },
    stage: { hub: count(stage.hub, "stage.hub") },
    spots,
    rounds,
  };
}

/** 지금 쓰는 숨바꼭질 값(hideseek.data.json) */
export const HIDE: HideTuning = readTuning(data);

/* ─── 내부 ─────────────────────────── */

function fail(why: string): never {
  throw new Error(`[teum] hideseek.data.json — ${why}`);
}

function record(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v))
    fail(`${path || "맨 위"}: 묶음({ })이어야 한다`);
  return v as Record<string, unknown>;
}

function list(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(`${path}: 목록([ ])이어야 한다`);
  return v;
}

function text(v: unknown, path: string): string {
  if (typeof v !== "string" || !v.trim()) fail(`${path}: 빈칸이 아닌 글이어야 한다`);
  return v;
}

function finite(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${path}: 수여야 한다`);
  return v;
}

function positive(v: unknown, path: string): number {
  const n = finite(v, path);
  if (n <= 0) fail(`${path}: 0 보다 커야 한다`);
  return n;
}

function share(v: unknown, path: string): number {
  const n = finite(v, path);
  if (n < 0 || n > 1) fail(`${path}: 0~1 사이 몫이어야 한다`);
  return n;
}

function count(v: unknown, path: string): number {
  const n = finite(v, path);
  if (!Number.isInteger(n) || n < 0) fail(`${path}: 0 이상의 정수여야 한다`);
  return n;
}

function contents(v: unknown, path: string): Content[] {
  return list(v, path).map((c, i) => {
    const known = (CONTENTS as readonly unknown[]).includes(c);
    if (!known) fail(`${path}[${i}]: ${CONTENTS.join("·")} 가운데 하나여야 한다`);
    return c as Content;
  });
}

function spotOf(v: unknown, path: string): HideSpot {
  const s = record(v, path);
  const id = text(s.id, `${path}.id`),
    x = finite(s.x, `${path}.x`),
    y = finite(s.y, `${path}.y`);
  if (s.note !== undefined) text(s.note, `${path}.note`);
  if (s.kind === "behind") {
    const w = positive(s.w, `${path}.w`);
    if (s.side !== 1 && s.side !== -1) fail(`${path}.side: 1(왼쪽) 또는 -1(오른쪽)이어야 한다`);
    return { id, kind: "behind", x, y, w, side: s.side };
  }
  if (s.kind === "high") {
    const top = positive(s.top, `${path}.top`),
      edge = finite(s.edge, `${path}.edge`);
    if (edge < 0) fail(`${path}.edge: 0 이상이어야 한다`);
    return { id, kind: "high", x, y, top, edge };
  }
  return fail(`${path}.kind: "behind"(뒤에 숨기) 또는 "high"(높이 숨기)여야 한다`);
}
