import * as THREE from "three";

import type { Services } from "../services";
import { S } from "../settings";
import type { CatLink } from "./coach";
import type { HideOverlay } from "./overlay";
import type { BoxLine } from "./line";
import type { Seeker } from "./seeker";
import { sphereAt, startPoint } from "./spots";
import type { DisguiseKind } from "./tuning";
import { HIDE } from "./tuning";

// 아닌 척하기 — 숨지 않고 눈에 띄는 곳에서 다른 것인 척한다. 자세히 보면 티가 난다. 톡 치면 재채기하며 들통나고(민망해함) 찾아진다.
//   내 줄에 끼기 — 이미 찾은 상자들 줄 맨 끝에 슬쩍 붙어 따라온다(하나 이상 찾은 뒤, 내가 그 자리를 안 볼 때). 혼자 원래 크기, 돌아보면 휘파람
//   병정인 척 — 카드 병정 줄 맨 끝에 끼어 선다. 혼자 라임색이고 한 박자 늦게 뒤뚱거린다
//   고양이 뒤에 숨기 — 내 옆 고양이 뒤에 웅크리고 따라온다. 고양이보다 세 배 크다
//   조각상인 척 — 받침대 위에서 포즈를 잡고 굳어 있다. 안 보면 포즈를 바꾸고, 오래 보면 부들부들
//   변장 안경·화분의 꽃·선물 더미·가면 — 소품(assets)을 입는다. 소품 모델이 없으면 맨몸으로 그 자리에 선다
//   풍선인 척 — 풍선 다발 사이에 떠서 같이 둥둥. 혼자 네모나고 가끔 움찔한다(광장 70m 안에 풍선 다발이 없어 다발을 같이 놓는다)
//   케이크 장식인 척 — 케이크 꼭대기에 체리처럼. 케이크보다 너무 크고, 가끔 미끄러져 떨어졌다가 다시 기어오른다(케이크도 같이 놓는다)
// 아닌 척하는 상자는 움직이지 않는다(컵케이크 냄새에는 끌려간다). 빈 데를 친 칙에는 움찔만 한다

/** 소품 모델 키(분류표 hideseek): 안경 · 화분 · 선물 더미 · 토끼 가면 */
export const PROP_KEYS = {
  glasses: "disguise_glasses",
  flowerpot: "flowerpot",
  gifts: "gift_pile",
  mask: "rabbit_mask",
} as const;

/** 아닌 척에 쓰는 것: 손님 무리 자리(가면이 섞여 든다)와 병정 줄 끝, 옆의 고양이, 내 뒤 줄의 자리 */
export interface DisguiseLinks {
  help: {
    homeOf(species: string, out: THREE.Vector3): THREE.Vector3 | null;
    rowEnd(out: THREE.Vector3, face: THREE.Vector3): boolean;
  };
  cat: CatLink;
  line: Pick<BoxLine, "spotFor">;
}

/** 받침대: 키(m)·반지름(m)·색 · 고양이 뒤로 물러앉는 거리(m) · 가면 상자가 무리 가운데에서 떨어진 거리(m) · 휘파람 간격(초) · 조각상 포즈를 바꾸는 간격(초) */
const PEDESTAL_H = 1.2,
  PEDESTAL_R = 1.5,
  PEDESTAL_COLOR = 0xf4eee6,
  CAT_BEHIND = 1.6,
  MASK_ASIDE = 3.2,
  WHISTLE_EVERY = 3,
  POSE_EVERY = 1.6,
  WADDLE_FOR = 0.45;
/** 풍선 다발: 풍선 수·반지름(m)·떠 있는 높이(m, 땅에서)·퍼진 폭(m)·색(라임은 상자의 것이라 뺀다) · 상자가 떠 있는 높이(m)·오르내림(m) */
const BALLOONS = 5,
  BALLOON_R = 1.1,
  BALLOON_UP = 6.2,
  BALLOON_SPREAD = 1.9,
  BALLOON_COLORS = [0xff8fc6, 0x8fd3ff, 0xffe066, 0xc6a2ff, 0xffb38a],
  FLOAT_AT = 4.4,
  FLOAT_BOB = 0.35;
