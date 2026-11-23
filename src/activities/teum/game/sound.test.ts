import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Manifest } from "../assets/manifest";
import { GameEvents } from "./events";
import type { SoundOptions } from "./sound";
import { SoundManager } from "./sound";

// 소리 장치 대역: 상태(돌기·멈춤)와 튼 소리만 적는다
class FakeAudioContext {
  static made: FakeAudioContext[] = [];
  state: AudioContextState = "suspended";
  readonly destination = {};
  readonly started: { loop: boolean; playbackRate: { value: number }; at: number }[] = [];
  currentTime = 0;
  constructor() {
    FakeAudioContext.made.push(this);
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
  createGain() {
    return { gain: { value: 1 }, connect: (to: unknown) => to };
  }
  createBufferSource() {
    const source = {
      buffer: null as unknown,
      loop: false,
      playbackRate: { value: 1 },
      at: -1,
      connect: (to: unknown) => to,
      start: (at: number) => {
        source.at = at;
        this.started.push(source);
      },
    };
    return source;
  }
  decodeAudioData(data: ArrayBuffer) {
    return Promise.resolve({ data });
  }
}

const MANIFEST: Manifest = {
  version: "v3",
  assets: {
    pop: { file: "audio/sfx/pop.m4a", category: "audio/sfx", bytes: 9000 },
    ding: { file: "audio/sfx/ding.m4a", category: "audio/sfx", bytes: 7000 },
    tune: { file: "audio/bgm/tune.m4a", category: "audio/bgm", bytes: 400000 },
  },
};

const fetched: string[] = [];

function manager(change: Partial<SoundOptions> = {}) {
  const events = new GameEvents();
  const sound = new SoundManager({
    events,
    manifest: MANIFEST,
    urlOf: (file) => `https://cdn.test/${file}`,
    effects: { bubblePopped: { key: "pop" } },
    music: null,
    volume: { bgm: 0.5, sfx: 1 },
    ...change,
  });
  return { events, sound };
}

const touch = () => dispatchEvent(new Event("pointerdown"));
const settle = () => new Promise((r) => setTimeout(r, 0));
const ctx = () => FakeAudioContext.made.at(-1)!;

let hidden = false;

beforeEach(() => {
  FakeAudioContext.made = [];
  fetched.length = 0;
  hidden = false;
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      fetched.push(url);
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) });
    }),
  );
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SoundManager", () => {
  it("정한 소리가 없다 → 아무것도 듣지 않고 손짓에도 소리 장치를 만들지 않는다", () => {
    const { sound } = manager({ effects: {} });
    touch();
    expect([sound.hasSounds, FakeAudioContext.made.length]).toEqual([false, 0]);
    sound.dispose();
  });

  it("manifest 에 소리 에셋이 없으면(옛 에셋 판) → 아무것도 듣지 않는다", () => {
    const { sound } = manager({ manifest: { version: "v2", assets: {} } });
    expect(sound.hasSounds).toBe(false);
    sound.dispose();
  });

  it("규칙: 그 일의 값을 보고 소리를 고르고, null 이면 소리 없음", async () => {
    const { events, sound } = manager({
      effects: { sparkled: ({ dist }) => (dist < 45 ? { key: "ding", rate: 2 } : null) },
    });
    touch();
    events.emit("sparkled", { n: 6, dist: 80 });
    events.emit("sparkled", { n: 6, dist: 10 });
    await settle();
    expect(ctx().started.map((s) => s.playbackRate.value)).toEqual([2]);
    sound.dispose();
  });

  it("같은 소리는 gap 초 안에 다시 내지 않는다 · 빠르기 범위는 그 사이에서 고른다", async () => {
    const { events, sound } = manager({
      effects: { bubblePopped: { key: "pop", gap: 0.5, rate: [1, 2] } },
      random: () => 0.5,
    });
    touch();
    events.emit("bubblePopped", { combo: 1 });
    events.emit("bubblePopped", { combo: 2 });
    ctx().currentTime = 0.6;
    events.emit("bubblePopped", { combo: 3 });
    await settle();
    expect(ctx().started.map((s) => s.playbackRate.value)).toEqual([1.5, 1.5]);
    sound.dispose();
  });

  it("여러 소리 · 늦게 내기(delay)", async () => {
    const { events, sound } = manager({
      effects: { outfitPicked: [{ key: "pop" }, { key: "ding", delay: 0.35 }] },
    });
    touch();
    events.emit("outfitPicked", { random: false });
    await settle();
    expect(ctx().started.map((s) => s.at)).toEqual([0, 0.35]);
    sound.dispose();
  });

  it("첫 손짓 전 → 일이 일어나도 소리 없이 지나가고 파일도 받지 않는다", async () => {
    const { events, sound } = manager();
    events.emit("bubblePopped", { combo: 1 });
    await settle();
    expect([FakeAudioContext.made.length, fetched]).toEqual([0, []]);
    sound.dispose();
  });

  it("첫 손짓 → 소리를 열고 효과음 파일을 다 받기 시작, 그 뒤의 일은 효과음으로 난다", async () => {
    const { events, sound } = manager();
    touch();
    expect([ctx().state, fetched]).toEqual([
      "running",
      ["https://cdn.test/audio/sfx/pop.m4a", "https://cdn.test/audio/sfx/ding.m4a"],
    ]);
    events.emit("bubblePopped", { combo: 1 });
    await settle();
    expect(ctx().started).toHaveLength(1);
    sound.dispose();
  });

  it("같은 소리를 여러 번 → 파일은 한 번만 받고, 기본 쉬는 시간(0.05초) 안의 것은 한 번만 난다", async () => {
    const { events, sound } = manager();
    touch();
    events.emit("bubblePopped", { combo: 1 });
    events.emit("bubblePopped", { combo: 2 });
    await settle();
    expect([fetched.length, ctx().started.length]).toEqual([2, 1]);
    sound.dispose();
  });

  it("끄기 → 소리 장치를 멈추고 이 기기에 기억한다, 다시 켜면 돈다", () => {
    const { sound } = manager();
    touch();
    sound.setMuted(true);
    expect([ctx().state, localStorage.getItem("suaci.teum.muted")]).toEqual(["suspended", "1"]);
    sound.setMuted(false);
    expect([ctx().state, localStorage.getItem("suaci.teum.muted")]).toEqual(["running", null]);
    sound.dispose();
  });

  it("기억한 끄기 → 다음 판도 꺼진 채로 시작한다(손짓해도 멈춘 채)", async () => {
    localStorage.setItem("suaci.teum.muted", "1");
    const { events, sound } = manager();
    touch();
    events.emit("bubblePopped", { combo: 1 });
    await settle();
    expect([sound.isMuted, ctx().state, ctx().started.length]).toEqual([true, "suspended", 0]);
    sound.dispose();
  });

  it("탭이 숨으면 → 멈추고, 다시 보이면 돈다", () => {
    const { sound } = manager();
    touch();
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    const whileHidden = ctx().state;
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect([whileHidden, ctx().state]).toEqual(["suspended", "running"]);
    sound.dispose();
  });

  it("배경 음악 → 첫 손짓에 되풀이로 튼다", async () => {
    const { sound } = manager({ effects: {}, music: { key: "tune" } });
    touch();
    await settle();
    expect([sound.hasSounds, ctx().started.map((s) => s.loop)]).toEqual([true, [true]]);
    sound.dispose();
  });

  it("dispose → 듣기를 그치고 소리 장치를 닫는다", async () => {
    const { events, sound } = manager();
    touch();
    sound.dispose();
    events.emit("bubblePopped", { combo: 1 });
    await settle();
    expect([ctx().state, ctx().started.length]).toEqual(["closed", 0]);
  });
});

describe("SoundManager 소리 세션(아이폰 무음 스위치)", () => {
  it("소리를 열면 → 재생 세션(무음에서도 난다), 끄면 → 기본 세션, 다시 켜면 → 재생", () => {
    const session = { type: "auto" };
    Object.defineProperty(navigator, "audioSession", { configurable: true, value: session });
    const { sound } = manager({});
    touch();
    const opened = session.type;
    sound.setMuted(true);
    const muted = session.type;
    sound.setMuted(false);
    expect([opened, muted, session.type]).toEqual(["playback", "auto", "playback"]);
    sound.dispose();
    Reflect.deleteProperty(navigator, "audioSession");
  });

  it("탭이 숨으면 → 기본 세션(다른 앱 음악이 다시 돌 수 있게)", () => {
    const session = { type: "auto" };
    Object.defineProperty(navigator, "audioSession", { configurable: true, value: session });
    const { sound } = manager({});
    touch();
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(session.type).toBe("auto");
    sound.dispose();
    Reflect.deleteProperty(navigator, "audioSession");
  });

  it("창구가 없는 브라우저 → 그대로 소리를 연다", () => {
    const { sound } = manager({});
    touch();
    expect(FakeAudioContext.made.length).toBe(1);
    sound.dispose();
  });
});
