import type * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import { HIGH_BALLOON_SCALE, highBalloonHome } from "./highBalloon";
import type { Lawn } from "./lawn";
import { createLawnMesh } from "./lawn";
import { createLogoTextures } from "./logo";
import type { LogoTextures } from "./logo";
import type { LogoBalloon } from "./logoBalloons";
import { LogoBalloons } from "./logoBalloons";
import { Mists, Stamps } from "./mist";
import type { Flag, RestSite } from "./restFlags";
import { RestFlags } from "./restFlags";

// suaci 의 서명: 크게 말하지 않고, 스스로 알아차리게 둔다(브랜드 원칙 '넛지'). 제품도 문구도 구매 단추도 없다. suaci 것은 라임.
// 1) 로고 풍선 — logoBalloons.ts. 마을마다 하나, 마을 사이에 드문드문. 줄을 잡으면 잠깐 태워 올려 준다(take suaci = 잡으면 떠오른다)
// 2) 잔디 로고 — lawn.ts
// 3) 높은 풍선 — highBalloon.ts. 출발 마을에서 가장 가까운 로켓 바로 위, 로켓으로만 닿는 높이. 뚫고 지나가면 라임 안개가 터진다
// 4) 라임 안개 — mist.ts. 쉬는 곳에 들어서는 순간 한 번 퍼진다(칙, 하고 뿌린 듯). 병은 보이지 않고 안개만 있다
// 5) 쉬는 곳의 라임 깃발 — restFlags.ts. 글자 없이 색만. 멀리서 '저기 쉴 곳'이라고 알려 준다
// 6) 전설의 도장 — mist.ts. 전설의 손님을 만난 자리에 작은 라임 워드마크가 그 방문 동안 남는다. 만난 사람만 가진 흔적
// 만드는 차례(풍선 → 잔디 → 높은 풍선 → 안개 → 깃발 → 도장)와 프레임 차례(안개 → 깃발 → 도장 → 풍선)는 이 파일이 정한다

/** 서명이 보는 랜드마크·쉬는 곳 목록 */
interface SiteList {
  list: readonly RestSite[];
}

/** 높은 풍선을 띄울 로켓 목록 */
interface RocketList {
  list: readonly { v: THREE.Vector3 }[];
}

/** suaci 서명 전체 */
export class Signature implements Thing {
  readonly BAL: LogoBalloon[];
  /** 잔디 로고 자리(맡아 둔 것) */
  readonly lawn: Lawn;
  readonly lawnMesh: THREE.Mesh;
  readonly FLAGS: Flag[];
  /** 워드마크 모양만 남긴 그림(바탕은 비어 있다) — 물풍선도 이것을 두른다 */
  readonly wordmark: THREE.Texture;
  private readonly balloons: LogoBalloons;
  private readonly mists: Mists;
  private readonly flags: RestFlags;
  private readonly stamps: Stamps;
  private readonly tex: LogoTextures;

  /** 서명을 놓는다(풍경을 다 놓고 고래 길을 정한 뒤, 방울 길보다 먼저) */
  constructor(
    private readonly s: Services,
    lawn: Lawn,
    sites: SiteList,
    rockets: RocketList,
  ) {
    const rng = s.rng.fork("signature");
    this.lawn = lawn;
    const tex = createLogoTextures();
    this.tex = tex;
    this.wordmark = tex.lawn;
    const balloons = new LogoBalloons(s, tex, rng);
    this.balloons = balloons;
    this.BAL = balloons.list;
    this.lawnMesh = createLawnMesh(s, lawn, tex.lawn);
    const plan = s.map.brand.balloons,
      highHome = highBalloonHome(rockets.list);
    balloons.add(highHome, plan.highAlt, HIGH_BALLOON_SCALE);
    const mists = new Mists(s);
    this.mists = mists;
    this.flags = new RestFlags(s, sites.list, balloons.stringMat, mists);
    this.FLAGS = this.flags.list;
    this.stamps = new Stamps(s, tex.lawn, mists);
  }

  /** 전설의 손님을 만난 자리(v)에 작은 라임 워드마크를 찍고 안개를 한 번 뿌린다 */
  stampAt(v: THREE.Vector3) {
    this.stamps.stampAt(v);
  }

  /** 안개가 퍼졌다 사라지고, 깃발이 나부끼고(쉬는 곳에 들어서면 안개), 도장이 떠오르고, 풍선이 뜨거나 태워 올린다 */
  update(f: Frame) {
    const P = this.s.player.P;
    const altA = P.length() - S.R;
    this.mists.update(f.dt);
    this.flags.update(f.time);
    this.stamps.update(f.dt);
    this.balloons.update(altA, f, this.mists);
  }

  /** 치운다 */
  dispose() {
    this.balloons.dispose();
    this.flags.dispose();
    this.mists.dispose();
    this.stamps.dispose();
    this.lawnMesh.removeFromParent();
    this.lawnMesh.geometry.dispose();
    (this.lawnMesh.material as THREE.Material).dispose();
    this.tex.balloon.dispose();
    this.tex.lawn.dispose();
  }
}
