import * as THREE from "three";

import type { Thing } from "../core/frame";
import type { StandShape } from "./stand";
import type { TeaTuning } from "./teaTuning";

// 코드로 짓는 무대: 딸기우유 별, 크림 길, 흰 도자기 접시 셋(코발트 점무늬 테두리), 사선 줄무늬 기둥, 꼭대기 체리와 찜 기둥 깃발.
// 접시는 스탠드 축(+y)을 도는 단면(lathe)이라 별과 같은 중심의 둥근 판이 된다(stand.ts 와 같은 모양)

/** 접시 가운데 기둥 둘레의 틈(m) — 상자는 지나가고 사람은 못 지나간다(사람은 기둥에서 몸 반지름만큼 떨어진다) */
export const PLATE_HOLE = 0.6;

const TAU = Math.PI * 2;

/** 접시 단면의 둥근 정도(점 수) */
const ARC_STEPS = 40;
/** 테두리 점무늬 사이(m) */
const DOT_GAP = 1.15;
/** 접시 아랫면 고리가 놓이는 자리(가장자리까지의 몫) */
const UNDER_RINGS = [0.55, 0.86] as const;
/** 깃발 기둥 높이(m, 꼭대기 위로) */
const FLAG_POLE = 3.2;

/** 코드로 짓는 무대 */
export class StandMesh implements Thing {
  /** 가리는 것(접시·기둥) — 상자가 보이는지 잴 때 쓴다 */
  readonly blockers: THREE.Object3D[] = [];
  /** 찜 기둥 꼭대기의 깃발(찜하면 펄럭) */
  readonly flag: THREE.Mesh;
  /** 꼭대기 체리 윗면의 세계 자리 */
  readonly topPoint: THREE.Vector3;
  private readonly root = new THREE.Group();
  private readonly disposables: { dispose(): void }[] = [];
  private flap = 0;

  constructor(
    scene: THREE.Scene,
    private readonly stand: StandShape,
    t: TeaTuning,
  ) {
    const c = t.colors,
      R = stand.R;
    // ---- 별: 딸기우유 땅과 스탠드를 두르는 크림 길 ----
    const planetGeo = new THREE.SphereGeometry(R, 96, 64);
    const planetMat = this.standard(c.ground, 0.85);
    const planet = new THREE.Mesh(planetGeo, planetMat);
    this.root.add(planet);
    const firstPlate = stand.plates[0];
    const pathFrom = (firstPlate.half + 1.5) / R,
      pathWidth = 2.6 / R;
    const pathR = R + 0.03;
    const pathGeo = new THREE.SphereGeometry(pathR, 96, 4, 0, TAU, pathFrom, pathWidth);
    const pathMat = this.standard(c.path, 0.9);
    const path = new THREE.Mesh(pathGeo, pathMat);
    this.root.add(path);
    this.disposables.push(planetGeo, pathGeo);
    // ---- 접시 셋 ----
    const porcelain = this.standard(c.porcelain, 0.28);
    porcelain.envMapIntensity = 0.6;
    porcelain.side = THREE.DoubleSide;
    // 아랫면이 그늘에서도 칙칙하지 않게 조금 스스로 밝다
    porcelain.emissive.set(c.porcelain);
    porcelain.emissiveIntensity = 0.14;
    const cobalt = this.standard(c.cobalt, 0.35);
    const dotGeo = new THREE.SphereGeometry(0.16, 10, 8);
    this.disposables.push(dotGeo);
    for (const plate of stand.plates) {
      const profile = plateProfile(stand, plate.h, plate.bottom, plate.ang, t.stand.rim);
      const geo = new THREE.LatheGeometry(profile, 72);
      this.disposables.push(geo);
      const mesh = new THREE.Mesh(geo, porcelain);
      this.root.add(mesh);
      this.blockers.push(mesh);
      const dots = rimDots(stand, plate.h, plate.ang, dotGeo, cobalt);
      this.root.add(dots);
      // 아랫면의 코발트 고리 둘(밑에서 올려다볼 때 접시인 줄 알게)
      for (const share of UNDER_RINGS) {
        const ring = underRing(stand, plate.bottom, plate.ang, share, cobalt);
        this.root.add(ring);
        this.disposables.push(ring.geometry);
      }
    }
    // ---- 기둥: 땅에서 꼭대기까지, 흰 바탕에 코발트 사선 ----
    const columnTex = stripeTexture(c.porcelain, c.cobalt);
    const columnLength = t.stand.top + 0.5;
    const columnGeo = new THREE.CylinderGeometry(stand.columnR, stand.columnR, columnLength, 28);
    const turns = columnLength / 2.4;
    columnTex.repeat.set(3, turns);
    const columnMat = new THREE.MeshStandardMaterial({ map: columnTex, roughness: 0.3 });
    const column = new THREE.Mesh(columnGeo, columnMat);
    const columnMid = R + columnLength / 2 - 0.5;
    column.position.set(0, columnMid, 0);
    this.root.add(column);
    this.blockers.push(column);
    this.disposables.push(columnGeo, columnTex, columnMat);
    // ---- 꼭대기: 체리(딸기)와 초콜릿 꼭지, 찜 기둥과 깃발 ----
    const topY = R + t.stand.top;
    const cherryGeo = new THREE.SphereGeometry(1.25, 28, 20);
    const cherryMat = this.standard(c.strawberry, 0.25);
    const cherry = new THREE.Mesh(cherryGeo, cherryMat);
    cherry.position.y = topY + 0.6;
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, FLAG_POLE, 10);
    const poleMat = this.standard(c.chocolate, 0.5);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    const poleMid = topY + 1.4 + FLAG_POLE / 2;
    pole.position.set(0, poleMid, 0);
    const flagGeo = new THREE.PlaneGeometry(1.5, 0.9, 8, 2);
    flagGeo.translate(0.75, 0, 0);
    const flagMat = this.standard(c.lavender, 0.6);
    this.flag = new THREE.Mesh(flagGeo, flagMat);
    (this.flag.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    const flagY = topY + 1.4 + FLAG_POLE - 0.5;
    this.flag.position.set(0.08, flagY, 0);
    this.root.add(cherry, pole, this.flag);
    this.disposables.push(cherryGeo, poleGeo, flagGeo);
    this.topPoint = new THREE.Vector3(0, 0, 0);
    this.topPoint.y = topY + 1.8;
    scene.add(this.root);
  }

