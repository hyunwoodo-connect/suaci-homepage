import type { Manifest } from "@/lib/asset-kit/manifest";

import type { SoundChannel, SoundCue, SoundRule, SoundTable } from "../assets/settings";
import type { GameEventMap, GameEventName, GameEvents } from "./events";

// 소리판: 알림판(events)을 듣고 표(소리 규칙)대로 소리를 낸다. manifest 에 소리가 없으면(옛 에셋 판) 아무것도 듣지 않는다.
// - 브라우저는 사람이 건드리기 전에는 소리를 막는다 → 첫 터치·클릭·키에 소리를 연다(그 전의 일은 소리 없이 지나간다).
//   소리 장치를 만드는 일은 느려서(폰에서 수십 ms) 첫 손짓의 프레임에 끼면 화면이 멈칫한다 → 놀이를 시작하기 전에 미리 만들어 두고(prepare),
//   손짓에는 깨우기만 한다
// - 끄기는 이 기기에 기억한다. 꺼져 있거나 탭이 숨으면 소리 장치를 멈춘다(배터리)
// - 아이폰은 무음 스위치를 켜 두면 웹 소리를 끈다 → 소리가 나는 동안은 소리 세션을 '재생'으로 두어 무음에서도 나게 한다(끄기는 게임의
//   소리 단추로). 재생 세션은 다른 앱의 음악을 멈추므로, 끄거나 탭이 숨으면 세션을 기본으로 돌려 그 음악이 다시 돌 수 있게 한다.
//   이 창구(navigator.audioSession)가 없는 브라우저(안드로이드·옛 사파리)는 그대로
// - 채널 둘: 배경 음악(bgm)·효과음(sfx), 크기를 따로 둔다
// - 소리 파일은 첫 화면과 같이 받지 않는다: 소리 장치를 만든 뒤에 받는다

/** 소리판이 받는 것 */
export interface SoundOptions {
  events: GameEvents;
  manifest: Manifest;
  /** manifest 의 파일 경로 → 받을 주소 */
  urlOf: (file: string) => string;
  /** 일어난 일 → 소리 */
  effects: SoundTable;
  /** 배경 음악(없으면 null) */
  music: SoundCue | null;
  /** 채널 크기 */
  volume: Readonly<Record<SoundChannel, number>>;
  /** 음높이를 고르는 난수(시험이 바꾼다 — 놀이에 쓰는 난수가 아니다) */
  random?: () => number;
}

/** 끄기를 기억하는 칸 */
const MUTED_KEY = "suaci.teum.muted";
/** 소리를 여는 사람의 손짓 */
const UNLOCK_EVENTS = ["pointerdown", "touchend", "keydown"] as const;
/** 크기·같은 소리 사이 쉬는 시간(초)을 정하지 않았을 때 */
const DEFAULT_VOLUME = 0.6,
  DEFAULT_GAP = 0.05;
/** 효과음 분류 */
const SFX_CATEGORY = "audio/sfx";

/** 소리판 */
export class SoundManager {
  /** 낼 소리가 있나(manifest 에 소리 에셋이 있고 표나 배경 음악이 있을 때). 없으면 끄기 단추도 두지 않는다 */
  readonly hasSounds: boolean;
  private ctx: AudioContext | null = null;
  private readonly channels = new Map<SoundChannel, GainNode>();
  private muted: boolean;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  /** 소리마다 마지막으로 낸 때(소리 장치 시계) */
  private readonly last = new Map<string, number>();
  private readonly music: SoundCue | null;
  /** 사람이 건드렸나(그 뒤에만 소리 장치를 깨우고 소리 세션을 바꾼다) */
  private isUnlocked = false;
  /** 배경 음악을 틀었나(한 번만 튼다) */
  private hasMusicStarted = false;
  private readonly offs: (() => void)[] = [];
  private readonly random: () => number;

  constructor(private readonly o: SoundOptions) {
    this.muted = readMuted();
    this.random = o.random ?? Math.random;
    const assets = o.manifest.assets;
    const hasEffects = Object.values(assets).some((a) => a.category === SFX_CATEGORY);
    const rules = Object.entries(o.effects) as [GameEventName, SoundRule<GameEventName>][];
    this.music = o.music && Object.hasOwn(assets, o.music.key) ? o.music : null;
    this.hasSounds = (hasEffects && rules.length > 0) || this.music !== null;
    if (!this.hasSounds) return;
    if (hasEffects)
      for (const [name, rule] of rules) {
        const off = o.events.on(name, (payload) => this.fire(rule, payload));
        this.offs.push(off);
      }
    const unlock = () => this.unlock();
    for (const type of UNLOCK_EVENTS)
      addEventListener(type, unlock, { capture: true, passive: true });
    const onVisibility = () => this.applyState();
    document.addEventListener("visibilitychange", onVisibility);
    this.offs.push(() => {
      for (const type of UNLOCK_EVENTS) removeEventListener(type, unlock, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
    });
  }

  /**
   * 소리 장치를 미리 만들어 두고 소리 파일을 받기 시작한다(놀이가 그리기 시작하기 전에 부른다). 손짓 전이라 장치는 멈춘 채고 소리는 나지 않는다.
   * 꺼 둔 사람에게는 만들지 않는다(첫 손짓에 만든다 — 켜면 바로 나게)
   */
  prepare() {
    if (!this.hasSounds || this.muted || this.ctx) return;
    this.open();
  }

  /** 꺼 두었나 */
  get isMuted(): boolean {
    return this.muted;
  }

  /** 끄기·켜기(이 기기에 기억한다) */
  setMuted(muted: boolean) {
    this.muted = muted;
    writeMuted(muted);
    this.applyState();
  }

  /** 듣기를 그치고 소리 장치를 닫는다 */
  dispose() {
    for (const off of this.offs) off();
    this.offs.length = 0;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) void ctx.close();
  }

