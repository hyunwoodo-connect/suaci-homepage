import * as THREE from "three";

import type { ModelLibrary } from "../models/library";
import { S } from "../settings";

// 숨는 애(라임 상자) 하나. 뼈대가 없어 움직임은 모두 여기서 몸 전체를 옮기고 늘이고 돌려서 낸다:
// 숨 쉬기(3% 찌그러졌다 펴짐) · 재채기(0.3m 폴짝, 0.25초) · 들킴(0.6m 뛰며 한 바퀴, 0.5초) · 고개 내밀기(옆으로 0.4m, 0.8초) ·
// 들썩(언박싱 첫 번) · 터지기(두 번째 — 작아지며 사라진다) · 떨어지기(보너스 상자가 하늘에서) · 걷기(통통 뛰며 줄을 따라온다)

/** 상자 키(아바타 키 1.5m 의 0.7배) */
export const BOX_HEIGHT = 1.05;
/** 상자 모델 키 */
export const LIMEBOX = "limebox";

/** 숨쉬기 한 번(초)·찌그러지는 몫 */
const BREATH_PERIOD = 2.2,
  BREATH_SQUASH = 0.03;
/** 재채기·들킴·들썩·터지기(초)와 높이(m) */
const SNEEZE_TIME = 0.25,
  SNEEZE_HOP = 0.3,
  LEAP_TIME = 0.5,
  LEAP_HOP = 0.6,
  JIGGLE_TIME = 0.4,
  JIGGLE_HOP = 0.14,
  POP_TIME = 0.28;
/** 고개 내밀기: 4~7초마다 0.8초 동안 옆으로 0.4m */
const PEEK_MIN = 4,
  PEEK_SPAN = 3,
  PEEK_TIME = 0.8,
  PEEK_REACH = 0.4;
/** 떨어질 때 중력(m/s²)과 한 번 튀는 몫 */
const DROP_GRAVITY = 22,
  DROP_BOUNCE = 0.28;
/** 걸을 때 통통 뛰는 높이(m)와 빠르기 */
const WALK_HOP = 0.2,
  WALK_RATE = 2.6;
/** 금빛 리본(흰 부분만 물들인다) */
const GOLD_GLSL = `// 금빛 리본
      { float gmx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), gmn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
      float gs = (gmx - gmn) / max(gmx, 0.001), isWhite = step(gs, 0.2) * step(0.45, gmx);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.76, 0.22) * (0.5 + 0.55 * gmx), isWhite); }
      #include <alphamap_fragment>`;

const bx = new THREE.Vector3(),
  bf = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  spinQ = new THREE.Quaternion(),
  tiltQ = new THREE.Quaternion(),
  tiltE = new THREE.Euler(),
  axis = new THREE.Vector3(),
  YAXIS = new THREE.Vector3(0, 1, 0);

/** 라임 상자 하나 */
export class LimeBox {
  /** 자리(이 그룹을 행성 위에 놓는다) */
  readonly g = new THREE.Group();
  /** 행성 위 자리(단위 벡터)와 바닥 높이(땅 또는 꼭대기, m) */
  readonly v = new THREE.Vector3();
  a = 0;
  /** 보는 쪽(접선 단위 벡터) */
  readonly f = new THREE.Vector3(1, 0, 0);
  /** 고개 내미는 쪽(접선 단위 벡터, 0 이면 내밀지 않는다) */
  readonly peekDir = new THREE.Vector3();
  /** 바닥 위로 떠 있는 높이(떨어지는 중) */
  private air = 0;
  private vy = 0;
  private dropping = false;
  private readonly hold: THREE.Group;
  /** 키의 반 */
  private readonly hh: number;
  private readonly ph: number;
  private sneezeT = -1;
  private leapT = -1;
  private jiggleT = -1;
  private popT = -1;
  private peekWait: number;
  private peekT = -1;
  private walk = 0;
  private walkPhase = 0;
  private extraY = 0;

  /** scale: 키 배수(보너스 1.4·안에서 나오는 작은 상자), gold: 리본을 금빛으로 */
  constructor(
    models: ModelLibrary,
    scene: THREE.Scene,
    readonly scale = 1,
    gold = false,
    private readonly rand: () => number = Math.random,
  ) {
    const height = BOX_HEIGHT * scale;
    const opts = gold ? { ownLime: true, onArrive: goldRibbon } : {};
    this.hold = models.fit(LIMEBOX, height, "h", opts);
    this.hh = this.hold.userData.hh;
    this.g.add(this.hold);
    scene.add(this.g);
    this.ph = rand() * Math.PI * 2;
    this.peekWait = this.nextPeek();
  }