/** 케이크: 너비(m — 상자보다 작게, 그래서 상자가 너무 크다) · 미끄러지는 간격(초) · 바닥에 있다가 다시 오르기까지(초) · 미끄러지는 거리(m) */
const CAKE_KEY = "d_cake",
  CAKE_W = 3,
  SLIP_EVERY = 6,
  SLIP_REST = 0.9,
  SLIP_SIDE = 1.4;
/** 줄 끝에 붙는 빠르기(거리의 몇 배 m/s, 가장 빠르게) · 서 있다 다시 걷는 거리(m) */
const LINE_CHASE = 9,
  LINE_MAX = 26,
  LINE_GO = 0.3;

const UP = new THREE.Vector3(0, 1, 0),
  at = new THREE.Vector3(),
  face = new THREE.Vector3(),
  side = new THREE.Vector3(),
  tmp = new THREE.Vector3(),
  ndc = new THREE.Vector3();

/** 아닌 척하는 상자 하나 */
interface Entry {
  k: Seeker;
  as: DisguiseKind;
  prop: THREE.Object3D | null;
  /** 찾을 수 있게 된 때(게임 초 — 내 줄에 끼기는 줄에 붙은 때) · 들통난 때 */
  since: number | null;
  blownAt: number | null;
  /** 내 줄에 끼기: 붙었나 · 다음 휘파람까지(초) */
  hasJoined: boolean;
  whistleT: number;
  /** 다음 몸짓까지(초 — 조각상 포즈·병정 뒤뚱·풍선 움찔·케이크 미끄럼) · 뒤뚱거리는 남은 시간(초) · 화면 밖에 나간 지·화면에 잡혀 있은 지(초) */
  poseT: number;
  /** 제자리 높이(m, 땅에서 — 풍선 다발 속·케이크 꼭대기)와 그 자리(케이크에서 미끄러졌다 돌아올 곳) */
  rest: number;
  readonly home: THREE.Vector3;
  /** 케이크: 미끄러져 바닥에 있은 지(초, 꼭대기에 있으면 -1) */
  slipT: number;
  stepLeft: number;
  unseenT: number;
  watchT: number;
}

/** 아닌 척하는 상자들 */
export class Disguises {
  private entries: Entry[] = [];
  /** 입힌 소품(종류마다 하나를 만들어 판마다 다시 쓴다) */
  private readonly props = new Map<DisguiseKind, THREE.Object3D>();
  private readonly pedestal: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  /** 풍선 다발(풍선인 척)과 케이크(케이크 장식인 척) — 광장에 없어 같이 놓는다 */
  private readonly bundle: THREE.Group;
  private cake: THREE.Object3D | null = null;
  private time = 0;

  constructor(
    private readonly s: Services,
    private readonly links: DisguiseLinks,
    private readonly overlay: HideOverlay,
    private readonly rand: () => number,
  ) {
    const foot = PEDESTAL_R * 1.12,
      geo = new THREE.CylinderGeometry(PEDESTAL_R, foot, PEDESTAL_H, 28),
      mat = new THREE.MeshStandardMaterial({ color: PEDESTAL_COLOR, roughness: 0.7 });
    this.pedestal = new THREE.Mesh(geo, mat);
    this.pedestal.visible = false;
    s.scene.add(this.pedestal);
    this.bundle = balloonBundle();
    this.bundle.visible = false;
    s.scene.add(this.bundle);
    // 소품과 케이크는 처음 화면에 없어 저절로 받지 않는다 — 판이 시작되기 전에 받아 둔다
    for (const key of Object.values(PROP_KEYS)) s.models.need(key);
    s.models.need(CAKE_KEY);
  }

  /** 아닌 척하던 상자인가(들통난 뒤에도 그 판 동안은 — 잰 값에 남긴다) */
  kindOf(k: Seeker): DisguiseKind | null {
    return this.find(k)?.as ?? null;
  }

  /** 지금 찾을 수 있나(내 줄에 끼기는 줄에 붙기 전에는 아무 데도 없다) */
  canFind(k: Seeker): boolean {
    const e = this.find(k);
    return !e || e.since !== null;
  }

