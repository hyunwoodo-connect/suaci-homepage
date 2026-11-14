import * as THREE from "three";

import { GLOWING_LIME, MODEL_STRIPES, MODEL_TINT } from "../../assets/settings";
import type { Game } from "../state";
import { LIME } from "../state";
import { flCull } from "./flowers";
import type { ToyKind } from "./materials";

// 톤: 초현실 팝(팝아트) 하나로 확정. 색 배합 — 바탕 = 코발트 하늘 + 진초록·연초록 체커 땅(광장 둘레는 분홍 체커) /
// 큰 덩어리(나무·꽃·랜드마크·구름) = 핫핑크와 흰색 / 탈 것 = 주황과 노랑 / 반응한 것과 고양이 = 라임

/** 톤 하나의 색 배합 */
export interface Look {
  name: string;
  asset: boolean;
  pop: boolean;
  add?: boolean;
  sat: number;
  wash: number;
  light: number;
  sunI: number;
  gA: number;
  gB: number;
  rim: number;
  top: number;
  puff: number;
  glow: number;
  lake: number;
  bg: number;
  cloud: number;
  toy: number;
  core?: number;
  stem?: number;
  tc: Record<ToyKind, number>;
  fl: number[];
  hop: number;
  pad: number;
}

/** 확정된 톤: 초현실 팝 */
export const LOOK: Look = {
  name: "초현실 팝",
  asset: true,
  pop: true,
  sat: 1.35,
  wash: 0,
  light: 2.0,
  sunI: 1.3,
  gA: 0x14803b,
  gB: 0x62cf4c,
  rim: 0x9db4f2,
  top: 0x002afd,
  puff: 0x14803b,
  glow: 0xe6ffa6,
  lake: 0x2f6fe6,
  bg: 0x7896ec,
  cloud: 0xff9ccb,
  toy: 0xff5a1f,
  tc: {
    ring: 0xff5a1f,
    pillar: 0xffd21f,
    chime: 0xff5a1f,
    bumper: 0xff5a1f,
    cannon: 0xff5a1f,
    hole: 0xffd21f,
    sling: 0xff5a1f,
    swing: 0xff5a1f,
    funnel: 0xff5a1f,
    plank: 0xffd21f,
    ramp: 0xffd21f,
    rail: 0xff5a1f,
    whirl: 0xffd21f,
    seed: 0xffd21f,
    rocket: 0xff5a1f,
    comet: 0xffd21f,
  },
  fl: [0xff5fa2, 0xffffff, 0xff8fbd, 0xffffff],
  hop: 0xffd21f,
  pad: 0xffd21f,
};

/** 모델 재질이 같이 쓰는 톤 값 */
export interface LookUniforms {
  sat: { value: number };
  wash: { value: number };
}

/** 모델 재질 하나가 갖는 톤 값 */
interface ModelMatData {
  tk: string;
  uTint: { value: THREE.Color };
  uTK: { value: number };
  uPat: { value: number };
  uPY: { value: number };
  uTint2: { value: THREE.Color };
  uAn: { value: THREE.Vector4 };
  uAk: { value: number };
  uAx: { value: number };
}

/** 모델 재질의 톤 값 읽기 */
export function modelMatData(mat: THREE.Material): ModelMatData {
  return mat.userData as ModelMatData;
}

/**
 * 모델 재질에 톤 셰이더를 덧입힌다: 채도·색조·줄무늬·라임 물들기, 그리고 생물은 뼈대 없이 몸을 휜다
 * (1 네발 걸음·고갯짓, 2 꼬리 헤엄, 3 날갯짓, 4 해파리 갓과 촉수, 5 두 발).
 */
