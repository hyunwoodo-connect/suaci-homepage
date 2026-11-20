// 존별 색 바꾸기 — 모델 읽고 쓰기: 배포본 모델(meshopt 압축·webp 텍스처)을 풀어 바탕색 텍스처의 픽셀에 규칙(recolorRules)을 적용하고
// 같은 형식으로 다시 쓴다. 메시는 그대로다(텍스처 한 장만 바뀐다)
import fs from "node:fs";
import path from "node:path";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

import { recolorPixels, variantList } from "./recolorRules.mjs";

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

/** inFile 모델의 바탕색 텍스처에 swaps 를 적용해 outFile 로. 바꾼 픽셀 수를 돌려준다 */
export async function recolorGlb(inFile, outFile, swaps) {
  const doc = await io.read(inFile);
  let changed = 0;
  for (const mat of doc.getRoot().listMaterials()) {
    const tex = mat.getBaseColorTexture();
    if (!tex) continue;
    const img = tex.getImage();
    const mime = tex.getMimeType();
    const { data, info } = await sharp(Buffer.from(img))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    changed += recolorPixels(data, info.channels, swaps);
    const raw = sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    });
    const out =
      mime === "image/webp"
        ? await raw.webp({ quality: 82 }).toBuffer()
        : mime === "image/jpeg"
          ? await raw.jpeg({ quality: 90 }).toBuffer()
          : await raw.png().toBuffer();
    tex.setImage(new Uint8Array(out));
  }
  await io.write(outFile, doc);
  return changed;
}

/** 배포본 버전 폴더(distDir)의 원본마다 변형을 만들어 manifest(mf)에 더하고, 더한 줄을 돌려준다(이미 있는 파일은 덮어쓰지 않는다) */
export async function addVariants(distDir, mf) {
  const out = {};
  for (const [key, model, swaps] of variantList()) {
    const base = mf.assets[model];
    if (!base) {
      console.error(`원본이 없어 건너뛴다: ${model}`);
      continue;
    }
    const file = base.file.replace(/\.glb$/, `@${key.split("@")[1]}.glb`);
    const target = path.join(distDir, file);
    if (fs.existsSync(target)) {
      console.error(`이미 있다(덮어쓰지 않는다): ${file}`);
      continue;
    }
    const changed = await recolorGlb(path.join(distDir, base.file), target, swaps);
    const bytes = fs.statSync(target).size;
    const entry = { ...base, file, bytes };
    mf.assets[key] = entry;
    out[key] = { ...entry, changed };
  }
  return out;
}
