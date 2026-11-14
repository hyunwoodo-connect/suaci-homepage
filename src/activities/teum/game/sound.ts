import type { Manifest } from "../assets/manifest";
import type { SoundChannel, SoundSetting } from "../assets/settings";
import type { GameEventName, GameEvents } from "./events";

// 소리판: 알림판(events)을 듣고 정해 둔 소리를 낸다. 소리를 정하기 전(표가 비어 있으면)에는 아무것도 듣지 않는다.
// - 브라우저는 사람이 건드리기 전에는 소리를 막는다 → 첫 터치·클릭·키에 소리를 연다(그 전의 일은 소리 없이 지나간다)
// - 끄기는 이 기기에 기억한다. 꺼져 있거나 탭이 숨으면 소리 장치를 멈춘다(배터리)
// - 채널 둘: 배경 음악(bgm)·효과음(sfx), 크기를 따로 둔다
// - 소리 파일은 첫 화면과 같이 받지 않는다: 소리를 연 뒤에 받는다

/** 소리판이 받는 것 */
export interface SoundOptions {
  events: GameEvents;
  manifest: Manifest;
  /** manifest 의 파일 경로 → 받을 주소 */
  urlOf: (file: string) => string;
  /** 일어난 일 → 효과음 */
  effects: Readonly<Partial<Record<GameEventName, SoundSetting>>>;
  /** 배경 음악(없으면 null) */
  music: SoundSetting | null;
  /** 채널 크기 */
  volume: Readonly<Record<SoundChannel, number>>;
}

/** 끄기를 기억하는 칸 */
const MUTED_KEY = "suaci.teum.muted";
/** 소리를 여는 사람의 손짓 */
const UNLOCK_EVENTS = ["pointerdown", "touchend", "keydown"] as const;

/** 소리판 */
export class SoundManager {
  /** 낼 소리가 하나라도 있나(manifest 에 있는 것만 센다). 없으면 끄기 단추도 두지 않는다 */
  readonly hasSounds: boolean;
  private ctx: AudioContext | null = null;
  private readonly channels = new Map<SoundChannel, GainNode>();
  private muted: boolean;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly effects: [GameEventName, SoundSetting][];
  private readonly music: SoundSetting | null;
  private readonly offs: (() => void)[] = [];

  constructor(private readonly o: SoundOptions) {
    this.muted = readMuted();
    const isPlayable = (s: SoundSetting | null | undefined): s is SoundSetting =>
      Boolean(s) && Object.hasOwn(o.manifest.assets, s!.key);
    this.effects = Object.entries(o.effects).flatMap(([name, setting]) =>
      isPlayable(setting)
        ? [[name as GameEventName, setting] as [GameEventName, SoundSetting]]
        : [],
    );
    this.music = isPlayable(o.music) ? o.music : null;
    this.hasSounds = this.effects.length > 0 || this.music !== null;
    if (!this.hasSounds) return;
    for (const [name, setting] of this.effects) {
      const off = o.events.on(name, () => this.play(setting));
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

  // 첫 손짓에 소리 장치를 만들고, 효과음 파일을 뒤에서 받기 시작하고, 배경 음악을 튼다. 그 뒤의 손짓은 멈춘 장치를 다시 깨운다(iOS)
  private unlock() {
    if (this.ctx) {
      this.applyState();
      return;
    }
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
    this.applyState();
    for (const [, setting] of this.effects) void this.load(setting.key);
    if (this.music) this.startMusic(this.music);
  }

  // 꺼져 있거나 탭이 숨으면 멈추고, 아니면 다시 돈다
  private applyState() {
    const ctx = this.ctx;
    if (!ctx) return;
    const isSilent = this.muted || document.hidden;
    if (isSilent && ctx.state === "running") void ctx.suspend();
    else if (!isSilent && ctx.state !== "running") void ctx.resume();
  }

  // 효과음 한 번(소리 장치가 돌 때만 — 꺼져 있으면 그냥 지나간다)
  private play(setting: SoundSetting) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    void this.load(setting.key).then((buffer) => {
      if (buffer && this.ctx === ctx) this.start(ctx, buffer, setting, "sfx", false);
    });
  }

  private startMusic(setting: SoundSetting) {
    const ctx = this.ctx!;
    void this.load(setting.key).then((buffer) => {
      if (buffer && this.ctx === ctx) this.start(ctx, buffer, setting, "bgm", true);
    });
  }

  private start(
    ctx: AudioContext,
    buffer: AudioBuffer,
    setting: SoundSetting,
    channel: SoundChannel,
    loop: boolean,
  ) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    const gain = ctx.createGain();
    gain.gain.value = setting.volume ?? 1;
    const out = this.channels.get(channel)!;
    source.connect(gain).connect(out);
    source.start();
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
