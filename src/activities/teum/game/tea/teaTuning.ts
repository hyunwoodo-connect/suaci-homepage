import data from "./tea.data.json";

// 티타임 행성 값은 tea.data.json 한 파일에 있고, 기획이 코드 없이 직접 고친다(칸 이름은 기획서 13장 그대로).
// 여기서는 그 파일을 읽어 모양을 확인하고 이름 붙은 값으로 내준다. 모양이 틀리면 어느 칸이 왜 틀렸는지 알리고 멈춘다(시험이 먼저 잡는다)

/** 자리: 층(0 땅, 1~3 접시) · 축에서 잰 거리(m) · 방위(도) */
export interface TeaSpot {
  tier: number;
  dist: number;
  bear: number;
}

/** 놀이기구 길의 한 점: 땅에서 높이(m) · 축에서 잰 거리(m) · 방위(도) */
export interface PathPoint {
  h: number;
  dist: number;
  bear: number;
}

/** 버섯 하나: 서 있는 자리와 내려 주는 자리 */
export interface MushroomSpec {
  at: TeaSpot;
  to: TeaSpot;
}

/** 길을 따라 실어 가는 놀이기구(바람 기둥·대포·미끄럼틀) */
export interface RideSpec {
  /** 타는 자리 */
  at: TeaSpot;
  /** 실어 가는 길 */
  path: PathPoint[];
  /** 길을 다 가는 시간(초) */
  seconds: number;
  /** 이 거리(m) 안에 오면 탄다 */
  reach: number;
}

/** 리본 없는 꾸밈 하나: 모델 키 · 자리 · 크기(m, 키) · 돌림(도) · 막는 반지름(m, 0 이면 지나간다) · 바닥에서 띄우는 높이(쌓기) */
export interface DecorSpec {
  key: string;
  at: TeaSpot;
  size: number;
  turn: number;
  block: number;
  lift: number;
}

/** 접시 하나: 땅에서 높이 · 지름(m) */
export interface PlateSpec {
  h: number;
  d: number;
}

/** 티타임 행성 값 전체 */
export interface TeaTuning {
  planet: { radius: number };
  /** 스탠드: 접시(아래부터) · 꼭대기 높이 · 기둥 지름 · 접시 두께 · 테두리 높이 */
  stand: { plates: PlateSpec[]; top: number; column: number; plateThick: number; rim: number };
  /** 색(라임은 상자와 리본만, 금색은 보너스 상자만) */
  colors: Record<ColorName, string>;
  /** 하늘이 시계: 색과 그 색이 되는 시각(초) */
  sky: { colors: string[]; at: number[] };
  /** 걷기와 떨어지기: 떨어질 때 중력·최대 빠르기, 아래 접시가 받는 여유, 내려앉을 때 남기는 빠르기 몫, 몸 반지름·키 */
  walk: {
    fallGravity: number;
    fallLimit: number;
    catchMargin: number;
    landKeep: number;
    bodyHalf: number;
    bodyTop: number;
  };
  /** 시작: 내려앉는 자리 · 떨어지기 시작하는 높이 · 행성 전경을 보는 시간 */
  start: { spot: TeaSpot; dropHeight: number; overview: number };
  movers: {
    mushrooms: MushroomSpec[];
    /** 버섯이 튕겨 내려 주는 시간 · 밟히는 거리 */
    mushroomSeconds: number;
    mushroomReach: number;
    wind: RideSpec;
    cannon: RideSpec;
    slide: RideSpec;
  };
  /** 리본 없는 꾸밈(화면은 풍성하고, 누를 만한 건 리본 물건뿐) */
  decor: DecorSpec[];
  round: { cap: number; lastCall: number };
  sneak: { every: readonly [number, number]; speed: number; homeGuard: number };
  flee: { speed: number; spotSeconds: number; spotShare: number; spotReach: number };
  catch: { radiusScale: number; minPx: number; reach: number };
  open: { reach: number };
  warm: { bands: number[]; every: number[] };
  first: { stillSeconds: number };
  retry: { free: number };
}

/** 색 이름 */
export type ColorName =
  | "lime"
  | "gold"
  | "ground"
  | "path"
  | "porcelain"
  | "cobalt"
  | "strawberry"
  | "lavender"
  | "chocolate"
  | "cream";

const COLOR_NAMES: readonly ColorName[] = [
  "lime",
  "gold",
  "ground",
  "path",
  "porcelain",
  "cobalt",
  "strawberry",
  "lavender",
  "chocolate",
  "cream",
];