  /** 깃발을 한 번 크게 펄럭인다(찜) */
  wave() {
    this.flap = 1;
  }

  /** 깃발이 바람에 흔들린다 */
  update(f: { dt: number; time: number }) {
    const settled = this.flap - f.dt * 0.6;
    this.flap = Math.max(0, settled);
    const sway = 0.25 + this.flap * 0.9,
      phase = f.time * (2.2 + this.flap * 6);
    this.flag.rotation.y = Math.sin(phase) * sway;
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
}

/* ─── 내부 ─────────────────────────── */

// 접시 단면(축에서의 거리 x, 높이 y): 기둥 둘레 틈에서 윗면을 따라 가장자리로, 테두리 입술을 넘어 아랫면으로 돌아온다
function plateProfile(
  stand: StandShape,
  top: number,
  bottom: number,
  ang: number,
  rim: number,
): THREE.Vector2[] {
  const R = stand.R;
  const holeR = stand.columnR + PLATE_HOLE;
  const topR = R + top,
    bottomR = R + bottom;
  const holeTop = holeR / topR,
    holeBottom = holeR / bottomR;
  const pts: THREE.Vector2[] = [];
  const arc = (radius: number, from: number, to: number) => {
    for (let i = 0; i <= ARC_STEPS; i++) {
      const a = from + ((to - from) * i) / ARC_STEPS;
      const point = polar(a, radius);
      pts.push(point);
    }
  };
  // 아랫면(안 → 밖), 가장자리, 입술, 윗면(밖 → 안): 바깥을 보는 면이 되게 아래부터 돈다
  arc(bottomR, holeBottom, ang);
  const lipOut = ang + 0.25 / topR;
  const lipR = topR + rim;
  const lipTip = polar(lipOut, lipR),
    lipBase = polar(ang, lipR);
  pts.push(lipTip, lipBase);
  arc(topR, ang, holeTop);
  // 기둥 둘레 틈의 안쪽 벽으로 닫는다
  const first = pts[0].clone();
  pts.push(first);
  return pts;
}

// 축에서 각 a, 중심에서 radius 인 단면 점(x 축에서의 거리, 높이)
function polar(a: number, radius: number): THREE.Vector2 {
  const x = Math.sin(a) * radius,
    y = Math.cos(a) * radius;
  return new THREE.Vector2(x, y);
}

// 테두리 입술 위의 코발트 점무늬
function rimDots(
  stand: StandShape,
  top: number,
  ang: number,
  geo: THREE.SphereGeometry,
  mat: THREE.Material,
): THREE.InstancedMesh {
  const radius = stand.R + top + 0.2;
  const ringR = Math.sin(ang) * radius,
    y = Math.cos(ang) * radius;
  const around = (TAU * ringR) / DOT_GAP;
  const fits = Math.round(around);
  const count = Math.max(8, fits);
  const dots = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = Math.sin(a) * ringR,
      z = Math.cos(a) * ringR;
    m.makeTranslation(x, y, z);
    dots.setMatrixAt(i, m);
  }
  return dots;
}

// 접시 아랫면에 붙은 코발트 고리(가장자리까지의 share 몫 자리)
function underRing(
  stand: StandShape,
  bottom: number,
  ang: number,
  share: number,
  mat: THREE.Material,
): THREE.Mesh {
  const radius = stand.R + bottom - 0.04;
  const a = ang * share;
  const ringR = Math.sin(a) * radius,
    y = Math.cos(a) * radius;
  const geo = new THREE.TorusGeometry(ringR, 0.09, 6, 72);
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  return ring;
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
      g.beginPath();
      const from = k * size,
        to = from + size;
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
