import * as THREE from "three";

import type { Frame } from "../core/frame";
import { ease } from "../core/frame";
import type { Random } from "../core/random";
import { within } from "../maps/map";
import type { Services } from "../services";
import { S } from "../settings";
import { fr } from "../world/hash";
import { offset, offsetInto, UP } from "../world/sphere";
import { floatHighBalloon } from "./highBalloon";
import type { LogoTextures } from "./logo";
import type { Mists } from "./mist";

// 로고 풍선 — 마을마다 하나, 마을 사이에 드문드문. 줄을 잡으면 잠깐 태워 올려 준다(take suaci = 잡으면 떠오른다).
// 높은 풍선(highBalloon.ts)도 같은 목록의 끝에 같은 몸으로 있다

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

const q0b = new THREE.Vector3(),
  bq = new THREE.Quaternion(),
  by = new THREE.Quaternion();

/** 로고 풍선 전체. 만들면서 마을마다·마을 사이에 놓는다(난수는 풍선마다 하나, 놓는 차례대로) */
export class LogoBalloons {
  readonly list: LogoBalloon[] = [];
  /** 풍선 줄 재질(쉬는 곳 깃대도 같이 쓴다) */
  readonly stringMat: THREE.MeshBasicMaterial;
  private readonly bGeo: THREE.SphereGeometry;
  private readonly kGeo: THREE.ConeGeometry;
  private readonly bMat: THREE.MeshStandardMaterial;
  private readonly kMat: THREE.MeshBasicMaterial;
  private readonly strGeos: THREE.BufferGeometry[] = [];

  constructor(
    private readonly s: Services,
    tex: LogoTextures,
    private readonly rng: Random,
  ) {
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
    this.bGeo = bGeo;
    this.kGeo = kGeo;
    this.bMat = bMat;
    this.kMat = kMat;
    this.stringMat = sMat;
    const HV = s.occ.hubs,
      plan = s.map.brand.balloons;
    for (let hk = 0; hk < HV.length; hk++) {
      const hubBear = 35 + hk * 67;
      const spot = s.occ.hubAt(hk, plan.town.dist, hubBear);
      if (s.land.has(spot)) this.add(spot, plan.town.alt); // 마을마다 하나(뭍의 마을만)
    }
    for (let i = 0; i < plan.between.count; i++) {
      const farRoll = fr(i, 901),
        far = within(plan.between.dist, farRoll),
        bear = 60 * i + 360 * fr(i, 902);
      const hub = HV[i % HV.length];
      const spot = offset(hub, far, bear);
      if (s.land.has(spot)) this.add(spot, plan.between.alt); // 마을 사이
    }
  }

  /** 풍선 하나를 home 위 alt 높이에 띄운다(big = 높은 풍선의 배율 — 줄이 짧다) */
  add(home: THREE.Vector3 | null, alt: number, big?: number) {
    if (!home) return;
    const s = this.s;
    const gr = new THREE.Group(),
      body = new THREE.Mesh(this.bGeo, this.bMat),
      knot = new THREE.Mesh(this.kGeo, this.kMat),
      L = big ? 6 : alt - 2.4;
    const strGeo = new THREE.CylinderGeometry(0.03, 0.03, L, 5);
    this.strGeos.push(strGeo);
    const str = new THREE.Mesh(strGeo, this.stringMat);
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
    this.list.push(b);
  }

  /** 풍선마다 한 프레임(목록 차례대로). altA = 내 높이, mists = 높은 풍선을 뚫을 때 터뜨릴 안개 */
  update(altA: number, f: Frame, mists: Mists) {
    for (const b of this.list) this.balloon(b, altA, f, mists);
  }

  /** 치운다(줄 재질은 깃대도 같이 써서 여기서 한 번만) */
  dispose() {
    for (const b of this.list) b.g.removeFromParent();
    this.bGeo.dispose();
    this.kGeo.dispose();
    for (const g of this.strGeos) g.dispose();
    this.bMat.dispose();
    this.kMat.dispose();
    this.stringMat.dispose();
  }

  // 처음 잡거나 처음 뚫을 때 한 번만 "take suaci."
  private sayTakeOnce() {
    this.s.hud.sayOnce("take", "take suaci.");
  }

  // 풍선 하나: 잡으면 머리 위에서 끌어 올리고(약 3초), 놓으면 날아갔다가 한참 뒤 제자리에 다시 뜬다. 높은 풍선은 뚫으면 안개
  private balloon(b: LogoBalloon, altA: number, f: Frame, mists: Mists) {
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
      const burst = floatHighBalloon(b, altA, f, this.s, mists);
      if (burst) this.sayTakeOnce();
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
        this.s.events.emit("logoBalloonCaught", {});
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
