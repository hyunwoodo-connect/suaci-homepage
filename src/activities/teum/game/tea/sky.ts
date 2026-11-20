import * as THREE from "three";

import type { TeaTuning } from "./teaTuning";

// 하늘이 시계: 판이 흐르는 동안 라벤더 → 복숭아 → 보라로 진다(시각은 값 파일 sky.at).
// 카메라를 따라다니는 큰 공 안쪽에 위(진한 색)·지평선(옅은 색) 둘로 칠하고, 안개도 같은 지평선 색으로 맞춘다

/** 하늘 공 반지름(m) — 작은 별 전체보다 훨씬 크게 */
const DOME_R = 400;
const WHITE = new THREE.Color(0xffffff);

/** 하늘 */
export class TeaSky {
  private readonly dome: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private readonly colors: THREE.Color[];
  private readonly at: number[];
  private readonly top = new THREE.Color();
  private readonly horizon = new THREE.Color();

  constructor(
    private readonly scene: THREE.Scene,
    t: TeaTuning,
  ) {
    this.colors = t.sky.colors.map((hex) => new THREE.Color(hex));
    this.at = t.sky.at;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color() },
        uHor: { value: new THREE.Color() },
        uUp: { value: new THREE.Vector3(0, 1, 0) },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader:
        "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `varying vec3 vDir; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uUp;
        void main() { float k = smoothstep(-0.2, 0.75, dot(normalize(vDir), uUp)); gl_FragColor = vec4(mix(uHor, uTop, k), 1.0);
        #include <colorspace_fragment>
        }`,
    });
    const geo = new THREE.SphereGeometry(DOME_R, 32, 16);
    this.dome = new THREE.Mesh(geo, this.mat);
    this.dome.renderOrder = -1;
    this.dome.frustumCulled = false;
    scene.add(this.dome);
    this.setTime(0);
  }

  /** 판이 시작되고 seconds 초 — 그 시각의 하늘 색으로 */
  setTime(seconds: number) {
    const { colors, at } = this;
    let i = 0;
    while (i < at.length - 1 && seconds >= at[i + 1]) i++;
    const after = i + 1,
      last = colors.length - 1;
    const next = Math.min(after, last);
    const span = at[next] - at[i];
    const into = span > 0 ? (seconds - at[i]) / span : 0;
    const k = THREE.MathUtils.clamp(into, 0, 1);
    this.horizon.copy(colors[i]).lerp(colors[next], k);
    // 위는 같은 색을 조금 진하게, 지평선은 흰빛을 섞어 옅게
    this.top.copy(this.horizon).multiplyScalar(0.86);
    this.horizon.lerp(WHITE, 0.35);
    (this.mat.uniforms.uTop.value as THREE.Color).copy(this.top);
    (this.mat.uniforms.uHor.value as THREE.Color).copy(this.horizon);
    const fog = this.scene.fog as THREE.Fog | null;
    if (fog) fog.color.copy(this.horizon);
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(this.horizon);
  }

  /** 카메라를 따라간다(위는 내가 선 자리의 위 — 작은 별이라 어디서 봐도 머리 위가 진한 쪽) */
  follow(camera: THREE.Camera, up: THREE.Vector3) {
    this.dome.position.copy(camera.position);
    (this.mat.uniforms.uUp.value as THREE.Vector3).copy(up);
  }

  /** 치운다 */
  dispose() {
    this.dome.removeFromParent();
    this.dome.geometry.dispose();
    this.mat.dispose();
  }
}
