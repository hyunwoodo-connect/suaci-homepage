import { CREATURES } from "../../assets/settings";
import data from "./hideseek.data.json";

// 숨바꼭질 값(숨는 자리·묶음·언박싱 내용물·문구·거리·시간·판에 부르는 생물)은 hideseek.data.json 한 파일에 있고, 기획이 코드 없이 직접 고친다.
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

/**
 * 높이 숨기: 꼭대기(또는 매달릴 곳)의 가운데(평면 m), 상자 바닥 높이(땅에서 m), 가운데에서 출발 쪽으로 나앉는 거리(m),
 * 굴러떨어질 때 앞으로 밀려나는 거리(m — 올라앉은 것 밖으로 떨어지게)
 */
export interface HighSpot {
  id: string;
  kind: "high";
  x: number;
  y: number;
  top: number;
  edge: number;
  slide: number;
}

/** 숨는 자리 하나 */
export type HideSpot = BehindSpot | HighSpot;

/** 판에 부르는 생물 한 무리: 종·마릿수·자리(무대 마을 중심에서 잰 평면 m). 하늘을 도는 종이면 도는 반지름과 땅에서의 높이(m) */
export interface GuestGroup {
  species: string;
  count: number;
  x: number;
  y: number;
  /** 땅 위 무리만: 둘러서지 않고 한 줄로 선다 */
  row: boolean;
  /** 하늘을 도는 종만: 도는 반지름·높이 */
  orbit: number | null;
  alt: number | null;
}

