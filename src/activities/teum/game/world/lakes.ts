import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { LOOK } from "../look";
import type { Services } from "../services";
import { S } from "../settings";
import type { RoundSpot } from "./layout";
import { fromInto, UP } from "./sphere";

// 호수 — 수면을 스치면 빨라지고 물결이 남는다. 행성 곡면을 따라 붙는 얇은 덮개

/** 호수 하나 */
export interface Lake extends RoundSpot {
  m: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  v: THREE.Vector3;
}

/** 호수 전체 */
export class Lakes implements Thing {
  readonly list: Lake[];
  /** 물결 셰이더의 시간(프레임 처음에 맞춘다) */
  readonly clock: Thing;
  private readonly lakeT = { value: 0 };
  private wasL = false;
  /** 다음 물보라까지 */
  private rip = 0;

  constructor(private readonly s: Services) {
    const lakeT = this.lakeT;
    this.list = s.layout.lake.map((l) => {
      const mat = new THREE.MeshBasicMaterial({ color: LOOK.lake }),
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
      // 모양은 layout 이 실제 크기로 채운다
      const emptyGeo = new THREE.BufferGeometry();
      const m = new THREE.Mesh(emptyGeo, mat);
      s.scene.add(m);
      return { ...l, m, v: new THREE.Vector3() };
    });
    this.clock = {
      update(f: Frame) {
        lakeT.value = f.time;
      },
      dispose() {},
    };
  }

  /** 호수 자리와 모양: 행성 곡면을 따라 붙는 얇은 덮개 */
  layout() {
    for (const l of this.list) {
      fromInto(l.v, l.dist, l.bear);
      l.m.geometry.dispose();
      // 행성보다 살짝 위에 뜬 구면 조각: 꼭대기에서 반지름(l.r)만큼의 각도까지
      const surface = S.R + 0.3,
        fullTurn = Math.PI * 2,
        capAngle = l.r / S.R;
      l.m.geometry = new THREE.SphereGeometry(surface, 72, 20, 0, fullTurn, 0, capAngle);
      l.m.quaternion.setFromUnitVectors(UP, l.v);
    }
  }

  /** 자리 차지: 물가까지 */
  claim() {
    for (const l of this.list) {
      const shore = l.r + 3;
      this.s.occ.fill(l.v, shore);
    }
  }

  /** 낮게 스치면 빨라지고 물이 갈라지며 튄다 */
  update(f: Frame) {
    const { player, ripples, hud } = this.s;
    let inL = false;
    if (player.air < 1.5)
      for (const l of this.list)
        if (player.p.angleTo(l.v) * S.R < l.r) {
          inL = true;
          break;
        }
    if (inL && player.tot > 0.3) {
      player.boostAtLeast(0.85);
      this.rip -= f.dt;
      if (this.rip <= 0) {
        this.rip = 0.16;
        ripples.splash(player.p, 0.75, 3); // 수면을 스치면 물이 갈라지며 튄다
      }
    }
    if (inL && !this.wasL) hud.say("호수 — 수면을 스치며 달립니다");
    this.wasL = inL;
  }

  /** 치운다 */
  dispose() {
    for (const l of this.list) {
      l.m.removeFromParent();
      l.m.geometry.dispose();
      l.m.material.dispose();
    }
  }
}
