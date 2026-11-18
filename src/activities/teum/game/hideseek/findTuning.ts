import data from "./hideseek.data.json";
import { HIDE, ROUND_BOXES } from "./tuning";

// 조각 02 '찾는 손맛'의 값: hideseek.data.json 의 warm·candidate·miss·hide·trail·props·mushrooms 칸을 읽고 모양과 규칙을 확인한다
// (틀리면 어느 칸인지 알리며 멈춘다). 열어 보기·주민의 칸은 openTuning.ts, 나머지 칸은 tuning.ts 가 읽는다

/** 숨는 패턴: A 혼자 튀는 애(같은 물건 무리 가운데 하나) · B 길 끝(꽃 길의 끝) · C 속에 쏙(낱개 물건 안) · D 높은 곳 */
export const PATTERNS = ["A", "B", "C", "D"] as const;

/** 숨는 패턴 */
export type Pattern = (typeof PATTERNS)[number];

/** 후보 물건의 갈래: 같은 물건 무리의 하나 · 낱개 · 높은 곳 */
export type PropClass = "cluster" | "solo" | "high";

/**
 * 물건 종류: 모델(에셋 키)·크기(m)·크기를 재는 쪽(w 너비·h 키)·쌓을 때 한 칸이 차지하는 키의 몫·뚜껑(몸통 윗면) 높이가 키의 몇 몫인가·
 * 속에 든 상자의 크기 배수(이 크기일 때 — 물건 옆으로 삐져나오지 않게)
 */
export interface PropKind {
  model: string;
  size: number;
  by: "w" | "h";
  nest: number;
  lid: number;
  fit: number;
  /** 색 없이(회색으로) 온 모델에 칠하는 색(#rrggbb — 없으면 null) */
  paint: string | null;
}

/** 후보 물건 하나(놓을 자리는 광장 가운데 기준 평면 m) */
export interface PropSpec {
  id: string;
  /** 무리 이름(같은 무리끼리는 한 판에 상자 하나만) */
  group: string;
  cls: PropClass;
  kind: string;
  size: number;
  x: number;
  y: number;
  /** 밑에 쌓은 같은 물건의 크기들(탑 — 높은 곳만) */
  under: readonly number[];
  /** 탑이 아닌 높은 곳의 바닥 높이(m — 통통 구름 위). 탑이면 null(쌓은 높이로 정한다) */
  base: number | null;
}

/** 조각 02 의 값 */
export interface FindTuning {
  warm: {
    far: number;
    mid: number;
    near: number;
    every: readonly [number, number, number];
    volume: readonly [number, number];
    pitch: number;
    sparkle: readonly [number, number, number];
    rustleDegrees: number;
    rustleEvery: number;
  };
  candidate: {
    wiggleReach: number;
    tapReach: number;
    perBox: number;
    wiggleSeconds: number;
    wiggleScale: number;
    highBelow: number;
  };
  miss: {
    tauntReach: number;
    tauntSeconds: number;
    moveRange: readonly [number, number];
    moveSeconds: number;
    moveArc: number;
    cooldown: number;
    maxMoves: number;
  };
  hide: {
    patternMax: number;
    insideMax: number;
    first: readonly Pattern[];
    minApart: number;
    minFromStart: number;
    highNear: number;
  };
  trail: {
    count: readonly [number, number];
    gap: readonly [number, number];
    size: readonly [number, number];
    fromEnd: number;
  };
  kinds: Readonly<Record<string, PropKind>>;
  props: readonly PropSpec[];
  mushrooms: readonly { x: number; y: number }[];
}

/** 같은 물건이 이만큼은 모여야 무리다(패턴 A) · 버섯은 적어도 이만큼 */
export const CLUSTER_MIN = 4,
  MUSHROOM_MIN = 6;

