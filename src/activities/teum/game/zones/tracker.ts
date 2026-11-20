import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { RegionNamer } from "../minimap/regionName";
import type { Motion } from "../player/motion";
import type { Services } from "../services";
import type { Sky } from "../world/sky";
import type { ZoneConfig } from "./zone";
import { DEFAULT_SUN, DEFAULT_SUN_INTENSITY, fogOf, motionOf } from "./zone";

// 존 넘나들기(오너 2026-11-20 5번 — 공용): 지금 어느 존에 있는지는 한 곳(가장 가까운 마을)에서 정한다.
// 새 존에 들어서면(그 존다운 정도가 섞임 띠의 가운데를 넘으면) 2초에 걸쳐 하늘·안개·빛·몸놀림을 새 존 값으로 바꾸고,
// 배경 소리를 바꾸고, 지역 이름을 1.2초 띄운다(같은 경계를 10초 안에 다시 넘으면 이름은 안 띄운다 — MINIMAP-01).
// 하늘빛은 경계 가까이(그 존다운 정도가 낮을수록) 옅어진다 — 예전 RegionLook 과 같은 셈

/** 바뀌는 데 걸리는 시간(초) · 하늘빛·안개에 섞는 가장 큰 정도 · 들어선 것으로 치는 그 존다운 정도 */
const BLEND_SECONDS = 2;
const SKY_MIX = 0.85,
  FOG_MIX = 0.85;
const ENTER_AT = 0.5;
/** 이름을 다시 띄우지 않는 시간(초) · 띄우는 시간(초) — 지도에 미니맵 값이 없을 때 */
const NAME_COOLDOWN = 10;

/** 존의 배경 소리를 바꾸는 창구(소리판) */
export interface AmbientSink {
  setAmbient(key: string | null): void;
}

/** 존이 바꾸는 것들 */
export interface ZoneTargets {
  sky: Sky;
  sun: THREE.DirectionalLight;
  motion: Motion;
  ambient: AmbientSink | null;
  /** 지역 이름을 띄운다(미니맵) */
  showName: ((name: string) => void) | null;
}

/** 존 넘나들기 */
export class ZoneTracker implements Thing {
  /** 지금 존(설정 차례, 아직 없으면 -1) */
  current = -1;
  private readonly zones: readonly ZoneConfig[];
  private readonly byHub: (ZoneConfig | undefined)[] = [];
  private readonly namer: RegionNamer;
  private w = 0;
  private blendT = 1;
  // 바뀌기 시작할 때의 값과 가는 값
  private readonly fromSky = new THREE.Color();
  private readonly toSky = new THREE.Color();
  private readonly fromFog = new THREE.Color();
  private readonly toFog = new THREE.Color();
  private readonly fromSun = new THREE.Color();
  private readonly toSun = new THREE.Color();
  private fromSunI: number = DEFAULT_SUN_INTENSITY;
  private toSunI: number = DEFAULT_SUN_INTENSITY;
  private fromMotion: Motion;
  private toMotion: Motion;
  private readonly fogNow = new THREE.Color();

  constructor(
    private readonly s: Services,
    private readonly to: ZoneTargets,
  ) {
    this.zones = s.map.zoneConfigs ?? [];
    for (const z of this.zones) this.byHub[z.hub] = z;
    const cooldown = s.map.minimap?.regionName.cooldown ?? NAME_COOLDOWN;
    const start = s.regions.nearest(s.player.p as THREE.Vector3);
    this.namer = new RegionNamer(start, cooldown);
    this.fromMotion = { ...to.motion };
    this.toMotion = { ...to.motion };
  }

  /** 지금 존 설정(없으면 undefined) */
  get zone(): ZoneConfig | undefined {
    return this.byHub[this.current];
  }

  /** 마을 번호의 존 설정 */
  zoneAt(hub: number): ZoneConfig | undefined {
    return this.byHub[hub];
  }

