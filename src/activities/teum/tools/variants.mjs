// 이미 만든 배포본 버전에 존별 색 바꾸기 변형 모델을 더한다(원본에서 다시 빌드하지 않고). 버전 안의 원래 파일은 건드리지 않는다.
// 사용: node variants.mjs <배포본 버전 폴더>   예: node variants.mjs ~/teum/dist/v10
// 하는 일: 규칙(recolorRules.mjs)의 변형마다 <분류>/<원본 파일>@<존>.glb 를 쓰고, 그 버전의 manifest.json 에 줄을 더하고,
// 더한 줄을 variants.json 으로도 남긴다 — 그 버전의 manifest.json 은 CDN 에서 덮어쓰지 않으므로 이 파일을 게임의 assets/variants.<버전>.json 으로
// 옮기고(게임이 받은 manifest 에 더한다), manifest 사본(assets/manifest.<버전>.json)에도 같은 줄을 넣는다. 새 버전을 빌드하면 build.mjs 가 같은 일을 한다
import fs from "node:fs";
import path from "node:path";

import { addVariants } from "./recolor.mjs";

const [distArg] = process.argv.slice(2);
if (!distArg) {
  console.error("사용: node variants.mjs <배포본 버전 폴더>");
  process.exit(1);
}
const dist = path.resolve(distArg);
const manifestFile = path.join(dist, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
const added = await addVariants(dist, manifest);
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
fs.writeFileSync(path.join(dist, "variants.json"), JSON.stringify(added, null, 1));
for (const [k, a] of Object.entries(added))
  console.log(`${k} → ${a.file} (${a.bytes}B, ${a.changed}px)`);
