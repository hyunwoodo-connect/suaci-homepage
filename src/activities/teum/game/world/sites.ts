import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Hold } from "../models/library";
import { topDir } from "../models/extent";
import type { Holder } from "../player/player";
import type { Services } from "../services";
import { S, WHITE } from "../settings";
import type { LayoutSite } from "./layout";
import type { Places } from "./places";
import { ball, Bin, label } from "./shapes";
import { from, heading } from "./sphere";
import type { Height, HasHeights } from "./tall";

// 랜드마크(멀리서 보이는 큰 것)와 쉬는 곳(구석의 조용한 자리) — 종류마다 하나씩만 있다.
// 가까이 가면 이름표가 뜨고, 한 번 꿀렁 인사하고, 저마다 다르게 움직인다. 속으로는 못 들어간다.
// 저마다 다른 것(부딪힘·움직임)은 아래 SITE_KINDS 한 표에 있다 — 새 랜드마크는 자리표에 한 줄 + 여기 한 줄(+ 필요하면 동작 하나)

/** 부딪힘: 막힌다(block) · 떠 있는 공처럼 막힌다(float) · 크게 튕긴다(dome) · 미끄러져 내려온다(slide) · 위로 올려 보낸다(stairs) */
type Collide = "block" | "float" | "dome" | "slide" | "stairs";

/** 가까이 갔을 때의 움직임 */
type Idle =
  | "sway"
  | "spinFaster"
  | "wheelLights"
  | "fireworks"
  | "moonDrift"
  | "islandFloat"
  | "embers"
  | "foam"
  | "rock"
  | "stand";

/** 랜드마크 한 종류: 부딪힘과 움직임(없으면 떠 있는 것은 float·나머지는 block, 움직임은 sway) */
interface SiteKind {
  collide?: Collide;
  idle?: Idle;
}

/** 랜드마크 종류마다 다른 것 */
const SITE_KINDS: Readonly<Record<string, SiteKind>> = {
  dome: { collide: "dome" },
  slide: { collide: "slide" },
  stairs: { collide: "stairs", idle: "stand" },
  carousel: { idle: "spinFaster" },
  ferris: { idle: "wheelLights" },
  castle: { idle: "fireworks" },
  palace: { idle: "fireworks" },
  moon: { idle: "moonDrift" },
  island: { idle: "islandFloat" },
  campfire: { idle: "embers" },
  bathtub: { idle: "foam" },
  hammock: { idle: "rock" },
};

/** 랜드마크·쉬는 곳 하나 */
export interface Site extends LayoutSite {
  g: THREE.Group;
  prim: THREE.Mesh;
  lit: number;
  cool: number;
  /** 쉬는 곳 고리 안에 들어온 정도 */
  inn: number;
  was: boolean;
  top: number;
  model: Hold | null;
  pos: THREE.Vector3;
  v: THREE.Vector3;
  ring?: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  bub?: THREE.Sprite;
  core: number;
  near: number;
  hello: number;
  tick: number;
  wasNear: boolean;
  hit: number;
  tag: THREE.Sprite;
  /** 미끄럼틀: 내려가는 방향(모델 기준)과 길이 — 모델이 와야 안다 */
  fx?: number;
  fz?: number;
  sl?: number;
  collide: Collide;
  idle: Idle;
  /** 시계 방향 접선(관람차 불빛이 바퀴 테를 도는 쪽) — 자리가 정해지면 채운다 */
  side: THREE.Vector3;
}

/** 미끄럼틀을 타는 동안: 꼭대기로 올라갔다가 미끄러져 내려온다 */
interface SlideRide {
  t: number;
  s: Site;
  s0: THREE.Vector3;
  a: THREE.Vector3;
  b: THREE.Vector3;
  d: THREE.Vector3;
}

// 이 갈래의 자리는 조형물 크기를 정할 때 보지 않는다(따로 피하거나 겹쳐도 되는 것)
const SKIP_IN_SIZING = ["site", "tree", "hill", "hub", "place", "lake", "jet"];

