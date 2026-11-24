// '틈' 성능 재기: 무엇이 무거운지, 고친 뒤 얼마나 가벼워졌는지 숫자로 본다.
// 같은 씨앗(?seed=7)·같은 축제 지역(?fest=0)으로 짓고, 세 마을의 정해진 자리 아홉 곳(땅 위 · 낮게 날 때 · 높이 떴을 때)에서
// 프레임을 이 도구가 직접 넘기며 잰다:
//   · 프레임 한 장의 시간(ms) — 게임 셈 + 그리기 호출 + GPU 가 그 프레임을 다 그릴 때까지(픽셀 하나를 읽어 기다린다)
//   · 그리기 호출 · 삼각형 · 셰이더 프로그램 · 도형 · 텍스처 수
//   · 무엇이 삼각형을 쓰나(재질 이름별, 이름 없는 도형은 도형 종류와 하나당 삼각형 수로)
// 프레임 시간은 이 컴퓨터의 GPU 로 잰 값이라 폰의 시간이 아니다 — 전후를 견주는 데만 쓴다. 삼각형·그리기 호출 수는 어디서나 같다.
// 사용: 개발 서버(`next dev`, 에셋은 tools/serve.mjs)를 띄우고
//   node perf.mjs <origin> <out.json> [지도] [화면 배율]        잰다(지도를 안 주면 기본 지도, 배율은 2)
//   node perf.mjs --compare <before.json> <after.json>           전후를 나란히 보인다
// 크롬은 깔려 있는 것을 쓴다: TEUM_CHROME 으로 바꾼다
import fs from "node:fs";

const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
/** 자리마다 재는 프레임 수 · 삼각형을 많이 쓰는 것을 몇 개까지 적나 */
const FRAMES = 120,
  TOP = 12;

if (process.argv[2] === "--compare") {
  const [before, after] = process.argv.slice(3);
  compare(readJson(before), readJson(after));
  process.exit(0);
}

const [origin, out, map = "", ratio = "2"] = process.argv.slice(2);
if (!origin || !out) {
  console.error(
    "사용: node perf.mjs <origin> <out.json> [지도] [화면 배율] | --compare <before.json> <after.json>",
  );
  process.exit(1);
}
const { default: puppeteer } = await import("puppeteer-core");

// 프레임은 도구가 넘긴다: requestAnimationFrame 을 줄에 세우고 __tick(n) 이 1/60초 간격 시각으로 부른다
const HOOK = () => {
  const queue = [];
  let clock = 0;
  window.requestAnimationFrame = (cb) => {
    queue.push(cb);
    return queue.length;
  };
  window.cancelAnimationFrame = () => {};
  window.__tick = (n) => {
    for (let i = 0; i < n; i++) {
      if (clock === 0) clock = performance.now() + 1000;
      else clock += 1000 / 60;
      for (const cb of queue.splice(0)) cb(clock);
    }
  };
};

