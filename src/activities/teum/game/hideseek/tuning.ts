import { CREATURES } from "../../assets/settings";
import data from "./hideseek.data.json";

// 숨바꼭질 값(문구·색·무대·꼭꼭 숨어라 장면·누르기·상자의 몸짓·찾은 상자의 줄·금색 상자·언박싱 내용물·판에 부르는 생물)은
// hideseek.data.json 한 파일에 있고, 기획이 코드 없이 직접 고친다(찾기의 칸은 findTuning, 열어 보기·주민의 칸은 openTuning 이 읽는다).
// 여기서는 그 파일을 읽어 모양을 확인하고 이름 붙은 값으로 내준다. 모양이 틀리면 어느 칸이 왜 틀렸는지 알리고 멈춘다(시험이 먼저 잡는다)

/** 코드가 아는 언박싱 내용물 다섯 */
export const CONTENTS = ["nested", "lime", "bubbles", "giant", "whale"] as const;

/** 내용물 */
export type Content = (typeof CONTENTS)[number];

/**
 * 판에 부르는 생물 한 무리(판 영역에 사는 주민): 종·마릿수. 사는 자리(home)에서 가장 가까운 빈 seats 에 앉는다(없으면 남은 자리 아무 데나).
 * 하늘 종이면 처음 흩어져 뜨는 둘레(m)와 땅에서의 높이(m)
 */
export interface GuestGroup {
  species: string;
  count: number;
  /** 사는 자리(무대 마을 중심에서 잰 평면 m) — 없으면 판마다 아무 빈자리 */
  home: Seat | null;
  /** 땅 위 무리만: 둘러서지 않고 한 줄로 선다 */
  row: boolean;
  /** 하늘을 도는 종만: 도는 반지름·높이 */
  orbit: number | null;
  alt: number | null;
}

/** 생물 무리가 앉는 자리(무대 마을 중심에서 잰 평면 m) */
export interface Seat {
  x: number;
  y: number;
}

