import * as THREE from "three";

import type { Services } from "../services";
import { S } from "../settings";
import type { HideFx } from "./effects";
import type { HideOverlay } from "./overlay";
import { LIDS_MOVE } from "./overlay";
import type { Seeker } from "./seeker";
import { resetSeeker } from "./seeker";
import { placeOf, sphereAt } from "./spots";
import type { Timeline } from "./timeline";
import type { HideSpot } from "./tuning";
import { HIDE } from "./tuning";

// '꼭꼭 숨어라': 상자 넷이 내 앞에 한 줄로 서서 차례로 폴짝 → 큰 글자 → 깜짝 놀라 우왕좌왕(하나는 넘어지고 하나는 버둥) →
// 제각각 숨을 곳 쪽으로 종종걸음(발밑 먼지) → 눈꺼풀이 감긴 동안 숨는 자리에 든다 → 눈을 뜬다. 찾기는 판이 시작한다.
// 첫 판의 첫 상자는 '제일 못 숨은 놈' — 정면 물건 뒤로 가는 것이 다 보이고, 리본과 귀를 다 내놓는다.
// 장면의 시각은 hideseek.data.json 의 start. 둘째 판부터는 놀라서 흩어지는 대목을 줄인다

/** 숨는 장면이 판에 알리는 때: 상자가 숨는 자리에 들었다(눈을 감은 동안) · 눈을 떴다(찾기 시작) */
interface HidingCues {
  settled(): void;
  go(): void;
}

/** 줄 선 상자들이 차례로 폴짝하는 간격(초) · 우왕좌왕하며 서로에게 달려드는 빠르기·흩어져 달려가는 빠르기(m/s) · 우왕좌왕하다 버둥거리는 시간(초) */
const WAVE_GAP = 0.1,
  FLUSTER_SPEED = 3.5,
  SCATTER_SPEED = 13,
  FLUSTER_FLAIL = 0.3;
/** 발밑 먼지: 간격(초)·크기(m)·남는 시간(초) */
const DUST_EVERY = 0.12,
  DUST_SIZE = 0.55,
  DUST_LIFE = 0.5;

const at = new THREE.Vector3(),
  tmp = new THREE.Vector3(),
  ahead = new THREE.Vector3(),
  rightV = new THREE.Vector3();

/** 숨는 장면 */
export class HidingScene {
  /** 이번 판이 첫 판인가(start 가 받는다 — 장면의 시각과 '제일 못 숨은 놈'이 달라진다) */
  private first = false;
  /** 우왕좌왕하는 중 · 흩어져 달려가는 중, 다음 먼지까지(초) */
  private flustering = false;
  private scurrying = false;
  private dustT = 0;

  constructor(
    private readonly s: Services,
    private readonly seekers: readonly Seeker[],
    private readonly fx: HideFx,
    private readonly overlay: HideOverlay,
    private readonly timeline: Timeline,
  ) {}

  /** 장면을 시작한다: 무대 마을(hub)에 선 내 앞에 상자를 한 줄로 세우고(숨을 자리는 spots), 장면의 시각마다 할 일을 걸어 둔다 */
  start(hub: THREE.Vector3, spots: readonly HideSpot[], first: boolean, cues: HidingCues) {
    const { player, terrain } = this.s,
      T = HIDE.start,
      o = this.overlay,
      tl = this.timeline;
    this.first = first;
    this.flustering = this.scurrying = false;
    const p = player.p as THREE.Vector3,
      h = player.h as THREE.Vector3;
    rightV.crossVectors(p, h).normalize();
    const back = tmp.copy(h).negate();
    this.seekers.forEach((k, i) => {
      resetSeeker(k, spots[i]);
      const place = this.placeFor(k, i);
      sphereAt(k.to, hub, place.x, place.y);
      const across = (i - 1.5) * T.lineGap;
      const aheadArc = T.lineAhead / S.R,
        acrossArc = across / S.R;
      ahead.copy(p).addScaledVector(h, aheadArc).addScaledVector(rightV, acrossArc).normalize();
      const ground = terrain.groundAt(ahead);
      k.box.setSize(1, true);
      k.box.put(ahead, ground, back);
      k.box.setPeek(null);
      tl.after(i * WAVE_GAP, () => k.box.hop());
    });
    const textAt = this.sceneTime(T.textAt),
      closeAt = this.sceneTime(T.closeAt),
      openAt = this.sceneTime(T.openAt);
    const hideFor = closeAt - textAt;
    tl.after(textAt, () => o.showBig(HIDE.copy.hide, hideFor));
    tl.after(this.sceneTime(T.startleAt), () => this.fluster());
    tl.after(this.sceneTime(T.scurryAt), () => this.scatter());
    tl.after(closeAt, () => o.setLids(true));
    tl.after(closeAt + LIDS_MOVE, () => {
      this.scurrying = false;
      this.hideAll(hub);
      cues.settled();
    });
    tl.after(openAt, () => o.setLids(false));
    tl.after(this.sceneTime(T.goAt), () => cues.go());
  }

