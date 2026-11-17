import * as THREE from "three";

import type { Game } from "../Game";
import { STAGE_HUB, sphereAt, startPoint } from "../hideseek/spots";
import { S } from "../settings";
import { offset } from "../world/sphere";
import type { TangleRow } from "./audit";
import type { Body } from "./tangles";
import { groundRadius, widest } from "./tangles";
import { worldBodies } from "./worldBodies";

// 내려다본 지도(개발 도구): 게임이 실제로 그리는 세계를 무대 마을 위에서 찍는다 — 값으로 그린 그림이 아니다.
// top 은 수직으로 내려다본 직교 화면, oblique 는 남쪽 하늘(높이 60m)에서 45도로 내려다본 화면. 안개·하늘·뭉게구름·사람·생물은 끈다.
// 덧그림: 30·70·120m 동그라미, 출발 자리와 보는 방향, 구역 경계와 이름, 놓인 것의 테두리와 이름, 엉킨 곳의 번호(maps/audit 의 번호)

/** 찍는 법 */
export interface MapShotOptions {
  view: "top" | "oblique";
  /** 담는 반지름(m — 무대 마을 가운데에서) */
  radius: number;
  /** 그림의 가로(px). 세로는 top 이면 같고 oblique 면 2/3 */
  size: number;
  /** 덧그림을 얹는다 */
  hasOverlay: boolean;
  /** 덧그릴 엉킨 곳 */
  marks: readonly TangleRow[];
  /** 꽃 길이 놓일 수 있는 자리를 덧그린다(판 하나를 찍을 때는 끈다 — 실제로 깔린 길이 보인다) */
  hasTrailPlans: boolean;
  /** 더 적을 글(가운데 기준 평면 자리 m) — 판 하나를 찍을 때 상자가 숨은 물건의 패턴 */
  notes: readonly MapNote[];
}

/** 지도에 적는 글 하나 */
export interface MapNote {
  x: number;
  y: number;
  text: string;
}

/** 덧그림 색 */
const INK = {
  ring: "#141414",
  zone: "#5b5b5b",
  landmark: "#c2187a",
  tree: "#1f8f3a",
  ride: "#8a5a00",
  lake: "#1976d2",
  scatter: "#6b6b6b",
  prop: "#0066ff",
  tower: "#ff7a00",
  mushroom: "#e00030",
  seat: "#5f7f9f",
  trail: "#e0409a",
  flower: "#ff5fa8",
  mark: "#ff0000",
} as const;

/** 카메라 높이(m — 직교 화면이라 그림에는 영향이 없다. 가장 키 큰 것보다 위) */
const TOP_ALT = 600;
/** 비스듬한 화면: 높이(m) · 내려다보는 각(도) · 세로 시야각(도) */
const OBLIQUE = { alt: 60, pitch: 45, fov: 70 } as const;
/** 덧그리는 동그라미(m) · 출발 자리에서 보는 방향을 가리키는 선의 길이(m) */
const RINGS = [30, 70, 120],
  START_ARROW = 9;
/** 색 풀이: 색과 뜻 */
const LEGEND: readonly (readonly [string, string])[] = [
  [INK.landmark, "장소·랜드마크(손으로 놓음)"],
  [INK.ride, "놀이기구·길(손으로 놓음)"],
  [INK.tree, "키 큰 나무"],
  [INK.scatter, "씨앗으로 흩뿌린 것"],
  [INK.prop, "숨바꼭질 후보 물건"],
  [INK.tower, "탑·통통 구름 위 물건"],
  [INK.mushroom, "버섯"],
  [INK.seat, "구경꾼 자리·출발 줄(점선)"],
  [INK.trail, "꽃 길이 놓일 수 있는 자리"],
  [INK.flower, "바닥의 작은 꽃(점)"],
  [INK.mark, "엉킨 곳(번호는 overlaps.md)"],
];
/** 안개를 끌 때 미뤄 두는 거리(m) */
const NO_FOG = 1e7;

