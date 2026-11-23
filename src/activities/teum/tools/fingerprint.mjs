// '틈' 지문: 바꾸기 전과 뒤에 세계가 똑같이 움직이는지 숫자로 비교한다(리팩토링처럼 값·순서를 바꾸지 않는 일의 확인).
// 같은 씨앗(?seed=7)·같은 축제 지역(?fest=0)으로 짓고, 화면 프레임을 이 도구가 직접 돌린다 — 첫 프레임은 0.1초로 잘리고
// 그 뒤로는 1/60초. 구간마다 네트워크가 잠잠하고 받는 중인 모델이 없을 때까지 기다린다(늦게 도착한 모델이 보이기 시작하는
// 때에 따라 쓰는 난수가 달라지는 것들이 있어, 도착을 늘 같은 구간 경계에 맞춘다).
// 뜨는 것: 배치 전체 · 놓인 수 · 가만히 2초 · 놀이기구·장소마다 순간이동한 뒤 3초 · 키를 눌러 나는 9초 · 끝 상태.
// 사용: 개발 서버(`next dev`, 에셋은 tools/serve.mjs)를 띄우고
//   node fingerprint.mjs <origin> <out.json>                      지문을 뜬다
//   node fingerprint.mjs --compare <before.json> <after.json>     비교한다(같으면 0, 다르면 1로 끝난다)
// 비교는 끝 상태의 호수 물고기만 뺀다 — 같은 코드로도 판마다 아주 조금 흔들린다(그 밖은 모두 정확히 같아야 한다).
// 크롬은 깔려 있는 것을 쓴다: TEUM_CHROME 으로 바꾼다
import fs from "node:fs";

const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

if (process.argv[2] === "--compare") {
  const [before, after] = process.argv.slice(3);
  const same = compare(readJson(before), readJson(after));
  console.log(same ? "SAME" : "DIFFERENT");
  process.exit(same ? 0 : 1);
}

const [origin, out] = process.argv.slice(2);
if (!origin || !out) {
  console.error(
    "사용: node fingerprint.mjs <origin> <out.json> | --compare <before.json> <after.json>",
  );
  process.exit(1);
}
const { default: puppeteer } = await import("puppeteer-core");

// 프레임은 도구가 돌린다: requestAnimationFrame 을 줄에 세우고 __tick(n) 이 1/60초 간격 시각으로 부른다
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
      const cbs = queue.splice(0);
      for (const cb of cbs) cb(clock);
    }
  };
};

const browser = await puppeteer.launch({
  executablePath: process.env.TEUM_CHROME ?? DEFAULT_CHROME,
  headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--use-angle=metal"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.evaluateOnNewDocument(HOOK);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(`${origin}/events/teum?seed=7&fest=0&quick`, {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await page.waitForFunction(() => window.__teum && window.__teum.probe.ready(), {
  timeout: 180000,
  polling: 500,
});

/** 네트워크가 잠잠하고 받는 중인 모델이 없을 때까지 */
async function settle(idle = 150) {
  await page.waitForNetworkIdle({ idleTime: idle, timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => window.__teum.game.s.models.waiting.size === 0, {
    timeout: 60000,
    polling: 50,
  });
}
/** n 프레임 돌리고 몸 상태 */
function stepPlayer(n) {
  return page.evaluate((n) => {
    window.__tick(n);
    return window.__teum.probe.player();
  }, n);
}

await settle(1000);
const fp = await page.evaluate(() => {
  const P = window.__teum.probe;
  return {
    map: P.mapName(),
    fest: P.festStart(),
    counts: P.counts(),
    place: P.place(),
    whale0: P.whale(),
    creatures0: P.creatures(),
    targets: P.rideTargets(),
  };
});

// 가만히 2초
const idle = [];
for (let k = 0; k < 8; k++) {
  idle.push(
    await page.evaluate(
      () => (
        window.__tick(15),
        { p: window.__teum.probe.player(), w: window.__teum.probe.whale() }
      ),
    ),
  );
  await settle();
}
fp.idle = { rec: idle, creatures: await page.evaluate(() => window.__teum.probe.creatures()) };

// 놀이기구·장소마다: 그 자리로 순간이동 → 3초(15프레임마다)
fp.rides = [];
for (const [name, at, air] of fp.targets) {
  await page.evaluate(
    (at, air) => {
      const P = window.__teum.probe;
      const v = P.vec().set(at[0], at[1], at[2]);
      P.teleport(v, null, air);
    },
    at,
    air,
  );
  const r = [];
  for (let k = 0; k < 12; k++) {
    r.push(await stepPlayer(15));
    await settle();
  }
  const tail = await page.evaluate(() => ({
    held: window.__teum.probe.held(),
    talk: window.__teum.probe.talk(),
  }));
  fp.rides.push([name, { r, ...tail }]);
}

// 키로 날기: 앞 3초 → 앞+왼쪽 2초 → 놓고 2초 → 앞+오른쪽 2초(20프레임마다)
fp.fly = [];
for (const [keys, frames] of [
  [["ArrowUp"], 180],
  [["ArrowUp", "ArrowLeft"], 120],
  [[], 120],
  [["ArrowUp", "ArrowRight"], 120],
]) {
  for (const k of keys) await page.keyboard.down(k);
  for (let f = 0; f < frames; f += 20) {
    fp.fly.push(await stepPlayer(20));
    await settle();
  }
  for (const k of keys) await page.keyboard.up(k);
}
fp.end = await page.evaluate(() => {
  const P = window.__teum.probe;
  return { creatures: P.creatures(), whale: P.whale(), pops: P.pops() };
});
fp.errors = errors;
await browser.close();
fs.writeFileSync(out, JSON.stringify(fp));
console.log(
  `${out}: 놀이기구 ${fp.rides.length}곳 · 비행 ${fp.fly.length}구간 · 페이지 오류 ${errors.length}`,
);

/* ─── 내부 ─────────────────────────── */

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// 배치·수·가만히·놀이기구·비행은 정확히 같아야 하고, 끝 상태는 호수 물고기만 뺀다. 다른 곳을 알린다
function compare(a, b) {
  const diffs = [];
  for (const k of [
    "map",
    "fest",
    "counts",
    "place",
    "whale0",
    "creatures0",
    "targets",
    "idle",
    "fly",
  ]) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diffs.push(k);
  }
  const rides = Math.max(a.rides.length, b.rides.length);
  for (let i = 0; i < rides; i++) {
    if (JSON.stringify(a.rides[i]) === JSON.stringify(b.rides[i])) continue;
    diffs.push(`ride ${a.rides[i]?.[0] ?? b.rides[i]?.[0]}`);
    break;
  }
  const notFish = (list) => list.filter((c) => c.type !== "fish");
  const endA = { ...a.end, creatures: notFish(a.end.creatures) };
  const endB = { ...b.end, creatures: notFish(b.end.creatures) };
  if (JSON.stringify(endA) !== JSON.stringify(endB)) diffs.push("end");
  if (b.errors.length) diffs.push(`page errors ${b.errors.length}`);
  for (const d of diffs) console.log("다름:", d);
  return diffs.length === 0;
}
