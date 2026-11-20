import * as THREE from "three";

import { ease } from "../core/frame";
import type { ModelLibrary } from "../models/library";
import type { StandShape } from "./stand";
import type { TeaTuning } from "./teaTuning";

// 코드로 짓는 무대: 딸기우유 별, 크림 길, 평평한 흰 도자기 접시 셋(코발트 점무늬 테두리, 아랫면 코발트 고리),
// 사선 줄무늬 기둥, 꼭대기 체리와 찜 기둥(흰 바탕에 딸기색 점 깃발).
// 접시와 기둥은 저마다 재질을 따로 둔다 — 카메라와 나 사이에 끼면 그것만 반투명(30%)으로 흐린다

/** 카메라와 나 사이에 낀 것의 불투명도(기획서 v3.1 1장) */
const FADED = 0.3;
/** 흐려지고 돌아오는 빠르기 */
const FADE_RATE = 8;
/** 접시 아랫면 고리가 놓이는 자리(가장자리까지의 몫) */
const UNDER_RINGS = [0.55, 0.86] as const;
/** 테두리 점무늬 사이(m) */
const DOT_GAP = 1.15;
/** 찜 기둥 높이(m, 꼭대기 위로)와 깃발 크기 */
const FLAG_POLE = 3.2;
const FLAG_SIZE = { w: 1.6, h: 1 } as const;
/** 땅을 두르는 크림 길: 축에서 수평 거리(m) */
const PATH_RING = { from: 18.5, to: 21 } as const;
const TAU = Math.PI * 2;

/** 흐려질 수 있는 것 하나 */
interface Fadable {
  mats: THREE.Material[];
  opacity: number;
  want: number;
}

const seg = new THREE.Vector3();

/** 코드로 짓는 무대 */
export class StandMesh {
  /** 찜 기둥 꼭대기의 깃발(찜하면 펄럭) */
  readonly flag: THREE.Mesh;
  /** 상자가 찜 기둥을 끌어안는 자리(꼭대기 체리 위) */
  readonly topPoint = new THREE.Vector3();
  private readonly root = new THREE.Group();
  private readonly disposables: { dispose(): void }[] = [];
  private readonly plateFades: Fadable[] = [];
  private readonly columnFade: Fadable;
  private flap = 0;

