import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Random } from "../core/random";
import { FLOOD_ALL, FLOOD_OFF } from "../look";
import type { WaterBalloonSpot } from "../maps/map";
import type { Services } from "../services";
import { S } from "../settings";
import { from, rad, UP } from "../world/sphere";
import { BALLOON_TINT, createBalloonGeometry, createBalloonMaterial } from "./balloonLook";
import type { BalloonPin } from "./hud";
import { REDUCED_MOTION, WaterBalloonHud } from "./hud";
import { BalloonRound } from "./round";
import { edgeHint, floodCos, nearestRemaining, pinFade, screenPin, touchedBalloons } from "./rules";
import { Splash } from "./splash";

// 물풍선 놀이: 지도에 놓인 물풍선(GameMap.waterBalloons)을 다 먹으면 성공. 숨기지 않는다 — 놀이기구를 타다 보면 지나는 자리에
// 떠 있고, 멀리서는 그 위에 얹은 물방울 핀으로 찾는다. 닿으면 터지고, 다 먹으면 걸린 시간과 함께 성공 판이 뜬다.
// 떠다니는 맛이 먼저라 몸은 건드리지 않는다(튕기지도 멈추지도 않는다). 지도에 물풍선이 없으면 이 놀이는 만들어지지 않는다.
// 끝 장면: 마지막 물풍선이 터진 자리에서 라임 물결이 퍼져 온 섬이 키컬러로 물든다 — 판이 끝난 뒤 머리에 남는 색이 라임이게.
// '계속 놀기'를 고르면 물든 섬에서 놀고, '한 번 더'를 고르면 섬이 제 색으로 돌아온다

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
  /** 흔들림 위상 */
  readonly phase: number;
  /** 나타난 뒤 흐른 시간(초). 0 이하면 아직 나오지 않았다 */
  age: number;
  /** 터지는 중 남은 시간(초) */
  pop: number;
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
/** 핀: 물풍선 가운데에서 이만큼(m) 위를 가리킨다 · 내가 이 거리(m) 안이면 안 보이고 → 이 거리부터 다 보인다 */
const PIN_ABOVE = BALLOON_RADIUS * 1.5,
  PIN_NEAR: readonly [number, number] = [30, 70];
/** 축하 물방울의 색: 라임과 흰 물빛 */
const PARTY_TINTS: readonly number[] = [BALLOON_TINT, 0xffffff];
/** 다 먹은 뒤: 축하가 이어지는 시간(초)·한 다발 사이(초), 성공 판이 뜨기까지(초 — 라임 물결이 눈앞을 지나 퍼지는 것을 보고 나서) */
const PARTY_SECONDS = 3,
  PARTY_EVERY = 0.28,
  PANEL_DELAY = 1.7;
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
const TINT = new THREE.Color(BALLOON_TINT),
  TINT_CSS = `#${TINT.getHexString()}`;

/**
 * 지도에 물풍선이 있으면 놀이를 만든다. 없으면 null — 장면에도 화면에도 아무것도 얹지 않는다.
 * wordmark: 물풍선에 두를 suaci 워드마크(글자 모양만 남긴 그림 — brand/logo.ts)
 */
export function createWaterBalloons(
  s: Services,
  parent: HTMLElement,
  wordmark: THREE.Texture,
): WaterBalloons | null {
  const spots = s.map.waterBalloons;
  if (!spots || spots.length === 0) return null;
  return new WaterBalloons(s, spots, parent, wordmark);
}

/** 물풍선 놀이 */
export class WaterBalloons implements Thing {
  readonly list: WaterBalloon[];
  /** 이번 판(먹은 수·걸린 시간·단계) */
  readonly round: BalloonRound;
  private readonly hud: WaterBalloonHud;
  private readonly bodies: THREE.InstancedMesh<THREE.LatheGeometry, THREE.MeshStandardMaterial>;
  private readonly pins: BalloonPin[] = [];
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
  /** 라임 물결이 퍼지기 시작한 뒤 흐른 시간(초). 음수면 물결이 없다(또는 다 퍼졌다) */
  private floodFor = -1;