  /* ─── 내부 ─────────────────────────── */

  // 손짓: 소리 장치를 깨우고(미리 만들어 두지 못했으면 지금 만든다) 배경 음악을 한 번 튼다. 그 뒤의 손짓은 멈춘 장치를 다시 깨운다(iOS)
  private unlock() {
    this.isUnlocked = true;
    if (!this.ctx) this.open();
    this.applyState();
    if (!this.music || this.hasMusicStarted) return;
    this.hasMusicStarted = true;
    this.startMusic(this.music);
  }

  // 소리 장치와 음량 줄을 만들고, 효과음·배경 음악 파일을 뒤에서 받기 시작한다(장치는 깨우기 전까지 멈춘 채다)
  private open() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    for (const [channel, level] of Object.entries(this.o.volume)) {
      const gain = ctx.createGain();
      gain.gain.value = level;
      gain.connect(master);
      this.channels.set(channel as SoundChannel, gain);
    }
    for (const [key, entry] of Object.entries(this.o.manifest.assets))
      if (entry.category === SFX_CATEGORY) void this.load(key);
    if (this.music) void this.load(this.music.key);
  }

  // 꺼져 있거나 탭이 숨으면 멈추고, 아니면 다시 돈다. 사람이 건드리기 전에는 아무것도 하지 않는다 —
  // 깨울 수 없고, 재생 세션으로 바꾸면 소리를 내기도 전에 다른 앱의 음악이 멈춘다
  private applyState() {
    const ctx = this.ctx;
    if (!ctx || !this.isUnlocked) return;
    const isSilent = this.muted || document.hidden;
    const session = isSilent ? "auto" : "playback";
    setAudioSession(session);
    if (isSilent && ctx.state === "running") void ctx.suspend();
    else if (!isSilent && ctx.state !== "running") void ctx.resume();
  }

  // 규칙을 풀어 소리를 낸다(규칙이 null 이면 소리 없음)
  private fire<K extends GameEventName>(rule: SoundRule<K>, payload: GameEventMap[K]) {
    const cues = typeof rule === "function" ? rule(payload) : rule;
    if (!cues) return;
    if (isCueList(cues)) for (const cue of cues) this.play(cue);
    else this.play(cues);
  }

  // 효과음 한 번(사람이 건드린 뒤, 소리 장치가 돌 때만 — 꺼져 있으면 그냥 지나간다). 같은 소리는 gap 초 안에 다시 내지 않는다.
  // 미리 만든 장치를 브라우저가 손짓 없이 돌게 두는 곳(자동 재생을 허락한 데스크탑)에서도 첫 손짓 전의 일은 소리 없이 지나간다
  private play(cue: SoundCue) {
    const ctx = this.ctx;
    const canSound = ctx !== null && this.isUnlocked && ctx.state === "running";
    if (!ctx || !canSound || !Object.hasOwn(this.o.manifest.assets, cue.key)) return;
    const t = ctx.currentTime,
      was = this.last.get(cue.key);
    if (was !== undefined && t - was < (cue.gap ?? DEFAULT_GAP)) return;
    this.last.set(cue.key, t);
    const rate = this.rateOf(cue);
    void this.load(cue.key).then((buffer) => {
      if (buffer && this.ctx === ctx) this.start(ctx, buffer, cue, rate, "sfx", false);
    });
  }

  private startMusic(cue: SoundCue) {
    const ctx = this.ctx!;
    const rate = this.rateOf(cue);
    void this.load(cue.key).then((buffer) => {
      if (buffer && this.ctx === ctx) this.start(ctx, buffer, cue, rate, "bgm", true);
    });
  }

  // 빠르기(음높이): 수 하나면 그대로, 범위면 그 사이 아무거나
  private rateOf(cue: SoundCue): number {
    const rate = cue.rate ?? 1;
    if (typeof rate === "number") return rate;
    const [lo, hi] = rate;
    return lo + (hi - lo) * this.random();
  }

  private start(
    ctx: AudioContext,
    buffer: AudioBuffer,
    cue: SoundCue,
    rate: number,
    channel: SoundChannel,
    loop: boolean,
  ) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = cue.volume ?? DEFAULT_VOLUME;
    const out = this.channels.get(channel)!;
    source.connect(gain).connect(out);
    const when = ctx.currentTime + (cue.delay ?? 0);
    source.start(when);
  }

  // 소리 파일을 한 번만 받아 푼다(못 받으면 그 소리는 없는 것으로)
  private load(key: string): Promise<AudioBuffer | null> {
    const known = this.buffers.get(key);
    if (known) return known;
    const ctx = this.ctx!;
    const entry = this.o.manifest.assets[key];
    const url = this.o.urlOf(entry.file);
    const job = fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null);
    this.buffers.set(key, job);
    return job;
  }
}

/* ─── 내부 ─────────────────────────── */

function isCueList(cues: SoundCue | readonly SoundCue[]): cues is readonly SoundCue[] {
  return Array.isArray(cues);
}

// 이 기기에 기억한 끄기(읽을 수 없으면 켠 채로)
function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean) {
  try {
    if (muted) localStorage.setItem(MUTED_KEY, "1");
    else localStorage.removeItem(MUTED_KEY);
  } catch {}
}

/** 사파리의 소리 세션(무음 스위치를 따를지 정한다) */
interface AudioSessionNavigator {
  audioSession?: { type: string };
}

// 소리 세션 종류를 바꾼다(창구가 없으면 아무것도 하지 않는다)
function setAudioSession(type: "playback" | "auto") {
  const session = (navigator as Navigator & AudioSessionNavigator).audioSession;
  if (session && session.type !== type) session.type = type;
}