  /** 보이나 */
  get visible(): boolean {
    return this.g.visible;
  }
  set visible(on: boolean) {
    this.g.visible = on;
  }

  /** 이 자리(v 단위 벡터, 바닥 높이 a)에 face 쪽을 보고 선다. 하던 짓은 그친다 */
  put(v: THREE.Vector3, a: number, face: THREE.Vector3) {
    this.v.copy(v).normalize();
    this.a = a;
    this.faceTo(face);
    this.air = 0;
    this.vy = 0;
    this.dropping = false;
    this.sneezeT = this.leapT = this.jiggleT = this.popT = this.peekT = -1;
    this.g.scale.setScalar(1);
    this.g.visible = true;
  }

  /** 보는 쪽을 바꾼다(접선으로 눕힌다) */
  faceTo(face: THREE.Vector3) {
    const radial = face.dot(this.v);
    this.f.copy(face).addScaledVector(this.v, -radial);
    if (this.f.lengthSq() < 1e-8) return;
    this.f.normalize();
  }

  /** 옆으로 고개를 내밀 쪽(없으면 0 벡터) */
  setPeek(dir: THREE.Vector3 | null) {
    if (dir) this.peekDir.copy(dir);
    else this.peekDir.set(0, 0, 0);
    this.peekT = -1;
  }

  /** 가운데의 세계 자리 */
  center(out: THREE.Vector3): THREE.Vector3 {
    const radius = S.R + this.a + this.air + this.hh;
    return out.copy(this.v).multiplyScalar(radius);
  }

  /** 재채기: 폴짝(0.25초) */
  sneeze() {
    this.sneezeT = 0;
  }

  /** 들킴: 뛰어오르며 한 바퀴(0.5초) */
  leap() {
    this.leapT = 0;
  }

  /** 들썩(언박싱 첫 번) */
  jiggle() {
    this.jiggleT = 0;
  }

  /** 터진다(작아지며 사라진다) */
  pop() {
    this.popT = 0;
  }

  /** 터지는 중이거나 사라졌나 */
  get isPopping(): boolean {
    return this.popT >= 0;
  }

  /** 이만큼(m) 위에서 떨어뜨린다(땅에 닿으면 한 번 튄다) */
  dropFrom(height: number) {
    this.air = height;
    this.vy = 0;
    this.dropping = true;
  }

  /** 떨어지는 중인가 */
  get isDropping(): boolean {
    return this.dropping;
  }

  /** 걷는 빠르기(0..1 — 통통 뛰는 세기) */
  setWalk(k: number) {
    this.walk = k;
  }

  /** 한 프레임: 숨쉬기·하던 짓을 몸에 입히고 행성 위에 놓는다 */
  update(dt: number, time: number) {
    const g = this.g;
    if (!g.visible) return;
    this.extraY = 0;
    const breathTime = time + this.ph;
    let spin = 0,
      tilt = 0,
      squash = breathAt(breathTime);
    if (this.sneezeT >= 0) {
      this.sneezeT += dt;
      const u = this.sneezeT / SNEEZE_TIME;
      if (u >= 1) this.sneezeT = -1;
      else this.extraY += arc(u) * SNEEZE_HOP;
    }
    if (this.leapT >= 0) {
      this.leapT += dt;
      const u = this.leapT / LEAP_TIME;
      if (u >= 1) this.leapT = -1;
      else {
        this.extraY += arc(u) * LEAP_HOP;
        const turn = smooth(u);
        spin = turn * Math.PI * 2;
      }
    }
    if (this.jiggleT >= 0) {
      this.jiggleT += dt;
      const u = this.jiggleT / JIGGLE_TIME;
      if (u >= 1) this.jiggleT = -1;
      else {
        this.extraY += arc(u) * JIGGLE_HOP;
        const wobblePhase = u * Math.PI * 5,
          wobble = Math.sin(wobblePhase);
        tilt = wobble * 0.16 * (1 - u);
      }
    }
    if (this.walk > 0.05) {
      this.walkPhase += dt * WALK_RATE * Math.PI * 2;
      const wave = Math.sin(this.walkPhase),
        step = Math.abs(wave);
      this.extraY += step * WALK_HOP * this.walk;
    }
    this.fall(dt);
    let size = 1;
    if (this.popT >= 0) {
      this.popT += dt;
      const u = this.popT / POP_TIME;
      if (u >= 1) {
        g.visible = false;
        return;
      }
      // 먼저 납작 눌렸다가 부풀며 사라진다
      squash = u < 0.4 ? 1 - 0.3 * (u / 0.4) : 0.7 + 0.6 * ((u - 0.4) / 0.6);
      size = u < 0.4 ? 1 : 1 - (u - 0.4) / 0.6;
    }
    // 고개 내밀기
    let peek = 0;
    if (this.peekDir.lengthSq() > 0) {
      if (this.peekT < 0) {
        this.peekWait -= dt;
        if (this.peekWait <= 0) this.peekT = 0;
      } else {
        this.peekT += dt;
        const u = this.peekT / PEEK_TIME;
        if (u >= 1) {
          this.peekT = -1;
          this.peekWait = this.nextPeek();
        } else {
          const peekPhase = u * Math.PI;
          peek = Math.sin(peekPhase) * PEEK_REACH;
        }
      }
    }
    const widen = 1 + (1 - squash) * 0.5;
    this.hold.scale.set(widen, squash, widen);
    this.hold.position.y = this.hh * squash;
    g.scale.setScalar(size);
    // 놓기: 위가 v, 앞(모델 +x)이 f
    bx.crossVectors(this.f, this.v).normalize();
    bf.crossVectors(this.v, bx).normalize();
    m4.makeBasis(bf, this.v, bx);
    g.quaternion.setFromRotationMatrix(m4);
    if (spin) {
      spinQ.setFromAxisAngle(YAXIS, spin);
      g.quaternion.multiply(spinQ);
    }
    if (tilt) {
      tiltE.set(tilt, 0, 0);
      tiltQ.setFromEuler(tiltE);
      g.quaternion.multiply(tiltQ);
    }
    const radius = S.R + this.a + this.air + this.extraY;
    g.position.copy(this.v).multiplyScalar(radius);
    if (peek) g.position.addScaledVector(this.peekDir, peek);
  }

