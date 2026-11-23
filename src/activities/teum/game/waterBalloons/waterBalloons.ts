import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Random } from "../core/random";
import type { WaterBalloonSpot } from "../maps/map";
import type { Services } from "../services";
import { S } from "../settings";
import { from, rad, UP } from "../world/sphere";
import type { BeamUniforms } from "./balloonLook";
import {
  BALLOON_TINTS,
  BEAM_ABOVE,
  beamTintInto,
  createBalloonGeometry,
  createBalloonMaterial,
  createBeamGeometry,
  createBeamMaterial,
} from "./balloonLook";
import { WaterBalloonHud } from "./hud";
import { BalloonRound } from "./round";
import { edgeHint, nearestRemaining, touchedBalloons } from "./rules";
import { Splash } from "./splash";

// 물풍선 놀이: 지도에 놓인 물풍선(GameMap.waterBalloons)을 다 먹으면 성공. 숨기지 않는다 — 놀이기구를 타다 보면 지나는 자리에
// 떠 있고, 멀리서도 물빛 기둥으로 보인다. 닿으면 터지고, 다 먹으면 걸린 시간과 함께 성공 판이 뜬다.
// 떠다니는 맛이 먼저라 몸은 건드리지 않는다(튕기지도 멈추지도 않는다). 지도에 물풍선이 없으면 이 놀이는 만들어지지 않는다

/** 물풍선 하나 */
export interface WaterBalloon {
  /** 행성 위 자리(단위 벡터) */
  readonly v: THREE.Vector3;
  /** 그 자리 땅 위 높이(m, 지도 값) */
  readonly alt: number;
  /** 그 자리 땅 높이(m) */
  readonly ground: number;
  /** 지금 가운데(둥실거림까지) — 닿았는지를 이 점으로 잰다 */
  readonly centre: THREE.Vector3;
  /** 몸 색(숫자와 그 색) · 기둥 색 */
  readonly hex: number;
  readonly tint: THREE.Color;
  readonly beamTint: THREE.Color;
  /** 화살표에 칠할 색(CSS) */
  readonly css: string;
  /** 흔들림 위상 */
  readonly phase: number;
  /** 나타난 뒤 흐른 시간(초). 0 이하면 아직 나오지 않았다 */
  age: number;
  /** 터지는 중 남은 시간(초) */
  pop: number;
  /** 물빛 기둥의 굵기(0 없음 … 1) */
  beam: number;
}

/** 물풍선 몸의 반지름(m) */
const BALLOON_RADIUS = 2.2;
/**
 * 몸이 물풍선 가운데에서 이 거리(m) 안을 지나면 먹는다 — 빠르게, 어느 쪽에서든, 하늘 높이에서도 오므로 넉넉하게.
 * 땅 위 거리가 아니라 세 방향 거리다
 */
const EAT_REACH = 5;
/** 다시 놓일 물풍선은 내가 이만큼(m) 벗어난 뒤에 나온다 — '한 번 더'를 누른 자리에서 나오자마자 먹히지 않게 */
const REAPPEAR_CLEAR = EAT_REACH + 3;

/** 둥실거림: 오르내리는 폭(m)·빠르기, 출렁임(옆으로 불면 위아래로 준다): 폭·빠르기, 기우뚱: 각·빠르기 */
const BOB = 0.4,
  BOB_RATE = 1.2,
  WOBBLE = 0.05,
  WOBBLE_RATE = 2.6,
  TILT = 0.07,
  TILT_RATE = 0.9;
/** 터질 때: 이 시간(초) 동안 이만큼 더 부풀었다 사라진다 · 튀는 물방울 수와 빠르기(m/s) */
const POP_SECONDS = 0.14,
  POP_SWELL = 0.5,
  POP_DROPS = 32,
  POP_SPEED = 11;
/** 다시 놓일 때: 차례마다 이만큼(초) 늦게, 이 시간(초) 동안 통 하고 자란다 */
const RETURN_STAGGER = 0.07,
  GROW_SECONDS = 0.45;
/** 기둥이 굵어지고 가늘어지는 빠르기 · 땅속으로 묻는 길이(m, 비탈에서 발치가 뜨지 않게) */
const BEAM_RATE = 9,
  BEAM_SINK = 2;
/** 다 먹은 뒤: 축하가 이어지는 시간(초)·한 다발 사이(초), 성공 판이 뜨기까지(초 — 마지막 물풍선이 터지는 것을 보고 나서) */
const PARTY_SECONDS = 3,
  PARTY_EVERY = 0.28,
  PANEL_DELAY = 0.9;
/** 세상이 보이고 이만큼(초) 뒤에 놀이를 알린다 · 그 안내가 떠 있는 시간(초) */
const GREET_DELAY = 0.6,
  GREET_SECONDS = 6;