const world = new THREE.Vector3(),
  spot = new THREE.Vector3();

/** 지도 한 장을 찍어 캔버스로 돌려준다(게임 화면은 다음 프레임에 제 모습으로 돌아온다) */
export function mapShot(game: Game, opt: MapShotOptions): HTMLCanvasElement {
  const hub = game.s.occ.hubs[STAGE_HUB],
    width = opt.size,
    wide = (opt.size * 2) / 3,
    height = opt.view === "top" ? opt.size : Math.round(wide),
    aspect = width / height,
    camera = cameraFor(game, hub, opt, aspect),
    canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("[teum] 지도 그림: 2D 캔버스를 만들지 못했다");
  render(game, hub, camera, ctx, width, height);
  if (opt.hasOverlay) overlay(game, hub, camera, ctx, opt);
  return canvas;
}

/* ─── 내부 ─────────────────────────── */

function cameraFor(
  game: Game,
  hub: THREE.Vector3,
  opt: MapShotOptions,
  aspect: number,
): THREE.Camera {
  if (opt.view === "top") {
    // 공 위라 가장자리는 조금 안쪽으로 보인다: 담는 반지름의 호를 평면에 내린 길이로 잡는다
    const arc = opt.radius / S.R,
      half = S.R * Math.sin(arc) * 1.04,
      far = TOP_ALT + S.R,
      cam = new THREE.OrthographicCamera(-half, half, half, -half, 1, far),
      north = offset(hub, 1, 90).sub(hub).normalize(),
      eyeAlt = S.R + TOP_ALT;
    cam.position.copy(hub).multiplyScalar(eyeAlt);
    cam.up.copy(north);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    return cam;
  }
  // 남쪽 가장자리 밖 하늘에서 북쪽을 본다: 높이에서 pitch 로 내려다보면 바로 앞에서 먼 북쪽까지 담긴다
  const cam = new THREE.PerspectiveCamera(OBLIQUE.fov, aspect, 1, 4000),
    back = -(opt.radius + 10),
    pitch = THREE.MathUtils.degToRad(OBLIQUE.pitch),
    ahead = back + OBLIQUE.alt / Math.tan(pitch),
    eye = new THREE.Vector3(),
    target = new THREE.Vector3();
  sphereAt(eye, hub, 0, back);
  sphereAt(target, hub, 0, ahead);
  const eyeAlt = S.R + game.s.terrain.groundAt(eye) + OBLIQUE.alt;
  cam.up.copy(eye);
  cam.position.copy(eye).multiplyScalar(eyeAlt);
  target.multiplyScalar(S.R);
  cam.lookAt(target);
  cam.updateMatrixWorld();
  return cam;
}

// 게임 화면을 그 카메라로 한 번 그려 2D 캔버스에 옮긴다. 끈 것과 화면 크기는 되돌린다
function render(
  game: Game,
  hub: THREE.Vector3,
  camera: THREE.Camera,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const { renderer, scene } = game.stage,
    fog = scene.fog instanceof THREE.Fog ? scene.fog : null,
    fogWas = fog ? [fog.near, fog.far] : [0, 0],
    sizeWas = new THREE.Vector2(),
    ratioWas = renderer.getPixelRatio(),
    hidden = [game.sky.mesh, game.avatar.me, game.avatar.shadow],
    shownWas = hidden.map((o) => o.visible);
  renderer.getSize(sizeWas);
  if (fog) {
    fog.near = NO_FOG;
    fog.far = NO_FOG * 2;
  }
  for (const o of hidden) o.visible = false;
  game.clouds.setHidden(true);
  game.creatures.setHidden(true);
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  // 가까운 것만 그리기: 이 카메라의 시야로 다시 고른다
  const viewProj = new THREE.Matrix4(),
    frustum = new THREE.Frustum();
  viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(viewProj);
  game.s.models.flush(frustum, hub, game.s.culler.cut);
  game.terrainView.flush(frustum);
  renderer.render(scene, camera);
  ctx.drawImage(renderer.domElement, 0, 0, width, height);
  renderer.setPixelRatio(ratioWas);
  renderer.setSize(sizeWas.x, sizeWas.y, false);
  hidden.forEach((o, i) => {
    o.visible = shownWas[i];
  });
  game.clouds.setHidden(false);
  game.creatures.setHidden(false);
  if (fog) [fog.near, fog.far] = fogWas;
}