/** 값을 읽는다(모양·규칙이 틀리면 어느 칸인지 알리며 멈춘다) */
export function readFindTuning(raw: unknown): FindTuning {
  const r = record(raw, "(파일)"),
    warm = record(r.warm, "warm"),
    candidate = record(r.candidate, "candidate"),
    miss = record(r.miss, "miss"),
    hide = record(r.hide, "hide"),
    trail = record(r.trail, "trail"),
    props = record(r.props, "props");
  const far = positive(warm.far, "warm.far"),
    mid = positive(warm.mid, "warm.mid"),
    near = positive(warm.near, "warm.near");
  if (near > mid || mid > far) fail("warm: near ≤ mid ≤ far 여야 한다");
  const every = numbers(warm.every, "warm.every", 3),
    sparkle = numbers(warm.sparkle, "warm.sparkle", 3);
  if (every[0] < every[1] || every[1] < every[2])
    fail("warm.every: 가까울수록 짧아야 한다(먼 것부터 차례로)");
  const kinds: Record<string, PropKind> = {};
  const rawKinds = record(props.kinds, "props.kinds");
  for (const [name, v] of Object.entries(rawKinds)) kinds[name] = kindOf(v, `props.kinds.${name}`);
  const radius = HIDE.stage.radius,
    all: PropSpec[] = [];
  list(props.clusters, "props.clusters").forEach((v, i) => {
    const path = `props.clusters[${i}]`,
      c = record(v, path),
      id = text(c.id, `${path}.id`),
      kind = kindName(c.kind, kinds, `${path}.kind`),
      at = list(c.at, `${path}.at`);
    if (at.length < CLUSTER_MIN) fail(`${path}.at: 같은 물건이 ${CLUSTER_MIN}개는 모여야 한다`);
    at.forEach((p, j) => {
      const [x, y] = numbers(p, `${path}.at[${j}]`, 2);
      all.push({
        id: `${id}-${j + 1}`,
        group: id,
        cls: "cluster",
        kind,
        size: kinds[kind].size,
        x,
        y,
        under: [],
        base: null,
      });
    });
  });
  list(props.solos, "props.solos").forEach((v, i) => {
    const path = `props.solos[${i}]`,
      c = record(v, path),
      id = text(c.id, `${path}.id`),
      kind = kindName(c.kind, kinds, `${path}.kind`),
      x = finite(c.x, `${path}.x`),
      y = finite(c.y, `${path}.y`);
    all.push({
      id,
      group: id,
      cls: "solo",
      kind,
      size: kinds[kind].size,
      x,
      y,
      under: [],
      base: null,
    });
  });
  list(props.highs, "props.highs").forEach((v, i) => {
    const path = `props.highs[${i}]`,
      c = record(v, path),
      id = text(c.id, `${path}.id`),
      kind = kindName(c.kind, kinds, `${path}.kind`),
      x = finite(c.x, `${path}.x`),
      y = finite(c.y, `${path}.y`),
      size = positive(c.size, `${path}.size`),
      under =
        c.under === undefined
          ? []
          : list(c.under, `${path}.under`).map((n, j) => positive(n, `${path}.under[${j}]`)),
      base = c.base === undefined ? null : positive(c.base, `${path}.base`);
    if (under.length === 0 && base === null)
      fail(`${path}: 탑(under)이거나 바닥 높이(base)가 있어야 한다`);
    all.push({ id, group: id, cls: "high", kind, size, x, y, under, base });
  });
  const ids = new Set<string>();
  for (const p of all) {
    if (ids.has(p.id)) fail(`props: id "${p.id}" 가 두 번 나온다`);
    ids.add(p.id);
    if (Math.hypot(p.x, p.y) > radius)
      fail(`props: "${p.id}" 가 무대 반경(stage.radius ${radius}m) 밖이다`);
  }
  const perBox = positive(candidate.perBox, "candidate.perBox");
  if (all.length < perBox * ROUND_BOXES)
    fail(
      `props: 후보 물건이 ${perBox * ROUND_BOXES}개(상자 수의 candidate.perBox 배)는 있어야 한다`,
    );
  const mushrooms = list(r.mushrooms, "mushrooms").map((v, i) => {
    const m = record(v, `mushrooms[${i}]`),
      x = finite(m.x, `mushrooms[${i}].x`),
      y = finite(m.y, `mushrooms[${i}].y`);
    if (Math.hypot(x, y) > radius) fail(`mushrooms[${i}]: 무대 반경 밖이다`);
    return { x, y };
  });
  if (mushrooms.length < MUSHROOM_MIN) fail(`mushrooms: 적어도 ${MUSHROOM_MIN}개여야 한다`);
  const first = list(hide.first, "hide.first").map((v, i) => patternOf(v, `hide.first[${i}]`));
  if (first.length !== ROUND_BOXES) fail(`hide.first: ${ROUND_BOXES}개여야 한다`);
  const moveRange = numbers(miss.moveRange, "miss.moveRange", 2);
  if (moveRange[0] > moveRange[1]) fail("miss.moveRange: 가까운 쪽이 먼저여야 한다");
  const count = numbers(trail.count, "trail.count", 2);
  if (count[0] < 2 || count[0] > count[1]) fail("trail.count: 2 이상이고 적은 쪽이 먼저여야 한다");
  return {
    warm: {
      far,
      mid,
      near,
      every: [every[0], every[1], every[2]],
      volume: pair(warm.volume, "warm.volume"),
      pitch: finite(warm.pitch, "warm.pitch"),
      sparkle: [sparkle[0], sparkle[1], sparkle[2]],
      rustleDegrees: finite(warm.rustleDegrees, "warm.rustleDegrees"),
      rustleEvery: positive(warm.rustleEvery, "warm.rustleEvery"),
    },
    candidate: {
      wiggleReach: positive(candidate.wiggleReach, "candidate.wiggleReach"),
      tapReach: positive(candidate.tapReach, "candidate.tapReach"),
      perBox,
      wiggleSeconds: positive(candidate.wiggleSeconds, "candidate.wiggleSeconds"),
      wiggleScale: positive(candidate.wiggleScale, "candidate.wiggleScale"),
      highBelow: finite(candidate.highBelow, "candidate.highBelow"),
    },
    miss: {
      tauntReach: positive(miss.tauntReach, "miss.tauntReach"),
      tauntSeconds: positive(miss.tauntSeconds, "miss.tauntSeconds"),
      moveRange: [moveRange[0], moveRange[1]],
      moveSeconds: positive(miss.moveSeconds, "miss.moveSeconds"),
      moveArc: positive(miss.moveArc, "miss.moveArc"),
      cooldown: positive(miss.cooldown, "miss.cooldown"),
      maxMoves: whole(miss.maxMoves, "miss.maxMoves"),
    },
    hide: {
      patternMax: whole(hide.patternMax, "hide.patternMax"),
      insideMax: whole(hide.insideMax, "hide.insideMax"),
      first,
      minApart: positive(hide.minApart, "hide.minApart"),
      minFromStart: finite(hide.minFromStart, "hide.minFromStart"),
      highNear: positive(hide.highNear, "hide.highNear"),
    },
    trail: {
      count: [count[0], count[1]],
      gap: pair(trail.gap, "trail.gap"),
      size: pair(trail.size, "trail.size"),
      fromEnd: positive(trail.fromEnd, "trail.fromEnd"),
    },
    kinds,
    props: all,
    mushrooms,
  };
}