const at = new THREE.Vector3(),
  size = new THREE.Vector3(),
  stand = new THREE.Quaternion(),
  tilt = new THREE.Quaternion(),
  matrix = new THREE.Matrix4(),
  view = new THREE.Vector3(),
  side = new THREE.Vector3();
const TILT_AXIS = new THREE.Vector3(1, 0, 0);

/** 지도에 물풍선이 있으면 놀이를 만든다. 없으면 null — 장면에도 화면에도 아무것도 얹지 않는다 */
export function createWaterBalloons(s: Services, parent: HTMLElement): WaterBalloons | null {
  const spots = s.map.waterBalloons;
  if (!spots || spots.length === 0) return null;
  return new WaterBalloons(s, spots, parent);
}

/** 물풍선 놀이 */
export class WaterBalloons implements Thing {
  readonly list: WaterBalloon[];
  /** 이번 판(먹은 수·걸린 시간·단계) */
  readonly round: BalloonRound;
  private readonly hud: WaterBalloonHud;
  private readonly bodies: THREE.InstancedMesh<THREE.LatheGeometry, THREE.MeshStandardMaterial>;
  private readonly beams: THREE.InstancedMesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
  private readonly beamU: BeamUniforms = { uT: { value: 0 }, uEye: { value: new THREE.Vector3() } };
  private readonly splash: Splash;
  private readonly rng: Random;
  private readonly centres: THREE.Vector3[];
  /** 지금 먹을 수 없는 것(먹었거나 아직 나오지 않았다) */
  private readonly away: boolean[];
  /** 지난 프레임의 몸 자리와 그때까지 순간 이동한 횟수(순간 이동한 길은 지나온 길로 치지 않는다) */
  private readonly before = new THREE.Vector3();
  private jumps = -1;
  private party = 0;
  private partyNext = 0;
  private panelIn = 0;
  private greetIn = GREET_DELAY;

