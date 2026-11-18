import * as THREE from "three";

import type { Services } from "../services";
import { BOX_OUTLINE_PX } from "./limebox";
import { STAGE } from "./openTuning";
import { hullMaterial } from "./outline";

// 리본 매듭: 열어 볼 수 있는 물건마다 하나씩 달린 라임 리본(조각 03 — "리본 달린 것만 열린다").
// 서른 개쯤이라 한 묶음으로 찍어 그린다(리본 한 번, 흰 테두리 한 번 — 그리기 두 번). 모델은 한 덩어리라
// 몸짓은 통째로 한다: 바람에 살랑(기울기) · 내가 가까이 오면 쫑긋(통 튐) · 멀리서 누르면 까딱 · 누르면 팽팽 ·
// 꽝이면 풀려 축 늘어짐(납작·기울기·어둡게) · 찾으면 위로 튕겨 풀렸다가 다시 묶이고 흰 하트가 얹힘

/** 리본의 모습: 묶임 · 풀림(열어 본 꽝) · 다시 묶이고 하트(찾은 물건) */
export type RibbonLook = "tied" | "undone" | "heart";

/** 리본 모델(에셋 키) */
export const RIBBON_KEY = "hide_ribbon";

/** 리본 하나 */
interface Bow {
  /** 붙은 몸(물건) · 그 안의 자리(리본 밑 가운데) · 너비(m) · 바라보는 쪽(rad) */
  body: THREE.Object3D;
  at: THREE.Vector3;
  width: number;
  yaw: number;
  /** 살랑임의 위상(리본마다 다르게) */
  phase: number;
  look: RibbonLook;
  /** 풀린 정도(0 묶임 … 1 다 풀림) */
  slack: number;
  isTaut: boolean;
  /** 몸짓의 시계(초, 하지 않으면 -1): 쫑긋 · 까딱 · 위로 튕겨 풀림 · 다시 묶임 */
  perkT: number;
  flickT: number;
  popT: number;
  tieT: number;
  /** 튕겨 풀려 지금은 없다(다시 묶일 때까지) */
  isGone: boolean;
  heart: THREE.Mesh | null;
}

/** 한 묶음에 찍는 리본 수(후보 물건은 서른 개쯤) */
const CAPACITY = 64;
/** 쫑긋할 때 키가 늘어나는 몫 · 팽팽할 때 너비·키 배수 */
const PERK_STRETCH = 0.2,
  TAUT_WIDE = 1.14,
  TAUT_TALL = 0.9;
/** 까딱 한 번에 흔들리는 횟수 */
const FLICK_WAGS = 3;
/** 튕겨 풀림: 시간(초) · 솟는 높이(리본 너비의 배) · 도는 바퀴 수 */
const POP_SECONDS = 0.35,
  POP_RISE = 2.2,
  POP_TURNS = 2;
/** 다시 묶임: 시간(초) · 넘치게 부푸는 몫 */
const TIE_SECONDS = 0.3,
  TIE_OVER = 0.25;
/** 풀리는 빠르기(1/초) · 풀린 리본이 살랑이는 몫 */
const SLACK_RATE = 9,
  SLACK_SWAY = 0.25;
/** 하트가 매듭 위로 뜨는 높이(하트 크기의 몫) */
const HEART_OVER = 0.6;

const local = new THREE.Matrix4(),
  world = new THREE.Matrix4(),
  turn = new THREE.Euler(0, 0, 0, "YXZ"),
  quat = new THREE.Quaternion(),
  pos = new THREE.Vector3(),
  size = new THREE.Vector3(),
  tint = new THREE.Color(),
  NONE = new THREE.Matrix4().makeScale(0, 0, 0);

/** 리본 묶음 */
export class Ribbons {
  private readonly bows: Bow[] = [];
  private mesh: THREE.InstancedMesh | null = null;
  private shell: THREE.InstancedMesh | null = null;
  private edge: THREE.Material | null = null;
  /** 모델의 키(너비 1 일 때) — 리본 밑을 물건에 붙이는 데 쓴다 */
  private tall = 0.78;
  private readonly sit = new THREE.Matrix4();
  private readonly heartGeo = heartGeometry();
  private readonly heartMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private readonly material: THREE.MeshStandardMaterial;

  constructor(private readonly s: Services) {
    this.material = new THREE.MeshStandardMaterial({
      color: s.mats.lime,
      emissive: s.mats.lime,
      emissiveIntensity: 0.35,
      roughness: 0.5,
    });
    s.models.need(RIBBON_KEY);
    s.models.when(RIBBON_KEY, (root) => this.build(root));
  }

