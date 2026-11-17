import * as THREE from "three";

import { LIME, S } from "../settings";
import { FWD } from "../world/sphere";

// 생물 발밑 고리: 누를 수 있는 생물(가까이 있고 화면 안)의 발밑(하늘 생물은 그 아래 땅)에 얇은 라임 고리.
// 선 굵기는 폰에서 RING_PX(거리와 상관없이 — 비스듬히 누운 땅이라 납작해지는 만큼 조금 굵힌다), 1초에 한 번 숨 쉬듯 ±8% 커졌다 작아진다.
// 켜질 때 바깥에서 0.3초에 조여 들고, 꺼질 때 0.3초에 옅어진다. 누르면 안으로 조여들며 팟 터진다(반짝이는 helpers 가)

/** 선 굵기(폰 px) · 숨쉬기 폭 · 켜고 끄는 시간(초) · 켜질 때 처음 크기(배) · 누르면 조여드는 시간(초) */
const RING_PX = 3,
  BREATH = 0.08,
  FADE_SECONDS = 0.3,
  ENTER_SCALE = 1.6,
  IMPLODE_SECONDS = 0.15;
/** 땅에서 띄우는 높이(m) · 비스듬히 볼 때 굵기를 보태는 한계(사인 값 아래로는 더 굵히지 않는다) */
const LIFT = 0.12,
  SLANT_MIN = 0.4;

const RING_VERTEX = `varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const RING_FRAGMENT = `uniform vec3 uColor;
uniform float uOpacity;
uniform float uInner;
varying vec2 vP;
void main() {
  float d = length(vP);
  float aa = fwidth(d) * 1.2;
  float a = smoothstep(uInner - aa, uInner + aa, d) * (1.0 - smoothstep(1.0 - aa, 1.0 + aa, d));
  if (a <= 0.001) discard;
  gl_FragColor = vec4(uColor, uOpacity * a);
}`;

const eye = new THREE.Vector3(),
  white = new THREE.Color(0xffffff);

/** 발밑 고리 하나 */
export class FootRing {
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly uColor = { value: new THREE.Color(LIME) };
  private readonly uOpacity = { value: 0 };
  private readonly uInner = { value: 0.9 };
  /** 보이는 정도(0..1)·켜졌나 · 켜진 뒤 흐른 시간(초) · 조여드는 중(초, 아니면 -1) · 밝기 배수 */
  private k = 0;
  private isOn = false;
  private onT = 0;
  private implodeT = -1;
  private bright = 1;
  private radius = 1;
  private readonly n = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: RING_VERTEX,
      fragmentShader: RING_FRAGMENT,
      uniforms: { uColor: this.uColor, uOpacity: this.uOpacity, uInner: this.uInner },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.PlaneGeometry(2.2, 2.2);
    this.mesh = new THREE.Mesh(plane, mat);
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** 켜졌나(조여 들어 터지는 중은 아니다) */
  get on(): boolean {
    return this.isOn;
  }

  /** 켠다·끈다(켤 때마다 바깥에서 조여 든다) */
  set(on: boolean) {
    if (on === this.isOn) return;
    this.isOn = on;
    if (on) {
      this.onT = 0;
      this.implodeT = -1;
    }
  }

  /** 밝기 배수(부르러 온 생물은 1.5배 — 굵고 하얗게 밝다) */
  setBright(k: number) {
    this.bright = k;
  }

  /** 놓을 자리: 땅 위 v(단위 벡터), 땅 높이 ground(m), 반지름(m) */
  place(v: THREE.Vector3, ground: number, radius: number) {
    this.n.copy(v).normalize();
    const lift = S.R + ground + LIFT;
    this.mesh.position.copy(this.n).multiplyScalar(lift);
    this.mesh.quaternion.setFromUnitVectors(FWD, this.n);
    this.radius = radius;
  }

  /** 바로 끈다(판이 끝났다 — 판 밖에서는 고리를 그리지 않는다) */
  hide() {
    this.isOn = false;
    this.k = 0;
    this.implodeT = -1;
    this.mesh.visible = false;
  }

  /** 눌렸다: 안으로 조여들며 사라진다 */
  implode() {
    this.isOn = false;
    this.implodeT = 0;
  }

  /** 한 프레임 */
  update(dt: number, time: number, camera: THREE.PerspectiveCamera, viewH: number) {
    let scale = 1;
    if (this.implodeT >= 0) {
      this.implodeT += dt;
      const u = this.implodeT / IMPLODE_SECONDS;
      if (u >= 1) {
        this.implodeT = -1;
        this.k = 0;
      } else scale = 1 - 0.85 * u;
    } else {
      const want = this.isOn ? 1 : 0,
        step = dt / FADE_SECONDS;
      const up = this.k + step,
        down = this.k - step;
      this.k = want > this.k ? Math.min(1, up) : Math.max(0, down);
      if (this.isOn) {
        this.onT += dt;
        const entered = this.onT / FADE_SECONDS,
          enter = Math.min(1, entered),
          closing = 1 - enter * enter * (3 - 2 * enter);
        scale = 1 + (ENTER_SCALE - 1) * closing;
      }
    }
    const isShown = this.k > 0.01 || this.implodeT >= 0;
    this.mesh.visible = isShown;
    if (!isShown) return;
    const breathPhase = time * Math.PI * 2,
      breath = 1 + BREATH * Math.sin(breathPhase) * (this.bright > 1 ? 2 : 1),
      r = this.radius * scale * breath;
    this.mesh.scale.setScalar(r);
    // 폰에서 RING_PX 굵기: 거리에 따라 m 로 바꾸고, 비스듬히 누워 납작해지는 만큼 조금 굵힌다
    camera.getWorldPosition(eye);
    const dist = eye.distanceTo(this.mesh.position),
      halfFov = (camera.fov * Math.PI) / 360,
      perPx = (2 * dist * Math.tan(halfFov)) / viewH,
      facing = eye.sub(this.mesh.position).normalize().dot(this.n),
      slant = Math.abs(facing),
      flat = Math.max(SLANT_MIN, slant),
      width = (RING_PX * this.bright * perPx) / flat,
      inner = 1 - width / r;
    this.uInner.value = Math.max(0.3, inner);
    const strong = 0.9 * this.bright,
      peak = Math.min(1, strong);
    this.uOpacity.value = peak * this.k;
    this.uColor.value.set(LIME);
    if (this.bright > 1) this.uColor.value.lerp(white, 0.35);
  }

  /** 지금 반지름(m — 누르는 자리를 정한다) */
  get size(): number {
    return this.radius;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
