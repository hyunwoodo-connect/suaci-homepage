import * as THREE from "three";

import { BG } from "../state";

// 하늘: 지평선 색에서 위쪽 색으로 번지고, 해 쪽이 은은하게 밝다. 하늘 그림이 오면 그 위에 덮는다

/** 하늘 셰이더 값 */
export interface SkyUniforms {
  [name: string]: THREE.IUniform;
  uTop: { value: THREE.Color };
  uHor: { value: THREE.Color };
  uUp: { value: THREE.Vector3 };
  uSun: { value: THREE.Vector3 };
  uMap: { value: THREE.Texture | null };
  uHas: { value: number };
}

/** 하늘 공과 그 값 */
export interface Sky {
  SKY: SkyUniforms;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
}

/** 하늘 공을 만든다(그림은 받은 뒤 setSkyTexture 로) */
export function createSky(scene: THREE.Scene, SUN: THREE.Vector3): Sky {
  const SKY: SkyUniforms = {
    uTop: { value: new THREE.Color(0xd5dadf) },
    uHor: { value: new THREE.Color(BG) },
    uUp: { value: new THREE.Vector3(0, 1, 0) },
    uSun: { value: SUN },
    uMap: { value: null },
    uHas: { value: 0 },
  };
  const skyGeo = new THREE.SphereGeometry(700, 28, 18);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: SKY,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    vertexShader:
      "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `varying vec3 vDir; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uUp; uniform vec3 uSun; uniform sampler2D uMap; uniform float uHas;
    void main() { vec3 d = normalize(vDir); float t = dot(d, uUp); vec3 c = mix(uHor, uTop, smoothstep(0.0, 0.7, t));
      if (uHas > 0.5) { // 하늘 그림: 해 쪽을 가운데로 두고 좌우로 거울처럼 이어 붙여 이음매가 없다. 지평선에서 66도까지 덮고 그 위는 단색
        vec3 h1 = normalize(uSun - uUp * dot(uSun, uUp) + vec3(1e-4)), h2 = cross(uUp, h1);
        float az = atan(dot(d, h2), dot(d, h1)), el = asin(clamp(t, -1.0, 1.0));
        float um = abs(mod(az * 2.0 + 4.712389, 6.283185) - 3.141593) / 3.141593, ve = (el - 0.14) / 0.67, vm = clamp(ve, 0.004, 0.996); // 그림을 네 번 이어 붙여 구름을 절반 크기로, 지평선에서 조금 위로 올려 놓는다
        c = mix(texture2D(uMap, vec2(um, vm)).rgb, uTop, smoothstep(0.88, 0.99, ve));
      }
      c += vec3(1.0, 0.96, 0.88) * pow(max(dot(d, uSun), 0.0), 20.0) * 0.18; gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
  });
  const mesh = new THREE.Mesh(skyGeo, skyMat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { SKY, mesh };
}

/** 받은 하늘 그림을 덮는다 */
export function setSkyTexture(sky: Sky, tx: THREE.Texture) {
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping;
  tx.generateMipmaps = false;
  tx.minFilter = THREE.LinearFilter;
  tx.needsUpdate = true;
  sky.SKY.uMap.value = tx;
  sky.SKY.uHas.value = 1;
}