const siteCol = new THREE.Color(),
  top = new THREE.Vector3(),
  gp = new THREE.Vector3();

/** 랜드마크·쉬는 곳 전체(미끄럼틀은 나를 붙잡는다) */
export class Sites implements Thing, Holder, HasHeights {
  readonly list: Site[];
  /** 미끄럼틀을 타는 동안에도 몸 크기는 그대로 */
  readonly bodyScale = 1;
  private ride: SlideRide | null = null;
  private readonly bin = new Bin();

  constructor(
    private readonly s: Services,
    places: Places,
  ) {
    const L = s.layout;
    // 조형물은 크게 — 다만 옆의 놀이기구·호수·다른 조형물과 겹치지 않는 크기까지만. 떠 있는 것은 그만큼 더 높이
    {
      const pts: THREE.Vector3[] = [];
      for (const [k, list] of Object.entries(L)) {
        if (SKIP_IN_SIZING.includes(k)) continue;
        for (const o of list as { dist?: number; bear?: number }[])
          if (o && typeof o.dist === "number") {
            const at = from(o.dist, o.bear!);
            pts.push(at);
          }
      }
      const lk = L.lake.map((l) => ({ v: from(l.dist, l.bear), r: l.r })),
        sv = L.site.map((st) => from(st.dist, st.bear));
      // 자리표의 크기를 그 자리에서 바로 키운다 — 뒤의 조형물은 앞에서 이미 키운 크기(o.size)를 보고 정한다
      L.site.forEach((st, i) => {
        let k = 1.25;
        if (st.kind === "land") {
          k = 1;
          for (const t of [1.7, 1.45, 1.2]) {
            const rad = st.size * 0.4 * t;
            if (
              st.lift ||
              (!pts.some((q) => q.angleTo(sv[i]) * S.R < rad + 4) &&
                !lk.some((l) => l.v.angleTo(sv[i]) * S.R < l.r + rad) &&
                !L.site.some(
                  (o, j) => j !== i && sv[j].angleTo(sv[i]) * S.R < rad + o.size * 0.4 + 3,
                ))
            ) {
              k = t;
              break;
            }
          }
        }
        st.sc = k;
        st.size *= k;
        if (st.kind === "land" && st.r) st.r *= Math.min(1.4, k);
        if (st.lift) st.lift *= 2.2;
      });
    }
    const BUB = bubbleTex(),
      ringGeo = new THREE.TorusGeometry(1, 0.035, 8, 64);
    this.bin.add(BUB);
    this.bin.add(ringGeo);
    this.list = L.site.map((st) => {
      const gr = new THREE.Group();
      // 모델이 오기 전의 자리 공: 반지름과 높이가 같아 바닥에 닿는다
      const primSize = st.kind === "land" ? 5 : 2;
      const prim = ball(s.mats, primSize, 0xc2c6c5, primSize);
      gr.add(prim);
      let ring: Site["ring"], bub: Site["bub"];
      if (st.kind === "rest") {
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
        });
        ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.scale.setScalar(st.r);
        ring.position.y = 0.35;
        gr.add(ring);
        const bubMat = new THREE.SpriteMaterial({
          map: BUB,
          transparent: true,
          depthWrite: false,
          fog: false,
        });
        bub = new THREE.Sprite(bubMat);
        bub.scale.setScalar(3.4);
        bub.position.y = st.size + 3;
        gr.add(bub);
      }
      const at = () => from(st.dist, st.bear);
      const lift = st.lift || 0;
      const item = places.addItem(gr, at, lift);
      // 이름표: 가까이 가면 뜬다
      const tag = label(st.name);
      tag.material.opacity = 0;
      tag.material.fog = false;
      const big = st.kind === "land";
      const tagWidth = big ? 15 : 7.5,
        tagHeight = big ? 4.7 : 2.4;
      tag.scale.set(tagWidth, tagHeight, 1);
      tag.position.y = st.size + (big ? 5 : 6.5);
      gr.add(tag);
      this.bin.keep(gr);
      const kind = SITE_KINDS[st.k] ?? {};
      const collide = kind.collide ?? (st.sky ? "float" : "block");
      const site: Site = {
        ...st,
        sc: st.sc ?? 1,
        g: gr,
        prim,
        lit: 0,
        cool: 0,
        inn: 0,
        was: false,
        top: st.size,
        model: null,
        pos: new THREE.Vector3(),
        v: item.v,
        ring,
        bub,
        core: st.size * 0.4,
        near: 0,
        hello: 0,
        tick: 0,
        wasNear: false,
        hit: 0,
        tag,
        collide,
        idle: kind.idle ?? "sway",
        side: new THREE.Vector3(),
      };
      return site;
    });
  }

  /** 모델을 끼운다(꼭대기·몸 반지름·쉬는 곳 고리를 모델 크기로). 먼 것은 장면에서 뗀다 */
  fitModels() {
    const { models, culler } = this.s;
    for (const st of this.list) {
      culler.track(st.g, st.v);
      const sideDir = heading(st.v, 90);
      st.side.copy(sideDir);
      if (!models.has(st.k)) continue;
      const isFerris =
        st.k === "ferris" && models.has("ferris_wheel") && models.has("ferris_stand");
      const m = isFerris
        ? this.buildFerris(st)
        : models.fit(st.k, st.size, st.by, { ownLime: true });
      m.position.y = m.userData.hh;
      st.g.add(m);
      st.model = m;
      st.top = m.userData.top || m.userData.hh * 2;
      const coreShare = st.k === "ferris" ? 0.6 : 0.8,
        coreRadius = m.userData.rw * coreShare;
      st.core = Math.max(2, coreRadius);
      if (st.kind === "rest") st.r = st.core + 5.5;
      st.tag.position.y = st.top + (st.kind === "land" ? 5 : 6.6);
      const prim = [st.prim];
      if (isFerris) models.when("ferris_stand", () => models.swapWhenReady("ferris_wheel", prim));
      else models.swapWhenReady(st.k, prim);
    }
    // 미끄럼틀: 내려가는 방향 = 탑의 반대쪽(탑이 어느 쪽인지는 모델의 꼭짓점으로 안다)
    const sl = this.list.find((x) => x.k === "slide");
    if (sl && sl.model) {
      const slModel = sl.model;
      models.when("slide", () => {
        // 미끄럼틀 자리(그룹) 좌표계에서 잰다 — 이 방향은 그룹의 돌림을 곱해 쓰므로 세계 좌표로 재면
        // 행성 위 자리에 따라 엉뚱한 쪽(재 보니 128도 어긋남)으로 미끄러진다
        sl.g.updateWorldMatrix(true, false);
        const frame = sl.g.matrixWorld.clone().invert();
        const t = topDir(slModel, frame),
          l = Math.max(1e-6, t.len);
        sl.fx = -t.x / l;
        sl.fz = -t.z / l;
        sl.sl = t.ext;
      });
    }
  }

  /** 자리 차지: 몸 둘레보다 넉넉하게 */
  claim() {
    for (const st of this.list) {
      const clearance = st.core + 9;
      this.s.occ.fill(st.v, clearance);
    }
  }

  /** 고래 길을 정할 때 보는 꼭대기 높이 */
  pushHeights(out: Height[]) {
    for (const st of this.list) {
      const siteTop = st.top || 0;
      out.push([st.v, siteTop]);
    }
  }

  /** 인사·이름표·부딪힘·저마다의 움직임, 그리고 미끄럼틀 타기 */
  update(f: Frame) {
    const { player, fx, hud, terrain, mats } = this.s,
      p = player.p,
      P = player.P,
      dt = f.dt,
      held = player.held;
    this.slideStep(dt);
    for (const st of this.list) {
      if (st.cool > 0) st.cool -= dt;
      if (st.hit > 0) st.hit -= dt;
      const midHeight = st.top * 0.5;
      st.pos.copy(st.g.position).addScaledVector(st.v, midHeight);
      const dg = p.angleTo(st.v) * S.R,
        d3 = st.sky ? P.distanceTo(st.pos) : dg,
        big = st.kind === "land";
      // 가까이 가면: 이름표가 뜨고, 한 번 꿀렁 인사하고, 저마다 다르게 움직인다
      const nr = (st.sky ? d3 : player.air < st.top + 14 ? dg : 1e9) < st.core + (big ? 30 : 13);
      const nearTarget = nr ? 1 : 0;
      st.near += (nearTarget - st.near) * ease(3, dt);
      const helloLeft = st.hello - dt * 0.9;
      st.hello = Math.max(0, helloLeft);
      if (nr && !st.wasNear) {
        st.hello = 1;
        if (st.cool <= 0) {
          hud.say(st.msg);
          st.cool = 5;
        }
      }
      st.wasNear = nr;
      st.tag.material.opacity = st.near;
      // 부딪힘
      if (!held) {
        const bump = this.collide(st, dg, d3);
        if (bump && st.hit <= 0) {
          st.hit = 0.6;
          st.lit = 1;
          st.hello = 1;
          fx.burst(P, 6, 5);
          const reachSq = big ? 900 : 300;
          terrain.lightFlowers(st.v, reachSq);
        }
      }
      if (st.kind === "rest") {
        // 쉬는 곳: 고리 안에 있으면 고리와 말풍선이 라임이 된다
        const inside = player.air < 4 && dg < st.r;
        const innTarget = inside ? 1 : 0;
        st.inn += (innTarget - st.inn) * ease(5, dt);
        st.was = inside;
        siteCol.copy(WHITE).lerp(mats.lime, st.inn);
        st.ring!.material.color.copy(siteCol);
        st.bub!.material.color.copy(siteCol);
        const ringPhase = f.time * 2 + st.dist;
        const ringScale = st.r * (1 + 0.03 * Math.sin(ringPhase));
        st.ring!.scale.setScalar(ringScale);
        const bobPhase = f.time * 1.6 + st.bear;
        st.bub!.position.y = st.top + 3 + Math.sin(bobPhase) * 0.35;
        const bubScale = 3.4 + st.inn * 0.8;
        st.bub!.scale.setScalar(bubScale);
        st.tag.position.y = st.top + 6.6;
        // 쉬는 곳에서는 저절로 느려진다
        if (inside && player.spd > 0) player.slowDown(0.9);
      }
      const litLeft = st.lit - dt * 0.4;
      st.lit = Math.max(0, litLeft);
      if (st.lit > 0.02) {
        const size = big ? 30 : 14;
        const alpha = st.lit * 0.7;
        fx.glow(st.pos, size, alpha);
      }
      const m = st.model;
      if (!m) continue;
      const u = m.userData;
      const topLift = st.top * 0.45;
      top.copy(st.pos).addScaledVector(st.v, topLift);
      st.tick -= dt;
      // 꿀렁 인사: 옆과 위가 엇갈려 늘고 준다(hello 가 0 이 되면 멈춘다)
      const helloPhase = f.time * 13;
      const helloWave = Math.sin(helloPhase);
      const squash = u.k * (1 - 0.05 * st.hello * helloWave),
        stretch = u.k * (1 + 0.09 * st.hello * helloWave);
      m.scale.set(squash, stretch, squash);
      const litGlow = st.lit * 0.35,
        restGlow = st.kind === "rest" ? st.inn * 0.12 : 0;
      u.uLime.value = Math.max(litGlow, restGlow);
      this.animate(st, m, f);
    }
  }

  /** 치운다 */
  dispose() {
    for (const st of this.list) st.g.removeFromParent();
    this.bin.dispose();
  }

  // 미끄럼틀: 꼭대기로 올라갔다가 미끄러져 내려온다
  private slideStep(dt: number) {
    const R0 = this.ride,
      player = this.s.player;
    const body = player.bodyFor(this);
    if (!R0 || !body) return;
    const st = R0.s,
      T1 = 0.9,
      T2 = 1.5;
    R0.t += dt;
    body.vy = 0;
    if (R0.t < T1) {
      const k = R0.t / T1,
        e = k * k * (3 - 2 * k);
      body.p.copy(R0.s0).lerp(R0.a, e).normalize();
      body.air = st.top * 0.74 * e;
    } else {
      const slideT = (R0.t - T1) / T2;
      const k = Math.min(1, slideT);
      // 처음엔 천천히, 갈수록 빨리 미끄러진다
      const glide = k * k * 0.6 + k * 0.4;
      body.p.copy(R0.a).lerp(R0.b, glide).normalize();
      const left = 1 - k;
      const height = st.top * 0.74 * Math.pow(left, 1.4);
      body.air = Math.max(0.05, height);
      const dAlong = R0.d.dot(body.p);
      body.vel.copy(R0.d).addScaledVector(body.p, -dAlong).normalize();
    }
    if (R0.t >= T1 + T2) {
      this.ride = null;
      player.release(this, { boost: 6, stun: 0.6 });
      st.cool = 4;
      st.hit = 2.5;
      st.lit = 1;
      this.s.fx.burst(player.P, 10, 7);
    }
  }

  // 부딪힘: 종류마다 다르게. 부딪혔으면 true
  private collide(st: Site, dg: number, d3: number): boolean {
    const player = this.s.player;
    switch (st.collide) {
      case "dome": {
        // 돔은 막지 않는다. 닿는 곳이 어디든 크게 튕겨 올린다
        // 반구 지붕 높이(hd): 가운데서 멀수록 낮다. 돔 밖이면 -1
        const across = dg / st.core;
        const capSq = 1 - across * across;
        const hd = dg < st.core ? st.top * Math.sqrt(capSq) : -1;
        if (hd < 0 || player.air >= hd + 0.4) return false;
        // 지붕 위로 몸을 올려 세운다: 잠깐 붙잡아 높이만 정하고 바로 놓는다
        const body = player.grab(this);
        if (!body) return false;
        body.air = hd + 0.5;
        body.vy = Math.max(body.vy, 14);
        player.release(this);
        return true;
      }
      case "slide": {
        if (!st.model || st.sl === undefined || st.hit > 0 || player.air >= 5) return false;
        if (dg >= st.core * 0.8) return false;
        if (!player.grab(this)) return false;
        const d = new THREE.Vector3(st.fx!, 0, st.fz!).applyQuaternion(st.g.quaternion).normalize();
        // 꼭대기(a)는 미끄럼 길이의 42% 뒤쪽, 내려온 끝(b)은 60% 앞쪽
        const backArc = (-st.sl * 0.42) / S.R,
          frontArc = (st.sl * 0.6) / S.R;
        const a = st.v.clone().addScaledVector(d, backArc).normalize(),
          b = st.v.clone().addScaledVector(d, frontArc).normalize();
        const s0 = player.p.clone();
        this.ride = { t: 0, s: st, s0, a, b, d };
        this.s.hud.say(st.msg);
        return true;
      }
      case "stairs":
        // 계단은 막지 않고 위로 올려 보낸다
        if (dg < st.core + 1.5 && player.air < st.top) {
          player.lift(13);
          return true;
        }
        return false;
      case "float": {
        if (d3 >= st.core) return false;
        // 떠 있는 것: 높이와 상관없이, 지금 높이에서 자른 공의 단면 반지름만큼 밀어낸다
        const heightGap = player.P.length() - st.pos.length();
        const sliceSq = st.core * st.core - Math.pow(heightGap, 2);
        const sliceSqSafe = Math.max(1, sliceSq);
        const sliceR = Math.sqrt(sliceSqSafe) + 1;
        return player.blockBody(st.v, sliceR);
      }
      default:
        return player.block(st.v, st.core, st.top);
    }
  }

  // 가까이 갔을 때 저마다의 움직임
  private animate(st: Site, m: Hold, f: Frame) {
    const u = m.userData,
      fx = this.s.fx,
      dt = f.dt,
      time = f.time;
    switch (st.idle) {
      case "spinFaster": {
        // 다가가면 빨리 돈다
        m.rotation.y += dt * (0.2 + 2.2 * st.near);
        const hopPhase = time * 3;
        const hopWave = Math.sin(hopPhase);
        m.position.y = u.hh + Math.abs(hopWave) * 0.5 * st.near;
        break;
      }
      case "wheelLights": {
        // 불빛이 바퀴를 따라 돈다
        if (u.spin) {
          u.spin.rotation.z += dt * (0.1 + 0.7 * st.near);
          for (const qq of u.parts!) qq.userData.uLime.value = st.lit * 0.35;
        } else {
          const swayPhase = time * 1.2;
          m.rotation.z = Math.sin(swayPhase) * 0.06 * st.near;
        }
        if (st.near > 0.5 && st.tick <= 0) {
          st.tick = 0.35;
          const a = time * 1.4;
          const rimUp = Math.sin(a) * st.top * 0.42,
            rimSide = Math.cos(a) * st.top * 0.42;
          gp.copy(st.pos).addScaledVector(st.v, rimUp).addScaledVector(st.side, rimSide);
          fx.burst(gp, 1, 3);
        }
        break;
      }
      case "fireworks":
        // 지붕에서 불꽃이 터진다
        if (st.near > 0.5 && st.tick <= 0) {
          st.tick = 0.9;
          top.addScaledVector(st.v, 3);
          fx.burst(top, 12, 12);
        }
        break;
      case "moonDrift": {
        m.rotation.y += dt * (0.08 + 0.9 * st.near);
        const floatPhase = time * 0.5;
        m.position.y = u.hh + Math.sin(floatPhase) * 1.2;
        if (st.near > 0.5 && st.tick <= 0) {
          st.tick = 0.5;
          fx.burst(st.pos, 2, 6);
        }
        break;
      }
      case "islandFloat": {
        const floatPhase = time * 0.5 + 2;
        m.position.y = u.hh + Math.sin(floatPhase) * (1.2 + 2 * st.near);
        m.rotation.y += dt * 0.05;
        break;
      }
      case "embers":
        // 불티가 오른다
        if (st.near > 0.3 && st.tick <= 0) {
          st.tick = 0.22;
          fx.burst(st.pos, 1, 4);
        }
        break;
      case "foam":
        // 거품이 오른다
        if (st.near > 0.3 && st.tick <= 0) {
          st.tick = 0.3;
          fx.burst(top, 1, 2.5);
        }
        break;
      case "rock": {
        // 흔들린다
        const swingPhase = time * 1.8;
        m.rotation.x = Math.sin(swingPhase) * 0.12 * st.near;
        break;
      }
      case "stand":
        m.rotation.z = 0;
        break;
      default: {
        const swayPhase = time * 2.2 + st.dist;
        m.rotation.z = Math.sin(swayPhase) * 0.04 * st.near;
      }
    }
  }

  // 관람차: 받침과 바퀴를 따로 세워서 바퀴가 실제로 돈다
  private buildFerris(st: Site): Hold {
    const models = this.s.models;
    const G = new THREE.Group() as Hold,
      fsK = st.sc || 1,
      standH = 23 * fsK,
      wheelH = 34 * fsK,
      stand = models.fit("ferris_stand", standH, "h", { ownLime: true }),
      wheel = models.fit("ferris_wheel", wheelH, "h", { ownLime: true });
    stand.position.y = stand.userData.hh;
    G.add(stand);
    stand.updateMatrixWorld(true);
    // 받침 꼭대기(축)가 뻗은 방향을 찾는다: 위쪽 꼭짓점들이 더 길게 퍼진 쪽.
    // 받침 상자는 모델을 받기 전이라 원본 상자를 받침 틀의 자리·배율로 옮겨 잰다
    const standBox = models.box("ferris_stand"),
      wheelBoxRaw = models.box("ferris_wheel");
    const sb = placedBox(standBox, stand.matrixWorld),
      cut = sb.min.y + (sb.max.y - sb.min.y) * 0.84;
    const axleY = sb.min.y + (sb.max.y - sb.min.y) * 0.9;
    // 바퀴의 얇은 쪽(바퀴 면에 수직인 쪽)을 축 방향에 맞춘다
    wheel.updateMatrixWorld(true);
    const wheelBox = placedBox(wheelBoxRaw, wheel.matrixWorld),
      wb = new THREE.Vector3();
    wheelBox.getSize(wb);
    const thinX = wb.x < wb.z;
    const pivot = new THREE.Group(),
      spin = new THREE.Group();
    pivot.position.y = axleY;
    wheel.rotation.y = thinX ? Math.PI / 2 : 0;
    spin.add(wheel);
    pivot.add(spin);
    G.add(pivot);
    models.when("ferris_stand", () => {
      // 꼭짓점은 관람차 그룹(G) 기준으로 잰다(끼우기 전과 같은 좌표)
      G.updateMatrixWorld(true);
      const toG = new THREE.Matrix4().copy(G.matrixWorld).invert(),
        m = new THREE.Matrix4(),
        V = new THREE.Vector3();
      let x0 = 1e9,
        x1 = -1e9,
        z0 = 1e9,
        z1 = -1e9;
      stand.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        m.multiplyMatrices(toG, o.matrixWorld);
        const a = o.geometry.attributes.position;
        for (let i = 0; i < a.count; i += 2) {
          V.fromBufferAttribute(a, i).applyMatrix4(m);
          if (V.y > cut) {
            x0 = Math.min(x0, V.x);
            x1 = Math.max(x1, V.x);
            z0 = Math.min(z0, V.z);
            z1 = Math.max(z1, V.z);
          }
        }
      });
      const axleX = x1 - x0 > z1 - z0;
      pivot.rotation.y = axleX ? Math.PI / 2 : 0; // pivot 의 z 축 = 축 방향
    });
    G.userData = {
      k: 1,
      hh: 0,
      top: axleY + 17 * fsK,
      rw: 17 * fsK,
      uLime: { value: 0 },
      spin,
      parts: [stand, wheel],
    };
    return G;
  }
}

/* ─── 내부 ─────────────────────────── */

// 틀 안의 모델이 원본 상자 그대로 놓였을 때의 상자: 틀 가운데 맞춤(−중심)을 틀 행렬 앞에 곱해 옮긴다
function placedBox(box: THREE.Box3, holdWorld: THREE.Matrix4): THREE.Box3 {
  const ct = new THREE.Vector3();
  box.getCenter(ct);
  const negCt = ct.negate();
  const inner = new THREE.Matrix4().makeTranslation(negCt.x, negCt.y, negCt.z);
  const world = new THREE.Matrix4().multiplyMatrices(holdWorld, inner);
  return box.clone().applyMatrix4(world);
}

// 말풍선: 나중에 여기서 이야기를 나눈다
function bubbleTex() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#fff";
  c.beginPath();
  c.roundRect(10, 16, 108, 76, 34);
  c.fill();
  c.beginPath();
  c.moveTo(44, 88);
  c.lineTo(40, 116);
  c.lineTo(68, 90);
  c.fill();
  c.fillStyle = "#2b2e2d";
  for (const x of [42, 64, 86]) {
    c.beginPath();
    c.arc(x, 54, 7, 0, 6.3);
    c.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
