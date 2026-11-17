// 지도 점검(브라우저 쪽) — map-check.sh 가 부른다.
// <origin>/events/teum?map=<지도>&seed=<씨앗> 을 폰처럼 열어: 지도 점검 결과 · 지어진 세계의 점검(엉킨 곳 — 흩뿌린 것·숨바꼭질 물건까지) ·
// 놓인 수 · 첫 화면 목록과 바이트 · 성능 한 번(가만히 10초)을 보여 준다.
// 성능은 에뮬레이션이다(헤드리스 크롬, 390×844 DPR 3 — 게임은 2로 자른다, CPU 4배 느리게, 개발 서버). 폰 실기가 아니다.
// 크롬은 깔려 있는 것을 쓴다(puppeteer-core 는 크롬을 받지 않는다): TEUM_CHROME 으로 바꾼다.
// 사용: node mapCheck.mjs <origin> <map> <seed> [gpu|swiftshader]
import puppeteer from "puppeteer-core";

const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
/** 재는 시간(초) */
const SECONDS = 10;
/** 엉킨 곳을 보여 주는 줄 수(가운데에서 가까운 차례) */
const TANGLE_LINES = 40;

const [origin, map, seed, modeArg] = process.argv.slice(2);
if (!origin || !map || !seed) {
  console.error("사용: node mapCheck.mjs <origin> <map> <seed> [gpu|swiftshader]");
  process.exit(1);
}
const gpuArgs =
  (modeArg ?? "gpu") === "gpu"
    ? ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--use-angle=metal"]
    : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

// 페이지에 먼저 심는 것: 렌더러를 잡고(three 개발 도구 고리) 프레임마다 시간·그리기 수·힙을 적는다
const HOOK = () => {
  const W = window;
  W.__perf = { frames: [], on: false };
  const devtools = new EventTarget();
  devtools.addEventListener("observe", (e) => {
    const o = e.detail;
    if (o && o.isWebGLRenderer) W.__perf.renderer = o;
  });
  W.__THREE_DEVTOOLS__ = devtools;
  const raf = W.requestAnimationFrame.bind(W);
  W.requestAnimationFrame = (cb) =>
    raf((t) => {
      const st = performance.now();
      cb(t);
      const en = performance.now();
      const P = W.__perf;
      if (!P.on || !P.renderer) return;
      const r = P.renderer.info;
      const heap = performance.memory ? performance.memory.usedJSHeapSize : 0;
      P.frames.push([st, en - st, r.render.calls, r.render.triangles, heap]);
    });
};

const pct = (arr, q) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

