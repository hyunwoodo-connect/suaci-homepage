import * as THREE from "three";

import type { Thing } from "../core/frame";
import { LOOK } from "../look";
import type { Services } from "../services";

// 하늘: 지평선 색에서 위쪽 색으로 번지고, 해 쪽이 은은하게 밝다. 하늘 그림이 오면 그 위에 덮는다.
// 하늘 공은 늘 카메라를 감싸고(카메라를 따라간다), 위쪽은 내가 선 자리의 위다.
// 숨바꼭질 한 판 동안은 하늘이 서서히 노을로 바뀐다(setDusk) — 숫자 타이머 대신 하늘색이 시계다. 햇빛도 같이 붉어진다

/** 하늘 셰이더 값 */
export interface SkyUniforms {
  [name: string]: THREE.IUniform;
  uTop: { value: THREE.Color };
  uHor: { value: THREE.Color };
  uUp: { value: THREE.Vector3 };
  uSun: { value: THREE.Vector3 };
  uMap: { value: THREE.Texture | null };
  uHas: { value: number };
  /** 지금 지역의 하늘빛과 섞는 정도 */
  uReg: { value: THREE.Color };
  uRegW: { value: number };
  /** 노을이 진 정도(0 낮 … 1 해가 졌다) */
  uDusk: { value: number };
}

/** 노을: 지평선 색·위쪽 색·햇빛 색·안개 색 */
const DUSK_HORIZON = new THREE.Color(0xff8a4c),
  DUSK_TOP = new THREE.Color(0x4a3a8c),
  DUSK_SUN = new THREE.Color(0xff9a5e),
  DUSK_FOG = new THREE.Color(0xd9785a);

/** 하늘 공 */
export class Sky implements Thing {
  readonly SKY: SkyUniforms;
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly dayLight: THREE.Color;

  /** sun: 해(그 방향으로 하늘이 밝다) */
  constructor(
    private readonly s: Services,
    private readonly sun: THREE.DirectionalLight,
  ) {
    const sunDir = sun.position.clone().normalize();
    this.dayLight = sun.color.clone();
    this.SKY = {
      uTop: { value: new THREE.Color(LOOK.top) },
      uHor: { value: new THREE.Color(LOOK.bg) },
      uUp: { value: new THREE.Vector3(0, 1, 0) },
      uSun: { value: sunDir },
      uMap: { value: null },
      uHas: { value: 0 },
      uReg: { value: new THREE.Color(s.map.regions[0]?.sky ?? LOOK.top) },
      uRegW: { value: 0 },
      uDusk: { value: 0 },
    };
    const skyGeo = new THREE.SphereGeometry(700, 28, 18);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.SKY,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      vertexShader:
        "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `varying vec3 vDir; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uUp; uniform vec3 uSun; uniform sampler2D uMap; uniform float uHas; uniform vec3 uReg; uniform float uRegW; uniform float uDusk;
      void main() { vec3 d = normalize(vDir); float t = dot(d, uUp); vec3 c = mix(uHor, uTop, smoothstep(0.0, 0.7, t));
        if (uHas > 0.5) { // 하늘 그림: 해 쪽을 가운데로 두고 좌우로 거울처럼 이어 붙여 이음매가 없다. 지평선에서 66도까지 덮고 그 위는 단색
          vec3 h1 = normalize(uSun - uUp * dot(uSun, uUp) + vec3(1e-4)), h2 = cross(uUp, h1);
          float az = atan(dot(d, h2), dot(d, h1)), el = asin(clamp(t, -1.0, 1.0));
          float um = abs(mod(az * 2.0 + 4.712389, 6.283185) - 3.141593) / 3.141593, ve = (el - 0.14) / 0.67, vm = clamp(ve, 0.004, 0.996); // 그림을 네 번 이어 붙여 구름을 절반 크기로, 지평선에서 조금 위로 올려 놓는다
          c = mix(texture2D(uMap, vec2(um, vm)).rgb, uTop, smoothstep(0.88, 0.99, ve));
        }
        c = mix(c, uReg * (0.5 + 0.75 * dot(c, vec3(0.333))), uRegW); // 지역마다 하늘빛이 다르다
        c = mix(c, mix(vec3(${glsl(DUSK_HORIZON)}), vec3(${glsl(DUSK_TOP)}), smoothstep(-0.05, 0.6, t)), uDusk * 0.92); // 해가 지면 지평선은 주황, 위는 보라
        c += vec3(1.0, 0.96, 0.88) * pow(max(dot(d, uSun), 0.0), 20.0) * 0.18; gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    });
    this.mesh = new THREE.Mesh(skyGeo, skyMat);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
    s.scene.add(this.mesh);
  }

  /** 받은 하늘 그림을 덮는다 */
  setTexture(tx: THREE.Texture) {
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping;
    tx.generateMipmaps = false;
    tx.minFilter = THREE.LinearFilter;
    tx.needsUpdate = true;
    this.SKY.uMap.value = tx;
    this.SKY.uHas.value = 1;
  }

  /** 노을이 진 정도(0 낮 … 1 해가 졌다): 하늘이 주황·보라로, 햇빛이 붉게 바뀐다 */
  setDusk(k: number) {
    this.SKY.uDusk.value = k;
    const warm = k * 0.8;
    this.sun.color.copy(this.dayLight).lerp(DUSK_SUN, warm);
  }

  /** 안개색에 노을을 입힌다(지금 지역의 안개색을 받아 그 자리에서 바꾼다) */
  tintFog(fog: THREE.Color) {
    const mix = this.SKY.uDusk.value * 0.75;
    fog.lerp(DUSK_FOG, mix);
  }

  /** 하늘 공이 카메라를 감싸고, 위쪽을 내 자리 위로 */
  update() {
    this.mesh.position.copy(this.s.camera.camera.position);
    this.SKY.uUp.value.copy(this.s.player.p);
  }

  /** 치운다 */
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.SKY.uMap.value?.dispose();
  }
}

/* ─── 내부 ─────────────────────────── */

// 색을 셰이더에 적을 글로(선형 색 공간 값 — 하늘 셰이더는 끝에서 화면 색 공간으로 바꾼다)
function glsl(c: THREE.Color): string {
  return `${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)}`;
}