  /** 리본 하나를 단다: body 안의 at(리본 밑 가운데)에 너비 width(m)로, yaw(rad) 쪽을 보게. 번호를 돌려준다 */
  add(body: THREE.Object3D, at: THREE.Vector3, width: number, yaw: number): number {
    const phase = this.bows.length * 1.7;
    this.bows.push({
      body,
      at: at.clone(),
      width,
      yaw,
      phase,
      look: "tied",
      slack: 0,
      isTaut: false,
      perkT: -1,
      flickT: -1,
      popT: -1,
      tieT: -1,
      isGone: false,
      heart: null,
    });
    return this.bows.length - 1;
  }

  /** 모습을 바꾼다. 풀림은 스르르 늘어지고, 하트는 (튕겨 풀렸던 리본이) 통 하고 다시 묶이며 얹힌다 */
  setLook(i: number, look: RibbonLook) {
    const bow = this.bows[i];
    if (bow.look === look) return;
    bow.look = look;
    bow.isTaut = false;
    if (look === "undone") return;
    bow.isGone = false;
    bow.popT = -1;
    bow.tieT = 0;
    if (look === "heart") this.addHeart(bow);
    else this.dropHeart(bow);
  }

  /** 쫑긋: 한 번 통 튄다(내가 가까이 왔다) */
  perk(i: number) {
    this.bows[i].perkT = 0;
  }

  /** 까딱: 리본만 흔들린다(멀리서 눌렀다) */
  flick(i: number) {
    this.bows[i].flickT = 0;
  }

  /** 팽팽히 당겨진다(누른 순간부터 결과가 갈릴 때까지) */
  setTaut(i: number, on: boolean) {
    this.bows[i].isTaut = on;
  }

  /** 위로 튕겨 풀린다(상자를 찾았다) — 다시 묶일 때(setLook)까지 없다 */
  pop(i: number) {
    const bow = this.bows[i];
    bow.isTaut = false;
    bow.popT = 0;
  }

  /** 모두 다시 묶는다(새 판·판이 끝났을 때) */
  reset() {
    for (const bow of this.bows) {
      bow.look = "tied";
      bow.slack = 0;
      bow.isTaut = bow.isGone = false;
      bow.perkT = bow.flickT = bow.popT = bow.tieT = -1;
      this.dropHeart(bow);
    }
  }