  /** 가장 가까운 마을로 존을 정하고, 들어서면 2초에 걸쳐 바꾼다 */
  update(f: Frame) {
    const { player, regions, scene, fx, events } = this.s;
    if (!this.zones.length) return;
    const p = player.p as THREE.Vector3;
    const hub = regions.nearest(p),
      w = regions.weight(p, hub);
    // 하늘빛은 경계 가까이 옅게(그 존다운 정도를 천천히 따라간다)
    const fade = -1.2 * f.dt;
    const k = 1 - Math.exp(fade);
    this.w += (w - this.w) * k;
    if (w > ENTER_AT && hub !== this.current) {
      const was = this.current;
      this.enter(hub);
      if (was >= 0) {
        fx.burst(player.P, 18, 10);
        events.emit("regionEntered", { region: hub });
      }
    }
    const entered = this.namer.step(hub, w, f.time);
    const zone = this.byHub[entered ?? -1];
    if (zone && this.to.showName) this.to.showName(zone.name);
    // 2초에 걸쳐 새 존 값으로
    const step = f.dt / BLEND_SECONDS;
    const next = this.blendT + step;
    this.blendT = Math.min(1, next);
    const t = smooth(this.blendT);
    const SKY = this.to.sky.SKY;
    SKY.uReg.value.copy(this.fromSky).lerp(this.toSky, t);
    SKY.uRegW.value = SKY_MIX * this.w;
    this.fogNow.copy(this.fromFog).lerp(this.toFog, t);
    const fog = scene.fog as THREE.Fog,
      background = scene.background as THREE.Color;
    const fogMix = FOG_MIX * this.w;
    fog.color.copy(background).lerp(this.fogNow, fogMix);
    const sun = this.to.sun;
    sun.color.copy(this.fromSun).lerp(this.toSun, t);
    sun.intensity = this.fromSunI + (this.toSunI - this.fromSunI) * t;
    const m = this.to.motion;
    for (const key of MOTION_KEYS)
      m[key] = this.fromMotion[key] + (this.toMotion[key] - this.fromMotion[key]) * t;
  }

  /** 떠날 것 없음 */
  dispose() {}

  // 새 존: 지금 값에서 새 존 값으로 가기 시작한다(처음 서 있던 존은 바로 그 값)
  private enter(hub: number) {
    const isFirst = this.current < 0;
    this.current = hub;
    const zone = this.byHub[hub];
    const sky = zone?.colors?.sky ?? this.s.map.regions[hub]?.sky ?? DEFAULT_SKY;
    const fogColor = zone ? fogOf(zone) : sky;
    const light = zone?.colors?.light;
    this.fromSky.copy(this.to.sky.SKY.uReg.value);
    this.toSky.setHex(sky);
    this.fromFog.copy(this.fogNow);
    this.toFog.setHex(fogColor);
    this.fromSun.copy(this.to.sun.color);
    this.toSun.setHex(light?.color ?? DEFAULT_SUN);
    this.fromSunI = this.to.sun.intensity;
    this.toSunI = light?.intensity ?? DEFAULT_SUN_INTENSITY;
    this.fromMotion = { ...this.to.motion };
    this.toMotion = motionOf(zone);
    this.to.ambient?.setAmbient(zone?.sound?.ambient ?? null);
    if (isFirst) {
      this.fromSky.copy(this.toSky);
      this.fromFog.copy(this.toFog);
      this.fromSun.copy(this.toSun);
      this.fromSunI = this.toSunI;
      this.fromMotion = { ...this.toMotion };
    }
    this.blendT = 0;
  }
}

/* ─── 내부 ─────────────────────────── */

/** 몸놀림의 값들 */
const MOTION_KEYS = ["gravity", "fallLimit", "speed", "camD", "camH"] as const;
/** 존 설정도 지역 색도 없을 때의 하늘 */
const DEFAULT_SKY = 0xc9cbe8;

// 부드럽게(0..1)
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
