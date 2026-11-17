import { CREATURES } from "../../assets/settings";
import data from "./hideseek.data.json";

// 숨바꼭질 값(숨는 자리·묶음·언박싱 내용물·문구·거리·시간·판에 부르는 생물)은 hideseek.data.json 한 파일에 있고, 기획이 코드 없이 직접 고친다.
// 여기서는 그 파일을 읽어 모양을 확인하고 이름 붙은 값으로 내준다. 모양이 틀리면 어느 칸이 왜 틀렸는지 알리고 멈춘다(시험이 먼저 잡는다)

/** 코드가 아는 언박싱 내용물 다섯 */
export const CONTENTS = ["nested", "lime", "bubbles", "giant", "whale"] as const;

/** 내용물 */
export type Content = (typeof CONTENTS)[number];

/** 숨는 수법: 뒤에 숨기 · 높이 숨기 · 아닌 척하기 */
export type HideKind = "behind" | "high" | "disguise";

/** 아닌 척하는 법: 내 줄에 끼기 · 병정인 척 · 고양이 뒤에 숨기 · 조각상인 척 · 변장 안경 · 화분의 꽃 · 선물 더미 · 가면 · 풍선인 척 · 케이크 장식인 척 */
export const DISGUISES = [
  "line",
  "soldier",
  "cat",
  "statue",
  "glasses",
  "flowerpot",
  "gifts",
  "mask",
  "balloon",
  "cake",
] as const;

/** 아닌 척하는 법 하나 */
export type DisguiseKind = (typeof DISGUISES)[number];

/** 생물이 주는 도움: 길 · 높이 · 투시 · 점호 · 미끼 · 시간 */
export const HELPS = ["rabbit", "mushroom", "key", "soldier", "cupcake", "watch"] as const;

/** 생물이 주는 도움 하나 */
export type HelpKind = (typeof HELPS)[number];

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

/**
 * 아닌 척하기: 숨지 않고 눈에 띄는 곳에서 다른 것인 척한다. 놓을 자리(평면 m)는 조각상·안경·화분·선물 더미만 적고,
 * 가면은 섞여 들 생물 무리(group — 그 판의 그 무리 자리 곁)를 적는다. 나머지는 판이 도는 동안 자리가 정해진다(내 줄·병정 줄·고양이 곁)
 */
export interface DisguiseSpot {
  id: string;
  kind: "disguise";
  as: DisguiseKind;
  x: number;
  y: number;
  group: string | null;
}

/** 숨는 자리 하나 */
export type HideSpot = BehindSpot | HighSpot | DisguiseSpot;

/** 놓을 자리가 정해진 아닌 척하기(자리표의 x·y 를 쓴다) */
export const PLACED_DISGUISES: readonly DisguiseKind[] = [
  "statue",
  "glasses",
  "flowerpot",
  "gifts",
  "balloon",
  "cake",
];

