// 원본(<raw>/*.glb) → 배포본(<out>/<버전>/<분류>/<이름>.glb) + manifest.json
// 하는 일: 폴리곤 줄이기(목표보다 많을 때만) → 텍스처 크기·webp → meshopt 압축. 뼈대가 있는 것은 줄이지 않는다.
// 끝에 존별 색 바꾸기(recolorRules.mjs 규칙 → <원본>@<존> 변형 모델)를 같은 버전에 싣는다.
// 소리(<raw>/<이름>.mp3·.m4a·.ogg·.webm, 분류표의 audio/… 이름)는 그대로 <분류>/<이름>.<확장자> 로 싣는다.
// 그림(<raw>/<이름>.webp, 분류표에 image 로 적은 이름 — 옷 무늬·옷장 칸 그림)도 그대로 싣는다.
// manifest 에는 원본 기준 크기 상자(box)를 같이 적는다 — 게임이 모델을 받기 전에 배치를 끝내는 데 쓴다.
// 사용: npm i && node build.mjs <raw 폴더> <out 폴더> <버전>   예: node build.mjs ~/teum/raw ~/teum/dist v2
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { boxOf } from "./bounds.mjs";
import { addVariants } from "./recolor.mjs";
import {
  AUDIO_EXTENSIONS,
  CATALOG,
  IMAGE_EXTENSIONS,
  RETIRED,
  fileName,
  isAudioCategory,
} from "./catalog.mjs";

const [rawArg, outArg, version] = process.argv.slice(2);
if (!rawArg || !outArg || !version) {
  console.error("사용: node build.mjs <raw 폴더> <out 폴더> <버전>");
  process.exit(1);
}
const run = promisify(execFile);
const G = path.join(import.meta.dirname, "node_modules/.bin/gltf-transform");
const raw = path.resolve(rawArg);
const dist = path.join(path.resolve(outArg), version);
const tmp = path.join(path.resolve(outArg), ".tmp");
if (fs.existsSync(path.join(dist, "manifest.json"))) {
  console.error(`${dist} 는 이미 있다. 버전은 덮어쓰지 않는다 — 새 버전 이름으로 빌드한다`);
  process.exit(1);
}
fs.mkdirSync(tmp, { recursive: true });

const stat = (file) => {
  const b = fs.readFileSync(file);
  const jl = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jl).toString());
  let tris = 0;
  for (const m of j.meshes || [])
    for (const p of m.primitives) tris += j.accessors[p.indices ?? p.attributes.POSITION].count / 3;
  return { bytes: b.length, tris: Math.round(tris), skinned: (j.skins || []).length > 0 };
};

const names = fs
  .readdirSync(raw)
  .filter((f) => f.endsWith(".glb"))
  .map((f) => f.slice(0, -4))
  .filter((n) => !RETIRED.has(n));
const unknown = names.filter(
  (n) => !CATALOG[n] || isAudioCategory(CATALOG[n].cat) || CATALOG[n].image,
);
if (unknown.length) {
  console.error("분류표에 모델로 없는 에셋: " + unknown.join(", "));
  process.exit(1);
}
// 소리: 분류표의 audio/… 이름이어야 하고, 한 이름은 한 형식으로만
const sounds = fs
  .readdirSync(raw)
  .filter((f) => AUDIO_EXTENSIONS.includes(path.extname(f).toLowerCase()))
  .map((f) => {
    const ext = path.extname(f).toLowerCase();
    return { f, ext, k: f.slice(0, -ext.length) };
  });
const badSounds = sounds.filter(({ k }) => !CATALOG[k] || !isAudioCategory(CATALOG[k].cat));
if (badSounds.length) {
  console.error("분류표에 소리(audio/…)로 없는 소리: " + badSounds.map((x) => x.f).join(", "));
  process.exit(1);
}
// 그림: 분류표에 image 로 적은 이름이어야 한다
const pictures = fs
  .readdirSync(raw)
  .filter((f) => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()))
  .map((f) => {
    const ext = path.extname(f).toLowerCase();
    return { f, ext, k: f.slice(0, -ext.length) };
  });
