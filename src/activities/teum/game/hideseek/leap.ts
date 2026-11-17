import * as THREE from "three";

import type { HeldBody, Holder } from "../player/player";
import type { Services } from "../services";
import { S } from "../settings";
import { HIDE } from "./tuning";

// 찾았다고 정한 뒤 상자까지 가는 일은 저절로: 아바타가 스스로 뛰어 날아가(포물선) 상자 바로 앞(판이 정한 자리)에 내린다.
// 가는 동안만 조작이 잠긴다(붙잡기 — 놀이기구와 같은 손잡이). 거리에 따라 find.leapMin~leapMax 초

/** 포물선 꼭대기(m — 거리의 몫을 더한다) */
const ARC_BASE = 2,
  ARC_SHARE = 0.18;

/** 거리 dist(m)를 뛰어가는 시간(초): 가까우면 leapMin, tapReach 이면 leapMax */
export function leapSeconds(dist: number): number {
  const { leapMin, leapMax, tapReach } = HIDE.find,
    share = dist / tapReach,
    k = Math.min(1, share);
  return leapMin + (leapMax - leapMin) * k;
}

const spot = new THREE.Vector3(),
  fwd = new THREE.Vector3();

/** 상자까지 뛰어가기 */
export class Leap implements Holder {
  readonly rideName = "leap";
  readonly freezesGravity = true;
  private isOn = false;
  private t = 0;
  private seconds = 1;
  private arc = 0;
  private air0 = 0;
  private air1 = 0;
  /** 떠난 자리 · 도는 축 · 다 갔을 때의 각(rad) */
  private readonly from = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private angle = 0;

  constructor(private readonly s: Services) {}

  /** 내릴 자리(to — 단위 벡터, 땅에서 toAir m)까지 뛰어간다. 이미 붙잡혀 있으면(놀이기구) 뛰지 않고 false */
  start(to: THREE.Vector3, toAir: number): boolean {
    const { player } = this.s;
    if (player.isHeld) return false;
    this.from.copy(player.p);
    const dist = this.from.angleTo(to) * S.R;
    this.axis.crossVectors(this.from, to);
    if (this.axis.lengthSq() < 1e-12) this.axis.crossVectors(this.from, player.h);
    this.axis.normalize();
    this.angle = dist / S.R;
    this.seconds = leapSeconds(dist);
    this.arc = ARC_BASE + dist * ARC_SHARE;
    this.air0 = player.air;
    this.air1 = toAir;
    this.t = 0;
    this.isOn = true;
    player.grab(this);
    return true;
  }

  /** 한 프레임: 다 뛰었으면 true(그 프레임에 내려놓는다) */
  update(dt: number): boolean {
    if (!this.isOn) return false;
    const { player } = this.s,
      body = player.bodyFor(this);
    if (!body) {
      this.isOn = false;
      return true;
    }
    this.t += dt;
    const raw = this.t / this.seconds,
      u = Math.min(1, raw);
    this.carry(body, u);
    if (u < 1) return false;
    this.isOn = false;
    player.release(this, { boost: 0 });
    return true;
  }

  /** 그만둔다(판이 넘어간다) */
  stop() {
    if (!this.isOn) return;
    this.isOn = false;
    this.s.player.release(this, { boost: 0 });
  }

  // 길 위 u(0..1)의 자리: 땅 위로는 고르게, 높이는 포물선
  private carry(body: HeldBody, u: number) {
    const along = this.angle * u;
    spot.copy(this.from).applyAxisAngle(this.axis, along).normalize();
    fwd.crossVectors(this.axis, spot).normalize();
    body.p.copy(spot);
    if (this.angle > 1e-6) body.h.copy(fwd);
    body.vel.copy(body.h);
    body.vy = 0;
    const base = this.air0 + (this.air1 - this.air0) * u,
      hump = 4 * u * (1 - u) * this.arc,
      air = base + hump;
    body.air = Math.max(0.01, air);
  }
}