  /** spots: 지도의 물풍선 자리(하나 이상), parent: 화면을 얹을 곳(캔버스의 부모) */
  constructor(
    private readonly s: Services,
    spots: readonly WaterBalloonSpot[],
    parent: HTMLElement,
  ) {
    // 놀이 난수는 제 갈래에서만 뽑는다(다른 것들의 흐름을 건드리지 않는다)
    const rng = s.rng.fork("waterBalloons");
    this.rng = rng;
    this.list = spots.map((spot, i) => {
      const v = from(spot.dist, spot.bear),
        ground = s.terrain.groundAt(v),
        hex = BALLOON_TINTS[i % BALLOON_TINTS.length],
        tint = new THREE.Color(hex),
        beamTint = new THREE.Color();
      beamTintInto(beamTint, i);
      const radius = S.R + ground + spot.alt;
      return {
        v,
        alt: spot.alt,
        ground,
        centre: v.clone().multiplyScalar(radius),
        hex,
        tint,
        beamTint,
        css: `#${tint.getHexString()}`,
        phase: rng.next() * 6.283,
        age: GROW_SECONDS,
        pop: 0,
        beam: 1,
      };
    });
    const total = this.list.length;
    this.round = new BalloonRound(total);
    this.centres = this.list.map((b) => b.centre);
    this.away = this.list.map(() => false);
    const bodyGeo = createBalloonGeometry(),
      bodyMat = createBalloonMaterial(),
      beamGeo = createBeamGeometry(),
      beamMat = createBeamMaterial(this.beamU);
    this.bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, total);
    this.beams = new THREE.InstancedMesh(beamGeo, beamMat, total);
    for (const mesh of [this.bodies, this.beams]) {
      // 온 행성에 흩어져 있어 한 덩어리의 시야 검사가 맞지 않는다(열 개 남짓이라 그냥 그린다)
      mesh.frustumCulled = false;
      this.list.forEach((b, i) => mesh.setColorAt(i, b.tint));
      s.scene.add(mesh);
    }
    // 반투명한 것들(구름·방울) 뒤에 더해 그린다
    this.beams.renderOrder = 2;
    this.splash = new Splash(s.scene, rng);
    this.hud = new WaterBalloonHud(parent, {
      onAgain: () => this.playAgain(),
      onKeepPlaying: () => this.keepPlaying(),
    });
    this.hud.setCount(0, total);
  }

  /** 한 번 더: 물풍선이 모두 돌아오고 수와 시계가 0 으로. 나는 그 자리에 그대로 있다 */
  playAgain() {
    this.round.restart();
    this.party = 0;
    this.panelIn = 0;
    this.list.forEach((b, i) => {
      b.age = -i * RETURN_STAGGER;
      b.pop = 0;
    });
    this.hud.hideSuccess();
    this.hud.setCount(0, this.round.total);
  }

  /** 계속 놀기: 물풍선도 화면도 치우고 떠다니기만 한다 */
  keepPlaying() {
    this.round.leave();
    this.party = 0;
    this.panelIn = 0;
    this.bodies.count = 0;
    this.beams.count = 0;
    this.hud.close();
  }

  /** 둥실거리고, 닿으면 터지고, 다 먹으면 축하하고 성공 판을 띄운다 */
  update(f: Frame) {
    const { player, hud } = this.s;
    this.hud.setHidden(hud.isInStudio);
    this.hud.update(f);
    this.splash.update(f);
    const round = this.round;
    if (round.stage === "over") return;
    this.greet(f);
    // 시계는 내가 처음 움직일 때부터(꾸미기 씬 동안은 입력이 막혀 있어 켜지지 않는다)
    if (player.m0 > 0) round.begin();
    round.tick(f.dt);
    this.float(f);
    this.eatTouched();
    this.celebrate(f);
    this.point();
    this.beamU.uT.value = f.time;
    this.beamU.uEye.value.copy(player.P);
  }

  /** 장면과 화면에서 치운다 */
  dispose() {
    for (const mesh of [this.bodies, this.beams]) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose();
    }
    this.splash.dispose();
    this.hud.dispose();
  }

  /* ─── 내부 ─────────────────────────── */

  // 놀이를 알리는 한 줄을 한 번 띄운다. 꾸미기 씬 동안은 안내 줄이 숨어 있어 세지 않는다 — 처음 온 사람은 씬을 닫은 뒤에 본다
  private greet(f: Frame) {
    const hud = this.s.hud;
    if (this.greetIn <= 0 || hud.isInStudio) return;
    this.greetIn -= f.dt;
    if (this.greetIn > 0) return;
    hud.say(`물풍선 ${this.round.total}개를 다 먹으면 성공이에요`, GREET_SECONDS);
  }

  // 물풍선마다 이번 프레임의 자리·크기를 정해 묶음의 앞 칸부터 채운다(먹힌 것·아직 안 나온 것은 칸을 쓰지 않는다)
  private float(f: Frame) {
    const { dt, time } = f,
      eaten = this.round.eaten,
      P = this.s.player.P,
      beamEase = ease(BEAM_RATE, dt);
    let bodyN = 0,
      beamN = 0;
    this.list.forEach((b, i) => {
      const isEaten = eaten[i];
      if (!isEaten) {
        // 나올 차례가 됐어도 내가 그 자리에 있으면 벗어날 때까지 기다린다
        const next = b.age + dt,
          isUnderMe = b.age <= 0 && next > 0 && P.distanceTo(b.centre) < REAPPEAR_CLEAR;
        b.age = isUnderMe ? 0 : next;
      }
      if (b.pop > 0) b.pop -= dt;
      const isOut = !isEaten && b.age > 0;
      this.away[i] = !isOut;
      const bobPhase = time * BOB_RATE + b.phase,
        radius = S.R + b.ground + b.alt + BOB * Math.sin(bobPhase);
      b.centre.copy(b.v).multiplyScalar(radius);
      const beamWant = isOut ? 1 : 0;
      b.beam += (beamWant - b.beam) * beamEase;
      stand.setFromUnitVectors(UP, b.v);
      if (b.beam > 0.01) {
        const footRadius = S.R + b.ground - BEAM_SINK,
          length = b.alt + BEAM_SINK + BEAM_ABOVE;
        at.copy(b.v).multiplyScalar(footRadius);
        size.set(b.beam, length, b.beam);
        matrix.compose(at, stand, size);
        this.beams.setMatrixAt(beamN, matrix);
        this.beams.setColorAt(beamN, b.beamTint);
        beamN++;
      }
      const k = bodyScale(b, isEaten);
      if (k <= 0) return;
      // 물이 든 것처럼: 옆으로 불면 위아래로 줄고, 천천히 기우뚱한다
      const wobblePhase = time * WOBBLE_RATE + b.phase * 1.7,
        wobble = WOBBLE * Math.sin(wobblePhase),
        tiltPhase = time * TILT_RATE + b.phase,
        tiltAngle = TILT * Math.sin(tiltPhase),
        wide = BALLOON_RADIUS * k * (1 + wobble),
        tall = BALLOON_RADIUS * k * (1 - 2 * wobble);
      tilt.setFromAxisAngle(TILT_AXIS, tiltAngle).premultiply(stand);
      size.set(wide, tall, wide);
      matrix.compose(b.centre, tilt, size);
      this.bodies.setMatrixAt(bodyN, matrix);
      this.bodies.setColorAt(bodyN, b.tint);
      bodyN++;
    });
    this.fill(this.bodies, bodyN);
    this.fill(this.beams, beamN);
  }

  // 묶음에 이번 프레임 채운 칸 수를 알린다
  private fill(mesh: THREE.InstancedMesh, n: number) {
    mesh.count = n;
    if (n === 0) return;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  // 지난 프레임 자리에서 지금 자리까지 지나온 길에 닿은 물풍선을 먹는다. 놀이기구에 붙잡혀 있어도 먹는다
  private eatTouched() {
    const player = this.s.player,
      P = player.P;
    if (player.jumps !== this.jumps) this.before.copy(P);
    this.jumps = player.jumps;
    const touched = touchedBalloons(this.before, P, this.centres, this.away, EAT_REACH);
    for (const i of touched) this.pop(i);
    this.before.copy(P);
  }

  // 터진다: 물방울이 튀고, 수가 오르고, 마지막이면 축하가 시작된다
  private pop(i: number) {
    const round = this.round;
    if (!round.eat(i)) return;
    const { events, fx } = this.s,
      b = this.list[i],
      count = round.count,
      total = round.total;
    b.pop = POP_SECONDS;
    this.away[i] = true;
    // 물풍선 소리를 빛 방울보다 먼저 알린다 — 빛 방울의 울림이 같은 소리를 먼저 잡으면 먹은 수만큼 높인 음이 묻힌다
    events.emit("waterBalloonPopped", { count, total });
    this.splash.burst(b.centre, b.v, b.hex, POP_DROPS, POP_SPEED);
    fx.burst(b.centre, 10, 9);
    this.hud.setCount(count, total);
    if (round.stage !== "cleared") return;
    events.emit("waterBalloonsCleared", { seconds: round.seconds });
    this.party = PARTY_SECONDS;
    this.partyNext = 0;
    this.panelIn = PANEL_DELAY;
  }

  // 다 먹은 뒤: 내 둘레에서 물방울과 빛 방울이 다발로 터지고, 조금 뒤 성공 판이 뜬다
  private celebrate(f: Frame) {
    const round = this.round;
    if (this.panelIn > 0) {
      this.panelIn -= f.dt;
      if (this.panelIn <= 0) this.hud.showSuccess(round.total, round.seconds);
    }
    if (this.party <= 0) return;
    this.party -= f.dt;
    this.partyNext -= f.dt;
    if (this.partyNext > 0) return;
    this.partyNext = PARTY_EVERY;
    const { player, fx } = this.s,
      rng = this.rng,
      up = player.p;
    // 내 앞뒤·양옆 12m 안, 머리 위 2~8m 아무 데서
    const ahead = rng.range(-12, 12),
      aside = rng.range(-12, 12),
      above = rng.range(2, 8),
      pick = rng.next() * BALLOON_TINTS.length,
      hex = BALLOON_TINTS[Math.floor(pick)];
    side.crossVectors(player.h, up);
    at.copy(player.P)
      .addScaledVector(player.h, ahead)
      .addScaledVector(side, aside)
      .addScaledVector(up, above);
    this.splash.burst(at, up, hex, 14, 12);
    fx.burst(at, 12, 11);
  }

  // 가장 가까운 남은 물풍선이 화면 밖이면 그쪽 가장자리에 화살표를 둔다
  private point() {
    const i = nearestRemaining(this.s.player.P, this.centres, this.away);
    if (i < 0) {
      this.hud.pointTo(null);
      return;
    }
    const camera = this.s.camera.camera,
      b = this.list[i],
      halfFov = rad(camera.fov) / 2,
      tanY = Math.tan(halfFov),
      tanX = tanY * camera.aspect,
      box = this.hud.hintBox();
    view.copy(b.centre).applyMatrix4(camera.matrixWorldInverse);
    const hint = edgeHint(view, tanX, tanY, box);
    this.hud.pointTo(hint, b.css);
  }
}

/* ─── 내부 ─────────────────────────── */

// 몸 크기(0 없음 … 1 제 크기): 먹히면 잠깐 더 부풀었다 사라지고, 다시 놓이면 조금 넘쳤다가 제 크기로 자란다
function bodyScale(b: WaterBalloon, isEaten: boolean): number {
  if (isEaten) {
    if (b.pop <= 0) return 0;
    const swollen = 1 - b.pop / POP_SECONDS;
    return 1 + POP_SWELL * swollen;
  }
  if (b.age <= 0) return 0;
  const grown = b.age / GROW_SECONDS,
    t = Math.min(1, grown),
    rest = 1 - t;
  // 끝에서 살짝 넘쳤다 돌아오는 자람(back-out)
  return 1 - rest * rest * (1 - 2.4 * t);
}
