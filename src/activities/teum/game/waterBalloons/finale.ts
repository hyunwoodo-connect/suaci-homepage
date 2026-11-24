import * as THREE from "three";

import type { Frame } from "../core/frame";
import type { Random } from "../core/random";
import { FLOOD_ALL, FLOOD_OFF } from "../keyColor";
import type { Services } from "../services";
import { S } from "../settings";
import { BALLOON_TINT } from "./balloonLook";
import { REDUCED_MOTION } from "./hudStyle";
import { floodCos } from "./rules";
import type { Splash } from "./splash";

// 물풍선을 다 먹은 뒤의 끝 장면: 마지막 물풍선이 터진 자리에서 라임 물결이 퍼져 온 섬이 키컬러로 물들고,
// 내 둘레에서 축하 물방울이 터지고, 물결이 눈앞을 지난 뒤 성공 판이 뜬다 — 판이 끝난 뒤 머리에 남는 색이 라임이게.
// '계속 놀기'를 고르면 물든 섬에서 놀고(물결은 끝까지 퍼진다), '한 번 더'를 고르면 섬이 제 색으로 돌아온다

/** 축하 물방울의 색: 라임과 흰 물빛 */
const PARTY_TINTS: readonly number[] = [BALLOON_TINT, 0xffffff];
/** 축하가 이어지는 시간(초)·한 다발 사이(초), 성공 판이 뜨기까지(초 — 라임 물결이 눈앞을 지나 퍼지는 것을 보고 나서) */
const PARTY_SECONDS = 3,
  PARTY_EVERY = 0.28,
  PANEL_DELAY = 1.7;

const at = new THREE.Vector3(),
  side = new THREE.Vector3();

/** 물풍선 놀이의 끝 장면 */
export class BalloonFinale {
  private party = 0;
  private partyNext = 0;
  private panelIn = 0;
  /** 라임 물결이 퍼지기 시작한 뒤 흐른 시간(초). 음수면 물결이 없다(또는 다 퍼졌다) */
  private floodFor = -1;

  /** splash·rng: 놀이의 물방울과 난수(같이 쓴다), showPanel: 성공 판을 띄울 때 부른다 */
  constructor(
    private readonly s: Services,
    private readonly splash: Splash,
    private readonly rng: Random,
    private readonly showPanel: () => void,
  ) {}

  /** 마지막 물풍선이 v(행성 위 방향)에서 터졌다: 축하와 물결이 시작되고 조금 뒤 성공 판이 뜬다 */
  start(v: THREE.Vector3) {
    this.party = PARTY_SECONDS;
    this.partyNext = 0;
    this.panelIn = PANEL_DELAY;
    const flood = this.s.mats.lookU.flood.value;
    flood.set(v.x, v.y, v.z, flood.w);
    this.floodFor = 0;
  }

  /** 한 번 더: 축하와 성공 판을 멈추고 섬을 제 색으로 돌린다 */
  reset() {
    this.leave();
    this.floodFor = -1;
    this.s.mats.lookU.flood.value.w = FLOOD_OFF;
  }

  /** 계속 놀기: 축하와 성공 판만 멈춘다(섬은 라임으로 물든 채고 물결은 끝까지 퍼진다) */
  leave() {
    this.party = 0;
    this.panelIn = 0;
  }

  /** 라임 물결이 퍼진다(놀이를 끝낸 뒤에도 부른다). 다 덮으면 그 뒤로는 세지 않는다 */
  spread(f: Frame) {
    if (this.floodFor < 0) return;
    this.floodFor += f.dt;
    const cos = REDUCED_MOTION ? null : floodCos(this.floodFor, S.R);
    this.s.mats.lookU.flood.value.w = cos ?? FLOOD_ALL;
    if (cos === null) this.floodFor = -1;
  }

  /** 내 둘레에서 물방울과 빛 방울이 다발로 터지고, 조금 뒤 성공 판을 띄운다 */
  celebrate(f: Frame) {
    if (this.panelIn > 0) {
      this.panelIn -= f.dt;
      if (this.panelIn <= 0) this.showPanel();
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

  /** 치운다: 물결을 걷는다 */
  dispose() {
    this.s.mats.lookU.flood.value.w = FLOOD_OFF;
  }
}