  /** v 에서 to(단위 벡터) 쪽으로 speed(m/s) 만큼 간다. 남은 거리(m)를 돌려준다 */
  stepToward(to: THREE.Vector3, speed: number, dt: number): number {
    const angle = this.v.angleTo(to),
      dist = angle * S.R;
    if (dist < 1e-4) return 0;
    const reach = speed * dt,
      move = Math.min(dist, reach),
      stepAngle = move / S.R;
    axis.crossVectors(this.v, to).normalize();
    // 나아가는 쪽을 본다
    bf.crossVectors(axis, this.v);
    this.faceTo(bf);
    this.v.applyAxisAngle(axis, stepAngle).normalize();
    return dist - move;
  }

  /** 치운다(모델 재질은 모델 자리가 치운다) */
  dispose() {
    this.g.removeFromParent();
  }

  private fall(dt: number) {
    if (!this.dropping) return;
    this.vy -= DROP_GRAVITY * dt;
    this.air += this.vy * dt;
    if (this.air > 0) return;
    this.air = 0;
    // 한 번만 튀고 선다
    const rebound = -this.vy * DROP_BOUNCE;
    if (rebound > 2) this.vy = rebound;
    else {
      this.vy = 0;
      this.dropping = false;
    }
  }

  private nextPeek(): number {
    const roll = this.rand();
    return PEEK_MIN + roll * PEEK_SPAN;
  }
}

/** 숨쉬기: 1 에서 0.97 사이로 천천히 오르내린다 */
export function breathAt(time: number): number {
  const phase = (time / BREATH_PERIOD) * Math.PI * 2;
  const wave = 0.5 + 0.5 * Math.sin(phase);
  return 1 - BREATH_SQUASH * wave;
}

/* ─── 내부 ─────────────────────────── */

// 0..1 에서 솟았다 내려오는 곡선(꼭대기 1)
function arc(u: number): number {
  return 4 * u * (1 - u);
}

function smooth(u: number): number {
  return u * u * (3 - 2 * u);
}

// 보너스 상자: 흰 리본만 금빛으로 물들인다(재질은 이 틀만의 복제본이다)
function goldRibbon(model: THREE.Object3D) {
  model.traverse((c) => {
    if (!(c instanceof THREE.Mesh)) return;
    const mat = c.material as THREE.MeshStandardMaterial;
    const base = mat.onBeforeCompile,
      baseKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, renderer) => {
      base.call(mat, sh, renderer);
      sh.fragmentShader = sh.fragmentShader.replace("#include <alphamap_fragment>", GOLD_GLSL);
    };
    mat.customProgramCacheKey = () => {
      const key = baseKey.call(mat);
      return key + "-gold";
    };
    mat.needsUpdate = true;
  });
}
