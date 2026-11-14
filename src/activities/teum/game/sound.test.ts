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
  readonly started: { loop: boolean }[] = [];
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
      connect: (to: unknown) => to,
      start: () => this.started.push(source),
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

  it("manifest 에 없는 소리 키 → 없는 것으로 친다", () => {
    const { sound } = manager({ effects: { bubblePopped: { key: "nope" } } });
    expect(sound.hasSounds).toBe(false);
    sound.dispose();
  });

  it("첫 손짓 전 → 일이 일어나도 소리 없이 지나가고 파일도 받지 않는다", async () => {
    const { events, sound } = manager();
    events.emit("bubblePopped", { combo: 1 });
    await settle();
    expect([FakeAudioContext.made.length, fetched]).toEqual([0, []]);
    sound.dispose();
  });

  it("첫 손짓 → 소리를 열고 효과음 파일을 받기 시작, 그 뒤의 일은 효과음으로 난다", async () => {
    const { events, sound } = manager();
    touch();
    expect([ctx().state, fetched]).toEqual(["running", ["https://cdn.test/audio/sfx/pop.m4a"]]);
    events.emit("bubblePopped", { combo: 1 });
    await settle();
    expect(ctx().started).toHaveLength(1);
    sound.dispose();
  });

  it("같은 소리를 여러 번 → 파일은 한 번만 받는다", async () => {
    const { events, sound } = manager();
    touch();
    events.emit("bubblePopped", { combo: 1 });
    events.emit("bubblePopped", { combo: 2 });
    await settle();
    expect([fetched.length, ctx().started.length]).toEqual([1, 2]);
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