/** 숨바꼭질 값 전체 */
export interface HideTuning {
  /** 화면에 뜰 수 있는 글은 이것뿐이다: 큰 글자(꼭꼭 숨어라·술래는 너·찾았다!·깔까?)와 단추(한 판 더). 안내 줄·말풍선은 없다 — 나머지는 몸짓으로 */
  copy: {
    hide: string;
    it: string;
    found: string;
    open: string;
    again: string;
  };
  /** 화면 색: 찬 칸의 라임·글자와 테두리의 먹색 */
  colors: { lime: string; ink: string };
  /** 무대: 자리표의 마을 차례(0 이 광장)와 판 영역의 반경(m) */
  stage: { hub: number; radius: number };
  /**
   * 판 시작(꼭꼭 숨어라): 상자 줄이 플레이어 앞(m)·사이(m), 그리고 장면의 시각(초) —
   * textAt 큰 글자, startleAt 상자들이 깜짝 놀라 우왕좌왕, scurryAt 흩어져 종종걸음, offscreenAt 먼 놈들이 화면 밖으로,
   * closeAt 눈꺼풀이 감김(다 감기면 판이 상자를 후보 물건 속에 숨긴다), openAt 눈을 뜸, goAt '술래는 너'와 함께 조작이 풀림.
   * laterShare: 둘째 판부터 startleAt~offscreenAt 구간을 이 몫으로 줄인다
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
  };
  /** 화면: 큰 글자가 떠 있는 시간(초) */
  screen: { bigSeconds: number };
  /**
   * 누르기: 누르는 자리는 그려진 영역보다 사방 tapPad(px) 넓고 적어도 tapMin(px) 네모.
   * 누름은 손가락을 0.2초(measure.dragTapMs) 안에 떼고 그 사이 tapMove(px) 안으로 움직였을 때만
   */
  find: { tapPad: number; tapMin: number; tapMove: number };
  /** 버섯 높이 뛰기(이동 수단): 솟는 높이(m)·꼭대기에서 내려오는 시간(초)·떠 있는 동안 옮길 수 있는 수평 거리(m)·올라선 것으로 치는 거리(m) */
  mushroom: { height: number; hang: number; drift: number; stepReach: number };
  /**
   * 찾은 상자의 줄(내 뒤 좌우로 비스듬히 — V자): 줄마다 뒤로 물러나는 거리(m)·첫 상자가 내 뒤로 떨어진 거리(m)·줄 선 상자의 크기 배수 ·
   * 카메라와 나를 잇는 선에서 좌우로 비켜서는 거리(m, 이 안으로는 안 들어온다)
   */
  line: { gap: number; first: number; scale: number; side: number };
  /** 판마다 무대에 부르는 생물 무리 */
  guests: readonly GuestGroup[];
  /** 사는 자리가 막힌 무리가 옮겨 앉는 빈자리 */
  seats: readonly Seat[];
  /** 몸짓: 종종걸음 한 걸음(초)과 뒤뚱거리는 각(도), 폴짝의 납작·늘어남(키 배수), 깜짝의 늘어남, 버둥의 각(도) */
  moves: {
    stepSeconds: number;
    waddleDegrees: number;
    hopSquash: number;
    hopStretch: number;
    startleStretch: number;
    flailDegrees: number;
  };
  /** 상자: 키(m — 거리와 상관없이 늘 같다)·숨쉬기, 숨어 있는 동안 리본 귀 길이 배수, 숨은 상자의 흰 윤곽선 굵기(폰 px) */
  box: {
    earScale: number;
    outlinePx: number;
    height: number;
    breathSeconds: number;
    breathSquash: number;
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
  /** 누름으로 치는 시간: 손가락을 이 안(ms)에 떼야 누름이다(끌다가 뗀 것은 누름이 아니다) */
  measure: { dragTapMs: number };
}

/** 한 판의 상자 수(보너스 빼고) */
export const ROUND_BOXES = 4;

/** 데이터 파일을 읽어 모양을 확인한다. 틀리면 어느 칸이 왜 틀렸는지 알리며 멈춘다 */
export function readTuning(raw: unknown): HideTuning {
  const r = record(raw, "");
  const [copy, colors, moves, stage, start, screen, find, mushroom] = [
    "copy",
    "colors",
    "moves",
    "stage",
    "start",
    "screen",
    "find",
    "mushroom",
  ].map((k) => record(r[k], k));
  const [line, box, bonus, unbox, look, measure] = [
    "line",
    "box",
    "bonus",
    "unbox",
    "look",
    "measure",
  ].map((k) => record(r[k], k));
  const radius = positive(stage.radius, "stage.radius");
  const guests = list(r.guests, "guests").map((g, i) => guestOf(g, `guests[${i}]`));
  const seats = list(r.seats, "seats").map((v, i) => seatOf(v, `seats[${i}]`, radius));
  if (seats.length < guests.length) fail("seats: 생물 무리(guests) 수보다 적다");
  guests.forEach((g, i) => {
    if (g.home && Math.hypot(g.home.x, g.home.y) > radius)
      fail(`guests[${i}].home: 무대 반경(stage.radius ${radius}m) 밖이다`);
  });
  const duds = contents(unbox.duds, "unbox.duds"),
    happenings = contents(unbox.happenings, "unbox.happenings");
  if (!duds.length) fail("unbox.duds: 꽝이 하나는 있어야 한다");
  if (!happenings.length)
    fail("unbox.happenings: 보너스 상자에 넣을 일어나는 일이 하나는 있어야 한다");
  for (const c of duds)
    if (happenings.includes(c)) fail(`unbox: "${c}" 가 꽝과 일어나는 일에 같이 있다`);
  const dudCount = count(unbox.dudCount, "unbox.dudCount");
  if (dudCount > ROUND_BOXES) fail(`unbox.dudCount: 0~${ROUND_BOXES} 이어야 한다`);
  const lineScale = positive(line.scale, "line.scale");
  if (lineScale > 1) fail("line.scale: 1 이하여야 한다(줄 선 상자를 줄이는 배수)");
  return {
    copy: {
      hide: text(copy.hide, "copy.hide"),
      it: text(copy.it, "copy.it"),
      found: text(copy.found, "copy.found"),
      open: text(copy.open, "copy.open"),
      again: text(copy.again, "copy.again"),
    },
    colors: {
      lime: text(colors.lime, "colors.lime"),
      ink: text(colors.ink, "colors.ink"),
    },
    stage: { hub: count(stage.hub, "stage.hub"), radius },
    start: {
      lineAhead: positive(start.lineAhead, "start.lineAhead"),
      lineGap: positive(start.lineGap, "start.lineGap"),
      ...startTimes(start),
      laterShare: share(start.laterShare, "start.laterShare"),
    },
    screen: { bigSeconds: positive(screen.bigSeconds, "screen.bigSeconds") },
    find: {
      tapPad: positive(find.tapPad, "find.tapPad"),
      tapMin: positive(find.tapMin, "find.tapMin"),
      tapMove: positive(find.tapMove, "find.tapMove"),
    },
    mushroom: {
      height: positive(mushroom.height, "mushroom.height"),
      hang: positive(mushroom.hang, "mushroom.hang"),
      drift: positive(mushroom.drift, "mushroom.drift"),
      stepReach: positive(mushroom.stepReach, "mushroom.stepReach"),
    },
    line: {
      gap: positive(line.gap, "line.gap"),
      first: positive(line.first, "line.first"),
      scale: lineScale,
      side: positive(line.side, "line.side"),
    },
    guests,
    seats,
    moves: {
      stepSeconds: positive(moves.stepSeconds, "moves.stepSeconds"),
      waddleDegrees: positive(moves.waddleDegrees, "moves.waddleDegrees"),
      hopSquash: share(moves.hopSquash, "moves.hopSquash"),
      hopStretch: positive(moves.hopStretch, "moves.hopStretch"),
      startleStretch: positive(moves.startleStretch, "moves.startleStretch"),
      flailDegrees: positive(moves.flailDegrees, "moves.flailDegrees"),
    },
    box: {
      earScale: positive(box.earScale, "box.earScale"),
      outlinePx: positive(box.outlinePx, "box.outlinePx"),
      height: positive(box.height, "box.height"),
      breathSeconds: positive(box.breathSeconds, "box.breathSeconds"),
      breathSquash: share(box.breathSquash, "box.breathSquash"),
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
  if (g.row !== undefined && typeof g.row !== "boolean")
    fail(`${path}.row: true(한 줄로) 또는 false 여야 한다`);
  const home = g.home === undefined ? null : homeOf(g.home, `${path}.home`);
  if (!set.sky) return { species, count: n, home, row: g.row === true, orbit: null, alt: null };
  if (g.row === true) fail(`${path}.row: 하늘 무리는 줄 서지 않는다(땅 위 무리만)`);
  const orbit = positive(g.orbit, `${path}.orbit`),
    alt = positive(g.alt, `${path}.alt`);
  return { species, count: n, home, row: false, orbit, alt };
}

// 사는 자리: [x, y] 두 수(무대 반경 안인지는 자리표를 다 읽은 뒤에 본다)
function homeOf(v: unknown, path: string): Seat {
  const at = list(v, path);
  if (at.length !== 2) fail(`${path}: [x, y] 두 수여야 한다`);
  return { x: finite(at[0], `${path}[0]`), y: finite(at[1], `${path}[1]`) };
}

// 생물 무리가 앉는 자리: 무대 반경 안
function seatOf(v: unknown, path: string, radius: number): Seat {
  const s = record(v, path);
  if (s.note !== undefined) text(s.note, `${path}.note`);
  const x = finite(s.x, `${path}.x`),
    y = finite(s.y, `${path}.y`),
    far = Math.hypot(x, y);
  if (far > radius) fail(`${path}: 무대 반경(stage.radius ${radius}m) 밖이다`);
  return { x, y };
}