  /** 한 프레임: 우왕좌왕 · 종종걸음과 발밑 먼지 · 다 온 놈은 출발 쪽을 보고 리본을 잡아당긴다 */
  update(dt: number) {
    const terrain = this.s.terrain;
    if (this.flustering)
      this.seekers.forEach((k, i) => {
        const other = this.seekers[i ^ 1].box;
        if (k.box.v.angleTo(other.v) * S.R < k.box.hh * 1.4) return;
        k.box.stepToward(other.v, FLUSTER_SPEED, dt);
        k.box.setScurry(1);
      });
    if (!this.scurrying) return;
    this.dustT -= dt;
    const isDusty = this.dustT <= 0;
    if (isDusty) this.dustT = DUST_EVERY;
    for (const k of this.seekers) {
      if (k.speed <= 0) continue;
      const left = k.box.stepToward(k.to, k.speed, dt);
      k.box.a = terrain.groundAt(k.box.v);
      k.box.setScurry(1);
      if (isDusty) {
        const foot = S.R + k.box.a + 0.2;
        at.copy(k.box.v).multiplyScalar(foot);
        this.fx.dot(at, DUST_SIZE, DUST_LIFE);
      }
      if (left > 0.2) continue;
      k.speed = 0;
      k.box.setScurry(0);
      k.box.faceTo(this.s.player.p as THREE.Vector3);
      k.box.tug();
    }
  }

  /* ─── 내부 ─────────────────────────── */

  // 장면의 시각: 둘째 판부터는 놀라서 흩어져 화면 밖으로 나가기까지(startleAt~offscreenAt)를 laterShare 로 줄인다
  private sceneTime(x: number): number {
    const T = HIDE.start,
      share = this.first ? 1 : T.laterShare;
    if (x <= T.startleAt) return x;
    const until = Math.min(x, T.offscreenAt),
      cut = until - T.startleAt,
      over = x - T.offscreenAt,
      rest = Math.max(0, over);
    return T.startleAt + cut * share + rest;
  }

  // 상자들이 깜짝 놀라 서로 부딪치며 우왕좌왕한다. 하나는 넘어졌다 일어나고 하나는 버둥거린다
  private fluster() {
    for (const k of this.seekers) k.box.startle();
    this.flustering = true;
    this.timeline.after(0.12, () => {
      this.seekers[2].box.topple();
      this.seekers[1].box.flail(FLUSTER_FLAIL);
    });
  }

  // 넷이 제각각 숨을 곳 쪽으로 종종걸음. 첫 판의 '제일 못 숨은 놈'은 화면 밖으로 나갈 때쯤 닿게 달린다(가는 것이 다 보인다)
  private scatter() {
    const T = HIDE.start,
      span = this.sceneTime(T.offscreenAt) - this.sceneTime(T.scurryAt);
    this.flustering = false;
    this.scurrying = true;
    this.seekers.forEach((k, i) => {
      const dist = k.box.v.angleTo(k.to) * S.R;
      k.speed = this.first && i === 0 ? dist / span : SCATTER_SPEED;
    });
    this.s.events.emit("hideStarted", {});
  }

  // 숨는 자리: 첫 판의 첫 상자만 '제일 못 숨은 놈' — 리본과 귀를 다 내놓는다
  private placeFor(k: Seeker, i: number) {
    const isWorst = this.first && i === 0;
    return isWorst ? placeOf(k.spot, HIDE.start.firstShowShare) : placeOf(k.spot);
  }

  // 숨는 자리에 든다: 뒤에 숨기는 가린 것 뒤에 비켜서고, 높이 숨기는 올라앉거나 매달린다. 모두 출발 쪽을 본다.
  // 달리다 만 놈도 여기서 멈춘다(해가 진 뒤 몰려올 때까지 서 있는다)
  private hideAll(hub: THREE.Vector3) {
    const terrain = this.s.terrain;
    this.seekers.forEach((k, i) => {
      const place = this.placeFor(k, i);
      sphereAt(at, hub, place.x, place.y);
      const faceX = place.x + place.faceX,
        faceY = place.y + place.faceY;
      const facePoint = sphereAt(tmp, hub, faceX, faceY).sub(at);
      const ground = terrain.groundAt(at);
      const base = place.top === null ? ground : ground + place.top;
      k.speed = 0;
      k.box.put(at, base, facePoint);
      if (place.peekX || place.peekY) {
        const peekX = place.x + place.peekX,
          peekY = place.y + place.peekY;
        const peekPoint = sphereAt(ahead, hub, peekX, peekY).sub(at);
        const radial = peekPoint.dot(at);
        peekPoint.addScaledVector(at, -radial).normalize();
        k.box.setPeek(peekPoint);
      } else k.box.setPeek(null);
    });
  }
}