const browser = await puppeteer.launch({
  executablePath: process.env.TEUM_CHROME || DEFAULT_CHROME,
  headless: true,
  protocolTimeout: 900000,
  args: [...gpuArgs, "--enable-precise-memory-info"],
});
const page = await browser.newPage();
await page.setUserAgent(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
);
await page.setViewport({
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
await page.evaluateOnNewDocument(HOOK);
const warnings = [];
page.on("console", (m) => {
  if (m.type() === "warning" || m.type() === "error") warnings.push(m.text().slice(0, 200));
});
const url = `${origin}/events/teum?map=${encodeURIComponent(map)}&seed=${encodeURIComponent(seed)}`;
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForFunction(() => window.__teum, { timeout: 300000, polling: 200 });
const built = await page.evaluate(() => {
  const p = window.__teum.probe;
  return { mapName: p.mapName(), problems: p.check(), counts: p.counts(), first: p.firstScreen() };
});
// 첫 화면이 그려지고, 뒤에서 받는 나머지까지 다 온 뒤에 잰다
await page.waitForFunction(
  () => window.__perf.renderer && window.__perf.renderer.info.render.frame > 2,
  { timeout: 300000, polling: 200 },
);
await page.waitForFunction(() => window.__teum.probe.ready(), { timeout: 300000, polling: 500 });
await new Promise((r) => setTimeout(r, 1500));
// 지어진 세계의 점검: 씨앗으로 흩뿌린 것과 숨바꼭질 물건까지 실제로 놓인 몸으로 본다(값만 보는 점검은 위의 problems)
const audit = await page.evaluate(() => window.__teum.map.audit());
const cdp = await page.createCDPSession();
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const renderer = await page.evaluate(() => {
  const gl = window.__perf.renderer.getContext();
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "?";
});
await page.evaluate(() => {
  window.__perf.frames = [];
  window.__perf.on = true;
});
await new Promise((r) => setTimeout(r, SECONDS * 1000));
const frames = await page.evaluate(() => {
  window.__perf.on = false;
  return window.__perf.frames;
});
await browser.close();

const starts = frames.map((f) => f[0]);
const deltas = starts.slice(1).map((s, i) => s - starts[i]);
const perf = {
  fps: +(frames.length / SECONDS).toFixed(1),
  frameP95: +pct(deltas, 0.95).toFixed(1),
  jsP95: +pct(
    frames.map((f) => f[1]),
    0.95,
  ).toFixed(2),
  calls: Math.round(mean(frames.map((f) => f[2]))),
  tris: Math.round(mean(frames.map((f) => f[3]))),
  heapMB: +(mean(frames.map((f) => f[4])) / 1048576).toFixed(1),
};

// ---- 보여 주기 ----
const mb = (b) => (b / 1e6).toFixed(2) + " MB";
const line = (o) =>
  Object.entries(o)
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ");
console.log(`지도 ${built.mapName} (요청 ${map}) · 씨앗 ${seed}`);
if (built.mapName !== map)
  console.log(
    `  ! ?map=${map} 이 아니라 ${built.mapName} 로 지었다 — 지도 목록(maps/index.ts)을 확인`,
  );
const problemCount = built.problems.length ? built.problems.length + "건" : "문제 없음";
console.log(`\n[점검] ${problemCount}`);
for (const p of built.problems) console.log(`  ${p.kind} — ${p.what}`);
const tangleCounts = {};
for (const row of audit.rows) {
  const key = `${row.group} ${row.kind}`;
  tangleCounts[key] = (tangleCounts[key] ?? 0) + 1;
}
const tangleLine = audit.rows.length
  ? `${audit.rows.length}곳 — ${line(tangleCounts)}`
  : "엉킨 곳 없음";
console.log(`\n[지어진 세계의 점검] 몸 ${audit.bodies}개 · ${tangleLine}`);
for (const row of audit.rows.slice(0, TANGLE_LINES)) {
  const where = `(${row.x.toFixed(0)}, ${row.y.toFixed(0)})`;
  console.log(`  ${row.no}. ${row.kind} — ${row.a} · ${row.b} ${where} ${row.depth.toFixed(1)}m`);
}
if (audit.rows.length > TANGLE_LINES)
  console.log(`  … 그 밖 ${audit.rows.length - TANGLE_LINES}곳`);
for (const slope of audit.slopes)
  console.log(`  비탈 — ${slope.id}: 자리 안의 땅 높이 차 ${slope.drop.toFixed(1)}m`);
if (audit.unmeasured.length)
  console.log(`  굵기 표에 없는 모델(통째 원기둥으로 봄): ${audit.unmeasured.join(" ")}`);
console.log(`\n[놓인 수]`);
for (const [group, o] of Object.entries(built.counts)) console.log(`  ${group}: ${line(o)}`);
const firstLine = `${built.first.keys.length}개 · ${mb(built.first.bytes)} / 전체 ${mb(built.first.total)}`;
console.log(`\n[첫 화면] ${firstLine}`);
console.log(`  ${built.first.keys.join(" ")}`);
console.log(
  `\n[성능 한 번 — 에뮬레이션: 헤드리스 크롬 ${renderer}, 390×844 DPR3(게임 2), CPU×4, 개발 서버, 가만히 ${SECONDS}초]`,
);
const perfLine = line({
  fps: perf.fps,
  "프레임 p95(ms)": perf.frameP95,
  "JS p95(ms)": perf.jsP95,
  "그리기 호출": perf.calls,
  삼각형: perf.tris,
  "힙(MB)": perf.heapMB,
});
console.log(`  ${perfLine}`);
if (warnings.length) {
  console.log(`\n[브라우저 경고·오류 ${warnings.length}건]`);
  for (const w of warnings.slice(0, 10)) console.log(`  ${w}`);
}
