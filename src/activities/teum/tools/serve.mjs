// 로컬 미리보기용 에셋 서버: 배포본 폴더(dist)를 CORS 를 열어 내보낸다. 운영은 CloudFront 가 같은 일을 한다.
// 사용: node serve.mjs <dist 폴더> [포트=4610]
//   .env.local 에 NEXT_PUBLIC_TEUM_ASSET_BASE=http://localhost:4610 을 두면 게임이 여기서 받는다
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
const port = Number(process.argv[3] ?? 4610);
if (!process.argv[2] || !fs.existsSync(root)) {
  console.error("사용: node serve.mjs <dist 폴더> [포트]");
  process.exit(1);
}
const TYPES = {
  ".glb": "model/gltf-binary",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(root, rel);
    if (
      !file.startsWith(root + path.sep) ||
      !fs.existsSync(file) ||
      fs.statSync(file).isDirectory()
    ) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
      "Content-Length": fs.statSync(file).size,
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`${root} → http://localhost:${port}`));
