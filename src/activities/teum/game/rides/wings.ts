import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { S } from "../state";
import { from, UP } from "../world/sphere";
import { featGround } from "../world/terrain";

// 날개 — 주우면 한동안 천천히 떨어지고, 칙 할 때마다 날갯짓해서 올라간다

/** 주울 수 있는 날개 하나 */
export interface WingItem {
  g: THREE.Group;
  dist: number;
  bear: number;
  v: THREE.Vector3;
  gnd: number;
  cool: number;
}

/** 날개를 단 동안: 남은 시간(t)과 날갯짓(flap) */
export interface WingState {
  t: number;
  flap: number;
}

/** 날개 전체: 주울 것들과 내 등의 날개 */
export interface Wings {
  items: WingItem[];
  mine: THREE.Group;
}

const yq2 = new THREE.Quaternion(),
  yq3 = new THREE.Quaternion();

/** 날개를 만든다 */
export function createWings(g: Game): Wings {
  const wingGeo = new THREE.SphereGeometry(1, 14, 10),
    wingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const wingPair = (sz: number) => {
    const gr = new THREE.Group();
    for (const sg of [-1, 1]) {
      const w = new THREE.Mesh(wingGeo, wingMat);
      const span = sz * 1.3,
        thickness = sz * 0.22,
        depth = sz * 0.62;
      w.scale.set(span, thickness, depth);
      w.position.x = sg * sz * 1.25;
      gr.add(w);
    }
    return gr;
  };
  const items = g.L.wing.map(({ dist, bear }) => {
    const gr = wingPair(1.1);
    g.scene.add(gr);
    return { g: gr, dist, bear, v: new THREE.Vector3(), gnd: 0, cool: 0 };
  });
  const mine = wingPair(0.62);
  mine.position.set(0, 0.28, -0.22);
  mine.visible = false;
  return { items, mine };
}

/** 날개 자리 */
export function layoutWings(g: Game, keep: THREE.Vector3[]) {
  for (const w of g.wings.items) {
    const spot = from(w.dist, w.bear);
    w.v.copy(spot);
    w.gnd = featGround(g, w.v);
    keep.push(w.v);
  }
}

/** 날개: 주우면 달고, 끝나기 직전에는 깜빡인다 */
export function wingsFrame(g: Game) {
  const { pl, t, time } = g,
    dt = t.dt,
    wing = g.rides.wing,
    mine = g.wings.mine;
  for (const w of g.wings.items) {
    const altOffset = t.alt - (w.gnd + 2.2);
    if (w.cool > 0) w.cool -= dt;
    else if (pl.p.angleTo(w.v) * S.R < 2.8 && Math.abs(altOffset) < 4.5) {
      wing.t = 16;
      w.cool = 12;
      say(g, "날개 — 칙 할 때마다 날갯짓합니다");
    }
    w.g.visible = w.cool <= 0;
    const bobPhase = time * 1.8 + w.dist;
    const radius = S.R + w.gnd + 2.2 + Math.sin(bobPhase) * 0.3;
    w.g.position.copy(w.v).multiplyScalar(radius);
    yq2.setFromUnitVectors(UP, w.v);
    const spinAngle = time * 1.4;
    const spin = yq3.setFromAxisAngle(UP, spinAngle);
    w.g.quaternion.copy(yq2).multiply(spin);
    const flapPhase = time * 5;
    const flap = Math.sin(flapPhase);
    w.g.children[0].rotation.z = flap * 0.35;
    w.g.children[1].rotation.z = -flap * 0.35;
  }
  const flapLeft = wing.flap - dt * 3;
  wing.flap = Math.max(0, flapLeft);
  const blinkPhase = time * 18;
  mine.visible = wing.t > 0 && (wing.t > 2.5 || Math.sin(blinkPhase) > 0); // 끝나기 직전에는 깜빡인다
  {
    const beatPhase = time * 6;
    const fl = 0.25 + Math.sin(beatPhase) * 0.2 + wing.flap * 0.9;
    mine.children[0].rotation.z = fl;
    mine.children[1].rotation.z = -fl;
  }
}