  /** 찾을 수 있게 된 뒤 들통나기까지(아직이면 지금까지) 흐른 시간(초 — 잰 값) */
  shownFor(k: Seeker): number | null {
    const e = this.find(k);
    if (!e || e.since === null) return null;
    const end = e.blownAt ?? this.time;
    return end - e.since;
  }

  /** 내 곁을 따라오는 아닌 척인가(내 줄에 끼기·고양이 뒤에 숨기 — 멀어서 키울 일이 없다) */
  isBeside(k: Seeker): boolean {
    const as = this.find(k)?.as;
    return as === "line" || as === "cat";
  }

  /** 아직 들통나지 않고 아닌 척하는 중인가(빈 데 칙에 재채기하지 않고 움찔만 한다) */
  isPretending(k: Seeker): boolean {
    const e = this.find(k);
    return e !== null && e.blownAt === null;
  }

  /** 판 시작(눈을 감은 동안): 아닌 척하는 상자를 저마다의 자리에 둔다. hub: 무대 마을 중심 */
  place(seekers: readonly Seeker[], hub: THREE.Vector3) {
    this.clear();
    const start = startPoint();
    for (const k of seekers) {
      const spot = k.spot;
      if (spot.kind !== "disguise") continue;
      const e: Entry = {
        k,
        as: spot.as,
        prop: null,
        since: this.time,
        blownAt: null,
        hasJoined: false,
        whistleT: WHISTLE_EVERY,
        poseT: POSE_EVERY,
        stepLeft: 0,
        unseenT: 0,
        watchT: 0,
        rest: 0,
        home: new THREE.Vector3(),
        slipT: -1,
      };
      this.entries.push(e);
      const b = k.box,
        terrain = this.s.terrain;
      b.setPeek(null);
      sphereAt(face, hub, start.x, start.y);
      if (spot.as === "line") {
        b.visible = false;
        e.since = null;
        continue;
      }
      if (spot.as === "cat") {
        // 카메라 바로 앞이라 줄 선 상자 크기로 웅크린다(그래도 고양이보다 세 배는 크다)
        b.setSize(HIDE.line.scale, true);
        b.setLongEars(false);
        b.visible = false;
        e.since = null;
        continue;
      }
      if (spot.as === "soldier") {
        const hasRow = this.links.help.rowEnd(at, face);
        if (!hasRow) sphereAt(at, hub, start.x, start.y);
        const ground = terrain.groundAt(at);
        b.put(at, ground, face);
        continue;
      }
      if (spot.as === "mask") this.maskSpot(spot.group ?? "", hub, at);
      else sphereAt(at, hub, spot.x, spot.y);
      const ground = terrain.groundAt(at),
        lift = this.standOn(spot.as, at, ground),
        base = ground + lift;
      face.sub(at);
      b.put(at, base, face);
      e.rest = lift;
      e.home.copy(at);
      e.prop = this.dress(spot.as);
      b.wear(e.prop);
    }
  }

  /** 한 프레임(찾는 중). found: 지금까지 찾은 수(내 줄에 끼기의 자리) */
  update(dt: number, found: number) {
    this.time += dt;
    for (const e of this.entries) {
      if (e.k.state !== "hidden" || e.blownAt !== null) continue;
      if (e.as === "line") this.lineUp(e, dt, found);
      else if (e.as === "cat") this.followCat(e, found);
      else if (e.as === "statue") this.pose(e, dt);
      else if (e.as === "soldier") this.waddle(e, dt);
      else if (e.as === "balloon") this.float(e, dt);
      else if (e.as === "cake") this.slip(e, dt);
    }
  }

  /** 들통났다(찾았다): 소품을 벗고 민망해한다 */
  reveal(k: Seeker) {
    const e = this.find(k);
    if (!e || e.blownAt !== null) return;
    e.blownAt = this.time;
    k.box.setFrozen(false);
    k.box.wear(null);
    k.box.coverEyes(true);
    this.s.events.emit("hideDisguiseBlown", {});
  }

  /** 소품을 벗긴다(해가 졌다 — 이긴 상자들은 맨몸으로 뛴다. 받침대는 새 판까지 그대로) */
  undress() {
    for (const e of this.entries) e.k.box.wear(null);
  }