  constructor(
    scene: THREE.Scene,
    private readonly stand: StandShape,
    t: TeaTuning,
    models: ModelLibrary,
  ) {
    const c = t.colors,
      R = stand.R;
    // ---- 별: 딸기우유 땅과 스탠드를 두르는 크림 길 ----
    const planetGeo = new THREE.SphereGeometry(R, 96, 64);
    const planetMat = this.standard(c.ground, 0.85);
    const planet = new THREE.Mesh(planetGeo, planetMat);
    this.root.add(planet);
    const fromShare = PATH_RING.from / R,
      toShare = PATH_RING.to / R;
    const pathFrom = Math.asin(fromShare),
      pathTo = Math.asin(toShare);
    const pathWidth = pathTo - pathFrom;
    const pathR = R + 0.03;
    const pathGeo = new THREE.SphereGeometry(pathR, 96, 4, 0, TAU, pathFrom, pathWidth);
    const pathMat = this.standard(c.path, 0.9);
    const path = new THREE.Mesh(pathGeo, pathMat);
    this.root.add(path);
    this.disposables.push(planetGeo, pathGeo);
    // ---- 접시 셋: 저마다 재질(흐리기) ----
    const cobalt = this.standard(c.cobalt, 0.35);
    const dotGeo = new THREE.SphereGeometry(0.16, 10, 8);
    this.disposables.push(dotGeo);
    for (const plate of stand.plates) {
      const porcelain = this.porcelain(c.porcelain);
      const profile = plateProfile(plate.holeR, plate.radius, plate.top, plate.bottom, t.stand.rim);
      const geo = new THREE.LatheGeometry(profile, 72);
      this.disposables.push(geo);
      const mesh = new THREE.Mesh(geo, porcelain);
      this.root.add(mesh);
      const rimY = plate.top + t.stand.rim;
      const dots = rimDots(plate.radius, rimY, dotGeo, cobalt);
      this.root.add(dots);
      const mats: THREE.Material[] = [porcelain];
      for (const share of UNDER_RINGS) {
        const ringMat = this.standard(c.cobalt, 0.35);
        const ringR = plate.radius * share;
        const ring = underRing(ringR, plate.bottom, ringMat);
        this.root.add(ring);
        this.disposables.push(ring.geometry);
        mats.push(ringMat);
      }
      this.plateFades.push({ mats, opacity: 1, want: 1 });
    }
    // ---- 기둥: 땅 속에서 꼭대기까지, 흰 바탕에 코발트 사선 ----
    const columnTex = stripeTexture(c.porcelain, c.cobalt);
    const columnLength = t.stand.top + 2;
    const columnGeo = new THREE.CylinderGeometry(stand.columnR, stand.columnR, columnLength, 28);
    const turns = columnLength / 2.4;
    columnTex.repeat.set(3, turns);
    const columnMat = new THREE.MeshStandardMaterial({ map: columnTex, roughness: 0.3 });
    const column = new THREE.Mesh(columnGeo, columnMat);
    column.position.y = R - 2 + columnLength / 2;
    this.root.add(column);
    this.columnFade = { mats: [columnMat], opacity: 1, want: 1 };
    this.disposables.push(columnGeo, columnTex);
    // ---- 꼭대기: 체리(모델이 오면 바꾼다)와 찜 기둥(흰 깃발에 딸기색 점) ----
    const topY = stand.topY;
    const cherryGeo = new THREE.SphereGeometry(1.25, 28, 20);
    const cherryMat = this.standard(c.strawberry, 0.25);
    const cherry = new THREE.Mesh(cherryGeo, cherryMat);
    cherry.position.y = topY + 0.6;
    this.root.add(cherry);
    if (models.has("s_cherry")) {
      const hold = models.fit("s_cherry", 2.8, "h");
      hold.position.y = topY + hold.userData.hh - 0.2;
      models.swapWhenReady("s_cherry", [cherry]);
      this.root.add(hold);
    }
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, FLAG_POLE, 10);
    const poleMat = this.standard(c.chocolate, 0.5);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = topY + 1.4 + FLAG_POLE / 2;
    const flagGeo = new THREE.PlaneGeometry(FLAG_SIZE.w, FLAG_SIZE.h, 8, 2);
    const half = FLAG_SIZE.w / 2;
    flagGeo.translate(half, 0, 0);
    const flagTex = dotTexture(c.porcelain, c.strawberry);
    const flagMat = new THREE.MeshStandardMaterial({
      map: flagTex,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    this.flag = new THREE.Mesh(flagGeo, flagMat);
    const flagY = topY + 1.4 + FLAG_POLE - 0.55;
    this.flag.position.set(0.08, flagY, 0);
    this.root.add(pole, this.flag);
    this.disposables.push(cherryGeo, poleGeo, flagGeo, flagTex);
    const hugY = topY + 1.6;
    this.topPoint.set(0, hugY, 0);
    scene.add(this.root);
  }

  /** 깃발을 한 번 크게 펄럭인다(찜) */
  wave() {
    this.flap = 1;
  }

  /** from(카메라)에서 to(나)까지 사이에 낀 접시·기둥을 반투명으로(나머지는 돌아온다) */
  fadeBetween(from: THREE.Vector3, to: THREE.Vector3) {
    const { stand } = this;
    seg.subVectors(to, from);
    stand.plates.forEach((plate, i) => {
      const isBetween = crossesPlate(from, seg, plate.holeR, plate.radius, plate.top, plate.bottom);
      this.plateFades[i].want = isBetween ? FADED : 1;
    });
    const camRho = Math.hypot(from.x, from.z);
    const isInsideColumn = camRho < stand.columnR + 0.2 && from.y < stand.topY;
    const hitsColumn = crossesColumn(from, seg, stand.columnR, stand.R, stand.topY);
    this.columnFade.want = hitsColumn || isInsideColumn ? FADED : 1;
  }

  /** 깃발이 바람에 흔들리고, 흐려질 것은 흐려진다 */
  update(f: { dt: number; time: number }) {
    const settled = this.flap - f.dt * 0.6;
    this.flap = Math.max(0, settled);
    const sway = 0.25 + this.flap * 0.9,
      rate = 2.2 + this.flap * 6;
    const phase = f.time * rate;
    this.flag.rotation.y = Math.sin(phase) * sway;
    const k = ease(FADE_RATE, f.dt);
    for (const fade of [...this.plateFades, this.columnFade]) applyFade(fade, k);
  }

  /** 치운다 */
  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
    });
    for (const d of this.disposables) d.dispose();
  }

  // 무광에 가까운 표준 재질
  private standard(hex: string, roughness: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color: hex, roughness, metalness: 0 });
  }

  // 흰 도자기: 그늘(아랫면)에서도 칙칙하지 않게 조금 스스로 밝다
  private porcelain(hex: string): THREE.MeshStandardMaterial {
    const m = this.standard(hex, 0.28);
    m.envMapIntensity = 0.6;
    m.side = THREE.DoubleSide;
    m.emissive.set(hex);
    m.emissiveIntensity = 0.14;
    return m;
  }
}