/** 값 파일을 읽어 모양을 확인한다. 틀리면 칸 이름과 까닭을 알리며 멈춘다 */
export function readTeaTuning(raw: unknown): TeaTuning {
  const root = record(raw, "");
  const planet = record(root.planet, "planet");
  const radius = positive(planet.radius, "planet.radius");
  const stand = record(root.stand, "stand");
  const plateList = list(stand.plates, "stand.plates");
  const plates = plateList.map((v, i) => plateOf(v, `stand.plates[${i}]`));
  const top = positive(stand.top, "stand.top");
  checkPlates(plates, top);
  const tiers = plates.length;
  const colorsRaw = record(root.colors, "colors");
  const colors = {} as Record<ColorName, string>;
  for (const name of COLOR_NAMES) colors[name] = colorOf(colorsRaw[name], `colors.${name}`);
  const sky = record(root.sky, "sky");
  const skyColors = list(sky.colors, "sky.colors").map((v, i) => colorOf(v, `sky.colors[${i}]`));
  const skyAt = list(sky.at, "sky.at").map((v, i) => finite(v, `sky.at[${i}]`));
  if (skyAt.length !== skyColors.length) fail("sky.at: sky.colors 와 수가 같아야 한다");
  const walk = record(root.walk, "walk");
  const start = record(root.start, "start");
  const movers = record(root.movers, "movers");
  const mushroomList = list(movers.mushrooms, "movers.mushrooms");
  const mushrooms = mushroomList.map((v, i) => mushroomOf(v, `movers.mushrooms[${i}]`, tiers));
  const decorList = list(root.decor, "decor");
  const decor = decorList.map((v, i) => decorOf(v, `decor[${i}]`, tiers));
  const round = record(root.round, "round");
  const cap = positive(round.cap, "round.cap");
  const lastCall = positive(round.lastCall, "round.lastCall");
  if (lastCall >= cap) fail("round.lastCall: round.cap 보다 작아야 한다");
  const sneak = record(root.sneak, "sneak");
  const flee = record(root.flee, "flee");
  const catchRaw = record(root.catch, "catch");
  const open = record(root.open, "open");
  const warm = record(root.warm, "warm");
  const bands = list(warm.bands, "warm.bands").map((v, i) => positive(v, `warm.bands[${i}]`));
  const every = list(warm.every, "warm.every").map((v, i) => positive(v, `warm.every[${i}]`));
  if (every.length !== bands.length) fail("warm.every: warm.bands 와 수가 같아야 한다");
  const first = record(root.first, "first");
  const retry = record(root.retry, "retry");
  return {
    planet: { radius },
    stand: {
      plates,
      top,
      column: positive(stand.column, "stand.column"),
      plateThick: positive(stand.plateThick, "stand.plateThick"),
      rim: positive(stand.rim, "stand.rim"),
    },
    colors,
    sky: { colors: skyColors, at: skyAt },
    walk: {
      fallGravity: positive(walk.fallGravity, "walk.fallGravity"),
      fallLimit: positive(walk.fallLimit, "walk.fallLimit"),
      catchMargin: positive(walk.catchMargin, "walk.catchMargin"),
      landKeep: share(walk.landKeep, "walk.landKeep"),
      bodyHalf: positive(walk.bodyHalf, "walk.bodyHalf"),
      bodyTop: positive(walk.bodyTop, "walk.bodyTop"),
    },
    start: {
      spot: spotOf(start.spot, "start.spot", tiers),
      dropHeight: positive(start.dropHeight, "start.dropHeight"),
      overview: positive(start.overview, "start.overview"),
    },
    movers: {
      mushrooms,
      mushroomSeconds: positive(movers.mushroomSeconds, "movers.mushroomSeconds"),
      mushroomReach: positive(movers.mushroomReach, "movers.mushroomReach"),
      wind: rideOf(movers.wind, "movers.wind", tiers),
      cannon: rideOf(movers.cannon, "movers.cannon", tiers),
      slide: rideOf(movers.slide, "movers.slide", tiers),
    },
    decor,
    round: { cap, lastCall },
    sneak: {
      every: pair(sneak.every, "sneak.every"),
      speed: positive(sneak.speed, "sneak.speed"),
      homeGuard: positive(sneak.homeGuard, "sneak.homeGuard"),
    },
    flee: {
      speed: positive(flee.speed, "flee.speed"),
      spotSeconds: positive(flee.spotSeconds, "flee.spotSeconds"),
      spotShare: share(flee.spotShare, "flee.spotShare"),
      spotReach: positive(flee.spotReach, "flee.spotReach"),
    },
    catch: {
      radiusScale: positive(catchRaw.radiusScale, "catch.radiusScale"),
      minPx: positive(catchRaw.minPx, "catch.minPx"),
      reach: positive(catchRaw.reach, "catch.reach"),
    },
    open: { reach: positive(open.reach, "open.reach") },
    warm: { bands, every },
    first: { stillSeconds: positive(first.stillSeconds, "first.stillSeconds") },
    retry: { free: whole(retry.free, "retry.free") },
  };
}

/** 지금 값 파일의 값 */
export const TEA: Readonly<TeaTuning> = readTeaTuning(data);

/* ─── 내부 ─────────────────────────── */

function fail(why: string): never {
  throw new Error(`tea.data.json ${why}`);
}

function record(v: unknown, path: string): Record<string, unknown> {
  const isRecord = typeof v === "object" && v !== null && !Array.isArray(v);
  if (!isRecord) fail(`${path || "(맨 위)"}: 묶음이어야 한다`);
  return v as Record<string, unknown>;
}

function list(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(`${path}: 목록이어야 한다`);
  return v;
}

