import * as THREE from "three";

import type { Services } from "../services";
import { S } from "../settings";
import { from, offset, START } from "../world/sphere";

// 잔디 로고: 출발 마을 곁 풀밭에 옅게 깎아 둔 라임 워드마크(폭 150m). 땅에서는 그냥 무늬이고, 높이 솟구쳤을 때만 글자로 읽힌다

/** 맡아 둔 잔디 자리: 가운데(c), 출발점에서 거리·방향, 빈 점 수, 글자 세로(u)·가로(r) 방향 */
export interface Lawn {
  c: THREE.Vector3;
  dist: number;
  bear: number;
  free: number;
  u: THREE.Vector3;
  r: THREE.Vector3;
}

/** 잔디 글자 폭(m) */
const LAWN_W = 150;

/**
 * 잔디 로고 자리를 먼저 맡아 둔다(나무·꽃·조형물을 놓기 전에): 출발 마을 둘레에서 가장 빈 풀밭을 골라
 * 그 위에 아무것도 서지 않게 한다. 미리 정해 둔 큰 나무는 갓이 넓어서 26m 이상 멀찍이 피한다
 */
export function reserveLawn(s: Services): Lawn {
  const occ = s.occ;
  let best: Omit<Lawn, "u" | "r"> | null = null,
    bs = -1;
  const LT = (s.layout.tree || []).map((o) => from(o.dist, o.bear));
  for (const dist of [110, 140, 170, 200, 230, 260, 290, 320])
    for (let b = 0; b < 360; b += 10) {
      const c = offset(START, dist, b);
      let score = 0;
      lawnPoints(c, (q) => {
        if (
          occ.isFree(q, 8) &&
          !occ.nearCorridor(q, 5) &&
          LT.every((tv) => tv.angleTo(q) * S.R > 26)
        )
          score++;
      });
      if (score > bs) {
        bs = score;
        best = { c, dist, bear: b, free: score };
      }
    }
  const chosen = best!;
  const axes = lawnPoints(chosen.c, (q) => occ.fill(q, 10));
  return { ...chosen, ...axes };
}

/** 맡아 둔 자리에 잔디 글자를 깐다(땅 높이를 따라 휜 판) */
export function createLawnMesh(s: Services, lawn: Lawn, tex: THREE.Texture): THREE.Mesh {
  const { c, u, r } = lawn,
    W = LAWN_W,
    H = (W * 256) / 1024,
    nx = 80,
    ny = 20,
    pos: number[] = [],
    uv: number[] = [],
    idx: number[] = [],
    q = new THREE.Vector3();
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const x = (i / nx - 0.5) * W,
        y = (j / ny - 0.5) * H;
      const acrossArc = x / S.R,
        alongArc = y / S.R;
      const across = Math.tan(acrossArc),
        along = Math.tan(alongArc);
      q.copy(c).addScaledVector(r, across).addScaledVector(u, along).normalize();
      const ground = s.terrain.groundAt(q);
      const gh = Math.max(ground, 0) + 0.22;
      const radius = S.R + gh;
      const px = q.x * radius,
        py = q.y * radius,
        pz = q.z * radius;
      pos.push(px, py, pz);
      const tu = i / nx,
        tv = j / ny;
      uv.push(tu, tv);
    }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i,
        b2 = a + 1,
        c2 = a + nx + 1,
        d = c2 + 1;
      idx.push(a, b2, c2, b2, d, c2);
    }
  const ge = new THREE.BufferGeometry();
  const posAttr = new THREE.Float32BufferAttribute(pos, 3);
  ge.setAttribute("position", posAttr);
  const uvAttr = new THREE.Float32BufferAttribute(uv, 2);
  ge.setAttribute("uv", uvAttr);
  ge.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    color: 0xa9ff39,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(ge, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  s.scene.add(mesh);
  return mesh;
}

/* ─── 내부 ─────────────────────────── */

// 잔디 글자 판 위 점 스물하나(가로 일곱 × 세로 셋)를 each 에 넘긴다. 세로(u)는 출발점에서 멀어지는 쪽
function lawnPoints(
  c: THREE.Vector3,
  each: (q: THREE.Vector3) => void,
): { u: THREE.Vector3; r: THREE.Vector3 } {
  const u = new THREE.Vector3().copy(c).sub(START);
  const upPart = u.dot(c);
  u.addScaledVector(c, -upPart).normalize();
  const r = new THREE.Vector3().crossVectors(u, c).normalize();
  for (let a = -3; a <= 3; a++)
    for (let b = -1; b <= 1; b++) {
      const acrossArc = (a * 23) / S.R,
        alongArc = (b * 14) / S.R;
      const across = Math.tan(acrossArc),
        along = Math.tan(alongArc);
      const q = new THREE.Vector3()
        .copy(c)
        .addScaledVector(r, across)
        .addScaledVector(u, along)
        .normalize();
      each(q);
    }
  return { u, r };
}