/* ─── 내부 ─────────────────────────── */

// 불투명도를 바라는 값 쪽으로(1 이면 다시 불투명 그리기). 투명으로 바뀔 때만 셰이더를 다시 만든다
// (three 는 불투명 재질의 알파를 1 로 고정해 그린다 — transparent 를 바꾸면 needsUpdate 가 있어야 반투명이 된다)
function applyFade(fade: Fadable, k: number) {
  fade.opacity += (fade.want - fade.opacity) * k;
  const isSolid = fade.opacity > 0.99;
  for (const m of fade.mats) {
    if (m.transparent === isSolid) {
      m.transparent = !isSolid;
      m.depthWrite = isSolid;
      m.needsUpdate = true;
    }
    m.opacity = isSolid ? 1 : fade.opacity;
  }
}

// 평평한 접시 단면(축에서의 수평 거리 x, 높이 y): 아랫면 → 가장자리 → 테두리 입술 → 윗면 → 틈의 안쪽 벽
function plateProfile(
  holeR: number,
  radius: number,
  top: number,
  bottom: number,
  rim: number,
): THREE.Vector2[] {
  const bevel = 0.3;
  const lipOut = radius + 0.12,
    lipTop = top + rim,
    lipIn = radius - 0.25;
  const pts = [
    [holeR, bottom],
    [radius - bevel, bottom],
    [radius, bottom + bevel],
    [lipOut, lipTop],
    [lipIn, lipTop],
    [lipIn - 0.2, top],
    [holeR, top],
    [holeR, bottom],
  ];
  return pts.map(([x, y]) => new THREE.Vector2(x, y));
}

// 테두리 입술 위의 코발트 점무늬
function rimDots(
  radius: number,
  y: number,
  geo: THREE.SphereGeometry,
  mat: THREE.Material,
): THREE.InstancedMesh {
  const ringR = radius - 0.05;
  const around = (TAU * ringR) / DOT_GAP;
  const fits = Math.round(around);
  const count = Math.max(8, fits);
  const dots = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    const x = Math.sin(a) * ringR,
      z = Math.cos(a) * ringR;
    m.makeTranslation(x, y, z);
    dots.setMatrixAt(i, m);
  }
  return dots;
}

// 접시 아랫면에 붙은 코발트 고리
function underRing(ringR: number, bottom: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.TorusGeometry(ringR, 0.09, 6, 72);
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = bottom - 0.04;
  return ring;
}

// from + s·d(s 0~1) 선이 접시 판(틈과 가장자리 사이)을 지나나
function crossesPlate(
  from: THREE.Vector3,
  d: THREE.Vector3,
  holeR: number,
  radius: number,
  top: number,
  bottom: number,
): boolean {
  if (Math.abs(d.y) < 1e-6) return false;
  for (const y of [top, bottom]) {
    const s = (y - from.y) / d.y;
    if (s <= 0 || s >= 1) continue;
    const x = from.x + d.x * s,
      z = from.z + d.z * s;
    const rho = Math.hypot(x, z);
    if (rho >= holeR && rho <= radius) return true;
  }
  return false;
}

// from + s·d(s 0~1) 선이 기둥(땅 위 ~ 꼭대기)을 지나나
function crossesColumn(
  from: THREE.Vector3,
  d: THREE.Vector3,
  r: number,
  groundY: number,
  topY: number,
): boolean {
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-10) return false;
  const b = from.x * d.x + from.z * d.z;
  const c = from.x * from.x + from.z * from.z - r * r;
  const disc = b * b - a * c;
  if (disc < 0 || c < 0) return false;
  const root = Math.sqrt(disc);
  const s = (-b - root) / a;
  if (s <= 0 || s >= 1) return false;
  const y = from.y + d.y * s;
  return y > groundY - 2 && y < topY;
}

// 흰 바탕에 코발트 사선 줄무늬(기둥)
function stripeTexture(base: string, stripe: string): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    g.strokeStyle = stripe;
    g.lineWidth = 12;
    for (let k = -1; k <= 1; k++) {
      const from = k * size,
        to = from + size;
      g.beginPath();
      g.moveTo(from, size);
      g.lineTo(to, 0);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 흰 바탕에 딸기색 물방울 점(찜 깃발)
function dotTexture(base: string, dot: string): THREE.CanvasTexture {
  const w = 96,
    h = 60;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (g) {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.fillStyle = dot;
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 5; col++) {
        const shift = row % 2 === 0 ? 0 : 10;
        const x = 10 + col * 20 + shift,
          y = 10 + row * 20;
        g.beginPath();
        g.arc(x, y, 5, 0, TAU);
        g.fill();
      }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
