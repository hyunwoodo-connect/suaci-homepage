import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { LOOK } from "../look";
import type { LayoutLake } from "../maps/layout";
import type { Services } from "../services";
import { S } from "../settings";
import { fromInto, offsetInto, UP } from "./sphere";

// 호수 — 수면을 스치면 빨라지고 물결이 남는다. 행성 곡면을 따라 붙는 얇은 덮개.
// 지도 v2(v79): 바다(자리표 sea — 반지름 300m 호수 하나, 섬은 언덕이 물 위로 솟는다)와 초콜릿 시내(tint)도 이것으로.
// 초콜릿 시내는 비스킷 언덕 비탈에도 놓여 덮개를 땅(큰 언덕) 높이에 맞춰 덮는다 — 평평하면 언덕 속에 묻힌다

/** 호수 하나 */
export interface Lake extends LayoutLake {
  m: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  v: THREE.Vector3;
  /** 바다(자리표 sea)인가 */
  isSea: boolean;
}

/** 물빛: 깊은 색 · 얕은 색(물가 거품 쪽) */
const WATER = {
  lake: { deep: LOOK.lake, shallow: 0x73ebff },
  sea: { deep: 0x2f6fe6, shallow: 0x7fe9ff },
  chocolate: { deep: 0x6b3e36, shallow: 0xa8705a },
} as const;
/** 섬 위(땅이 이만큼 m 넘게 솟은 곳)는 물이 아니다 */
const DRY_ABOVE = 0.5;
/** 땅을 따라 덮는 시내가 땅에서 뜨는 높이(m) — 언덕 면과 겹쳐 깜빡이지 않게 */
const DRAPE_LIFT = 0.6;
/** 바다를 차지할 때 물 위에 찍는 점 사이(m)·점마다 반지름(m) */
const SEA_CLAIM = { step: 18, r: 13 } as const;

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
    const seas: (LayoutLake & { isSea: boolean })[] = (s.layout.sea ?? []).map((sea) => ({
      ...sea,
      isSea: true,
    }));
    const lakes = s.layout.lake.map((l) => ({ ...l, isSea: false }));
    this.list = [...lakes, ...seas].map((l) => {
      const water = l.isSea ? WATER.sea : l.tint === "chocolate" ? WATER.chocolate : WATER.lake;
      const isDraped = !l.isSea && l.tint !== undefined;
      const mat = new THREE.MeshBasicMaterial({
          color: water.deep,
          polygonOffset: isDraped,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
        uRm = { value: l.r },
        uShal = { value: new THREE.Color(water.shallow) };
      mat.onBeforeCompile = (sh) => {
        // 가운데는 깊고 가장자리는 얕게, 물결 줄이 밖으로 퍼지고, 물가에는 흰 거품 띠
        sh.uniforms.uT = lakeT;
        sh.uniforms.uRm = uRm;
        sh.uniforms.uShal = uShal;
        sh.vertexShader =
          "varying float vLr; varying float vLa;\n" +
          sh.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\n  { vec3 n0 = normalize(position); vLr = acos(clamp(n0.y, -1.0, 1.0)) * length(position); vLa = atan(position.z, position.x); }",
          );
        sh.fragmentShader =
          "uniform float uT; uniform float uRm; uniform vec3 uShal; varying float vLr; varying float vLa;\n" +
          sh.fragmentShader.replace(
            "#include <map_fragment>",
            `#include <map_fragment>
        float lr = vLr / uRm, wob = 0.012 * sin(vLa * 9.0 + uT * 1.3) + 0.008 * sin(vLa * 17.0 - uT * 0.9);
        vec3 deep = diffuseColor.rgb, shal = mix(deep, uShal, 0.8);
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
      const geo = new THREE.SphereGeometry(surface, 72, 20, 0, fullTurn, 0, capAngle);
      l.m.quaternion.setFromUnitVectors(UP, l.v);
      const isDraped = !l.isSea && l.tint !== undefined;
      if (isDraped) this.drape(geo, l.m.quaternion);
      l.m.geometry = geo;
    }
  }

  /** 자리 차지: 물가까지(바다는 물 위만 — 섬에는 놓을 수 있게) */
  claim() {
    for (const l of this.list) {
      if (l.isSea) {
        this.claimWater(l);
        continue;
      }
      const shore = l.r + 3;
      this.s.occ.fill(l.v, shore);
    }
  }

  /** 낮게 스치면 빨라지고 물이 갈라지며 튄다 */
  update(f: Frame) {
    const { player, ripples, hud } = this.s;
    let inL = false;
    // 섬 위(땅이 솟은 곳)는 물이 아니다
    const isLow = player.air < 1.5 && this.s.terrain.groundAt(player.p) < DRY_ABOVE;
    if (isLow)
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

  /** 이 자리가 물 위인가(호수·바다 안이고 섬이 아니다) */
  isWater(v: THREE.Vector3): boolean {
    if (this.s.terrain.groundAt(v) >= DRY_ABOVE) return false;
    return this.list.some((l) => l.v.angleTo(v) * S.R < l.r);
  }

  /** 치운다 */
  dispose() {
    for (const l of this.list) {
      l.m.removeFromParent();
      l.m.geometry.dispose();
      l.m.material.dispose();
    }
  }

  // 덮개 꼭짓점을 그 자리 큰 언덕 높이로 올린다(호수 틀 → 세계 방향은 q 로 돌려 본다)
  private drape(geo: THREE.BufferGeometry, q: THREE.Quaternion) {
    const pos = geo.getAttribute("position");
    const dir = new THREE.Vector3(),
      world = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      dir.fromBufferAttribute(pos, i).normalize();
      world.copy(dir).applyQuaternion(q);
      const ground = this.s.terrain.featGround(world);
      const radius = S.R + ground + DRAPE_LIFT;
      dir.multiplyScalar(radius);
      pos.setXYZ(i, dir.x, dir.y, dir.z);
    }
    pos.needsUpdate = true;
    geo.computeBoundingSphere();
  }

  // 바다: 물 위에 점을 고르게 찍어 그 둘레만 차지한다(섬은 비워 둔다)
  private claimWater(l: Lake) {
    const { occ, terrain } = this.s;
    const ringCount = l.r / SEA_CLAIM.step;
    const rings = Math.ceil(ringCount);
    const spot = new THREE.Vector3();
    for (let i = 0; i <= rings; i++) {
      const dist = i * SEA_CLAIM.step;
      const around = (Math.PI * 2 * dist) / SEA_CLAIM.step;
      const aroundUp = Math.ceil(around);
      const n = Math.max(1, aroundUp);
      for (let k = 0; k < n; k++) {
        const bear = (k / n) * 360;
        offsetInto(spot, l.v, dist, bear);
        if (terrain.groundAt(spot) >= DRY_ABOVE) continue;
        occ.fill(spot, SEA_CLAIM.r);
      }
    }
  }
}