export function applyLook(
  g: Game,
  mat: THREE.MeshStandardMaterial,
  uL: { value: number },
  key: string,
) {
  const ud = mat.userData as ModelMatData;
  ud.tk = key;
  ud.uTint = { value: new THREE.Color(0xffffff) };
  ud.uTK = { value: 0 };
  ud.uPat = { value: 0 };
  ud.uPY = { value: 0 };
  ud.uTint2 = { value: new THREE.Color(0xffffff) };
  ud.uAn = { value: new THREE.Vector4() };
  ud.uAk = { value: 0 };
  ud.uAx = { value: 0 };
  g.mats.models.push(mat);
  mat.metalness = 0;
  mat.metalnessMap = null;
  mat.roughnessMap = null;
  mat.roughness = 0.85;
  const LK = g.lookU;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSat = LK.sat;
    sh.uniforms.uWash = LK.wash;
    sh.uniforms.uLime = uL;
    sh.uniforms.uTint = ud.uTint;
    sh.uniforms.uTK = ud.uTK;
    sh.uniforms.uPat = ud.uPat;
    sh.uniforms.uPY = ud.uPY;
    sh.uniforms.uTint2 = ud.uTint2;
    sh.uniforms.uAn = ud.uAn;
    sh.uniforms.uAk = ud.uAk;
    sh.uniforms.uAx = ud.uAx;
    sh.vertexShader =
      "varying vec3 vOp; uniform vec4 uAn; uniform float uAk; uniform float uAx;\n" +
      sh.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
  vOp = position;
  if (uAk > 0.5) {
    float s = uAx < 0.5 ? transformed.x : transformed.z, w = uAx < 0.5 ? transformed.z : -transformed.x, y = transformed.y, dF = 0.0, dW = 0.0, dY = 0.0, ph = uAn.y, am = uAn.z;
    if (uAk < 1.5) {
      float L = smoothstep(-0.12, -0.38, y), off = (s * w > 0.0) ? 0.0 : 3.14159;
      dF += L * 0.17 * am * sin(ph + off); dY += L * 0.08 * am * max(0.0, cos(ph + off)); dY += 0.022 * am * sin(2.0 * ph) * (1.0 - L);
      float Hm = smoothstep(0.1, 0.42, s) * (1.0 - L);
      dY += Hm * (0.11 * uAn.w + 0.02 * am * sin(2.0 * ph + 1.0)); dF += Hm * 0.05 * max(0.0, -uAn.w);
      float Tm = smoothstep(-0.3, -0.5, s); dW += Tm * 0.05 * sin(ph * 1.5 + uAn.x);
    } else if (uAk < 2.5) {
      float Tm = smoothstep(0.2, -0.5, s); dW += Tm * (0.05 + 0.17 * am) * sin(ph - s * 5.0) + 0.03 * sin(ph) * s;
    } else if (uAk < 3.5) {
      float Wm = smoothstep(0.1, 0.42, abs(w)); dY += Wm * abs(w) * (0.12 + 1.2 * am) * sin(ph); dY -= 0.05 * am * sin(ph) * (1.0 - Wm);
      float Tm = smoothstep(-0.2, -0.5, s) * (1.0 - Wm); dY += Tm * 0.08 * sin(ph * 0.5);
    } else if (uAk > 4.5) {
      float L = smoothstep(-0.24, -0.42, y), off = w > 0.0 ? 0.0 : 3.14159;
      dF += L * 0.2 * am * sin(ph + off); dY += L * 0.09 * am * max(0.0, cos(ph + off));
      dW += 0.035 * am * sin(ph) * (y + 0.5); dY += 0.02 * am * abs(sin(ph)) * (1.0 - L);
      float Am = smoothstep(0.3, 0.42, abs(w)) * (1.0 - L); dF -= Am * 0.12 * am * sin(ph + off);
    } else {
      float B = smoothstep(-0.05, 0.15, y), pu = sin(ph), Tm = smoothstep(0.02, -0.5, y);
      transformed.xz *= 1.0 + B * 0.11 * pu; dY -= B * 0.05 * pu;
      transformed.x += Tm * 0.07 * sin(ph * 0.8 + y * 9.0 + transformed.z * 6.0 + uAn.x); transformed.z += Tm * 0.07 * cos(ph * 0.7 + y * 9.0 + transformed.x * 6.0);
      transformed.xz *= 1.0 - Tm * 0.2 * sin(ph - 1.2); dY += Tm * 0.07 * sin(ph - 1.2) * (-y);
    }
    if (uAx < 0.5) { transformed.x += dF; transformed.z += dW; } else { transformed.z += dF; transformed.x -= dW; }
    transformed.y += dY;
  }`,
      );
    sh.fragmentShader =
      "uniform float uSat; uniform float uWash; uniform float uLime; uniform vec3 uTint; uniform float uTK; uniform float uPat; uniform float uPY; uniform vec3 uTint2; varying vec3 vOp;\n" +
      sh.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
      float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, uSat);
      // 색 배합: 에셋의 명암과 채도는 그대로 두고 색상만 정해진 색으로 바꾼다. 원래 흰 부분은 희게 남아 '정해진 색 + 흰색' 두 톤이 된다
      float mx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), mn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
      float sK = smoothstep(0.04, 0.4, mx > 0.0 ? (mx - mn) / mx : 0.0);
      vec3 tC = uTint; if (uPat > 0.5 && vOp.y < uPY) { tC = fract(atan(vOp.z, vOp.x) * 1.5915) < 0.5 ? uTint2 : vec3(1.0); sK = 1.0; } // 줄기는 세로 줄무늬(열 줄)
      vec3 mapped = mix(vec3(1.0), tC, sK) * mix(mx, 1.0, 0.24);
      mapped = mix(mapped, vec3(mix(mx, 1.0, 0.62)), step(2.95, uTint.r + uTint.g + uTint.b) * (1.0 - step(0.5, uPat) * step(vOp.y, uPY))); // 흰색으로 정한 것은 밝은 회색~흰색 명암만 남긴다
      diffuseColor.rgb = mix(diffuseColor.rgb, mapped, uTK);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), uWash);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.397, 1.0, 0.041), uLime * 0.8);`,
      );
  };
  mat.customProgramCacheKey = () => "teum-look7";
  // 톤은 시작할 때 한 번 칠했다. 늦게 온 모델은 그 칠을 여기서 받는다
  if (g.lookSet) styleModelMat(mat, LOOK);
}

