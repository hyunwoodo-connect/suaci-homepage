// 원본 .glb 의 크기 상자(장면 기준). three 의 Box3.setFromObject(정밀 아님)와 같은 셈:
// 메시마다 POSITION 의 min·max 상자를 노드의 세계 행렬로 옮긴 뒤 합친다.
// 게임은 모델을 받기 전에 이 상자로 배치를 끝낸다(배치가 받는 순서에 흔들리지 않게).
// 사용: node bounds.mjs <raw 폴더> <manifest.json> — 이미 만든 배포본 manifest 에 상자만 채워 넣는다.
import fs from "node:fs";
import path from "node:path";

const NORMALIZED = { 5120: 1 / 127, 5121: 1 / 255, 5122: 1 / 32767, 5123: 1 / 65535 };

/** .glb 파일 → [minX, minY, minZ, maxX, maxY, maxZ] (상자가 없으면 null) */
export function boxOf(file) {
  const buf = fs.readFileSync(file);
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString());
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  const scene = json.scenes[json.scene ?? 0];
  const visit = (index, parent) => {
    const node = json.nodes[index];
    const world = multiply(parent, localMatrix(node));
    if (node.mesh !== undefined) {
      for (const prim of json.meshes[node.mesh].primitives) {
        if (prim.targets) throw new Error(`${file}: 모프 타깃은 상자 셈이 다르다`);
        const acc = json.accessors[prim.attributes.POSITION];
        if (!acc?.min || !acc?.max) throw new Error(`${file}: POSITION min·max 가 없다`);
        const k = acc.normalized ? NORMALIZED[acc.componentType] : 1;
        unionTransformed(
          box,
          acc.min.map((v) => v * k),
          acc.max.map((v) => v * k),
          world,
        );
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  for (const root of scene.nodes) visit(root, IDENTITY);
  return box[0] === Infinity ? null : box;
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// three Matrix4.compose 와 같은 식(열 우선)
function localMatrix(node) {
  if (node.matrix) return node.matrix;
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const x2 = x + x,
    y2 = y + y,
    z2 = z + z;
  const xx = x * x2,
    xy = x * y2,
    xz = x * z2;
  const yy = y * y2,
    yz = y * z2,
    zz = z * z2;
  const wx = w * x2,
    wy = w * y2,
    wz = w * z2;
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

// three Matrix4.multiplyMatrices(a, b) 와 같은 식
function multiply(a, b) {
  const out = new Array(16);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      out[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
  return out;
}

// three Box3.applyMatrix4: 여덟 꼭짓점을 옮겨 다시 상자로
function unionTransformed(box, min, max, e) {
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]])
      for (const z of [min[2], max[2]]) {
        const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
        const px = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
        const py = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
        const pz = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
        box[0] = Math.min(box[0], px);
        box[1] = Math.min(box[1], py);
        box[2] = Math.min(box[2], pz);
        box[3] = Math.max(box[3], px);
        box[4] = Math.max(box[4], py);
        box[5] = Math.max(box[5], pz);
      }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [raw, manifestPath] = process.argv.slice(2);
  if (!raw || !manifestPath) {
    console.error("사용: node bounds.mjs <raw 폴더> <manifest.json>");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let n = 0;
  for (const [k, a] of Object.entries(manifest.assets)) {
    const src = path.join(raw, `${k}.glb`);
    if (!fs.existsSync(src)) continue;
    const box = boxOf(src);
    if (box) {
      a.box = box;
      n++;
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  console.log(`상자 ${n}개를 채웠다: ${manifestPath}`);
}