/** 판에 부르는 생물 한 무리: 종·마릿수(자리는 판마다 seats 에서 섞어 정한다). 하늘을 도는 종이면 도는 반지름과 땅에서의 높이(m) */
export interface GuestGroup {
  species: string;
  count: number;
  /** 눌렀을 때 주는 도움(없으면 원래 반응만) */
  help: HelpKind | null;
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
  /**
   * 화면에 뜰 수 있는 글은 이것뿐이다: 큰 글자(꼭꼭 숨어라·술래는 너·찾았다!·깔까?·우리가 이겼다!), 단추(한 판 더),
   * 말풍선(상자의 에취!·병정 점호 때 상자가 대답하는 숫자). 안내 줄·기호 말풍선은 없다 — 나머지는 몸짓으로
   */
  copy: {
    hide: string;
    it: string;
    found: string;
    open: string;
    boxesWin: string;
    again: string;
    sneeze: string;
    counts: readonly string[];
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
  /** 화면: 큰 글자가 떠 있는 시간(초) */
  screen: { bigSeconds: number };
  /** 칙: 닿는 거리(m)·같은 상자가 다시 재채기하기까지(초) */
  chik: { reach: number; sneezeCooldown: number };
  /**
   * 찾기 — 보이는 상자를 톡 친다: 이만큼(m) 안이면 찾았다. 누르는 자리는 그려진 영역보다 사방 tapPad(px) 넓고 적어도 tapMin(px) 네모.
   * 톡은 손가락을 0.2초(measure.dragTapMs) 안에 떼고 그 사이 tapMove(px) 안으로 움직였을 때만. 미스트가 날아가는 시간,
   * 아바타가 뛰어가는 시간의 아래·위(초, 거리에 따라), 찾는 순간 멈추는 시간, 눈을 가리고 버티는 시간, 포기하고 크게 폴짝하는 시간(초)
   */
  find: {
    tapReach: number;
    tapPad: number;
    tapMin: number;
    tapMove: number;
    mistSeconds: number;
    leapMin: number;
    leapMax: number;
    pauseSeconds: number;
    coverSeconds: number;
    hopSeconds: number;
  };
  /** 숨어 있는 동안: 내가 이 안(m)에 오면 숨을 참고, 이 안(m)을 지나쳐 멀어지면 '휴', 내밀다 화면 가운데 이 몫 안에 들면 눈이 마주친 것 */
  nearby: { holdBreathReach: number; passReach: number; watchShare: number };
  /** 높이 숨은 상자: 땅에서 이만큼(m) 넘게 위면 찾았을 때 굴러떨어지는 연출 */
  drop: { minAbove: number };
  /**
   * 생물: 이 거리(m) 안이고 화면 안이면 발밑 고리가 켜지고 나를 본다(누를 수 있다) · 고리 지름(몸 폭의 배수) · 한 번에 고리가 켜지는 생물 수 ·
   * 힌트가 시작되고 카메라가 생물을 잡고 있는 시간 · 누른 뒤 조작이 잠기는 시간(초)
   */
  help: {
    markReach: number;
    ringScale: number;
    ringMax: number;
    focusSeconds: number;
    lockSeconds: number;
  };
  /**
   * 토끼(길): 내 평소 빠르기의 몫으로 뛴다 · 나와 이만큼(m) 넘게 벌어지면 기다렸다가 이 안(m)으로 오면 다시 뛴다 · 발자국 사이(m) ·
   * 상자 이만큼(m) 앞에서 굴로 사라진다 · 발자국이 남는 시간(초)
   */
  rabbit: {
    speedShare: number;
    waitGap: number;
    resumeGap: number;
    stepGap: number;
    stop: number;
    trailSeconds: number;
  };
  /** 버섯(높이): 튕겨 오르는 높이(m) · 꼭대기에 떠 있는 시간(초) · 떠 있는 동안 상자를 눌러 찾는 거리(m) · 걸어 들어가도 튕겨 주는 거리(수평 m) */
  mushroom: { height: number; hang: number; tapReach: number; walkReach: number };
  /** 열쇠(투시): 파동이 퍼지는 거리(m) · 비치는 시간(초) · 이 몫만 남기고 비친다 · 끝나기 이만큼(초) 전에 깜빡여 알린다 */
  key: { reach: number; seconds: number; alpha: number; warnSeconds: number };
  /** 카드 병정(점호): 상자들이 대답하는 사이(초) · 점호 뒤 1번 상자 쪽을 창으로 가리키는 시간(초) */
  soldier: { gap: number; pointSeconds: number };
  /** 컵케이크(미끼): 냄새를 풍기는 시간(초) · 이 안(m)의 가장 가까운 숨은 상자가 다가온다 · 다가오는 상자가 이 안(m)이면 힐끔·떨기·깜짝 */
  cupcake: { seconds: number; reach: number; tellReach: readonly [number, number, number] };
  /** 회중시계(시간): 해가 되돌아가는 시간(초) · 판 시작 뒤 이만큼(초)이 지나야 쓸 수 있다(고리가 켜진다) */
  watch: { addSeconds: number; minElapsed: number };
  /** 고양이가 냄새를 맡는 거리(가장 가까운 숨은 상자까지 m): far 안이면 킁킁, mid 안이면 통통, near 안이면 폴짝폴짝. wobble: 고개가 흔들리는 폭(도) */
  cat: { far: number; mid: number; near: number; wobble: number };
  /**
   * 찾은 상자의 줄(내 뒤 좌우로 비스듬히 — V자): 줄마다 뒤로 물러나는 거리(m)·첫 상자가 내 뒤로 떨어진 거리(m)·줄 선 상자의 크기 배수 ·
   * 카메라와 나를 잇는 선에서 좌우로 비켜서는 거리(m, 이 안으로는 안 들어온다)
   */
  line: { gap: number; first: number; scale: number; side: number };
  /** 처음 배우기(첫 판): 첫 상자를 찾은 뒤 토끼가 와서 서는 내 앞 거리(m)·누를 때까지 나와 이 안(m)을 지킨다 */
  teach: { creatureAhead: number; creatureKeep: number };
  /**
   * 상자는 내가 안 볼 때만 움직인다: 자리 옮기는 간격(초, 이 사이 아무 때나) · 내 등 뒤로 따라붙는 거리(m, 이 사이) ·
   * 화면에서 벗어나고 다시 움직이기까지(초) · 이만큼(초) 넘게 보고 있으면 땀을 흘리며 떤다 · 움직이는 상자 수(첫 판·둘째 판부터) · 걷는 빠르기(m/s)
   */
  sneak: {
    moveEvery: readonly [number, number];
    followGap: readonly [number, number];
    resumeAfter: number;
    sweatAfter: number;
    firstRound: number;
    later: number;
    speed: number;
  };
  /** 판마다 무대에 부르는 생물 무리 */
  guests: readonly GuestGroup[];
  /** 생물 무리가 앉는 자리(판마다 섞는다 — 첫 판에는 토끼가 시작 자리에서 가장 가까운 땅 위 자리) */
  seats: readonly Seat[];
  /**
   * 전설의 생물(고래): 판마다 나올 확률, 나타나는 때(판 시작 뒤 초, from~to 사이), 판 위를 가로지르는 시간(이 안에 못 누르면 지나간다)·태워 가는 시간(초),
   * 떠 가는 높이(m — 화면에 보이면 거리와 상관없이 한 번 누른다)·눌린 뒤 큰 원을 그리며 내게 내려오는 시간(초)·태워 갈 때의 높이(m),
   * 무대 가운데에서 나타나고 사라지는 거리(m)·가운데에서 비켜 지나는 거리(m)·타고 갈 때 곁의 상자가 움찔하는 거리(m)
   */
  legend: {
    chance: number;
    from: number;
    to: number;
    staySeconds: number;
    rideSeconds: number;
    lift: number;
    descendSeconds: number;
    carryLift: number;
    span: number;
    aside: number;
    flinchReach: number;
  };
  /**
   * 못 찾을 때: 참을성을 잃는 때·쓸 수 있는 생물이 내 화면 안으로 오는 때(마지막으로 찾은 뒤 초), 참을성을 잃으면 고개 내미는 간격에 곱하는 몫,
   * 부르러 온 생물이 서는 내 앞 거리(m)·고리 밝기 배수
   */
  stuck: {
    restlessAfter: number;
    callAfter: number;
    restlessPeek: number;
    callAhead: number;
    callBright: number;
  };
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
  /**
   * 상자: 키(m — 거리와 상관없이 늘 같다)·뒤에 숨어 비어져 나오는 몫·숨쉬기·재채기로 튀는 높이(m)·고개 내밀기, 숨어 있는 동안 리본 귀 길이 배수,
   * 숨은 상자의 흰 윤곽선 굵기(폰 px — 버섯 꼭대기에서 내려다볼 때는 더 굵게)
   */
  box: {
    earScale: number;
    outlinePx: number;
    outlineHighPx: number;
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
  /** 숨는 자리(뒤·높이)와 아닌 척하기 */
  spots: readonly HideSpot[];
  /** 묶음(판마다 다음 것, ?hide=1·2·3…): 자리 id 넷씩. 넷 중 아닌 척은 둘(첫 묶음은 하나 — 내 줄에 끼기는 빼고) */
  rounds: readonly (readonly string[])[];
}

/** 한 판의 상자 수(보너스 빼고) */
export const ROUND_BOXES = 4;

/** 해가 진 뒤 상자들이 몰려오는 데 드는 가장 짧은 시간(초 — lost.climbAt 은 gatherAt 보다 이만큼 넘게 늦어야 한다) */
export const LOST_RUN_MIN = 0.5;

/** 데이터 파일을 읽어 모양을 확인한다. 틀리면 어느 칸이 왜 틀렸는지 알리며 멈춘다 */
export function readTuning(raw: unknown): HideTuning {
  const r = record(raw, "");
  const [copy, colors, nearby, lost, moves, stage, round, start, screen, chik, find, drop] = [
    "copy",
    "colors",
    "nearby",
    "lost",
    "moves",
    "stage",
    "round",
    "start",
    "screen",
    "chik",
    "find",
    "drop",
  ].map((k) => record(r[k], k));
  const [help, rabbit, mushroom, key, soldier, cupcake, watch, cat, line, sneak] = [
    "help",
    "rabbit",
    "mushroom",
    "key",
    "soldier",
    "cupcake",
    "watch",
    "cat",
    "line",
    "sneak",
  ].map((k) => record(r[k], k));
  const [legend, stuck, box, bonus, unbox, look, measure, teach] = [
    "legend",
    "stuck",
    "box",
    "bonus",
    "unbox",
    "look",
    "measure",
    "teach",
  ].map((k) => record(r[k], k));
  const radius = positive(stage.radius, "stage.radius");
  const guests = list(r.guests, "guests").map((g, i) => guestOf(g, `guests[${i}]`));
  for (const kind of HELPS) {
    const n = guests.filter((g) => g.help === kind).length;
    if (n !== 1) fail(`guests: 도움 "${kind}" 를 주는 무리가 하나여야 한다(지금 ${n})`);
  }
  const groundSpecies = guests.filter((g) => g.orbit === null).map((g) => g.species);
  const hides = list(r.spots, "spots").map((v, i) => spotOf(v, `spots[${i}]`));
  const disguises = list(r.disguises, "disguises").map((v, i) =>
    disguiseOf(v, `disguises[${i}]`, groundSpecies),
  );
  const spots = [...hides, ...disguises];
  const byId = new Map<string, HideSpot>();
  for (const s of spots) {
    if (byId.has(s.id)) fail(`spots: id "${s.id}" 가 두 번 나온다`);
    byId.set(s.id, s);
    const far = Math.hypot(s.x, s.y);
    if (far > radius) fail(`spots: "${s.id}" 가 무대 반경(stage.radius ${radius}m) 밖이다`);
  }
  const seats = list(r.seats, "seats").map((v, i) => seatOf(v, `seats[${i}]`, radius));
  if (seats.length < guests.length) fail("seats: 생물 무리(guests) 수보다 적다");
  const rounds = list(r.rounds, "rounds").map((picked, i) => roundOf(picked, i, byId));
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
  const peek = pair(box.peekEvery, "box.peekEvery"),
    moveEvery = pair(sneak.moveEvery, "sneak.moveEvery"),
    followGap = pair(sneak.followGap, "sneak.followGap");
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
  const leapMin = positive(find.leapMin, "find.leapMin"),
    leapMax = positive(find.leapMax, "find.leapMax");
  if (leapMin > leapMax) fail("find: leapMin 이 leapMax 보다 길다");
  const lineScale = positive(line.scale, "line.scale");
  if (lineScale > 1) fail("line.scale: 1 이하여야 한다(줄 선 상자를 줄이는 배수)");
  const wobble = finite(cat.wobble, "cat.wobble");
  if (wobble < 0 || wobble > 90) fail("cat.wobble: 0~90 도여야 한다");
  const far = positive(cat.far, "cat.far"),
    mid = positive(cat.mid, "cat.mid"),
    near = positive(cat.near, "cat.near");
  if (near > mid || mid > far) fail("cat: near ≤ mid ≤ far 여야 한다");
  const counts = list(copy.counts, "copy.counts").map((t, i) => text(t, `copy.counts[${i}]`));
  if (counts.length < ROUND_BOXES) fail(`copy.counts: 적어도 ${ROUND_BOXES}개여야 한다`);
  const ringMax = count(help.ringMax, "help.ringMax");
  if (ringMax < 1) fail("help.ringMax: 1 이상이어야 한다");
  const waitGap = positive(rabbit.waitGap, "rabbit.waitGap"),
    resumeGap = positive(rabbit.resumeGap, "rabbit.resumeGap");
  if (resumeGap >= waitGap) fail("rabbit: resumeGap 이 waitGap 보다 작아야 한다");
  const tells = list(cupcake.tellReach, "cupcake.tellReach").map((v, i) =>
    positive(v, `cupcake.tellReach[${i}]`),
  );
  if (tells.length !== 3 || tells[0] <= tells[1] || tells[1] <= tells[2])
    fail("cupcake.tellReach: 멀리서 가까이로 줄어드는 셋이어야 한다(예: [20, 10, 5])");
  const tellReach = [tells[0], tells[1], tells[2]] as const;
  const firstRound = count(sneak.firstRound, "sneak.firstRound"),
    later = count(sneak.later, "sneak.later");
  if (firstRound > ROUND_BOXES || later > ROUND_BOXES)
    fail(`sneak: 움직이는 상자 수는 0~${ROUND_BOXES} 이어야 한다`);
  return {
    copy: {
      hide: text(copy.hide, "copy.hide"),
      it: text(copy.it, "copy.it"),
      found: text(copy.found, "copy.found"),
      open: text(copy.open, "copy.open"),
      boxesWin: text(copy.boxesWin, "copy.boxesWin"),
      again: text(copy.again, "copy.again"),
      sneeze: text(copy.sneeze, "copy.sneeze"),
      counts,
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
    screen: { bigSeconds: positive(screen.bigSeconds, "screen.bigSeconds") },
    chik: {
      reach: positive(chik.reach, "chik.reach"),
      sneezeCooldown: positive(chik.sneezeCooldown, "chik.sneezeCooldown"),
    },
    find: {
      tapReach: positive(find.tapReach, "find.tapReach"),
      tapPad: positive(find.tapPad, "find.tapPad"),
      tapMin: positive(find.tapMin, "find.tapMin"),
      tapMove: positive(find.tapMove, "find.tapMove"),
      mistSeconds: positive(find.mistSeconds, "find.mistSeconds"),
      leapMin,
      leapMax,
      pauseSeconds: positive(find.pauseSeconds, "find.pauseSeconds"),
      coverSeconds: positive(find.coverSeconds, "find.coverSeconds"),
      hopSeconds: positive(find.hopSeconds, "find.hopSeconds"),
    },
    nearby: {
      holdBreathReach: positive(nearby.holdBreathReach, "nearby.holdBreathReach"),
      passReach: positive(nearby.passReach, "nearby.passReach"),
      watchShare: share(nearby.watchShare, "nearby.watchShare"),
    },
    drop: { minAbove: positive(drop.minAbove, "drop.minAbove") },
    help: {
      markReach: positive(help.markReach, "help.markReach"),
      ringScale: positive(help.ringScale, "help.ringScale"),
      ringMax,
      focusSeconds: positive(help.focusSeconds, "help.focusSeconds"),
      lockSeconds: positive(help.lockSeconds, "help.lockSeconds"),
    },
    rabbit: {
      speedShare: positive(rabbit.speedShare, "rabbit.speedShare"),
      waitGap,
      resumeGap,
      stepGap: positive(rabbit.stepGap, "rabbit.stepGap"),
      stop: positive(rabbit.stop, "rabbit.stop"),
      trailSeconds: positive(rabbit.trailSeconds, "rabbit.trailSeconds"),
    },
    mushroom: {
      height: positive(mushroom.height, "mushroom.height"),
      hang: positive(mushroom.hang, "mushroom.hang"),
      tapReach: positive(mushroom.tapReach, "mushroom.tapReach"),
      walkReach: positive(mushroom.walkReach, "mushroom.walkReach"),
    },
    key: {
      reach: positive(key.reach, "key.reach"),
      seconds: positive(key.seconds, "key.seconds"),
      alpha: share(key.alpha, "key.alpha"),
      warnSeconds: positive(key.warnSeconds, "key.warnSeconds"),
    },
    soldier: {
      gap: positive(soldier.gap, "soldier.gap"),
      pointSeconds: positive(soldier.pointSeconds, "soldier.pointSeconds"),
    },
    cupcake: {
      seconds: positive(cupcake.seconds, "cupcake.seconds"),
      reach: positive(cupcake.reach, "cupcake.reach"),
      tellReach,
    },
    watch: {
      addSeconds: positive(watch.addSeconds, "watch.addSeconds"),
      minElapsed: positive(watch.minElapsed, "watch.minElapsed"),
    },
    cat: { far, mid, near, wobble },
    line: {
      gap: positive(line.gap, "line.gap"),
      first: positive(line.first, "line.first"),
      scale: lineScale,
      side: positive(line.side, "line.side"),
    },
    teach: {
      creatureAhead: positive(teach.creatureAhead, "teach.creatureAhead"),
      creatureKeep: positive(teach.creatureKeep, "teach.creatureKeep"),
    },
    sneak: {
      moveEvery,
      followGap,
      resumeAfter: positive(sneak.resumeAfter, "sneak.resumeAfter"),
      sweatAfter: positive(sneak.sweatAfter, "sneak.sweatAfter"),
      firstRound,
      later,
      speed: positive(sneak.speed, "sneak.speed"),
    },
    guests,
    seats,
    legend: {
      chance: share(legend.chance, "legend.chance"),
      from,
      to,
      staySeconds: positive(legend.staySeconds, "legend.staySeconds"),
      rideSeconds: positive(legend.rideSeconds, "legend.rideSeconds"),
      lift: positive(legend.lift, "legend.lift"),
      descendSeconds: positive(legend.descendSeconds, "legend.descendSeconds"),
      carryLift: positive(legend.carryLift, "legend.carryLift"),
      span: positive(legend.span, "legend.span"),
      aside: finite(legend.aside, "legend.aside"),
      flinchReach: positive(legend.flinchReach, "legend.flinchReach"),
    },
    stuck: {
      restlessAfter: positive(stuck.restlessAfter, "stuck.restlessAfter"),
      callAfter: positive(stuck.callAfter, "stuck.callAfter"),
      restlessPeek: positive(stuck.restlessPeek, "stuck.restlessPeek"),
      callAhead: positive(stuck.callAhead, "stuck.callAhead"),
      callBright: positive(stuck.callBright, "stuck.callBright"),
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
      earScale: positive(box.earScale, "box.earScale"),
      outlinePx: positive(box.outlinePx, "box.outlinePx"),
      outlineHighPx: positive(box.outlineHighPx, "box.outlineHighPx"),
      height: positive(box.height, "box.height"),
      showShare: share(box.showShare, "box.showShare"),
      breathSeconds: positive(box.breathSeconds, "box.breathSeconds"),
      breathSquash: share(box.breathSquash, "box.breathSquash"),
      sneezeHop: positive(box.sneezeHop, "box.sneezeHop"),
      peekEvery: peek,
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
  const isKnownHelp = g.help === undefined || (HELPS as readonly unknown[]).includes(g.help);
  if (!isKnownHelp) fail(`${path}.help: ${HELPS.join("·")} 가운데 하나여야 한다`);
  const help = (g.help ?? null) as HelpKind | null;
  if (g.row !== undefined && typeof g.row !== "boolean")
    fail(`${path}.row: true(한 줄로) 또는 false 여야 한다`);
  if (!set.sky) return { species, count: n, help, row: g.row === true, orbit: null, alt: null };
  if (g.row === true) fail(`${path}.row: 하늘 무리는 줄 서지 않는다(땅 위 무리만)`);
  const orbit = positive(g.orbit, `${path}.orbit`),
    alt = positive(g.alt, `${path}.alt`);
  return { species, count: n, help, row: false, orbit, alt };
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

// 아닌 척하기: 놓을 자리가 정해진 것은 x·y, 가면은 섞여 들 땅 위 무리(group)
function disguiseOf(v: unknown, path: string, groundSpecies: readonly string[]): DisguiseSpot {
  const s = record(v, path);
  const id = text(s.id, `${path}.id`);
  if (s.note !== undefined) text(s.note, `${path}.note`);
  const known = (DISGUISES as readonly unknown[]).includes(s.as);
  if (!known) fail(`${path}.as: ${DISGUISES.join("·")} 가운데 하나여야 한다`);
  const as = s.as as DisguiseKind;
  const isPlaced = PLACED_DISGUISES.includes(as);
  const x = isPlaced ? finite(s.x, `${path}.x`) : 0,
    y = isPlaced ? finite(s.y, `${path}.y`) : 0;
  if (as !== "mask") return { id, kind: "disguise", as, x, y, group: null };
  const group = text(s.group, `${path}.group`);
  if (!groundSpecies.includes(group))
    fail(`${path}.group: "${group}" 는 guests 의 땅 위 무리가 아니다`);
  return { id, kind: "disguise", as, x, y, group };
}

// 묶음: 자리 넷, 그중 아닌 척은 둘(첫 묶음은 하나이고 내 줄에 끼기가 아니다)
function roundOf(v: unknown, i: number, byId: ReadonlyMap<string, HideSpot>): string[] {
  const path = `rounds[${i}]`;
  const chosen = list(v, path).map((id, j) => text(id, `${path}[${j}]`));
  if (chosen.length !== ROUND_BOXES) fail(`${path}: 자리 ${ROUND_BOXES}개여야 한다`);
  for (const id of chosen) if (!byId.has(id)) fail(`${path}: spots 에 없는 id "${id}"`);
  const picked = chosen.map((id) => byId.get(id)!),
    disguised = picked.filter((s) => s.kind === "disguise"),
    want = i === 0 ? 1 : 2;
  if (disguised.length !== want) fail(`${path}: 아닌 척하기가 ${want}개여야 한다`);
  const hasLine = disguised.some((s) => s.kind === "disguise" && s.as === "line");
  if (i === 0 && hasLine) fail(`${path}: 첫 묶음에는 내 줄에 끼기를 쓰지 않는다`);
  return chosen;
}

// [가장 짧게, 가장 길게] 두 수
function pair(v: unknown, path: string): readonly [number, number] {
  const n = list(v, path).map((x, i) => positive(x, `${path}[${i}]`));
  if (n.length !== 2 || n[0] > n[1]) fail(`${path}: [가장 짧게, 가장 길게] 두 수여야 한다`);
  return [n[0], n[1]];
}