/** 톤을 칠한다: 하늘·땅·구름·꽃·놀이기구·모델 재질을 그 톤의 색으로 */
export function setLook(g: Game) {
  const L = LOOK,
    t = g.terrain,
    GND = g.ground.GND,
    SKY = g.sky.SKY;
  g.lookU.sat.value = L.sat;
  g.lookU.wash.value = L.wash;
  g.hemi.intensity = L.light;
  g.background.set(L.bg);
  g.fog.color.set(L.bg);
  GND.uA.value.set(L.gA);
  GND.uB.value.set(L.gB);
  GND.uRim.value.set(L.rim);
  SKY.uHor.value.set(L.bg);
  SKY.uTop.value.set(L.top);
  g.ground.PUF.uRim.value.set(L.add ? L.rim : 0xffffff);
  // 솜 뭉치는 바닥보다 밝게, 아래쪽이 어둡게 죽지 않도록 스스로 조금 빛나게 한다
  const cloudCol = L.cloud || (L.pop ? 0xffffff : L.puff);
  const glowing: [THREE.MeshStandardMaterial, number, number][] = [
    [t.clump.material, L.pop ? 0.18 : 0.3, L.puff],
    [t.bumps.m.material, L.pop ? 0.06 : 0.3, L.pop ? 0xffffff : L.puff],
    [t.clouds.m.material, 0.55, cloudCol],
  ];
  for (const [mt, e, c] of glowing) {
    mt.color.set(c);
    mt.emissive.set(c).multiplyScalar(e);
  }
  // 초현실 팝에서는 바닥의 작은 뭉치가 꽃밭이 된다
  const FL = L.fl || [0xff5fa2, 0xffd21f, 0xffffff, 0xe5352b, 0xff8fbd];
  const tc = new THREE.Color();
  for (let k = 0; k < t.bumps.v.length; k++) {
    t.bumps.base[k] = L.pop ? FL[k % FL.length] : 0xffffff;
    t.bumps.m.setColorAt(k, tc.set(t.bumps.base[k]));
  }
  t.bumps.m.instanceColor!.needsUpdate = true;
  t.bumps.m.material.needsUpdate = true;
  flCull(g);
  const fl = g.flowers;
  fl.petalMat.needsUpdate = true;
  fl.petalMat.envMapIntensity = 0.5;
  fl.coreMat.color.set(L.core || (L.pop ? 0xffd21f : L.add ? 0xf0d9a8 : 0xf5f0e2));
  fl.stemMat.color.set(L.stem || (L.pop ? 0x2e8f45 : L.gB));
  // 기류와 바람길에 실려 가는 것도 꽃잎 색으로
  const thermM = g.thermals.thermM,
    streaks = g.streams.streaks;
  for (let k = 0; k < thermM.count; k++)
    thermM.setColorAt(k, tc.set(L.pop ? FL[k % FL.length] : k % 3 ? 0xffffff : LIME));
  for (let k = 0; k < streaks.count; k++)
    streaks.setColorAt(k, tc.set(L.pop ? FL[(k * 3) % FL.length] : 0xffffff));
  thermM.instanceColor!.needsUpdate = true;
  streaks.instanceColor!.needsUpdate = true;
  g.petals.mat.needsUpdate = true;
  g.petals.mat.envMapIntensity = 0.4;
  g.thermals.thermMat.uniforms.uCol.value.set(L.pop || L.add ? 0xffffff : LIME);
  const TC = g.mats.toy;
  for (const k of Object.keys(TC) as ToyKind[]) TC[k].set(L.tc ? L.tc[k] : L.toy);
  g.arches.planks.material.color.copy(TC.plank);
  g.pipes.ramps.material.color.copy(TC.ramp);
  g.rails.railM.material.color.copy(TC.rail);
  for (const f of g.seeds.fields) f.ring.material.color.copy(TC.seed);
  // 초현실 팝: 놀이기구와 모델이 바람 넣은 풍선처럼 매끈하게 빛난다. 바닥과 풀 언덕은 그대로 보송하다
  g.scene.environment = L.pop ? g.envTex : null;
  const ground = new Set<THREE.Material>([
    g.ground.planet.material,
    t.hillMat,
    ...t.features.map((f) => f.mesh.material),
  ]);
  for (const m of g.mats.greys) if (!ground.has(m)) m.roughness = L.pop ? 0.2 : 1;
  for (const m of g.mats.models) styleModelMat(m, L);
  for (const m of ground) (m as THREE.MeshStandardMaterial).envMapIntensity = 0;
  for (const m of [t.clump.material, t.bumps.m.material, t.clouds.m.material])
    m.envMapIntensity = 0;
  const hint = g.hud.hint;
  hint.style.color = L.pop || L.add ? "#fff" : "#6c7170";
  hint.style.textShadow = L.pop || L.add ? "0 1px 4px rgba(0,0,0,.4)" : "none"; // 진한 바탕에서는 안내 글자를 희게
  for (const m of g.mats.poles) m.color.set(L.pop ? 0xffffff : 0xa9adac);
  g.pillars.core.color.set(L.pop ? 0xffffff : 0xe6e8e7);
  g.ground.GND.uGrass.value = L.pop ? 1 : 0;
  for (const pd of g.pads.list)
    pd.m.material.color.set(pd.hop ? L.hop || 0xff8fbd : L.pad || 0xfafbfb);
  for (const b of g.balls.list) {
    b.m.material.color.set(L.pop ? 0xffffff : 0xc4c8c7);
    b.m.material.map = g.balls.beachTex2;
    b.m.material.roughness = L.pop ? 0.18 : 0.9;
    b.m.material.needsUpdate = true;
    for (const c of b.m.children) if (!c.userData.lime) c.visible = !L.pop;
  }
  g.sun.intensity = L.sunI || 0.75;
  for (const l of g.lakes.list) l.m.material.color.set(L.lake || 0xf3f5f4);
  for (const sp of g.fx.glows) sp.material.color.set(L.glow || LIME);
  for (const w of g.whirls)
    for (const c of w.spin.children)
      if (c instanceof THREE.Mesh && c.geometry.type === "TorusGeometry")
        c.material.color.copy(TC.whirl);
  const trail = g.trail,
    bgc = trail.bgc;
  bgc.set(L.bg);
  for (let k = 0; k < trail.N; k++) {
    tc.copy(g.mats.lime).lerp(bgc, k / (trail.N - 1));
    trail.col.set([tc.r, tc.g, tc.b], k * 3);
  }
  trail.geo.attributes.color.needsUpdate = true;
  g.fx.fxOn = L.asset;
  g.fx.motes.visible = g.fx.fxOn;
  g.fx.glowK = L.add ? 0.95 : 0.7; // 어두운 하늘에서는 빛을 더해서 번지게 한다
  for (const sp of g.fx.glows) {
    sp.material.blending = L.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    sp.material.needsUpdate = true;
  }
  g.fx.motes.material.blending = L.add ? THREE.AdditiveBlending : THREE.NormalBlending;
  g.fx.motes.material.needsUpdate = true;
  g.lookSet = true;
}

/* ─── 내부 ─────────────────────────── */

// 모델 재질 하나에 톤의 광택·색조·줄무늬를 칠한다
function styleModelMat(m: THREE.MeshStandardMaterial, L: Look) {
  const ud = m.userData as ModelMatData;
  m.roughness = L.pop ? 0.32 : 0.85;
  if (GLOWING_LIME.has(ud.tk)) {
    m.emissive.set(0x6fae12);
    m.emissiveIntensity = 0.5;
  } // 라임은 그늘에서도 쨍하게
  const t = MODEL_TINT[ud.tk];
  ud.uTK.value = t ? t[1] : 0;
  if (t) ud.uTint.value.set(t[0]);
  const pt = MODEL_STRIPES[ud.tk];
  ud.uPat.value = pt ? 1 : 0;
  if (pt) {
    ud.uPY.value = pt[0];
    ud.uTint2.value.set(pt[1]);
  }
}