const browser = await puppeteer.launch({
  executablePath: process.env.TEUM_CHROME || DEFAULT_CHROME,
  headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--use-angle=metal"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: Number(ratio) });
await page.evaluateOnNewDocument(HOOK);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const query = map ? `map=${map}&` : "";
await page.goto(`${origin}/events/teum?${query}seed=7&fest=0&quick`, {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await page.waitForFunction(() => window.__teum && window.__teum.probe.ready(), {
  timeout: 180000,
  polling: 200,
});

// 네트워크가 잠잠하고 받는 중인 모델이 없을 때까지
async function settle() {
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => window.__teum.game.s.models.waiting.size === 0, {
    timeout: 60000,
    polling: 50,
  });
}
async function tick(n) {
  for (let k = 0; k < n; k += 15) {
    await page.evaluate((m) => window.__tick(m), Math.min(15, n - k));
    await settle();
  }
}
await settle();
await tick(90);

// 그리기 호출마다 삼각형을 재질 이름별로 모은다(켜 둔 동안만)
await page.evaluate(() => {
  const renderer = window.__teum.game.stage.renderer,
    real = renderer.renderBufferDirect.bind(renderer);
  window.__draws = null;
  renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    if (window.__draws) {
      const index = geometry.index,
        position = geometry.attributes.position;
      let count = index ? index.count : position ? position.count : 0;
      const range = geometry.drawRange;
      if (range && isFinite(range.count)) count = Math.min(count, range.count);
      if (group) count = Math.min(count, group.count);
      const instances = object.isInstancedMesh ? object.count : 1,
        each = Math.round(count / 3),
        many = object.isInstancedMesh ? "×" : "",
        name = material.name || object.name || `${geometry.type}:${each}${many}`;
      const entry = (window.__draws[name] ??= { tris: 0, calls: 0, instances: 0 });
      entry.tris += each * instances;
      entry.calls++;
      entry.instances += instances;
    }
    return real(camera, scene, geometry, material, object, group);
  };
});

// 자리: [이름, 마을(hub 번호), 마을에서 거리(m), 방위(도), 높이(m)] — 늘 마을 쪽을 본다
const views = [];
for (const hub of [0, 3, 4])
  views.push(
    [`t${hub}-ground`, hub, 45, 0, 1.5],
    [`t${hub}-fly`, hub, 90, 250, 28],
    [`t${hub}-high`, hub, 120, 60, 70],
  );
const rows = [];
for (const [name, hub, away, bear, air] of views) {
  await page.evaluate(
    (hub, away, bear, air) => {
      const g = window.__teum.game,
        probe = window.__teum.probe;
      const centre = g.s.occ.hubs[hub],
        from = g.s.occ.hubAt(hub, away, bear).clone().normalize(),
        toward = centre.clone().addScaledVector(from, -centre.dot(from)).normalize();
      probe.teleport(from, toward, air);
    },
    hub,
    away,
    bear,
    air,
  );
  await tick(45);
  const row = await page.evaluate((frames) => {
    const renderer = window.__teum.game.stage.renderer,
      gl = renderer.getContext(),
      pixel = new Uint8Array(4),
      times = [];
    window.__draws = {};
    window.__tick(1);
    const draws = window.__draws;
    window.__draws = null;
    for (let i = 0; i < frames; i++) {
      const began = performance.now();
      window.__tick(1);
      // 한 픽셀을 읽어 GPU 가 이 프레임을 다 그릴 때까지 기다린다
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      times.push(performance.now() - began);
    }
    times.sort((a, b) => a - b);
    const list = Object.entries(draws).map(([name, e]) => ({ name, ...e }));
    return {
      // 가운데 값: 한두 프레임이 튀어도 흔들리지 않는다
      frame: times[Math.floor(frames / 2)],
      calls: list.reduce((n, e) => n + e.calls, 0),
      tris: list.reduce((n, e) => n + e.tris, 0),
      programs: renderer.info.programs.length,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      draws: list.sort((a, b) => b.tris - a.tris),
    };
  }, FRAMES);
  rows.push({ name, ...row });
  const tris = Math.round(row.tris / 1000);
  console.log(
    `${name.padEnd(10)} 프레임 ${row.frame.toFixed(2)}ms · 그리기 ${row.calls} · 삼각형 ${tris}k · 셰이더 ${row.programs}`,
  );
}
const mean = (key) => rows.reduce((n, r) => n + r[key], 0) / rows.length;
const summary = {
  frame: Number(mean("frame").toFixed(2)),
  calls: Math.round(mean("calls")),
  tris: Math.round(mean("tris")),
  programs: rows.at(-1).programs,
  geometries: rows.at(-1).geometries,
  textures: rows.at(-1).textures,
};
fs.writeFileSync(
  out,
  JSON.stringify({ map: map || "(기본)", ratio: Number(ratio), summary, rows }, null, 1),
);
console.log("평균", JSON.stringify(summary));
console.log("삼각형을 많이 쓰는 것(마지막 자리):");
for (const e of rows.at(-1).draws.slice(0, TOP))
  console.log(
    `  ${e.name.padEnd(24)} ${String(Math.round(e.tris / 1000)).padStart(5)}k · ${e.instances}개 · 그리기 ${e.calls}`,
  );
if (errors.length) console.log("콘솔 오류", errors.length, errors.slice(0, 3));
await browser.close();
process.exit(errors.length ? 1 : 0);

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

// 전후를 나란히: 평균, 자리마다의 삼각형
function compare(before, after) {
  const change = (a, b) => `${a} → ${b} (${a ? (((b - a) / a) * 100).toFixed(0) : "0"}%)`;
  const thousands = (n) => Math.round(n / 1000) + "k";
  console.log(`프레임(ms)   ${change(before.summary.frame, after.summary.frame)}`);
  console.log(`그리기 호출  ${change(before.summary.calls, after.summary.calls)}`);
  console.log(
    `삼각형       ${thousands(before.summary.tris)} → ${thousands(after.summary.tris)} (${(((after.summary.tris - before.summary.tris) / before.summary.tris) * 100).toFixed(0)}%)`,
  );
  console.log(`셰이더       ${change(before.summary.programs, after.summary.programs)}`);
  for (const row of after.rows) {
    const was = before.rows.find((r) => r.name === row.name);
    if (!was) continue;
    const delta = (((row.tris - was.tris) / was.tris) * 100).toFixed(0);
    console.log(
      `  ${row.name.padEnd(10)} 삼각형 ${thousands(was.tris)} → ${thousands(row.tris)} (${delta}%)`,
    );
  }
}