  /** 한 프레임 */
  update(dt: number, time: number) {
    const { mesh, shell } = this;
    if (!mesh || !shell) return;
    const R = STAGE.ribbon,
      sway = (Math.PI * 2) / R.swaySeconds,
      swayMax = THREE.MathUtils.degToRad(R.swayDegrees),
      droop = THREE.MathUtils.degToRad(R.undoneTilt),
      slackStep = dt * SLACK_RATE;
    this.bows.forEach((bow, i) => {
      const wantSlack = bow.look === "undone" ? 1 : 0,
        ease = Math.min(1, slackStep);
      bow.slack += (wantSlack - bow.slack) * ease;
      let lift = 0,
        wide = 1,
        tall = 1 + (R.undoneSquash - 1) * bow.slack,
        all = 1,
        spin = 0;
      const wave = time * sway + bow.phase,
        breeze = Math.sin(wave) * swayMax,
        loose = 1 - (1 - SLACK_SWAY) * bow.slack;
      let tilt = bow.isTaut ? 0 : breeze * loose + droop * bow.slack;
      if (bow.isTaut) {
        wide *= TAUT_WIDE;
        tall *= TAUT_TALL;
      }
      if (bow.perkT >= 0) {
        bow.perkT += dt;
        const u = bow.perkT / R.perkSeconds,
          capped = Math.min(1, u),
          angle = capped * Math.PI,
          arc = Math.sin(angle);
        lift += R.perkLift * this.tall * bow.width * arc;
        tall *= 1 + PERK_STRETCH * arc;
        if (u >= 1) bow.perkT = -1;
      }
      if (bow.flickT >= 0) {
        bow.flickT += dt;
        const raw = bow.flickT / R.flickSeconds,
          u = Math.min(1, raw),
          angle = u * Math.PI * 2 * FLICK_WAGS,
          wag = Math.sin(angle) * (1 - u);
        tilt += THREE.MathUtils.degToRad(R.flickDegrees) * wag;
        if (u >= 1) bow.flickT = -1;
      }
      if (bow.popT >= 0) {
        bow.popT += dt;
        const raw = bow.popT / POP_SECONDS,
          u = Math.min(1, raw);
        lift += POP_RISE * bow.width * u;
        spin = u * Math.PI * 2 * POP_TURNS;
        all = 1 - u;
        if (u >= 1) {
          bow.popT = -1;
          bow.isGone = true;
        }
      }
      if (bow.tieT >= 0) {
        bow.tieT += dt;
        const raw = bow.tieT / TIE_SECONDS,
          u = Math.min(1, raw),
          angle = u * Math.PI,
          over = Math.sin(angle) * TIE_OVER,
          grown = u * 2;
        all = Math.min(1, grown) + over;
        if (u >= 1) bow.tieT = -1;
      }
      if (bow.heart) {
        const heartSize = bow.heart.userData.size * Math.min(1, all);
        bow.heart.scale.setScalar(heartSize);
      }
      if (bow.isGone) {
        mesh.setMatrixAt(i, NONE);
        return;
      }
      const span = bow.width * all,
        yaw = bow.yaw + spin,
        y = bow.at.y + lift,
        high = span * tall,
        across = span * wide;
      turn.set(tilt, yaw, 0);
      quat.setFromEuler(turn);
      pos.set(bow.at.x, y, bow.at.z);
      size.set(span, high, across);
      local.compose(pos, quat, size).multiply(this.sit);
      bow.body.updateWorldMatrix(true, false);
      world.multiplyMatrices(bow.body.matrixWorld, local);
      mesh.setMatrixAt(i, world);
      const shade = 1 - R.undoneDim * bow.slack;
      tint.setScalar(shade);
      mesh.setColorAt(i, tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    for (const bow of this.bows) this.dropHeart(bow);
    for (const m of [this.mesh, this.shell]) {
      if (!m) continue;
      m.removeFromParent();
      m.dispose();
    }
    this.mesh?.geometry.dispose();
    this.material.dispose();
    this.edge?.dispose();
    this.heartGeo.dispose();
    this.heartMat.dispose();
  }

  /* ─── 내부 ─────────────────────────── */

  // 모델이 왔다: 한 덩어리 메시의 모양을 가져와 너비 1(가운데가 원점, 얇은 쪽이 앞)로 맞추고 묶음 둘(리본·흰 테두리)을 만든다
  private build(root: THREE.Object3D) {
    const source = firstMesh(root);
    if (!source || this.mesh) return;
    root.updateMatrixWorld(true);
    const toRoot = root.matrixWorld.clone().invert().multiply(source.matrixWorld),
      geometry = source.geometry.clone().applyMatrix4(toRoot);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!,
      center = new THREE.Vector3(),
      extent = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(extent);
    geometry.translate(-center.x, -center.y, -center.z);
    // 넓은 쪽을 z 로(얇은 쪽이 앞 x)
    if (extent.x > extent.z) {
      const quarter = Math.PI / 2;
      geometry.rotateY(quarter);
      extent.set(extent.z, extent.y, extent.x);
    }
    const unit = 1 / extent.z;
    geometry.scale(unit, unit, unit);
    this.tall = extent.y * unit;
    const half = this.tall / 2;
    this.sit.makeTranslation(0, half, 0);
    const mesh = new THREE.InstancedMesh(geometry, this.material, CAPACITY),
      edge = hullMaterial(0xffffff, BOX_OUTLINE_PX).material,
      shell = new THREE.InstancedMesh(geometry, edge, CAPACITY);
    // 테두리는 리본과 같은 자리 값을 나눠 쓴다(따로 채우지 않는다)
    shell.instanceMatrix = mesh.instanceMatrix;
    shell.renderOrder = -1;
    for (const m of [mesh, shell]) {
      m.count = this.bows.length;
      // 찍은 것들이 무대 곳곳에 흩어져 있어 모양 하나의 테두리 공으로는 시야를 가릴 수 없다
      m.frustumCulled = false;
      this.s.scene.add(m);
    }
    for (let i = 0; i < this.bows.length; i++) {
      mesh.setMatrixAt(i, NONE);
      tint.setScalar(1);
      mesh.setColorAt(i, tint);
    }
    this.mesh = mesh;
    this.shell = shell;
    this.edge = edge;
  }

  private addHeart(bow: Bow) {
    if (bow.heart) return;
    const heart = new THREE.Mesh(this.heartGeo, this.heartMat),
      scale = STAGE.ribbon.heart * bow.width,
      over = this.tall * bow.width + scale * HEART_OVER,
      y = bow.at.y + over;
    heart.userData.size = scale;
    heart.position.set(bow.at.x, y, bow.at.z);
    // 하트는 리본과 같은 쪽을 본다(하트 모양은 z 를 보고 그려져 있다)
    heart.rotation.y = bow.yaw + Math.PI / 2;
    heart.scale.setScalar(0);
    bow.body.add(heart);
    bow.heart = heart;
  }

  private dropHeart(bow: Bow) {
    bow.heart?.removeFromParent();
    bow.heart = null;
  }
}

/* ─── 내부 ─────────────────────────── */

function firstMesh(root: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((o) => {
    if (!found && o instanceof THREE.Mesh) found = o;
  });
  return found;
}

// 작은 하트(너비 1, 가운데가 원점, 도톰하게)
function heartGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.45);
  shape.bezierCurveTo(-0.7, 0, -0.5, 0.55, 0, 0.2);
  shape.bezierCurveTo(0.5, 0.55, 0.7, 0, 0, -0.45);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geometry.center();
  return geometry;
}