/** 숨바꼭질 값 전체 */
export interface HideTuning {
  /** 화면 위 글: 큰 글자(꼭꼭 숨어라·술래는 너·찾았다!·깔까?·우리가 이겼다!), 한 줄 안내(톡·고양이가 냄새를 맡았어), 말풍선(에취!·상자 봤어! 따라와!·저기!), 단추(한 판 더) */
  copy: {
    hide: string;
    it: string;
    found: string;
    tap: string;
    catSniff: string;
    sneeze: string;
    follow: string;
    there: string;
    open: string;
    boxesWin: string;
    again: string;
  };
  /** 화면 색: 찬 칸의 라임·글자와 테두리의 먹색 */
  colors: { lime: string; ink: string };
  /** 무대: 자리표의 마을 차례(0 이 광장)와 숨는 자리를 두는 반경(m) */
  stage: { hub: number; radius: number };
  /** 한 판의 길이(초) — 이만큼 지나면 해가 지고 남은 상자가 이긴다. redFrom: 하늘이 눈에 띄게 붉어지기 시작하는 때(초) */
  round: { seconds: number; redFrom: number };
  /**
   * 판 시작(꼭꼭 숨어라): 상자 줄이 플레이어 앞(m)·사이(m), 그리고 장면의 시각(초) —
   * textAt 큰 글자, startleAt 상자들이 깜짝 놀라 우왕좌왕, scurryAt 흩어져 종종걸음, offscreenAt 먼 놈들이 화면 밖으로,
   * closeAt 눈꺼풀이 감김(다 감기면 숨는 자리로 옮긴다), openAt 눈을 뜸, goAt '술래는 너'와 함께 조작이 풀림.
   * laterShare: 둘째 판부터 startleAt~offscreenAt 구간을 이 몫으로 줄인다.
   * 첫 판 첫 상자(제일 못 숨은 놈)가 비어져 나오는 몫과 혼자 재채기하는 간격(초)
   */
  start: {
    lineAhead: number;
    lineGap: number;
    textAt: number;
    startleAt: number;
    scurryAt: number;
    offscreenAt: number;
    closeAt: number;
    openAt: number;
    goAt: number;
    laterShare: number;
    firstShowShare: number;
    firstSneezeEvery: number;
  };
  /** 화면: 큰 글자가 떠 있는 시간(초), '톡' 안내가 뜨는 거리(숨은 상자와 m) */
  screen: { bigSeconds: number; tapHintReach: number };
  /** 칙: 닿는 거리(m)·같은 상자가 다시 재채기하기까지(초) */
  chik: { reach: number; sneezeCooldown: number };
  /** 이만큼(m, 3차원) 닿고 화면 안이면 찾았다. 찾는 순간 멈추는 시간, 눈을 가리고 버티는 시간, 포기하고 크게 폴짝하는 시간(초 — 그 뒤 내 뒤에 줄을 선다) */
  find: { reach: number; pauseSeconds: number; coverSeconds: number; hopSeconds: number };
  /** 숨어 있는 동안: 내가 이 안(m)에 오면 숨을 참고, 이 안(m)을 지나쳐 멀어지면 '휴', 내밀다 화면 가운데 이 몫 안에 들면 눈이 마주친 것 */
  nearby: { holdBreathReach: number; passReach: number; watchShare: number };
  /** 높이 숨은 상자: 내 높이보다 이만큼(m) 넘게 위면 닿아서 못 찾고, 수평 이 거리(m) 안에서 칙을 맞히면 떨어진다 */
  drop: { minAbove: number; reach: number };
  /**
   * 생물이 데려다준다: 닿는 수평 거리·높이 차(m), 상자 앞에서 멈추는 거리(m), 데려가는 시간의 아래·위(초)와 그 사이의 빠르기(m/s),
   * 땅 위 생물이 앞장서는 거리(m)·하늘 생물이 나를 들어 올리는 높이(m), 구조하러 나를 찾아오는 빠르기(m/s)
   */
  guide: {
    reach: number;
    band: number;
    stop: number;
    minSeconds: number;
    maxSeconds: number;
    speed: number;
    lead: number;
    lift: number;
    comeSpeed: number;
  };
  /** 고양이가 냄새를 맡는 거리(가장 가까운 숨은 상자까지 m): far 안이면 킁킁, mid 안이면 통통, near 안이면 폴짝폴짝. wobble: 고개가 흔들리는 폭(도) */
  cat: { far: number; mid: number; near: number; wobble: number };
  /** 찾은 상자의 줄: 상자 사이(m)·첫 상자가 내 뒤로 떨어진 거리(m)·줄 선 상자의 크기 배수 */
  line: { gap: number; first: number; scale: number };
  /** 판마다 무대에 부르는 생물 무리 */
  guests: readonly GuestGroup[];
  /**
   * 전설의 생물(고래): 판마다 나올 확률, 나타나는 때(판 시작 뒤 초, from~to 사이), 판 위를 가로지르는 시간·태워 가는 시간(초),
   * 떠 가는 높이(m)·닿는 수평 거리(m)·무대 가운데에서 나타나고 사라지는 거리(m)·가운데에서 비켜 지나는 거리(m)·타고 갈 때 곁의 상자가 움찔하는 거리(m)
   */
  legend: {
    chance: number;
    from: number;
    to: number;
    staySeconds: number;
    rideSeconds: number;
    lift: number;
    reach: number;
    span: number;
    aside: number;
    flinchReach: number;
  };
  /** 못 찾을 때: 참을성을 잃는 때·생물이 나를 찾아와 데려다주는 때(마지막으로 찾은 뒤 초)와 한 판에 몇 번까지, 참을성을 잃으면 고개 내미는 간격에 곱하는 몫 */
  stuck: { restlessAfter: number; rescueAfter: number; rescueMax: number; restlessPeek: number };
  /** 해가 진 뒤의 장면(초): 남은 상자들이 튀어나옴 · 내 앞으로 몰려와 둘러쌈 · 한 놈이 머리 위에 올라탐 · 단추가 뜸 */
  lost: { popAt: number; gatherAt: number; climbAt: number; buttonsAt: number };
  /** 몸짓: 종종걸음 한 걸음(초)과 뒤뚱거리는 각(도), 폴짝의 납작·늘어남(키 배수), 깜짝의 늘어남, 재채기로 젖히는 각·움찔·버둥의 각(도) */
  moves: {
    stepSeconds: number;
    waddleDegrees: number;
    hopSquash: number;
    hopStretch: number;
    startleStretch: number;
    sneezeLeanDegrees: number;
    flinchDegrees: number;
    flailDegrees: number;
  };
  /** 상자: 키(m)·뒤에 숨어 비어져 나오는 몫·숨쉬기·재채기로 튀는 높이(m)·고개 내밀기 */
  box: {
    height: number;
    showShare: number;
    breathSeconds: number;
    breathSquash: number;
    sneezeHop: number;
    /** 고개 내미는 간격(초, 이 둘 사이 아무 때나) */
    peekEvery: readonly [number, number];
    peekReach: number;
  };
  /** 보너스 상자: 다 찾고 떨어지기까지(초)·떨어지는 높이(m)·크기 배수·내 앞 거리(m) */
  bonus: { waitSeconds: number; dropHeight: number; scale: number; ahead: number };
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
  spots: readonly HideSpot[];
  /** 시험 묶음(?hide=1·2·3…): 자리 id 넷씩 */
  rounds: readonly (readonly string[])[];
}