  /** spots: 지도의 물풍선 자리(하나 이상), parent: 화면을 얹을 곳(캔버스의 부모), wordmark: 물풍선에 두를 워드마크 그림 */
  constructor(
    private readonly s: Services,
    spots: readonly WaterBalloonSpot[],
    parent: HTMLElement,
    wordmark: THREE.Texture,
  ) {
    // 놀이 난수는 제 갈래에서만 뽑는다(다른 것들의 흐름을 건드리지 않는다)
    const rng = s.rng.fork("waterBalloons");
    this.rng = rng;
    this.list = spots.map((spot) => {
      const v = from(spot.dist, spot.bear),
        ground = s.terrain.groundAt(v);
      const radius = S.R + ground + spot.alt;
      return {
        v,
        alt: spot.alt,
        ground,
        centre: v.clone().multiplyScalar(radius),
        phase: rng.next() * 6.283,
        age: GROW_SECONDS,
        pop: 0,
      };
    });
    const total = this.list.length;
    this.round = new BalloonRound(total);
    this.centres = this.list.map((b) => b.centre);
    this.away = this.list.map(() => false);
    const bodyGeo = createBalloonGeometry(),
      bodyMat = createBalloonMaterial(wordmark);
    this.bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, total);
    // 온 행성에 흩어져 있어 한 덩어리의 시야 검사가 맞지 않는다(열 개 남짓이라 그냥 그린다)
    this.bodies.frustumCulled = false;
    this.list.forEach((_, i) => this.bodies.setColorAt(i, TINT));
    s.scene.add(this.bodies);
    this.splash = new Splash(s.scene, rng);
    this.hud = new WaterBalloonHud(parent, {
      onAgain: () => this.playAgain(),
      onKeepPlaying: () => this.keepPlaying(),
    });
    this.hud.setCount(0, total);
  }

  /** 한 번 더: 물풍선이 모두 돌아오고 수와 시계가 0 으로, 섬은 제 색으로. 나는 그 자리에 그대로 있다 */
  playAgain() {
    this.round.restart();
    this.party = 0;
    this.panelIn = 0;
    this.floodFor = -1;
    this.s.mats.lookU.flood.value.w = FLOOD_OFF;
    this.list.forEach((b, i) => {
      b.age = -i * RETURN_STAGGER;
      b.pop = 0;
    });
    this.hud.hideSuccess();
    this.hud.setCount(0, this.round.total);
  }

  /** 계속 놀기: 물풍선도 화면도 치우고 떠다니기만 한다(섬은 라임으로 물든 채다) */
  keepPlaying() {
    this.round.leave();
    this.party = 0;
    this.panelIn = 0;
    this.bodies.count = 0;
    this.hud.close();
  }

  /** 둥실거리고, 닿으면 터지고, 다 먹으면 축하하고 성공 판을 띄운다 */
  update(f: Frame) {
    const { player, hud } = this.s;
    this.hud.setHidden(hud.isInStudio);
    this.hud.update(f);
    this.splash.update(f);
    this.spread(f);
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
  }

  /** 장면과 화면에서 치운다 */
  dispose() {
    const bodies = this.bodies;
    bodies.removeFromParent();
    bodies.geometry.dispose();
    bodies.material.dispose();
    bodies.dispose();
    this.splash.dispose();
    this.hud.dispose();
    this.s.mats.lookU.flood.value.w = FLOOD_OFF;
  }

  /* ─── 내부 ─────────────────────────── */

  // 라임 물결이 퍼진다: 다 덮으면 그 뒤로는 세지 않는다
  private spread(f: Frame) {
    if (this.floodFor < 0) return;
    this.floodFor += f.dt;
    const cos = REDUCED_MOTION ? null : floodCos(this.floodFor, S.R);
    this.s.mats.lookU.flood.value.w = cos ?? FLOOD_ALL;
    if (cos === null) this.floodFor = -1;
  }

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
      P = this.s.player.P;
    let bodyN = 0;
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
      stand.setFromUnitVectors(UP, b.v);
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
      bodyN++;
    });
    this.fill(this.bodies, bodyN);
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
    this.splash.burst(b.centre, b.v, BALLOON_TINT, POP_DROPS, POP_SPEED);
    fx.burst(b.centre, 10, 9);
    this.hud.setCount(count, total);
    if (round.stage !== "cleared") return;
    events.emit("waterBalloonsCleared", { seconds: round.seconds });
    this.party = PARTY_SECONDS;
    this.partyNext = 0;
    this.panelIn = PANEL_DELAY;
    // 마지막 물풍선이 터진 자리에서 라임 물결이 퍼지기 시작한다
    const flood = this.s.mats.lookU.flood.value;
    flood.set(b.v.x, b.v.y, b.v.z, flood.w);
    this.floodFor = 0;
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
      pick = rng.next() * PARTY_TINTS.length,
      hex = PARTY_TINTS[Math.floor(pick)];
    side.crossVectors(player.h, up);
    at.copy(player.P)
      .addScaledVector(player.h, ahead)
      .addScaledVector(side, aside)
      .addScaledVector(up, above);
    this.splash.burst(at, up, hex, 14, 12);
    fx.burst(at, 12, 11);
  }

  // 화면에 보이는 남은 물풍선마다 그 위에 핀을 얹고, 가장 가까운 것이 화면 밖이면 그쪽 가장자리에 화살표를 둔다
  private point() {
    const P = this.s.player.P,
      camera = this.s.camera.camera,
      halfFov = rad(camera.fov) / 2,
      tanY = Math.tan(halfFov),
      tanX = tanY * camera.aspect;
    let pinN = 0;
    this.list.forEach((b, i) => {
      if (this.away[i]) return;
      const distance = P.distanceTo(b.centre),
        alpha = pinFade(distance, PIN_NEAR[0], PIN_NEAR[1]);
      if (alpha <= 0) return;
      view.copy(b.centre).addScaledVector(b.v, PIN_ABOVE).applyMatrix4(camera.matrixWorldInverse);
      const spot = screenPin(view, tanX, tanY, innerWidth, innerHeight);
      if (!spot) return;
      const pin = this.pins[pinN] ?? { x: 0, y: 0, tint: TINT_CSS, alpha: 0 };
      this.pins[pinN] = pin;
      pin.x = spot.x;
      pin.y = spot.y;
      pin.alpha = alpha;
      pinN++;
    });
    for (let k = pinN; k < this.pins.length; k++) this.pins[k].alpha = 0;
    this.hud.setPins(this.pins);
    const nearest = nearestRemaining(P, this.centres, this.away);
    if (nearest < 0) {
      this.hud.pointTo(null);
      return;
    }
    const box = this.hud.hintBox();
    view.copy(this.list[nearest].centre).applyMatrix4(camera.matrixWorldInverse);
    const hint = edgeHint(view, tanX, tanY, box);
    this.hud.pointTo(hint, TINT_CSS);
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