/** 덧그림 붓: 행성 위 자리(단위 벡터)·땅에서의 높이(m) → 그림 위 점 */
interface Brush {
  ctx: CanvasRenderingContext2D;
  at(v: THREE.Vector3, alt?: number): [number, number] | null;
  /** 가운데 기준 평면 자리(m) → 그림 위 점 */
  plane(x: number, y: number): [number, number] | null;
  /** 그림 한 변(px)에 맞춘 굵기 배율 */
  k: number;
}

function overlay(
  game: Game,
  hub: THREE.Vector3,
  camera: THREE.Camera,
  ctx: CanvasRenderingContext2D,
  opt: MapShotOptions,
) {
  const { width, height } = ctx.canvas,
    k = opt.size / 2400;
  const at = (v: THREE.Vector3, alt = 0): [number, number] | null => {
    const radius = S.R + alt;
    world.copy(v).multiplyScalar(radius).project(camera);
    if (world.z > 1 || world.z < -1) return null;
    return [((world.x + 1) / 2) * width, ((1 - world.y) / 2) * height];
  };
  const plane = (x: number, y: number) => at(sphereAt(spot, hub, x, y));
  const brush: Brush = { ctx, at, plane, k };
  ctx.lineJoin = "round";
  ctx.textBaseline = "middle";
  drawFlowers(game, hub, brush, opt);
  drawFrame(game, brush, opt);
  drawBodies(game, hub, brush, opt);
  drawMarks(brush, opt);
  drawNotes(brush, opt);
  drawLegend(brush);
}

// 바닥의 작은 꽃: 점(수직 화면만 — 비스듬한 화면에서는 실제 꽃이 보인다)
function drawFlowers(game: Game, hub: THREE.Vector3, brush: Brush, opt: MapShotOptions) {
  if (opt.view !== "top") return;
  const { ctx, k } = brush,
    dot = 3 * k,
    half = dot / 2;
  ctx.fillStyle = INK.flower;
  for (const v of game.flowers.shown()) {
    if (v.angleTo(hub) * S.R > opt.radius) continue;
    const p = brush.at(v);
    if (!p) continue;
    const left = p[0] - half,
      top = p[1] - half;
    ctx.fillRect(left, top, dot, dot);
  }
}