  /** 거둔다(새 판): 소품을 벗기고 받침대·풍선 다발·케이크를 치운다 */
  clear() {
    this.undress();
    this.entries = [];
    this.pedestal.visible = false;
    this.bundle.visible = false;
    if (this.cake) this.cake.visible = false;
  }

  dispose() {
    this.pedestal.removeFromParent();
    this.pedestal.geometry.dispose();
    this.pedestal.material.dispose();
    this.bundle.removeFromParent();
    this.bundle.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      o.material.dispose();
    });
    this.cake?.removeFromParent();
  }

  /* ─── 내부: 풍선 다발·케이크 ─────────────────────────── */

  // 서는 자리의 높이(땅에서 m): 조각상은 받침대 위, 풍선은 다발 속, 케이크는 꼭대기. 받침대·다발·케이크를 그 자리에 놓는다
  private standOn(as: DisguiseKind, v: THREE.Vector3, ground: number): number {
    if (as === "statue") {
      this.raisePedestal(v, ground);
      return PEDESTAL_H;
    }
    if (as === "balloon") {
      this.raiseBalloons(v, ground);
      return FLOAT_AT;
    }
    if (as === "cake") return this.setCake(v, ground);
    return 0;
  }

  // 풍선 다발을 v(단위 벡터) 땅 위에 세운다(끈은 땅에 묶였다)
  private raiseBalloons(v: THREE.Vector3, ground: number) {
    const g = this.bundle,
      foot = S.R + ground;
    g.position.copy(v).multiplyScalar(foot);
    g.quaternion.setFromUnitVectors(UP, v);
    g.visible = true;
  }

  // 케이크를 v 땅 위에 놓고 꼭대기 높이(m)를 돌려준다. 모델이 아직 없으면 땅(0)
  private setCake(v: THREE.Vector3, ground: number): number {
    if (!this.cake && this.s.models.has(CAKE_KEY))
      this.cake = this.s.models.fit(CAKE_KEY, CAKE_W, "w");
    const c = this.cake;
    if (!c) return 0;
    if (!c.parent) this.s.scene.add(c);
    const half = c.userData.hh as number,
      mid = S.R + ground + half;
    c.position.copy(v).multiplyScalar(mid);
    c.quaternion.setFromUnitVectors(UP, v);
    c.visible = true;
    return half * 2;
  }

  // 풍선인 척: 다발과 같이 둥둥, 가끔 혼자 움찔
  private float(e: Entry, dt: number) {
    const b = e.k.box,
      phase = this.time * 1.3,
      bob = Math.sin(phase) * FLOAT_BOB,
      ground = this.s.terrain.groundAt(b.v);
    b.a = ground + e.rest + bob;
    e.poseT -= dt;
    if (e.poseT > 0) return;
    e.poseT = POSE_EVERY * 1.6;
    b.flinch();
  }

  // 케이크 장식인 척: 가끔 미끄러져 떨어졌다가(굴러떨어지기) 바닥에서 잠깐 뒤 다시 꼭대기로 기어오른다
  private slip(e: Entry, dt: number) {
    const b = e.k.box,
      ground = this.s.terrain.groundAt(e.home);
    if (e.slipT >= 0) {
      if (b.isTumbling) return;
      e.slipT += dt;
      if (e.slipT < SLIP_REST) return;
      e.slipT = -1;
      face.copy(this.s.player.p).sub(e.home);
      const top = ground + e.rest;
      b.put(e.home, top, face);
      b.hop(1.2);
      return;
    }
    e.poseT -= dt;
    if (e.poseT > 0 || e.rest <= 0) return;
    e.poseT = SLIP_EVERY;
    e.slipT = 0;
    b.tumbleTo(ground, SLIP_SIDE);
  }

  /* ─── 내부 ─────────────────────────── */

  private find(k: Seeker): Entry | null {
    return this.entries.find((e) => e.k === k) ?? null;
  }

  // 내 줄에 끼기: 하나 이상 찾은 뒤, 줄 끝 자리가 화면 밖일 때 슬쩍 붙는다. 붙으면 줄 끝을 따라온다 —
  // 줄 선 상자와 같은 크기라 크기로는 구분이 안 된다. 티는 귀가 혼자 길다는 것과, 돌아보면 고개를 돌리고 몸을 흔드는 휘파람 부는 척
  private lineUp(e: Entry, dt: number, found: number) {
    const b = e.k.box;
    this.links.line.spotFor(found, at);
    if (!e.hasJoined) {
      if (found < 1) return;
      const tail = tmp.copy(at).multiplyScalar(S.R);
      if (this.isOnScreen(tail)) return;
      const ground = this.s.terrain.groundAt(at);
      face.copy(this.s.player.p).sub(at);
      b.visible = true;
      b.setSize(HIDE.line.scale, true);
      b.setLongEars(true);
      b.setOutline(false);
      b.put(at, ground, face);
      e.hasJoined = true;
      e.since = this.time;
      return;
    }
    const gap = b.v.angleTo(at) * S.R;
    if (gap > LINE_GO) {
      const chase = gap * LINE_CHASE,
        speed = Math.min(LINE_MAX, chase);
      b.stepToward(at, speed, dt);
      b.setScurry(1);
    } else b.setScurry(0);
    b.a = this.s.terrain.groundAt(b.v);
    // 돌아보면(가까이서 화면에 잡히면) 휘파람 부는 척: 딴 데를 보며 몸을 흔든다
    e.whistleT -= dt;
    const center = b.center(tmp);
    if (e.whistleT > 0 || !this.isOnScreen(center)) return;
    e.whistleT = WHISTLE_EVERY;
    face.copy(b.v).sub(this.s.player.p);
    b.faceTo(face);
    b.jiggle();
  }

  // 고양이 뒤에 웅크리고 따라온다
  // 하나 이상 찾은 뒤에만 나타난다(시작하자마자 곁에 보이지 않게)
  private followCat(e: Entry, found: number) {
    const b = e.k.box,
      { player, terrain } = this.s;
    if (found < 1) {
      b.visible = false;
      return;
    }
    this.links.cat.catHead(at);
    at.normalize();
    const back = -CAT_BEHIND / S.R;
    at.addScaledVector(player.h, back).normalize();
    const ground = terrain.groundAt(at);
    if (!b.visible) {
      b.visible = true;
      e.since = this.time;
    }
    b.v.copy(at);
    b.a = ground;
    b.f.copy(player.h);
    b.holdBreath(true);
  }

  // 조각상: 화면에 잡히면 굳고(오래 보면 부들부들), 안 보는 동안 가끔 포즈를 바꾼다
  private pose(e: Entry, dt: number) {
    const b = e.k.box;
    if (e.k.seen) {
      e.unseenT = 0;
      e.watchT += dt;
      b.setFrozen(true);
      const isTrembling = e.watchT > HIDE.sneak.sweatAfter;
      b.setSweat(isTrembling);
      return;
    }
    e.watchT = 0;
    e.unseenT += dt;
    if (e.unseenT < HIDE.sneak.resumeAfter) return;
    b.setFrozen(false);
    e.poseT -= dt;
    if (e.poseT > 0) return;
    e.poseT = POSE_EVERY;
    const roll = this.rand();
    if (roll < 0.33) b.wave();
    else if (roll < 0.66) b.startle();
    else b.flinch();
  }

  // 병정인 척: 병정들이 차렷하고 있는데 혼자 한 박자씩 늦게 뒤뚱
  private waddle(e: Entry, dt: number) {
    const b = e.k.box;
    if (e.stepLeft > 0) {
      e.stepLeft -= dt;
      if (e.stepLeft <= 0) b.setScurry(0);
    }
    e.poseT -= dt;
    if (e.poseT > 0) return;
    e.poseT = POSE_EVERY;
    e.stepLeft = WADDLE_FOR;
    b.setScurry(1);
  }

  // 가면: 섞여 들 무리 곁(무리가 없으면 무대 가운데 곁)
  private maskSpot(group: string, hub: THREE.Vector3, out: THREE.Vector3) {
    const home = this.links.help.homeOf(group, out);
    if (!home) out.copy(hub);
    const bearing = this.rand() * Math.PI * 2;
    const bx = Math.cos(bearing),
      by = Math.sin(bearing);
    tmp.set(bx, by, 0);
    side.copy(out).cross(tmp).normalize();
    const aside = MASK_ASIDE / S.R;
    out.addScaledVector(side, aside).normalize();
  }

  // 받침대를 at(단위 벡터) 땅 위에 세운다
  private raisePedestal(v: THREE.Vector3, ground: number) {
    const p = this.pedestal,
      mid = S.R + ground + PEDESTAL_H / 2;
    p.position.copy(v).multiplyScalar(mid);
    p.quaternion.setFromUnitVectors(UP, v);
    p.visible = true;
  }

  // 소품을 입힌다(종류마다 한 번 만들어 둔다). 모델이 없으면 null
  private dress(as: DisguiseKind): THREE.Object3D | null {
    const made = this.props.get(as);
    if (made) return made;
    const prop = this.makeProp(as);
    if (prop) this.props.set(as, prop);
    return prop;
  }

  // 소품을 만든다(상자 바닥이 원점, 앞이 +x, 위가 +y, 미터). 모델이 없으면 null
  private makeProp(as: DisguiseKind): THREE.Object3D | null {
    // 크기는 소품 README 대로: 안경은 상자 폭의 0.9배, 가면은 상자 키의 0.9배, 화분은 상자 폭의 1.3배, 선물 더미는 상자 키의 2배쯤
    const models = this.s.models,
      H = HIDE.box.height,
      W = (H * 0.69) / 1.05;
    if (as === "glasses" && models.has(PROP_KEYS.glasses)) {
      const size = W * 0.9,
        o = models.fit(PROP_KEYS.glasses, size, "z"),
        front = W * 0.52,
        eyes = H * 0.6;
      o.position.set(front, eyes, 0);
      return o;
    }
    if (as === "mask" && models.has(PROP_KEYS.mask)) {
      const size = H * 0.9,
        o = models.fit(PROP_KEYS.mask, size, "h"),
        front = W * 0.55,
        face = H * 0.55;
      o.position.set(front, face, 0);
      return o;
    }
    if (as === "flowerpot" && models.has(PROP_KEYS.flowerpot)) {
      const size = W * 1.3,
        o = models.fit(PROP_KEYS.flowerpot, size, "w"),
        potH = o.userData.hh as number;
      o.position.set(0, potH, 0);
      return o;
    }
    if (as === "gifts" && models.has(PROP_KEYS.gifts)) {
      const size = H * 2,
        o = models.fit(PROP_KEYS.gifts, size, "w"),
        pileH = o.userData.hh as number,
        back = -H * 0.35,
        aside = H * 0.55;
      o.position.set(back, pileH, aside);
      return o;
    }
    return null;
  }

  // 화면 안인가
  private isOnScreen(world: THREE.Vector3): boolean {
    ndc.copy(world).project(this.s.camera.camera);
    return ndc.z < 1 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1;
  }
}

