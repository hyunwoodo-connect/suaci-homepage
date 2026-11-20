import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import { from } from "../world/sphere";
import type { PlayedGames } from "../zones/played";
import type { ZoneConfig } from "../zones/zone";
import type { EntryAction } from "./flow";
import { EntryFlow } from "./flow";
import { MINIGAMES } from "./index";
import type { Minigame, MinigameLinks, MinigameStage } from "./registry";

// 미니게임 입구(오너 2026-11-20 3번 — 공용 하나): 미니게임을 정한 존마다 랜드마크 앞에 시작 자리(둥근 판)를 둔다.
// 올라서면 짧은 연출 → 판 시작(그 동안 게임 마당 밖으로 못 나간다) → 판 끝 → 결과 → 자유 놀이(그 존은 '했다'로 적는다).
// 링크(도전장 ?zone=<존 id>)로 들어오면 그 존 시작 자리에 바로 선다. 게임을 열 수 없는 존(아직 판이 없는 숨바꼭질)은 판만 보인다
// 시작 자리: 랜드마크에서 그 존 마을 쪽으로(랜드마크가 마을 가운데면 출발점 쪽으로) 몸 둘레 + 여유만큼 나온 곳

/** 시작 자리 판: 반지름(m) · 테 안쪽 반지름(m) · 올라선 것으로 치는 높이(m) · 랜드마크 몸에서 떨어진 여유(m) · 게임 마당이 없을 때 반지름(m) */
const PAD = { r: 4.2, inner: 3, air: 2, clear: 12, gameR: 140 } as const;
/** 접시를 이 랜드마크 것으로 치는 거리(m) */
const PLATE_REACH = 6;
/** 랜드마크가 마을 가운데라고 치는 거리(m) */
const AT_HUB = 10;

/** 존 하나의 입구 */
interface Gate {
  zone: ZoneConfig;
  game: Minigame;
  flow: EntryFlow;
  stage: MinigameStage;
  pad: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
}

/** 존 미니게임 입구 전체 */
export class MinigameEntry implements Thing {
  private readonly gates: Gate[] = [];
  private readonly ringGeo = new THREE.RingGeometry(PAD.inner, PAD.r, 48);

  constructor(
    private readonly s: Services,
    links: MinigameLinks,
    private readonly played: PlayedGames,
  ) {
    const flat = -Math.PI / 2;
    this.ringGeo.rotateX(flat);
    for (const zone of s.map.zoneConfigs ?? []) {
      const make = zone.minigame ? MINIGAMES[zone.minigame] : undefined;
      const stage = make ? this.stageOf(zone) : null;
      if (!make || !stage) continue;
      const game = make(links);
      const color = zone.landmark?.beacon ?? 0xffffff;
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: game.isReady ? 0.9 : 0.35,
        depthWrite: false,
      });
      const pad = new THREE.Mesh(this.ringGeo, mat);
      s.scene.add(pad);
      const flow = new EntryFlow();
      this.gates.push({ zone, game, flow, stage, pad });
    }
  }

  /** 땅 높이가 정해진 뒤 시작 자리 판을 놓는다 */
  layout() {
    for (const gate of this.gates) {
      const v = gate.stage.start;
      const ground = this.s.terrain.featGround(v);
      const radius = S.R + ground + 0.25;
      gate.pad.position.copy(v).multiplyScalar(radius);
      gate.pad.quaternion.setFromUnitVectors(UP, v);
    }
  }

  /** 링크(도전장 ?zone=<존 id>)로 들어왔으면 그 존 시작 자리에 랜드마크를 보고 선다 */
  landFromLink(search: string = location.search) {
    const id = new URLSearchParams(search).get("zone");
    const gate = this.gates.find((g) => g.zone.id === id);
    if (!gate) return;
    const { start, landmark } = gate.stage;
    const look = landmark.clone().sub(start);
    this.s.player.teleport(start, look, 0);
  }

  /** 시작 자리에 올라섰는지 보고 흐름을 한 칸 — 판 동안은 게임 마당 안에 둔다 */
  update(f: Frame) {
    const { player } = this.s;
    for (const gate of this.gates) {
      const d = player.p.angleTo(gate.stage.start) * S.R;
      const isOnPad = d < PAD.r && player.air < PAD.air;
      const action = gate.flow.step({
        dt: f.dt,
        isOnPad,
        isReady: gate.game.isReady,
        isOver: gate.game.isOver,
      });
      this.act(gate, action);
      if (gate.flow.phase === "playing") player.leash(gate.stage.landmark, gate.stage.gameR);
      const wave = f.time * 2.4;
      const breath = 1 + Math.sin(wave) * 0.05;
      gate.pad.scale.setScalar(breath);
    }
  }

  /** 치운다 */
  dispose() {
    for (const gate of this.gates) {
      gate.pad.removeFromParent();
      gate.pad.material.dispose();
    }
    this.ringGeo.dispose();
  }

  /** 지금 판이 도는 존(없으면 null — 시험 창구·숨바꼭질이 읽는다) */
  get playing(): string | null {
    const gate = this.gates.find((g) => g.flow.phase === "playing");
    return gate ? gate.zone.id : null;
  }

  // 흐름이 정한 일: 연출 · 판 시작 · 결과 · 자유 놀이로
  private act(gate: Gate, action: EntryAction) {
    const { fx, events } = this.s;
    const zone = gate.zone.id,
      game = gate.zone.minigame ?? "";
    const at = gate.pad.position;
    switch (action) {
      case "intro":
        fx.burst(at, 16, 10);
        return;
      case "start":
        gate.game.start(gate.stage);
        events.emit("minigameStarted", { zone, game });
        return;
      case "result":
        fx.burst(at, 30, 16);
        return;
      case "finish":
        gate.game.stop();
        this.played.mark(zone);
        events.emit("minigameEnded", { zone, game });
        return;
      default:
        return;
    }
  }

  // 존의 판 자리: 랜드마크(자리표 landmark — 그 마을)·시작 자리·게임 마당(자리표 gameZone)
  private stageOf(zone: ZoneConfig): MinigameStage | null {
    const L = this.s.layout;
    const land = L.landmark?.find((m) => m.region === zone.hub);
    const hub = L.hub[zone.hub];
    if (!land || !hub) return null;
    const landmark = from(land.dist, land.bear);
    const center = from(hub.dist, hub.bear);
    const start0 = from(0, 0);
    const plate = L.decor?.find((d) => {
      const v = from(d.dist, d.bear);
      return d.model === "plate" && v.angleTo(landmark) * S.R < PLATE_REACH;
    });
    const footR = zone.landmark?.footR ?? land.footR;
    const body = Math.max(footR, plate?.r ?? 0);
    const out = body + PAD.clear;
    const awayFromHub = landmark.angleTo(center) * S.R;
    const toward = awayFromHub < AT_HUB ? start0 : center;
    const axis = landmark.clone().cross(toward);
    if (axis.lengthSq() < 1e-10) axis.set(1, 0, 0).cross(landmark);
    axis.normalize();
    const angle = out / S.R;
    const start = landmark.clone().applyAxisAngle(axis, angle).normalize();
    const game = L.gameZone?.find((g) => g.region === zone.hub);
    const gameR = game?.r ?? PAD.gameR;
    return { zone: zone.id, landmark, start, gameR };
  }
}

/* ─── 내부 ─────────────────────────── */

const UP = new THREE.Vector3(0, 1, 0);
