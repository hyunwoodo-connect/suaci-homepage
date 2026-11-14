import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Random } from "../core/random";
import type { Services } from "../services";
import { S } from "../settings";
import { fr } from "../world/hash";
import { offset, offsetInto, START, UP } from "../world/sphere";
import type { Lawn } from "./lawn";
import { createLawnMesh, reserveLawn } from "./lawn";
import { createLogoTextures } from "./logo";
import type { LogoTextures } from "./logo";

// suaci 의 서명: 크게 말하지 않고, 스스로 알아차리게 둔다(브랜드 원칙 '넛지'). 제품도 문구도 구매 단추도 없다. suaci 것은 라임.
// 1) 로고 풍선 — 마을마다 하나, 마을 사이에 드문드문. 줄을 잡으면 잠깐 태워 올려 준다(take suaci = 잡으면 떠오른다)
// 2) 잔디 로고 — lawn.ts
// 3) 높은 풍선 — 출발 마을에서 가장 가까운 로켓 바로 위, 로켓으로만 닿는 높이. 뚫고 지나가면 라임 안개가 터진다
// 4) 라임 안개 — 쉬는 곳에 들어서는 순간 한 번 퍼진다(칙, 하고 뿌린 듯). 병은 보이지 않고 안개만 있다
// 5) 쉬는 곳의 라임 깃발 — 글자 없이 색만. 멀리서 '저기 쉴 곳'이라고 알려 준다
// 6) 전설의 도장 — 전설의 손님을 만난 자리에 작은 라임 워드마크가 그 방문 동안 남는다. 만난 사람만 가진 흔적

/** 로고 풍선 하나: 제자리(home)·떠 있는 높이(top)·태워 올리는 중(ride)·다시 뜰 때까지(cool)·크기(k) */
export interface LogoBalloon {
  g: THREE.Group;
  home: THREE.Vector3;
  v: THREE.Vector3;
  g0: number;
  alt: number;
  top: number;
  ph: number;
  ride: number;
  cool: number;
  k: number;
  /** 높은 풍선이면 그 배율(0 이면 보통 풍선) */
  big: number;
}

/** 깃발을 꽂는 쉬는 곳(Sites 의 한 줄) */
export interface RestSite {
  k: string;
  kind: string;
  v: THREE.Vector3;
  r: number;
  dist: number;
}

/** 쉬는 곳 깃발 */
export interface Flag {
  s: RestSite;
  fl: THREE.Mesh;
  inn: boolean;
}

/** 라임 안개 한 번 */
interface Mist {
  m: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  t: number;
  s: number;
}

/** 전설의 도장 */
interface Stamp {
  m: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  k: number;
  on: boolean;
}

/** 서명이 보는 랜드마크·쉬는 곳 목록 */
interface SiteList {
  list: readonly RestSite[];
}

/** 높은 풍선을 띄울 로켓 목록 */
interface RocketList {
  list: readonly { v: THREE.Vector3 }[];
}

const q0b = new THREE.Vector3(),
  bq = new THREE.Quaternion(),
  by = new THREE.Quaternion(),
  sm = new THREE.Matrix4(),
  sx = new THREE.Vector3(),
  su = new THREE.Vector3();

