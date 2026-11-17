import * as THREE from "three";

import type { Services } from "../services";
import { S } from "../settings";
import type { HideOverlay } from "./overlay";
import type { Seeker } from "./seeker";
import type { Timeline } from "./timeline";
import { HIDE, LOST_RUN_MIN } from "./tuning";

// 해가 진 뒤(상자들이 이겼다): 잠깐 조용하다가 남은 상자들이 동시에 펑 튀어나오고(카메라가 물러난다), '우리가 이겼다!' 하며
// 내 앞으로 몰려와 둘러싸고 폴짝폴짝, 한 놈은 줄 선 상자 크기로 작아져 내 머리 위에 올라탄다. 장면의 시각은 hideseek.data.json 의 lost

/** 튀어나오는 높이·둘러싸고 뛰는 높이(m) · 내 둘레 거리(m) · 카메라가 물러나는 배수 · 머리 위에 올라앉는 높이(내 몸 가운데에서 m) */
const POP = 2.6,
  CHEER_HOP = 1.2,
  RING = 4.6,
  ZOOM = 1.5,
  ON_HEAD = 0.75;

const tmp = new THREE.Vector3(),
  rightV = new THREE.Vector3();

/** redFrom 까지 가는 노을의 몫 */
const DUSK_EARLY = 0.4;

/** 찾기 시작 뒤 t 초의 노을(0 낮 … 1 해가 졌다): redFrom 까지는 은은하게, 그 뒤로 눈에 띄게 붉어진다 */
export function duskAt(t: number): number {
  const { seconds, redFrom } = HIDE.round;
  if (t <= redFrom) return DUSK_EARLY * (t / redFrom);
  const share = (t - redFrom) / (seconds - redFrom),
    late = Math.min(1, share);
  return DUSK_EARLY + (1 - DUSK_EARLY) * late;
}

/** 해가 진 뒤 장면 */
export class Sunset {
  private losers: Seeker[] = [];
  /** 내 머리 위에 올라탄 상자 */
  private rider: Seeker | null = null;

  constructor(
    private readonly s: Services,
    private readonly overlay: HideOverlay,
    private readonly timeline: Timeline,
  ) {}

  /** 남은 상자들(losers)이 이겼다: 장면을 걸어 두고, 단추가 뜰 때가 되면 onButtons */
  start(losers: Seeker[], onButtons: () => void) {
    const L = HIDE.lost,
      tl = this.timeline;
    this.losers = losers;
    for (const k of losers) {
      k.box.setPeek(null);
      k.box.setRestless(false);
      k.box.setWobble(false);
      k.box.holdBreath(false);
    }
    const popFor = L.gatherAt - L.popAt,
      cheerFor = L.buttonsAt - L.gatherAt,
      runFor = L.climbAt - L.gatherAt - LOST_RUN_MIN * 0.5;
    tl.after(L.popAt, () => {
      this.s.camera.setZoom(ZOOM);
      for (const k of losers) {
        k.box.startle();
        k.box.hopFor(popFor, POP);
      }
    });
    tl.after(L.gatherAt, () => {
      this.overlay.showBig(HIDE.copy.boxesWin, cheerFor);
      this.s.events.emit("hideBoxesWon", {});
      this.gather(runFor);
    });
    tl.after(L.climbAt, () => {
      this.rider = losers[0] ?? null;
      this.rider?.box.setSize(HIDE.line.scale);
    });
    tl.after(L.buttonsAt, onButtons);
  }

  /** 한 프레임: 몰려오는 상자는 종종걸음으로, 다 오면 나를 보고 폴짝폴짝. 머리 위에 올라탄 놈은 나를 따라다닌다 */
  update(dt: number) {
    const { player, terrain } = this.s,
      p = player.p as THREE.Vector3;
    for (const k of this.losers) {
      if (k === this.rider || k.speed <= 0) continue;
      const left = k.box.stepToward(k.to, k.speed, dt);
      k.box.a = terrain.groundAt(k.box.v);
      k.box.setScurry(1);
      if (left > 0.2) continue;
      k.speed = 0;
      k.box.setScurry(0);
      const toMe = tmp.copy(p).sub(k.box.v);
      k.box.faceTo(toMe);
      k.box.hopFor(1e9, CHEER_HOP);
    }
    const rider = this.rider;
    if (!rider) return;
    const headTop = player.P.length() - S.R + ON_HEAD;
    rider.box.v.copy(p);
    rider.box.a = headTop;
    rider.box.faceTo(player.h as THREE.Vector3);
  }

  /** 장면을 거둔다(언박싱으로 넘어가거나 새 판) */
  clear() {
    this.losers = [];
    this.rider = null;
  }

  /* ─── 내부 ─────────────────────────── */

  // 남은 상자들이 seconds 안에 내 앞으로 몰려온다: 내 앞쪽 반원에 둘러서게(카메라는 내 뒤에 있다). 높이 숨었던 상자는 땅으로 내려와 달린다
  private gather(seconds: number) {
    const { player, terrain } = this.s,
      p = player.p as THREE.Vector3,
      h = player.h as THREE.Vector3,
      losers = this.losers;
    rightV.crossVectors(p, h).normalize();
    losers.forEach((k, i) => {
      const spread = losers.length > 1 ? i / (losers.length - 1) - 0.5 : 0,
        angle = spread * 2.2,
        fwd = Math.cos(angle) * RING,
        side = Math.sin(angle) * RING;
      const fwdArc = fwd / S.R,
        sideArc = side / S.R;
      k.to.copy(p).addScaledVector(h, fwdArc).addScaledVector(rightV, sideArc).normalize();
      k.box.a = terrain.groundAt(k.box.v);
      k.box.setPeek(null);
      const dist = k.box.v.angleTo(k.to) * S.R;
      k.speed = dist / seconds;
    });
  }
}