/** 조각 02 의 값(파일을 읽어 확인한 것) */
export const FIND: FindTuning = readFindTuning(data);

/* ─── 내부 ─────────────────────────── */

function fail(why: string): never {
  throw new Error(`[teum] hideseek.data.json — ${why}`);
}

function record(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${path}: 칸 묶음이어야 한다`);
  return v as Record<string, unknown>;
}

function list(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(`${path}: 목록이어야 한다`);
  return v;
}

function text(v: unknown, path: string): string {
  if (typeof v !== "string" || !v) fail(`${path}: 글이어야 한다`);
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

function whole(v: unknown, path: string): number {
  const n = finite(v, path);
  if (!Number.isInteger(n) || n < 0) fail(`${path}: 0 이상의 정수여야 한다`);
  return n;
}

function numbers(v: unknown, path: string, count: number): number[] {
  const items = list(v, path);
  if (items.length !== count) fail(`${path}: 수 ${count}개여야 한다`);
  return items.map((n, i) => finite(n, `${path}[${i}]`));
}

function pair(v: unknown, path: string): readonly [number, number] {
  const [a, b] = numbers(v, path, 2);
  return [a, b];
}

function patternOf(v: unknown, path: string): Pattern {
  const found = PATTERNS.find((p) => p === v);
  if (!found) fail(`${path}: ${PATTERNS.join("·")} 가운데 하나여야 한다`);
  return found;
}

function kindOf(v: unknown, path: string): PropKind {
  const k = record(v, path),
    by = k.by;
  if (by !== "w" && by !== "h") fail(`${path}.by: "w"(너비) 또는 "h"(키)여야 한다`);
  return {
    model: text(k.model, `${path}.model`),
    size: positive(k.size, `${path}.size`),
    by,
    nest: positive(k.nest, `${path}.nest`),
    lid: shareOf(k.lid, `${path}.lid`),
    fit: shareOf(k.fit, `${path}.fit`),
    paint: k.paint === undefined ? null : colorOf(k.paint, `${path}.paint`),
  };
}

function colorOf(v: unknown, path: string): string {
  const hex = text(v, path);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) fail(`${path}: #rrggbb 색이어야 한다`);
  return hex;
}

function shareOf(v: unknown, path: string): number {
  const n = positive(v, path);
  if (n > 1) fail(`${path}: 1 이하여야 한다`);
  return n;
}

function kindName(v: unknown, kinds: Record<string, PropKind>, path: string): string {
  const name = text(v, path);
  if (!Object.hasOwn(kinds, name)) fail(`${path}: props.kinds 에 없는 종류 "${name}"`);
  return name;
}