function finite(v: unknown, path: string): number {
  const isNumber = typeof v === "number" && Number.isFinite(v);
  if (!isNumber) fail(`${path}: 수여야 한다`);
  return v as number;
}

function positive(v: unknown, path: string): number {
  const n = finite(v, path);
  if (n <= 0) fail(`${path}: 0 보다 커야 한다`);
  return n;
}

function whole(v: unknown, path: string): number {
  const n = positive(v, path);
  if (!Number.isInteger(n)) fail(`${path}: 자연수여야 한다`);
  return n;
}

function share(v: unknown, path: string): number {
  const n = positive(v, path);
  if (n > 1) fail(`${path}: 0 과 1 사이여야 한다`);
  return n;
}

function pair(v: unknown, path: string): readonly [number, number] {
  const items = list(v, path);
  if (items.length !== 2) fail(`${path}: [작은 값, 큰 값] 둘이어야 한다`);
  const low = positive(items[0], `${path}[0]`),
    high = positive(items[1], `${path}[1]`);
  if (low > high) fail(`${path}: 앞이 뒤보다 크다`);
  return [low, high];
}

function colorOf(v: unknown, path: string): string {
  const isColor = typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);
  if (!isColor) fail(`${path}: #RRGGBB 색이어야 한다`);
  return v as string;
}

function plateOf(v: unknown, path: string): PlateSpec {
  const items = list(v, path);
  if (items.length !== 2) fail(`${path}: [높이, 지름] 둘이어야 한다`);
  return { h: positive(items[0], `${path}[0]`), d: positive(items[1], `${path}[1]`) };
}

// 접시는 아래부터 높아지고 좁아지며 꼭대기는 맨 위 접시보다 높다(어디서 떨어져도 한 단 아래가 받는다)
function checkPlates(plates: PlateSpec[], top: number) {
  if (plates.length === 0) fail("stand.plates: 접시가 하나는 있어야 한다");
  for (let i = 1; i < plates.length; i++) {
    const below = plates[i - 1],
      above = plates[i];
    if (above.h <= below.h) fail(`stand.plates[${i}]: 아래 접시보다 높아야 한다`);
    if (above.d >= below.d) fail(`stand.plates[${i}]: 아래 접시보다 좁아야 한다`);
  }
  const highest = plates[plates.length - 1];
  if (top <= highest.h) fail("stand.top: 맨 위 접시보다 높아야 한다");
}

function spotOf(v: unknown, path: string, tiers: number): TeaSpot {
  const items = list(v, path);
  if (items.length !== 3) fail(`${path}: [층, 거리, 방위] 셋이어야 한다`);
  const tier = finite(items[0], `${path}[0]`);
  const isTier = Number.isInteger(tier) && tier >= 0 && tier <= tiers;
  if (!isTier) fail(`${path}[0]: 층은 0(땅)~${tiers} 이어야 한다`);
  const dist = finite(items[1], `${path}[1]`);
  if (dist < 0) fail(`${path}[1]: 거리는 0 이상이어야 한다`);
  return { tier, dist, bear: finite(items[2], `${path}[2]`) };
}

function pointOf(v: unknown, path: string): PathPoint {
  const items = list(v, path);
  if (items.length !== 3) fail(`${path}: [높이, 거리, 방위] 셋이어야 한다`);
  const h = finite(items[0], `${path}[0]`),
    dist = finite(items[1], `${path}[1]`);
  if (h < 0 || dist < 0) fail(`${path}: 높이와 거리는 0 이상이어야 한다`);
  return { h, dist, bear: finite(items[2], `${path}[2]`) };
}

function mushroomOf(v: unknown, path: string, tiers: number): MushroomSpec {
  const m = record(v, path);
  const at = spotOf(m.at, `${path}.at`, tiers),
    to = spotOf(m.to, `${path}.to`, tiers);
  if (to.tier !== at.tier + 1) fail(`${path}.to: 버섯은 바로 위 층에 내려 준다`);
  return { at, to };
}

function rideOf(v: unknown, path: string, tiers: number): RideSpec {
  const r = record(v, path);
  const points = list(r.path, `${path}.path`);
  if (points.length < 2) fail(`${path}.path: 점이 둘 이상이어야 한다`);
  return {
    at: spotOf(r.at, `${path}.at`, tiers),
    path: points.map((p, i) => pointOf(p, `${path}.path[${i}]`)),
    seconds: positive(r.seconds, `${path}.seconds`),
    reach: positive(r.reach, `${path}.reach`),
  };
}

function decorOf(v: unknown, path: string, tiers: number): DecorSpec {
  const d = record(v, path);
  const key = d.key;
  if (typeof key !== "string" || !key) fail(`${path}.key: 모델 키(글)여야 한다`);
  const block = finite(d.block, `${path}.block`);
  if (block < 0) fail(`${path}.block: 0 이상이어야 한다`);
  const lift = d.lift === undefined ? 0 : finite(d.lift, `${path}.lift`);
  return {
    key,
    at: spotOf(d.at, `${path}.at`, tiers),
    size: positive(d.size, `${path}.size`),
    turn: finite(d.turn, `${path}.turn`),
    block,
    lift,
  };
}