const badPictures = pictures.filter(({ k }) => !CATALOG[k]?.image);
if (badPictures.length) {
  console.error("분류표에 그림(image)으로 없는 그림: " + badPictures.map((x) => x.f).join(", "));
  process.exit(1);
}
const soundKeys = sounds.map((x) => x.k);
const twice = soundKeys.filter((k, i) => soundKeys.indexOf(k) !== i);
if (twice.length) {
  console.error("한 소리가 두 형식으로 있다: " + twice.join(", "));
  process.exit(1);
}
// 두 키가 같은 배포 파일로 가면 하나가 다른 하나를 덮는다
const byFile = new Map();
for (const n of names) {
  const rel = `${CATALOG[n].cat}/${fileName(n)}.glb`;
  if (byFile.has(rel)) {
    console.error(`같은 파일로 간다: ${byFile.get(rel)}, ${n} → ${rel}`);
    process.exit(1);
  }
  byFile.set(rel, n);
}
for (const { k, ext } of [...sounds, ...pictures]) {
  const rel = `${CATALOG[k].cat}/${fileName(k)}${ext}`;
  if (byFile.has(rel)) {
    console.error(`같은 파일로 간다: ${byFile.get(rel)}, ${k} → ${rel}`);
    process.exit(1);
  }
  byFile.set(rel, k);
}

const manifest = { version, assets: {} };
const one = async (k) => {
  const c = CATALOG[k];
  const src = path.join(raw, k + ".glb");
  const before = stat(src);
  const rel = `${c.cat}/${fileName(k)}.glb`;
  const out = path.join(dist, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  let cur = src;
  const step = async (args, tag) => {
    const nx = path.join(tmp, `${k}.${tag}.glb`);
    await run(G, [args[0], cur, nx, ...args.slice(1)]);
    cur = nx;
  };
  if (!before.skinned && c.tris && before.tris > c.tris * 1.15) {
    await step(["weld"], "w");
    const ratio = String(Math.max(0.02, c.tris / before.tris));
    await step(["simplify", "--ratio", ratio, "--error", "0.01"], "s");
  }
  await step(["resize", "--width", String(c.tex), "--height", String(c.tex)], "r");
  await step(["webp", "--quality", "82"], "p");
  if (before.skinned) fs.copyFileSync(cur, out);
  else await run(G, ["meshopt", cur, out, "--level", "medium"]);
  const after = stat(out);
  manifest.assets[k] = {
    file: rel,
    category: c.cat,
    bytes: after.bytes,
    tris: after.tris,
    box: boxOf(src),
    ...(before.skinned ? { skinned: true } : {}),
  };
  for (const f of fs.readdirSync(tmp)) if (f.startsWith(k + ".")) fs.rmSync(path.join(tmp, f));
  return [k, before, after];
};

const queue = [...names];
const rows = [];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const k = queue.shift();
      try {
        rows.push(await one(k));
      } catch (e) {
        console.error("실패 " + k + ": " + String(e.message).slice(0, 200));
        process.exitCode = 1;
      }
    }
  }),
);
for (const f of fs.readdirSync(raw).filter((f) => f.endsWith(".jpg"))) {
  const rel = `sky/${f.replace("SUACI_", "").toLowerCase()}`;
  fs.mkdirSync(path.join(dist, "sky"), { recursive: true });
  fs.copyFileSync(path.join(raw, f), path.join(dist, rel));
  const bytes = fs.statSync(path.join(raw, f)).size;
  manifest.assets[f.slice(0, -4)] = { file: rel, category: "sky", bytes };
}
for (const { f, ext, k } of [...sounds, ...pictures]) {
  const rel = `${CATALOG[k].cat}/${fileName(k)}${ext}`;
  fs.mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true });
  fs.copyFileSync(path.join(raw, f), path.join(dist, rel));
  const bytes = fs.statSync(path.join(raw, f)).size;
  manifest.assets[k] = { file: rel, category: CATALOG[k].cat, bytes };
}
// 존별 색 바꾸기: 규칙(recolorRules.mjs)의 변형 모델을 방금 만든 원본에서 뽑아 같은 버전에 싣는다(<원본>@<존>)
const variants = await addVariants(dist, manifest);
for (const [k, a] of Object.entries(variants))
  console.log(`변형 ${k} → ${a.file} (${a.changed}px)`);
manifest.assets = Object.fromEntries(
  Object.entries(manifest.assets).sort(([, a], [, b]) => a.file.localeCompare(b.file)),
);
fs.writeFileSync(path.join(dist, "manifest.json"), JSON.stringify(manifest, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
const sum = (i, key) => rows.reduce((s, r) => s + r[i][key], 0);
const mb = (i) => (sum(i, "bytes") / 1e6).toFixed(1);
console.log(
  `${rows.length}개 · ${mb(1)}MB → ${mb(2)}MB · 폴리곤 ${sum(1, "tris")} → ${sum(2, "tris")}`,
);
if (sounds.length) console.log(`소리 ${sounds.length}개(그대로 실음)`);
if (pictures.length) console.log(`그림 ${pictures.length}개(그대로 실음)`);
