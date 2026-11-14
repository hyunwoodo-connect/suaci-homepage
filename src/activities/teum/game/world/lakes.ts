import * as THREE from "three";

import { splashAt } from "../fx/ripples";
import { say } from "../hud";
import type { Game } from "../state";
import { S } from "../state";
import type { RoundSpot } from "./layout";
import { from, UP } from "./sphere";

// 호수 — 수면을 스치면 빨라지고 물결이 남는다. 행성 곡면을 따라 붙는 얇은 덮개

/** 호수 하나 */
export interface Lake extends RoundSpot {
  m: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  v: THREE.Vector3;
}

/** 호수 전체 */
export interface Lakes {
  list: Lake[];
  /** 물결 셰이더의 시간 */
  lakeT: { value: number };
  wasL: boolean;
  /** 다음 물보라까지 */
  rip: number;
}

/** 호수를 만든다(모양은 layout) */
export function createLakes(g: Game): Lakes {
  const lakeT = { value: 0 };
  const list = g.L.lake.map((l) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xf3f5f4 }),
      uRm = { value: l.r };
    mat.onBeforeCompile = (sh) => {
      // 가운데는 깊고 가장자리는 얕게, 물결 줄이 밖으로 퍼지고, 물가에는 흰 거품 띠
      sh.uniforms.uT = lakeT;
      sh.uniforms.uRm = uRm;
      sh.vertexShader =
        "varying float vLr; varying float vLa;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n  { vec3 n0 = normalize(position); vLr = acos(clamp(n0.y, -1.0, 1.0)) * length(position); vLa = atan(position.z, position.x); }",
        );
      sh.fragmentShader =
        "uniform float uT; uniform float uRm; varying float vLr; varying float vLa;\n" +
        sh.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
      float lr = vLr / uRm, wob = 0.012 * sin(vLa * 9.0 + uT * 1.3) + 0.008 * sin(vLa * 17.0 - uT * 0.9);
      vec3 deep = diffuseColor.rgb, shal = mix(deep, vec3(0.45, 0.92, 1.0), 0.8);
      vec3 lc = mix(deep * 0.86, deep, smoothstep(0.0, 0.5, lr)); lc = mix(lc, shal, smoothstep(0.6, 0.93, lr + wob));
      float ring = fract((vLr + wob * uRm * 2.0) / 7.0 - uT * 0.16), brk = 0.5 + 0.5 * sin(vLa * 3.0 + uT * 0.5 + vLr * 0.9);
      lc = mix(lc, vec3(1.0), smoothstep(0.07, 0.02, abs(ring - 0.5)) * smoothstep(0.55, 0.75, brk) * smoothstep(0.12, 0.3, lr) * (1.0 - smoothstep(0.8, 0.9, lr)) * 0.7);
      float sp = sin(vLa * 41.0 + vLr * 2.3) * sin(vLr * 3.1 - uT * 1.7 + vLa * 5.0); lc = mix(lc, vec3(1.0), smoothstep(0.93, 0.99, sp) * 0.8 * (1.0 - smoothstep(0.8, 0.9, lr)));
      float foam = smoothstep(0.895, 0.915, lr + wob * 1.6 + 0.012 * sin(vLa * 31.0 + uT * 2.1));
      float foam2 = smoothstep(0.03, 0.0, abs(lr + wob * 1.2 - 0.84 - 0.02 * sin(uT * 0.8))) * (0.5 + 0.5 * sin(vLa * 7.0 - uT));
      diffuseColor.rgb = mix(mix(lc, vec3(1.0), foam2 * 0.8), vec3(1.0), foam);`,
        );
    };
    const m = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    g.scene.add(m);
    return { ...l, m, v: new THREE.Vector3() };
  });
  return { list, lakeT, wasL: false, rip: 0 };
}

/** 호수 자리와 모양: 행성 곡면을 따라 붙는 얇은 덮개 */
export function layoutLakes(g: Game) {
  for (const l of g.lakes.list) {
    l.v.copy(from(l.dist, l.bear));
    l.m.geometry.dispose();
    l.m.geometry = new THREE.SphereGeometry(S.R + 0.3, 72, 20, 0, Math.PI * 2, 0, l.r / S.R);
    l.m.quaternion.setFromUnitVectors(UP, l.v);
  }
}

/** 호수: 낮게 스치면 빨라지고 물이 갈라지며 튄다 */
export function lakesFrame(g: Game) {
  const { pl, t } = g,
    L = g.lakes;
  let inL = false;
  if (pl.air < 1.5)
    for (const l of L.list)
      if (pl.p.angleTo(l.v) * S.R < l.r) {
        inL = true;
        break;
      }
  if (inL && t.tot > 0.3) {
    pl.boost = Math.max(pl.boost, 0.85);
    L.rip -= t.dt;
    if (L.rip <= 0) {
      L.rip = 0.16;
      splashAt(g, pl.p.clone(), 0.75, 3); // 수면을 스치면 물이 갈라지며 튄다
    }
  }
  if (inL && !L.wasL) say(g, "호수 — 수면을 스치며 달립니다");
  L.wasL = inL;
}