/** 한 판의 상자 수(보너스 빼고) */
export const ROUND_BOXES = 4;

/** 해가 진 뒤 상자들이 몰려오는 데 드는 가장 짧은 시간(초 — lost.climbAt 은 gatherAt 보다 이만큼 넘게 늦어야 한다) */
export const LOST_RUN_MIN = 0.5;

/** 데이터 파일을 읽어 모양을 확인한다. 틀리면 어느 칸이 왜 틀렸는지 알리며 멈춘다 */
export function readTuning(raw: unknown): HideTuning {
  const r = record(raw, "");
  const copy = record(r.copy, "copy"),
    colors = record(r.colors, "colors"),
    nearby = record(r.nearby, "nearby"),
    lost = record(r.lost, "lost"),
    moves = record(r.moves, "moves"),
    stage = record(r.stage, "stage"),
    round = record(r.round, "round"),
    start = record(r.start, "start"),
    screen = record(r.screen, "screen"),
    chik = record(r.chik, "chik"),
    find = record(r.find, "find"),
    drop = record(r.drop, "drop"),
    guide = record(r.guide, "guide"),
    cat = record(r.cat, "cat"),
    line = record(r.line, "line"),
    legend = record(r.legend, "legend"),
    stuck = record(r.stuck, "stuck"),
    box = record(r.box, "box"),
    bonus = record(r.bonus, "bonus"),
    unbox = record(r.unbox, "unbox"),
    look = record(r.look, "look"),
    measure = record(r.measure, "measure");
  const radius = positive(stage.radius, "stage.radius");
  const spots = list(r.spots, "spots").map((s, i) => spotOf(s, `spots[${i}]`));
  const ids = new Set<string>();
  for (const s of spots) {
    if (ids.has(s.id)) fail(`spots: id "${s.id}" 가 두 번 나온다`);
    ids.add(s.id);
    const far = Math.hypot(s.x, s.y);
    if (far > radius) fail(`spots: "${s.id}" 가 무대 반경(stage.radius ${radius}m) 밖이다`);
  }
  const rounds = list(r.rounds, "rounds").map((picked, i) => {
    const path = `rounds[${i}]`;
    const chosen = list(picked, path).map((id, j) => text(id, `${path}[${j}]`));
    if (chosen.length !== ROUND_BOXES) fail(`${path}: 자리 ${ROUND_BOXES}개여야 한다`);
    for (const id of chosen) if (!ids.has(id)) fail(`${path}: spots 에 없는 id "${id}"`);
    return chosen;
  });
  if (!rounds.length) fail("rounds: 묶음이 하나는 있어야 한다");
  const duds = contents(unbox.duds, "unbox.duds"),
    happenings = contents(unbox.happenings, "unbox.happenings");
  if (!duds.length) fail("unbox.duds: 꽝이 하나는 있어야 한다");
  if (!happenings.length)
    fail("unbox.happenings: 보너스 상자에 넣을 일어나는 일이 하나는 있어야 한다");
  for (const c of duds)
    if (happenings.includes(c)) fail(`unbox: "${c}" 가 꽝과 일어나는 일에 같이 있다`);
  const dudCount = count(unbox.dudCount, "unbox.dudCount");
  if (dudCount > ROUND_BOXES) fail(`unbox.dudCount: 0~${ROUND_BOXES} 이어야 한다`);
  const peek = list(box.peekEvery, "box.peekEvery").map((n, i) =>
    positive(n, `box.peekEvery[${i}]`),
  );
  if (peek.length !== 2 || peek[0] > peek[1])
    fail("box.peekEvery: [가장 짧게, 가장 길게] 두 수여야 한다");
  const from = positive(legend.from, "legend.from"),
    to = positive(legend.to, "legend.to"),
    seconds = positive(round.seconds, "round.seconds"),
    redFrom = positive(round.redFrom, "round.redFrom");
  if (from > to) fail("legend: from 이 to 보다 늦다");
  if (to > seconds) fail("legend.to: 한 판(round.seconds)보다 늦으면 나오지 못한다");
  if (redFrom >= seconds) fail("round.redFrom: round.seconds 보다 일러야 한다");
  const popAt = positive(lost.popAt, "lost.popAt"),
    gatherAt = positive(lost.gatherAt, "lost.gatherAt"),
    climbAt = positive(lost.climbAt, "lost.climbAt"),
    buttonsAt = positive(lost.buttonsAt, "lost.buttonsAt");
  if (popAt >= gatherAt) fail("lost.gatherAt: popAt 보다 늦어야 한다");
  if (climbAt < gatherAt + LOST_RUN_MIN)
    fail(`lost.climbAt: gatherAt 보다 ${LOST_RUN_MIN}초 넘게 늦어야 한다(몰려올 시간)`);
  if (buttonsAt < climbAt) fail("lost.buttonsAt: climbAt 보다 이르다");
  const guests = list(r.guests, "guests").map((g, i) => guestOf(g, `guests[${i}]`));
  const minSeconds = positive(guide.minSeconds, "guide.minSeconds"),
    maxSeconds = positive(guide.maxSeconds, "guide.maxSeconds");
  if (minSeconds > maxSeconds) fail("guide: minSeconds 가 maxSeconds 보다 길다");
  const stop = positive(guide.stop, "guide.stop"),
    findReach = positive(find.reach, "find.reach");
  if (stop <= findReach)
    fail("guide.stop: find.reach 보다 커야 한다(생물은 데려다주기만 하고 찾는 것은 내 몫이다)");
  const lineScale = positive(line.scale, "line.scale");
  if (lineScale > 1) fail("line.scale: 1 이하여야 한다(줄 선 상자를 줄이는 배수)");
  const wobble = finite(cat.wobble, "cat.wobble");
  if (wobble < 0 || wobble > 90) fail("cat.wobble: 0~90 도여야 한다");
  const far = positive(cat.far, "cat.far"),
    mid = positive(cat.mid, "cat.mid"),
    near = positive(cat.near, "cat.near");
  if (near > mid || mid > far) fail("cat: near ≤ mid ≤ far 여야 한다");
  return {
    copy: {
      hide: text(copy.hide, "copy.hide"),
      it: text(copy.it, "copy.it"),
      found: text(copy.found, "copy.found"),
      tap: text(copy.tap, "copy.tap"),
      catSniff: text(copy.catSniff, "copy.catSniff"),
      sneeze: text(copy.sneeze, "copy.sneeze"),
      follow: text(copy.follow, "copy.follow"),
      there: text(copy.there, "copy.there"),
      open: text(copy.open, "copy.open"),
      boxesWin: text(copy.boxesWin, "copy.boxesWin"),
      again: text(copy.again, "copy.again"),
    },
    colors: {
      lime: text(colors.lime, "colors.lime"),
      ink: text(colors.ink, "colors.ink"),
    },
    stage: { hub: count(stage.hub, "stage.hub"), radius },
    round: { seconds, redFrom },
    start: {
      lineAhead: positive(start.lineAhead, "start.lineAhead"),
      lineGap: positive(start.lineGap, "start.lineGap"),
      ...startTimes(start),
      laterShare: share(start.laterShare, "start.laterShare"),
      firstShowShare: share(start.firstShowShare, "start.firstShowShare"),
      firstSneezeEvery: positive(start.firstSneezeEvery, "start.firstSneezeEvery"),
    },
    screen: {
      bigSeconds: positive(screen.bigSeconds, "screen.bigSeconds"),
      tapHintReach: positive(screen.tapHintReach, "screen.tapHintReach"),
    },
    chik: {
      reach: positive(chik.reach, "chik.reach"),
      sneezeCooldown: positive(chik.sneezeCooldown, "chik.sneezeCooldown"),
    },
    find: {
      reach: positive(find.reach, "find.reach"),
      pauseSeconds: positive(find.pauseSeconds, "find.pauseSeconds"),
      coverSeconds: positive(find.coverSeconds, "find.coverSeconds"),
      hopSeconds: positive(find.hopSeconds, "find.hopSeconds"),
    },
    nearby: {
      holdBreathReach: positive(nearby.holdBreathReach, "nearby.holdBreathReach"),
      passReach: positive(nearby.passReach, "nearby.passReach"),
      watchShare: share(nearby.watchShare, "nearby.watchShare"),
    },
    drop: {
      minAbove: positive(drop.minAbove, "drop.minAbove"),
      reach: positive(drop.reach, "drop.reach"),
    },
    guide: {
      reach: positive(guide.reach, "guide.reach"),
      band: positive(guide.band, "guide.band"),
      stop,
      minSeconds,
      maxSeconds,
      speed: positive(guide.speed, "guide.speed"),
      lead: positive(guide.lead, "guide.lead"),
      lift: positive(guide.lift, "guide.lift"),
      comeSpeed: positive(guide.comeSpeed, "guide.comeSpeed"),
    },
    cat: { far, mid, near, wobble },
    line: {
      gap: positive(line.gap, "line.gap"),
      first: positive(line.first, "line.first"),
      scale: lineScale,
    },
    guests,
    legend: {
      chance: share(legend.chance, "legend.chance"),
      from,
      to,
      staySeconds: positive(legend.staySeconds, "legend.staySeconds"),
      rideSeconds: positive(legend.rideSeconds, "legend.rideSeconds"),
      lift: positive(legend.lift, "legend.lift"),
      reach: positive(legend.reach, "legend.reach"),
      span: positive(legend.span, "legend.span"),
      aside: finite(legend.aside, "legend.aside"),
      flinchReach: positive(legend.flinchReach, "legend.flinchReach"),
    },
    stuck: {
      restlessAfter: positive(stuck.restlessAfter, "stuck.restlessAfter"),
      rescueAfter: positive(stuck.rescueAfter, "stuck.rescueAfter"),
      rescueMax: count(stuck.rescueMax, "stuck.rescueMax"),
      restlessPeek: positive(stuck.restlessPeek, "stuck.restlessPeek"),
    },
    lost: { popAt, gatherAt, climbAt, buttonsAt },
    moves: {
      stepSeconds: positive(moves.stepSeconds, "moves.stepSeconds"),
      waddleDegrees: positive(moves.waddleDegrees, "moves.waddleDegrees"),
      hopSquash: share(moves.hopSquash, "moves.hopSquash"),
      hopStretch: positive(moves.hopStretch, "moves.hopStretch"),
      startleStretch: positive(moves.startleStretch, "moves.startleStretch"),
      sneezeLeanDegrees: positive(moves.sneezeLeanDegrees, "moves.sneezeLeanDegrees"),
      flinchDegrees: positive(moves.flinchDegrees, "moves.flinchDegrees"),
      flailDegrees: positive(moves.flailDegrees, "moves.flailDegrees"),
    },
    box: {
      height: positive(box.height, "box.height"),
      showShare: share(box.showShare, "box.showShare"),
      breathSeconds: positive(box.breathSeconds, "box.breathSeconds"),
      breathSquash: share(box.breathSquash, "box.breathSquash"),
      sneezeHop: positive(box.sneezeHop, "box.sneezeHop"),
      peekEvery: [peek[0], peek[1]],
      peekReach: positive(box.peekReach, "box.peekReach"),
    },
    bonus: {
      waitSeconds: positive(bonus.waitSeconds, "bonus.waitSeconds"),
      dropHeight: positive(bonus.dropHeight, "bonus.dropHeight"),
      scale: positive(bonus.scale, "bonus.scale"),
      ahead: positive(bonus.ahead, "bonus.ahead"),
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
      edge = finite(s.edge, `${path}.edge`),
      slide = finite(s.slide, `${path}.slide`);
    if (slide < 0) fail(`${path}.slide: 0 이상이어야 한다`);
    return { id, kind: "high", x, y, top, edge, slide };
  }
  return fail(`${path}.kind: "behind"(뒤에 숨기) 또는 "high"(높이 숨기)여야 한다`);
}

// 판 시작 장면의 시각: 차례대로 늦어져야 한다
function startTimes(start: Record<string, unknown>) {
  const names = [
    "textAt",
    "startleAt",
    "scurryAt",
    "offscreenAt",
    "closeAt",
    "openAt",
    "goAt",
  ] as const;
  const at = names.map((name) => positive(start[name], `start.${name}`));
  for (let i = 1; i < at.length; i++)
    if (at[i] < at[i - 1]) fail(`start.${names[i]}: ${names[i - 1]} 보다 이르다`);
  const [textAt, startleAt, scurryAt, offscreenAt, closeAt, openAt, goAt] = at;
  return { textAt, startleAt, scurryAt, offscreenAt, closeAt, openAt, goAt };
}

// 판에 부르는 생물 무리: 종은 생물 설정표에 있는 땅 위 무리(herd)나 하늘 무리(sky)여야 하고, 하늘 무리는 도는 반지름·높이를 적는다
function guestOf(v: unknown, path: string): GuestGroup {
  const g = record(v, path);
  const species = text(g.species, `${path}.species`),
    set = CREATURES[species];
  if (g.note !== undefined) text(g.note, `${path}.note`);
  if (!set || !(set.herd || set.sky))
    fail(`${path}.species: "${species}" 는 땅 위 무리나 하늘 무리 생물이 아니다`);
  const n = count(g.count, `${path}.count`);
  if (n < 1) fail(`${path}.count: 1 이상이어야 한다`);
  const x = finite(g.x, `${path}.x`),
    y = finite(g.y, `${path}.y`);
  if (g.row !== undefined && typeof g.row !== "boolean")
    fail(`${path}.row: true(한 줄로) 또는 false 여야 한다`);
  if (!set.sky) return { species, count: n, x, y, row: g.row === true, orbit: null, alt: null };
  if (g.row === true) fail(`${path}.row: 하늘 무리는 줄 서지 않는다(땅 위 무리만)`);
  const orbit = positive(g.orbit, `${path}.orbit`),
    alt = positive(g.alt, `${path}.alt`);
  return { species, count: n, x, y, row: false, orbit, alt };
}