// 동그라미·구역 경계와 이름·출발 자리
function drawFrame(game: Game, brush: Brush, opt: MapShotOptions) {
  const { ctx, k } = brush,
    turn = Math.PI * 2;
  for (const ring of RINGS) {
    if (ring > opt.radius) continue;
    ctx.strokeStyle = INK.ring;
    ctx.lineWidth = 2.5 * k;
    path(brush, (i) => {
      const a = (i / 180) * turn;
      return [ring * Math.cos(a), ring * Math.sin(a)];
    });
    const top = brush.plane(0, ring);
    if (!top) continue;
    const x = top[0] + 8 * k,
      y = top[1] - 14 * k;
    label(brush, `${ring}m`, x, y, INK.ring, 22);
  }
  const dash = [14 * k, 10 * k],
    nameAt = opt.radius * 0.9;
  for (const zone of game.s.map.zones) {
    const edge = THREE.MathUtils.degToRad(zone.from),
      middle = (zone.from + zone.to) / 2,
      mid = THREE.MathUtils.degToRad(middle),
      edgeX = opt.radius * Math.cos(edge),
      edgeY = opt.radius * Math.sin(edge),
      nameX = nameAt * Math.cos(mid),
      nameY = nameAt * Math.sin(mid),
      from0 = brush.plane(0, 0),
      to = brush.plane(edgeX, edgeY),
      name = brush.plane(nameX, nameY);
    if (from0 && to) {
      ctx.strokeStyle = INK.zone;
      ctx.lineWidth = 2.5 * k;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(from0[0], from0[1]);
      ctx.lineTo(to[0], to[1]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (name) label(brush, zone.name, name[0], name[1], INK.zone, 30, "center");
  }
  // 출발 자리와 보는 방향(마을 가운데 쪽)
  const start = startPoint(),
    far = Math.hypot(start.x, start.y),
    rest = 1 - START_ARROW / far,
    aheadX = start.x * rest,
    aheadY = start.y * rest,
    p0 = brush.plane(start.x, start.y),
    p1 = brush.plane(aheadX, aheadY);
  if (!p0 || !p1) return;
  const dotR = 9 * k,
    textX = p0[0] + 14 * k,
    textY = p0[1] + 16 * k;
  ctx.strokeStyle = ctx.fillStyle = INK.ring;
  ctx.lineWidth = 5 * k;
  ctx.beginPath();
  ctx.moveTo(p0[0], p0[1]);
  ctx.lineTo(p1[0], p1[1]);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p0[0], p0[1], dotR, 0, turn);
  ctx.fill();
  label(brush, "출발", textX, textY, INK.ring, 24);
}

// 놓인 것의 테두리와 이름
function drawBodies(game: Game, hub: THREE.Vector3, brush: Brush, opt: MapShotOptions) {
  const { bodies, ponds } = worldBodies(game),
    labelled = new Set<string>(),
    reach = opt.radius + 20;
  for (const pond of ponds) {
    if (pond.v.angleTo(hub) * S.R - pond.r > reach) continue;
    circle(brush, pond.v, pond.r, INK.lake, 3);
    const p = brush.at(pond.v);
    if (p) label(brush, "호수", p[0], p[1], INK.lake, 22, "center");
  }
  for (const body of bodies) {
    if (body.v.angleTo(hub) * S.R - widest(body) > reach) continue;
    if (!opt.hasTrailPlans && body.name.startsWith("trail(")) continue;
    const look = lookOf(game, body),
      r = groundRadius(body) || widest(body);
    circle(brush, body.v, r, look.color, look.width, look.isDashed);
    if (!look.name || labelled.has(body.owner)) continue;
    labelled.add(body.owner);
    const p = brush.at(body.v);
    if (!p) continue;
    const x = p[0] + 6 * brush.k;
    label(brush, look.name, x, p[1], look.color, look.size);
  }
}

/** 몸 하나를 그리는 법 */
interface BodyLook {
  color: string;
  width: number;
  name: string;
  size: number;
  isDashed?: boolean;
}

function lookOf(game: Game, body: Body): BodyLook {
  const kind = body.name.split(/[#(]/)[0],
    inner = /\(([^)]+)\)/.exec(body.name)?.[1] ?? "";
  if (body.layer === "숨바꼭질") {
    if (kind === "tower" || kind === "perch")
      return { color: INK.tower, width: 4, name: inner, size: 20 };
    if (kind === "mushroom") return { color: INK.mushroom, width: 4, name: inner, size: 20 };
    if (kind === "prop") return { color: INK.prop, width: 4, name: inner, size: 20 };
    if (kind === "trail") return { color: INK.trail, width: 3, name: "", size: 0 };
    const name = kind === "seat" ? "" : inner;
    return { color: INK.seat, width: 2, name, size: 16, isDashed: true };
  }
  if (body.layer === "흩뿌림") {
    const name = kind === "bubble" ? "" : inner || kind;
    return { color: INK.scatter, width: 2, name, size: 16 };
  }
  if (kind === "place") return { color: INK.landmark, width: 5, name: inner, size: 30 };
  if (kind === "site") {
    const digits = /#(\d+)/.exec(body.name)?.[1] ?? "-1",
      index = Number(digits),
      site = game.s.map.layout.site[index];
    return { color: INK.landmark, width: 4, name: site?.name ?? inner, size: 24 };
  }
  if (kind === "tree") return { color: INK.tree, width: 3, name: "나무", size: 16 };
  return { color: INK.ride, width: 3, name: kind, size: 18 };
}

// 엉킨 곳: 빨간 동그라미와 번호
function drawMarks(brush: Brush, opt: MapShotOptions) {
  const { ctx, k } = brush,
    turn = Math.PI * 2,
    markR = 20 * k;
  for (const row of opt.marks) {
    if (row.far > opt.radius) continue;
    const p = brush.plane(row.x, row.y);
    if (!p) continue;
    const no = String(row.no),
      x = p[0] + 24 * k,
      y = p[1] - 20 * k;
    ctx.strokeStyle = INK.mark;
    ctx.lineWidth = 5 * k;
    ctx.beginPath();
    ctx.arc(p[0], p[1], markR, 0, turn);
    ctx.stroke();
    label(brush, no, x, y, INK.mark, 28);
  }
}

// 더 적을 글: 굵은 먹색(상자가 숨은 물건의 패턴)
function drawNotes(brush: Brush, opt: MapShotOptions) {
  const { k } = brush;
  for (const note of opt.notes) {
    const p = brush.plane(note.x, note.y);
    if (!p) continue;
    const x = p[0] - 34 * k,
      y = p[1] - 30 * k;
    label(brush, note.text, x, y, INK.ring, 40);
  }
}

// 색 풀이(왼쪽 아래)
function drawLegend(brush: Brush) {
  const { ctx, k } = brush,
    line = 30 * k,
    left = 24 * k,
    swatch = 18 * k,
    textX = left + swatch + 10 * k;
  let y = ctx.canvas.height - LEGEND.length * line - 14 * k;
  for (const [color, text] of LEGEND) {
    const top = y - swatch / 2;
    ctx.fillStyle = color;
    ctx.fillRect(left, top, swatch, swatch);
    label(brush, text, textX, y, INK.ring, 20);
    y += line;
  }
}

// 가운데 v, 반지름 r(m)의 땅 위 동그라미(공 위의 점을 이어 그린다 — 비스듬한 화면에서도 맞는다)
function circle(
  brush: Brush,
  v: THREE.Vector3,
  r: number,
  color: string,
  width: number,
  isDashed = false,
) {
  const { ctx, k } = brush,
    steps = 40;
  const dash = isDashed ? [8 * k, 6 * k] : [];
  ctx.strokeStyle = color;
  ctx.lineWidth = width * k;
  ctx.setLineDash(dash);
  ctx.beginPath();
  let isOpen = false;
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 360,
      edge = offset(v, r, bearing),
      p = brush.at(edge);
    if (!p) {
      isOpen = false;
      continue;
    }
    if (isOpen) ctx.lineTo(p[0], p[1]);
    else ctx.moveTo(p[0], p[1]);
    isOpen = true;
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

// 가운데 기준 평면 점 180 개를 이은 닫힌 선
function path(brush: Brush, pointAt: (i: number) => [number, number]) {
  const { ctx } = brush;
  ctx.beginPath();
  for (let i = 0; i <= 180; i++) {
    const [x, y] = pointAt(i),
      p = brush.plane(x, y);
    if (!p) continue;
    if (i === 0) ctx.moveTo(p[0], p[1]);
    else ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();
}

// 흰 테두리를 두른 글자(어떤 땅 색 위에서도 읽히게)
function label(
  brush: Brush,
  text: string,
  x: number,
  y: number,
  color: string,
  size: number,
  align: CanvasTextAlign = "left",
) {
  const { ctx, k } = brush,
    fitted = size * k,
    scaled = Math.round(fitted),
    px = Math.max(11, scaled);
  ctx.font = `600 ${px}px Pretendard, "Apple SD Gothic Neo", sans-serif`;
  ctx.textAlign = align;
  ctx.lineWidth = 5 * k;
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