/** suaci 서명 전체 */
export class Signature implements Thing {
  readonly BAL: LogoBalloon[] = [];
  /** 잔디 로고 자리(맡아 둔 것) */
  readonly lawn: Lawn;
  readonly lawnMesh: THREE.Mesh;
  readonly FLAGS: Flag[] = [];
  private readonly MIST: Mist[] = [];
  private mI = 0;
  private readonly STAMPS: Stamp[] = [];
  private stI = 0;
  private readonly tex: LogoTextures;
  private readonly rng: Random;
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];
  private readonly objects: THREE.Object3D[] = [];

  /** 잔디 로고 자리를 나무·꽃·조형물보다 먼저 맡아 둔다 */
  static reserveLawn(s: Services): Lawn {
    return reserveLawn(s);
  }

  /** 서명을 놓는다(풍경을 다 놓고 고래 길을 정한 뒤, 방울 길보다 먼저) */
  constructor(
    private readonly s: Services,
    lawn: Lawn,
    sites: SiteList,
    rockets: RocketList,
  ) {
    this.rng = s.rng.fork("signature");
    this.lawn = lawn;
    const tex = createLogoTextures();
    this.tex = tex;
    const bGeo = new THREE.SphereGeometry(1.75, 36, 24),
      kGeo = new THREE.ConeGeometry(0.24, 0.4, 12),
      bMat = new THREE.MeshStandardMaterial({
        map: tex.balloon,
        roughness: 0.28,
        metalness: 0,
        emissive: 0xffffff,
        emissiveMap: tex.balloon,
        emissiveIntensity: 0.55,
      }),
      kMat = new THREE.MeshBasicMaterial({ color: 0x141414 }),
      sMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    this.geos.push(bGeo, kGeo);
    this.mats.push(bMat, kMat, sMat);
    const mkBal = (home: THREE.Vector3 | null, alt: number, big?: number) => {
      if (!home) return;
      const gr = new THREE.Group(),
        body = new THREE.Mesh(bGeo, bMat),
        knot = new THREE.Mesh(kGeo, kMat),
        L = big ? 6 : alt - 2.4;
      const strGeo = new THREE.CylinderGeometry(0.03, 0.03, L, 5);
      this.geos.push(strGeo);
      const str = new THREE.Mesh(strGeo, sMat);
      body.scale.set(1, 1.14, 1);
      knot.position.y = -2.1;
      str.position.y = -2.3 - L / 2;
      gr.add(body, knot, str);
      if (big) gr.userData.big = big;
      gr.traverse((c) => {
        c.frustumCulled = false;
      });
      gr.visible = false;
      s.scene.add(gr);
      this.objects.push(gr);
      const ground = s.terrain.groundAt(home);
      const ph = this.rng.next() * 6.28;
      const b: LogoBalloon = {
        g: gr,
        home: home.clone().normalize(),
        v: home.clone().normalize(),
        g0: Math.max(ground, 0),
        alt,
        top: alt,
        ph,
        ride: 0,
        cool: 0,
        k: 1,
        big: big || 0,
      };
      this.BAL.push(b);
    };
    const HV = s.occ.hubs;
    for (let hk = 0; hk < HV.length; hk++) {
      const hubBear = 35 + hk * 67;
      const spot = s.occ.hubAt(hk, 34, hubBear);
      mkBal(spot, 13); // 마을마다 하나
    }
    for (let i = 0; i < 6; i++) {
      const far = 250 + 40 * fr(i, 901),
        bear = 60 * i + 360 * fr(i, 902);
      const hub = HV[i % HV.length];
      const spot = offset(hub, far, bear);
      mkBal(spot, 17); // 마을 사이
    }
    this.lawnMesh = createLawnMesh(s, lawn, tex.lawn);
    // 높은 풍선: 출발 마을에서 가장 가까운 로켓 바로 위 138m
    {
      let rk: { v: THREE.Vector3 } | null = null,
        rd = 1e9;
      for (const r of rockets.list) {
        const d = r.v.angleTo(START);
        if (d < rd) {
          rd = d;
          rk = r;
        }
      }
      if (rk) mkBal(rk.v, 138, 4.2);
    }
    const mistGeo = new THREE.SphereGeometry(1, 16, 12);
    this.geos.push(mistGeo);
    for (let i = 0; i < 4; i++) {
      const mistMat = new THREE.MeshBasicMaterial({
        color: 0xa9ff39,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      });
      this.mats.push(mistMat);
      const m = new THREE.Mesh(mistGeo, mistMat);
      m.visible = false;
      m.frustumCulled = false;
      s.scene.add(m);
      this.objects.push(m);
      this.MIST.push({ m, t: 9, s: 1 });
    }
    {
      const tri = new THREE.BufferGeometry();
      const triPos = new THREE.Float32BufferAttribute([0, 0, 0, 0, -1.1, 0, 2.3, -0.55, 0], 3);
      tri.setAttribute("position", triPos);
      tri.computeVertexNormals();
      const fMat = new THREE.MeshBasicMaterial({ color: 0xa9ff39, side: THREE.DoubleSide }),
        pGeo = new THREE.CylinderGeometry(0.06, 0.06, 7, 6);
      this.geos.push(tri, pGeo);
      this.mats.push(fMat);
      for (const site of sites.list) {
        if (site.kind !== "rest") continue;
        const flagFar = (site.r || 6) * 0.95;
        const v = offset(site.v, flagFar, 40),
          gr = new THREE.Group(),
          pole = new THREE.Mesh(pGeo, sMat),
          fl = new THREE.Mesh(tri, fMat);
        pole.position.y = 3.5;
        fl.position.y = 6.9;
        gr.add(pole, fl);
        gr.traverse((c) => {
          c.frustumCulled = false;
        });
        const ground = s.terrain.groundAt(v);
        const baseR = S.R + Math.max(ground, 0);
        gr.position.copy(v).multiplyScalar(baseR);
        gr.quaternion.setFromUnitVectors(UP, v);
        s.scene.add(gr);
        this.objects.push(gr);
        this.FLAGS.push({ s: site, fl, inn: false });
      }
    }
    const stampH = (9 * 256) / 1024;
    const stampGeo = new THREE.PlaneGeometry(9, stampH);
    this.geos.push(stampGeo);
    for (let i = 0; i < 6; i++) {
      const stampMat = new THREE.MeshBasicMaterial({
        map: tex.lawn,
        color: 0xa9ff39,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      });
      this.mats.push(stampMat);
      const m = new THREE.Mesh(stampGeo, stampMat);
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = 1;
      s.scene.add(m);
      this.objects.push(m);
      this.STAMPS.push({ m, k: 0, on: false });
    }
  }

  /** 전설의 손님을 만난 자리(v)에 작은 라임 워드마크를 찍고 안개를 한 번 뿌린다 */
  stampAt(v: THREE.Vector3) {
    const h = this.s.player.h;
    const o = this.STAMPS[this.stI++ % this.STAMPS.length];
    const hUp = h.dot(v);
    su.copy(h).addScaledVector(v, -hUp).normalize();
    sx.crossVectors(su, v).normalize();
    sm.makeBasis(sx, su, v);
    o.m.quaternion.setFromRotationMatrix(sm);
    const ground = this.s.terrain.groundAt(v);
    const stampR = S.R + Math.max(ground, 0) + 0.3;
    o.m.position.copy(v).multiplyScalar(stampR);
    o.m.visible = true;
    o.on = true;
    o.k = 0;
    this.mist(o.m.position, 9);
  }

  /** 안개가 퍼졌다 사라지고, 깃발이 나부끼고(쉬는 곳에 들어서면 안개), 도장이 떠오르고, 풍선이 뜨거나 태워 올린다 */
  update(f: Frame) {
    const { player } = this.s,
      p = player.p,
      P = player.P,
      dt = f.dt,
      time = f.time;
    const altA = P.length() - S.R;
    for (const o of this.MIST) {
      if (o.t > 1.6) {
        o.m.visible = false;
        continue;
      }
      o.t += dt;
      const k = o.t / 1.6;
      const left = 1 - k;
      const easeOut = 1 - Math.pow(left, 3);
      const spread = 0.25 + 0.75 * easeOut;
      const size = o.s * spread;
      o.m.scale.setScalar(size);
      const fadeK = k * 8;
      const fadeIn = Math.min(1, fadeK);
      o.m.material.opacity = 0.42 * (1 - k) * fadeIn;
    }
    for (const fl of this.FLAGS) {
      const flutterA = time * 2.2 + fl.s.dist,
        flutterB = time * 5.1;
      fl.fl.rotation.y = 0.5 * Math.sin(flutterA) + 0.25 * Math.sin(flutterB);
      const restR = fl.s.r || 6;
      const inn = player.air < 4 && p.angleTo(fl.s.v) * S.R < restR;
      if (inn && !fl.inn) this.mist(P, 8);
      fl.inn = inn;
    }
    for (const o of this.STAMPS)
      if (o.on && o.k < 1) {
        const grown = o.k + dt * 1.2;
        o.k = Math.min(1, grown);
        o.m.material.opacity = 0.9 * o.k;
      }
    for (const b of this.BAL) this.balloon(b, altA, f);
  }

  /** 치운다 */
  dispose() {
    for (const o of this.objects) o.removeFromParent();
    this.lawnMesh.removeFromParent();
    this.lawnMesh.geometry.dispose();
    (this.lawnMesh.material as THREE.Material).dispose();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.tex.balloon.dispose();
    this.tex.lawn.dispose();
  }

  // 다음 안개 하나를 그 자리에서 퍼뜨린다(자리는 복사한다)
  private mist(pos: THREE.Vector3, size?: number) {
    const o = this.MIST[this.mI++ % this.MIST.length];
    o.m.position.copy(pos);
    o.t = 0;
    o.s = size || 7;
    o.m.visible = true;
  }

  // 처음 잡거나 처음 뚫을 때 한 번만 "take suaci."
  private sayTakeOnce() {
    this.s.hud.sayOnce("take", "take suaci.");
  }

  // 풍선 하나: 잡으면 머리 위에서 끌어 올리고(약 3초), 놓으면 날아갔다가 한참 뒤 제자리에 다시 뜬다. 높은 풍선은 뚫으면 안개
  private balloon(b: LogoBalloon, altA: number, f: Frame) {
    const { player, fx } = this.s,
      p = player.p,
      P = player.P,
      dt = f.dt,
      time = f.time,
      held = player.held;
    const near = b.v.dot(p) > 0.9;
    b.g.visible = near && b.k > 0.02;
    if (!near && b.ride <= 0 && b.cool <= 0) return;
    if (b.ride > 0) {
      // 줄을 잡았다: 풍선이 머리 위에서 끌어 올린다
      b.ride -= dt;
      player.lift(5.4);
      const pull = ease(9, dt);
      b.v.lerp(p, pull).normalize();
      b.top += (altA + 4.6 - b.g0 - b.top) * pull;
      if (b.ride <= 0) b.cool = 22;
    } else if (b.cool > 0) {
      // 놓고 나면 풍선은 위로 날아가며 작아지고, 한참 뒤 제자리에 다시 뜬다
      b.cool -= dt;
      if (b.cool > 18) {
        b.top += 7 * dt;
        const shrunk = b.k - dt * 0.45;
        b.k = Math.max(0, shrunk);
      } else if (b.cool > 2) {
        b.k = 0;
        b.v.copy(b.home);
        b.top = b.alt;
      } else {
        const grown = b.k + dt * 0.6;
        b.k = Math.min(1, grown);
      }
    } else if (b.big) {
      b.v.copy(b.home);
      const swayPhase = time * 0.5 + b.ph;
      const target = b.alt + 1.5 * Math.sin(swayPhase);
      const sway = ease(2, dt);
      b.top += (target - b.top) * sway;
      b.k = 1;
      const altGap = altA - (b.g0 + b.top);
      if (!held && p.angleTo(b.v) * S.R < 9 && Math.abs(altGap) < 10) {
        b.cool = 22;
        fx.burst(P, 30, 14);
        this.mist(P, 22);
        player.raise(2.5);
        this.sayTakeOnce();
      }
    } else {
      const circleBear = time * 5 + b.ph * 57.3;
      offsetInto(q0b, b.home, 4.5, circleBear);
      const drift = ease(2, dt);
      b.v.lerp(q0b, drift).normalize();
      const swayPhase = time * 0.8 + b.ph;
      const target = b.alt + 0.7 * Math.sin(swayPhase);
      const sway = ease(2, dt);
      b.top += (target - b.top) * sway;
      b.k = 1;
      if (
        !held &&
        b.v.dot(p) > 0.99995 &&
        p.angleTo(b.v) * S.R < 2.5 &&
        altA < b.g0 + b.top + 1 &&
        altA > b.g0 + 0.8
      ) {
        b.ride = 3;
        fx.burst(P, 10, 9);
        this.sayTakeOnce();
      }
    }
    bq.setFromUnitVectors(UP, b.v);
    const spinAngle = time * 0.25 + b.ph;
    by.setFromAxisAngle(UP, spinAngle);
    b.g.quaternion.copy(bq).multiply(by);
    const radius = S.R + b.g0 + b.top;
    b.g.position.copy(b.v).multiplyScalar(radius);
    const scale = b.k * (b.big || 1);
    b.g.scale.setScalar(scale);
  }
}