/* ─── 내부 ─────────────────────────── */

// 풍선 다발: 땅에 묶인 끈 다섯에 풍선 다섯(파스텔, 라임은 뺀다) — 원점이 끈을 묶은 땅, 위가 +y
function balloonBundle(): THREE.Group {
  const g = new THREE.Group(),
    ball = new THREE.SphereGeometry(BALLOON_R, 18, 12);
  for (let i = 0; i < BALLOONS; i++) {
    const turn = (i / BALLOONS) * Math.PI * 2,
      x = Math.cos(turn) * BALLOON_SPREAD,
      z = Math.sin(turn) * BALLOON_SPREAD,
      y = BALLOON_UP + (i % 2) * 0.9,
      color = BALLOON_COLORS[i % BALLOON_COLORS.length];
    // 풍선마다 제 기하를 가져 치울 때 한 번씩만 치운다
    const geo = i === 0 ? ball : ball.clone(),
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35 }),
      b = new THREE.Mesh(geo, mat);
    b.position.set(x, y, z);
    b.scale.set(1, 1.18, 1);
    const len = Math.hypot(x, y, z),
      str = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, len, 5),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
      );
    const hx = x / 2,
      hy = y / 2,
      hz = z / 2;
    str.position.set(hx, hy, hz);
    tmp.set(x, y, z).normalize();
    str.quaternion.setFromUnitVectors(UP, tmp);
    g.add(b, str);
  }
  return g;
}
