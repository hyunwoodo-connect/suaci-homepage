import * as THREE from "three";

// 반짝이(MAP-03 2장): 케이크의 반짝이 분수·나선 반짝이·빛 기둥 안의 반짝이를 한 번에 그리는 점 묶음(Points).
// 점마다 색·모양(점·십자)·크기(m)·밝기를 갖고, 멀어져도 몇 픽셀은 남아 멀리서도 보인다(안개를 받지 않는다)

/** 반짝이 모양: 둥근 점 */
export const SPARKLE_DOT = 0;
/** 반짝이 모양: 십자 */
export const SPARKLE_CROSS = 1;

/** 멀리서도 남는 가장 작은 크기(px) */
const MIN_PX = 2.2;

/** 반짝이 점 묶음: 칸마다 자리·색·모양·크기·밝기를 쓰고 commit 으로 올린다 */
export class SparklePoints {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly shape: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;

  /** n: 칸 수 */
  constructor(readonly n: number) {
    const triple = n * 3;
    this.pos = new Float32Array(triple);
    this.col = new Float32Array(triple);
    this.shape = new Float32Array(n);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    const attrs: [string, Float32Array, number][] = [
      ["position", this.pos, 3],
      ["aColor", this.col, 3],
      ["aShape", this.shape, 1],
      ["aSize", this.size, 1],
      ["aAlpha", this.alpha, 1],
    ];
    for (const [name, array, width] of attrs) {
      const attr = new THREE.BufferAttribute(array, width);
      geo.setAttribute(name, attr);
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 }, uMinPx: { value: MIN_PX } },
      transparent: true,
      depthWrite: false,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  /** i 번째 칸 */
  set(i: number, p: THREE.Vector3, color: THREE.Color, shape: number, size: number, alpha: number) {
    const at = i * 3;
    this.pos[at] = p.x;
    this.pos[at + 1] = p.y;
    this.pos[at + 2] = p.z;
    this.col[at] = color.r;
    this.col[at + 1] = color.g;
    this.col[at + 2] = color.b;
    this.shape[i] = shape;
    this.size[i] = size;
    this.alpha[i] = alpha;
  }

  /** i 번째를 보이지 않게 */
  hide(i: number) {
    this.alpha[i] = 0;
  }

  /** 바뀐 칸을 올린다 · 화면 높이(px)와 시야각으로 거리마다 크기를 맞춘다 */
  commit(viewHeight: number, fovDeg: number) {
    const geo = this.points.geometry;
    for (const name of ["position", "aColor", "aShape", "aSize", "aAlpha"])
      geo.getAttribute(name).needsUpdate = true;
    const half = THREE.MathUtils.degToRad(fovDeg) / 2;
    const scale = viewHeight / (2 * Math.tan(half));
    this.points.material.uniforms.uScale.value = scale;
  }

  /** 치운다 */
  dispose() {
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

/* ─── 내부 ─────────────────────────── */

const VERTEX = `
attribute vec3 aColor; attribute float aShape; attribute float aSize; attribute float aAlpha;
uniform float uScale; uniform float uMinPx;
varying vec3 vColor; varying float vShape; varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = aSize * uScale / max(0.1, -mv.z);
  gl_PointSize = max(uMinPx, px);
  vColor = aColor; vShape = aShape; vAlpha = aAlpha;
}`;

const FRAGMENT = `
varying vec3 vColor; varying float vShape; varying float vAlpha;
void main() {
  if (vAlpha <= 0.01) discard;
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q);
  float dot = smoothstep(0.5, 0.3, r);
  float bar = max(smoothstep(0.12, 0.04, abs(q.x)), smoothstep(0.12, 0.04, abs(q.y))) * smoothstep(0.5, 0.38, r);
  float a = mix(dot, bar, step(0.5, vShape)) * vAlpha;
  if (a <= 0.01) discard;
  gl_FragColor = vec4(vColor, a);
  #include <colorspace_fragment>
}`;
