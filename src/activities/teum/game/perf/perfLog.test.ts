import { describe, expect, it } from "vitest";

import type { PerfContext } from "./perfLog";
import { PerfLog } from "./perfLog";

// 폰에서 직접 재는 기록: 끊긴 프레임과 그때의 상태를 적는다

/** 세상에서 평범하게 놀고 있는 프레임의 상태 */
function world(over: Partial<PerfContext> = {}): PerfContext {
  return {
    air: 3,
    isHeld: false,
    isInStudio: false,
    triangles: 480_000,
    calls: 130,
    programs: 43,
    geometries: 250,
    textures: 120,
    ratio: 2,
    isSettling: false,
    eaten: 0,
    workMs: 4,
    ...over,
  };
}
/** 같은 간격의 프레임을 n 장 넣는다 */
function feed(log: PerfLog, n: number, ms: number, now = world()) {
  for (let i = 0; i < n; i++) log.frame(ms, now);
}
/** report 의 둘째 줄(값)을 읽는다 */
function dataOf(log: PerfLog) {
  const text = log.report({ ua: "test" }),
    json = text.split("\n")[1];
  return JSON.parse(json);
}

describe("PerfLog", () => {
  it("고른 프레임만 → 끊김 0, 보통 간격은 그 간격", () => {
    const log = new PerfLog();
    feed(log, 600, 16.7);
    const data = dataOf(log);
    expect([data.frames, data.drops, data.typicalMs]).toEqual([600, 0, 17]);
  });

  it("한 장을 건너뛴 프레임(34ms) → 끊김으로 적고, 그때의 높이·삼각형·먹은 풍선을 남긴다", () => {
    const log = new PerfLog();
    feed(log, 300, 16.7);
    const high = world({ air: 120, isHeld: true, triangles: 930_000, calls: 190, eaten: 4 });
    log.frame(34, high);
    const data = dataOf(log);
    expect(data.drops).toBe(1);
    expect(data.dropList[0].slice(1, 6)).toEqual([34, 120, 1, 930, 190]);
    expect(data.dropList[0][11]).toBe(4);
  });

  it("그 프레임에 셰이더·도형·그림이 새로 생겼으면 → 끊긴 프레임에 그 수를 남긴다", () => {
    const log = new PerfLog();
    feed(log, 300, 16.7);
    const fresh = world({ programs: 44, geometries: 253, textures: 121 });
    log.frame(60, fresh);
    expect(dataOf(log).dropList[0].slice(6, 9)).toEqual([1, 3, 1]);
  });

  it("초당 120장 화면(8ms)에서 → 20ms 는 아직 끊김이 아니고(25ms 아래) 30ms 는 끊김이다", () => {
    const log = new PerfLog();
    feed(log, 300, 8.3);
    log.frame(20, world());
    log.frame(30, world());
    expect(dataOf(log).drops).toBe(1);
  });

  it("느린 기기(늘 33ms)에서 → 34ms 는 끊김이 아니고 60ms 는 끊김이다(기준이 없는 맨 첫 장만 끊김으로 적힌다)", () => {
    const log = new PerfLog();
    feed(log, 300, 33.3);
    log.frame(34, world());
    log.frame(60, world());
    const data = dataOf(log),
      lengths = data.dropList.map((drop: number[]) => drop[1]);
    expect([data.steadyMs, lengths]).toEqual([33, [33, 60]]);
  });

  it("세상에 들어선 첫 프레임이 길면(200ms) → 그것도 끊김으로 적고, 그 뒤의 고른 간격은 17ms 로 잡힌다", () => {
    const log = new PerfLog();
    log.frame(200, world());
    feed(log, 300, 16.7);
    log.frame(40, world());
    const data = dataOf(log),
      lengths = data.dropList.map((drop: number[]) => drop[1]);
    expect([data.steadyMs, data.worstMs, lengths]).toEqual([17, 200, [200, 40]]);
  });

  it("간격이 0 이거나 음수인 맨 첫 프레임 → 세지 않는다", () => {
    const log = new PerfLog();
    log.frame(-300, world());
    log.frame(0, world());
    feed(log, 10, 16.7);
    const data = dataOf(log);
    expect([data.frames, data.seconds, data.drops]).toEqual([10, 0, 0]);
  });

  it("끊긴 프레임에는 게임이 쓴 시간도 남긴다 → 간격은 긴데 이 값이 짧으면 게임 코드 밖에서 걸린 것", () => {
    const log = new PerfLog();
    feed(log, 300, 16.7);
    const outside = world({ workMs: 5.24 });
    log.frame(50, outside);
    expect(dataOf(log).dropList[0][12]).toBe(5.2);
  });

  it("2초 넘는 간격(다른 앱에 다녀옴) → 끊김이 아니라 자리 비움으로 세고, 언제 얼마나였는지 남긴다", () => {
    const log = new PerfLog();
    feed(log, 300, 16.7);
    log.frame(4000, world());
    const data = dataOf(log);
    expect([data.drops, data.pauses, data.frames, data.pauseList]).toEqual([
      0,
      1,
      300,
      [[5, 4000]],
    ]);
  });

  it("1.2초 멈춤 → 자리 비움이 아니라 끊김으로 적는다(폰에서는 진짜 멈춤이 이만큼 길 수 있다)", () => {
    const log = new PerfLog();
    feed(log, 300, 16.7);
    log.frame(1200, world());
    const data = dataOf(log);
    expect([data.drops, data.pauses, data.worstMs]).toEqual([1, 0, 1200]);
  });

  it("꾸미기 씬의 프레임 → 따로 세고 끊김·평균에 넣지 않는다", () => {
    const log = new PerfLog();
    const studio = world({ isInStudio: true });
    feed(log, 100, 50, studio);
    feed(log, 300, 16.7);
    const data = dataOf(log);
    expect([data.studioFrames, data.frames, data.drops]).toEqual([100, 300, 0]);
  });

  it("5초마다 구간을 닫아 → 평균 간격·가장 긴 간격·평균 높이·삼각형(천)을 남긴다", () => {
    const log = new PerfLog();
    const flying = world({ air: 40, triangles: 700_000, calls: 150, workMs: 6 });
    feed(log, 299, 16.7, flying);
    log.frame(45, flying);
    const span = dataOf(log).spans[0];
    expect(span.slice(1)).toEqual([300, 16.8, 45, 40, 700, 150, 6, 1]);
  });

  it("화면에 보일 한 줄 → 구간이 닫힐 때만 바뀐다(끊길 때마다 화면을 건드리지 않는다)", () => {
    const log = new PerfLog();
    const before = log.readout;
    feed(log, 100, 16.7);
    const during = log.readout;
    feed(log, 200, 16.7);
    const closed = log.readout;
    log.frame(40, world());
    const afterDrop = log.readout;
    feed(log, 300, 16.7);
    expect([during === before, closed, afterDrop, log.readout]).toEqual([
      true,
      "60fps · 끊김 0",
      "60fps · 끊김 0",
      "60fps · 끊김 1",
    ]);
  });

  it("끊긴 프레임이 80장을 넘으면 → 목록은 80장까지만, 수는 다 센다", () => {
    const log = new PerfLog();
    feed(log, 300, 16.7);
    feed(log, 100, 50);
    const data = dataOf(log);
    expect([data.drops, data.dropList.length]).toEqual([100, 80]);
  });

  it("목록이 찬 뒤 더 긴 끊김이 오면 → 가장 짧은 것 자리에 적는다(긴 것부터 남긴다), 목록은 때 차례", () => {
    const log = new PerfLog();
    feed(log, 300, 16.7);
    feed(log, 90, 50);
    log.frame(90, world());
    log.frame(30, world());
    const data = dataOf(log),
      lengths: number[] = data.dropList.map((drop: number[]) => drop[1]),
      times: number[] = data.dropList.map((drop: number[]) => drop[0]),
      inOrder = times.every((t, i) => i === 0 || times[i - 1] <= t);
    expect([lengths.length, Math.max(...lengths), lengths.includes(30), inOrder]).toEqual([
      80,
      90,
      false,
      true,
    ]);
  });

  it("report 의 첫 줄 → 사람이 읽는 요약", () => {
    const log = new PerfLog();
    feed(log, 600, 16.7);
    log.frame(84, world());
    const head = log.report({}).split("\n")[0];
    expect(head).toBe("틈 측정 · 601장 · 평균 59fps(보통 17ms) · 끊김 1장 · 가장 긴 것 84ms");
  });

  it("간격 분포 → 화면 주기 사이의 경계(12·25·42·58·100ms)마다 묶은 수: 33ms 와 34ms 는 같은 묶음", () => {
    const log = new PerfLog();
    feed(log, 10, 8);
    feed(log, 20, 16.7);
    feed(log, 3, 33);
    feed(log, 2, 34);
    feed(log, 1, 50);
    feed(log, 1, 120);
    expect(dataOf(log).buckets).toEqual([10, 20, 5, 1, 0, 1]);
  });
});
