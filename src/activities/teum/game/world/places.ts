import * as THREE from "three";

import { blockAt } from "../collide";
import { burst } from "../fx/sparks";
import { say } from "../hud";
import type { Game } from "../state";
import { LIME, S } from "../state";
import type { GreyMesh } from "./materials";
import { grey } from "./materials";
import { ball, box, cyl, label } from "./shapes";
import { from, FWD, offset } from "./sphere";
import { featGround } from "./terrain";

// 장소 넷(광장·분수·뽑기터·등대)과, 자리(at)와 모양(obj)을 나눠 두는 배치 목록

/** 이름 붙은 장소: 한 줄로 잇지 않고 사방에 흩어 둔다 */
export interface Place {
  name: string;
  at: () => THREE.Vector3;
}

/** 배치 목록 한 줄: 자리 계산(at)과 놓을 것(obj). layout 이 자리(v)를 채운다 */
export interface Item {
  at: () => THREE.Vector3;
  lift: number;
  obj: THREE.Object3D;
  v: THREE.Vector3;
  /** 장소에 끼운 모델(받기 전엔 빈 틀) */
  model?: THREE.Group;
}

/** 닿으면 반응하는 장소 셋(광장 나무, 분수, 뽑기 기계) */
export interface PlaceReaction {
  cool: number;
  lit: number;
  r: number;
  top: number;
  msg: string;
}

/** 생물이 서 있을 자리 — 회색 공 */
export interface SpotBall {
  m: GreyMesh;
  ph: number;
}

/** 장소 전체 */
export interface Places {
  list: Place[];
  items: Item[];
  /** 장소 자리(layout 이 채운다) */
  PV: THREE.Vector3[];
  PLZ: PlaceReaction[];
  lamp: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  spots: SpotBall[];
  spoutT: number;
}

/** 배치 목록에 하나 넣고 장면에 둔다 */
export function place<T extends THREE.Object3D>(
  g: Game,
  obj: T,
  at: () => THREE.Vector3,
  lift = 0,
): T {
  return addItem(g.places.items, g.scene, obj, at, lift);
}

/** 장소 넷과 생물 자리 공을 만든다 */
export function createPlaces(g: Game): Places {
  const list: Place[] = [
    { name: "광장", at: () => from(0, 0) },
    { name: "분수", at: () => from(105, 25) },
    { name: "뽑기터", at: () => from(125, 150) },
    { name: "등대", at: () => from(200, 262) },
  ];
  const items: Item[] = [],
    spots: SpotBall[] = [],
    scene = g.scene,
    mats = g.mats;
  const K = 4.5;
  {
    const gr = new THREE.Group();
    const base = cyl(mats, 1.9, 0.1, 0xc9cdcc);
    const trunk = cyl(mats, 0.18, 2.1, 0xb9bdbc);
    const crown = ball(mats, 1.0, 0xc2c6c5, 2.7);
    gr.add(base, trunk, crown);
    const l = label("광장");
    l.visible = false;
    l.position.y = 4.3;
    gr.add(l);
    gr.scale.setScalar(K);
    addItem(items, scene, gr, list[0].at);
  }
  {
    const gr = new THREE.Group();
    const basin = cyl(mats, 1.5, 0.35, 0xc4c8c7);
    const column = cyl(mats, 0.3, 1.2, 0xb9bdbc);
    const spout = ball(mats, 0.34, 0xcfd3d2, 1.45);
    gr.add(basin, column, spout);
    const l = label("분수");
    l.visible = false;
    l.position.y = 2.6;
    gr.add(l);
    gr.scale.setScalar(K);
    addItem(items, scene, gr, list[1].at);
  }
  {
    const gr = new THREE.Group();
    const body = box(mats, 1.1, 1.3, 1.1, 0xbfc3c2);
    const globe = ball(mats, 0.65, 0xd3d6d5, 1.8);
    const chute = box(mats, 0.2, 0.2, 0.22, 0xa9adac, 0.6);
    gr.add(body, globe, chute);
    chute.position.z = 0.64;
    const l = label("뽑기터");
    l.visible = false;
    l.position.y = 3.1;
    gr.add(l);
    gr.scale.setScalar(K);
    addItem(items, scene, gr, list[2].at);
  }
  let lamp: Places["lamp"], beam: Places["beam"];
  {
    const gr = new THREE.Group();
    const tower = cyl(mats, 2.2, 22, 0xc9cdcc);
    const plinth = cyl(mats, 3.4, 1.2, 0xbfc3c2);
    gr.add(tower, plinth);
    const lampGeo = new THREE.SphereGeometry(2.6, 24, 16);
    const lampMat = new THREE.MeshBasicMaterial({ color: LIME, fog: false });
    lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.y = 24;
    gr.add(lamp);
    const beamGeo = new THREE.CylinderGeometry(1.3, 1.3, 200, 12);
    const beamMat = new THREE.MeshBasicMaterial({
      color: LIME,
      fog: false,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 125;
    gr.add(beam);
    const l = label("등대");
    l.visible = false;
    l.position.y = 32;
    l.scale.set(8.5, 2.7, 1);
    gr.add(l);
    addItem(items, scene, gr, list[3].at);
  }
  // 생물이 서 있을 자리 — 회색 공
  const spotsAt: [number, number, number][] = [
    [0, 11, 40],
    [0, 14, 200],
    [1, 10, 80],
    [1, 13, 250],
    [2, 11, 20],
    [3, 16, 140],
  ];
  spotsAt.forEach(([i, dist, b], k) => {
    const spotGeo = new THREE.SphereGeometry(0.45, 18, 12);
    const spotMat = grey(mats, 0xaeb2b1);
    const m = new THREE.Mesh(spotGeo, spotMat);
    // 공마다 숨 쉬는 박자를 어긋나게
    const ph = k * 1.3;
    spots.push({ m, ph });
    addItem(items, scene, m, () => offset(list[i].at(), dist, b), 1.4);
  });
  return {
    list,
    items,
    PV: list.map(() => new THREE.Vector3()),
    PLZ: [
      { cool: 0, lit: 0, r: 10, top: 12, msg: "소원 나무 — 흔들리며 불이 켜집니다" },
      { cool: 0, lit: 0, r: 9, top: 6, msg: "미스트 분수 — 물기둥이 밀어 올립니다" },
      { cool: 0, lit: 0, r: 7, top: 9, msg: "뽑기 기계 — 덜컹 흔들립니다" },
    ],
    lamp,
    beam,
    spots,
    spoutT: 0,
  };
}

/** 장소가 반응한다: 불이 켜지고 빛이 튀고 둘레 꽃이 핀다 */
export function reactPlace(g: Game, i: number) {
  const z = g.places.PLZ[i],
    PV = g.places.PV;
  if (z.cool > 0) return;
  z.lit = 1;
  z.cool = 2.5;
  say(g, z.msg);
  const radius = S.R + featGround(g, PV[i]) + z.top;
  const at = PV[i].clone().multiplyScalar(radius);
  burst(g, at, 14, 9);
  const bumps = g.terrain.bumps;
  for (let k = 0; k < bumps.v.length; k++)
    if (2 * (1 - PV[i].dot(bumps.v[k])) * S.R * S.R < 500) bumps.lit[k] = 1; // 둘레 꽃도 같이 핀다
}

/** 장소 셋: 닿으면 반응하고, 분수는 물기둥이 위로 밀어 올린다 */
export function placesFrame(g: Game) {
  const { pl, t, time } = g,
    { PLZ, PV, items } = g.places;
  if (!t.held) {
    // 소원 나무 줄기와 뽑기 기계도 속으로 못 들어간다
    blockAt(g, PV[0], 3.2, 20);
    blockAt(g, PV[2], 4, 11);
  }
  for (let i = 0; i < 3; i++) {
    const z = PLZ[i],
      dz = pl.p.angleTo(PV[i]) * S.R;
    if (z.cool > 0) z.cool -= t.dt;
    if (z.cool <= 0 && pl.air < 9 && dz < z.r) reactPlace(g, i);
    const faded = z.lit - t.dt * 0.45;
    z.lit = Math.max(0, faded);
    const md = items[i].model;
    if (md) {
      const shakePhase = time * 11;
      md.rotation.z = Math.sin(shakePhase) * 0.07 * z.lit;
      md.userData.uLime.value = z.lit * 0.3;
    }
    if (i === 1 && !t.held && dz < 8.5 && pl.air < 9) {
      // 분수에 다가가면 물기둥이 밀어 올려 분수 위로 넘어간다(모델 속으로 들어가지 않게)
      pl.vy = Math.max(pl.vy, 7.5);
      if (pl.air <= 0) pl.air = 0.01;
      g.places.spoutT -= t.dt;
      if (g.places.spoutT <= 0) {
        g.places.spoutT = 0.09;
        const radius = S.R + featGround(g, PV[1]) + 3 + pl.air * 0.5;
        const at = PV[1].clone().multiplyScalar(radius);
        burst(g, at, 2, 7);
      }
    }
  }
}

/** 등대에 닿은 뒤의 상태: 언제부터(t), 퍼지는 빛 고리(wave) */
export interface Arrival {
  on: boolean;
  t: number;
  wave: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null;
}

/** 등대: 닿으면 불이 커지고 빛의 고리가 퍼지고, 카메라가 올라 둘러본다. 이번 프레임의 불빛 세기(pulse)를 돌려준다 */
export function lighthouseFrame(g: Game): number {
  const { pl, t, time } = g,
    arr = g.rides.arr,
    PV = g.places.PV,
    dt = t.dt;
  const dL = pl.p.angleTo(PV[3]) * S.R;
  if (!arr.on && dL < 17) {
    arr.on = true;
    arr.t = 0;
    say(g, "등대 — 불이 켜집니다");
    const waveGeo = new THREE.RingGeometry(0.965, 1, 120);
    const waveMat = new THREE.MeshBasicMaterial({
      color: LIME,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    arr.wave = new THREE.Mesh(waveGeo, waveMat);
    arr.wave.quaternion.setFromUnitVectors(FWD, PV[3]);
    const waveRadius = S.R + featGround(g, PV[3]) + 3;
    arr.wave.position.copy(PV[3]).multiplyScalar(waveRadius);
    g.scene.add(arr.wave);
  }
  if (arr.on && dL > 48 && arr.t > 9) arr.on = false;
  arr.t += dt;
  const live = arr.t < 8;
  // 카메라가 올라 둘러보는 정도: 닿은 뒤 서서히 올랐다가 8초 안에 내려온다
  const oT = live
    ? THREE.MathUtils.smoothstep(arr.t, 0.2, 1.8) * (1 - THREE.MathUtils.smoothstep(arr.t, 6.2, 8))
    : 0;
  const decay = -4 * dt;
  const ease = 1 - Math.exp(decay);
  pl.over += (oT - pl.over) * ease;
  const pulseLeft = 1 - arr.t / 3.5;
  const pulse = live ? Math.max(0, pulseLeft) : 0;
  const flickerPhase = time * 2;
  const lampScale = 1 + 0.7 * pulse + Math.sin(flickerPhase) * 0.04;
  g.places.lamp.scale.setScalar(lampScale);
  const beamWidth = 1 + 3 * pulse;
  g.places.beam.scale.set(beamWidth, 1, beamWidth);
  if (arr.wave) {
    const k = arr.t / 5.5;
    if (k >= 1) {
      g.scene.remove(arr.wave);
      arr.wave.geometry.dispose();
      arr.wave.material.dispose();
      arr.wave = null;
    } else {
      // 처음엔 빠르게, 끝으로 갈수록 느리게 퍼진다
      const waveLeft = 1 - k;
      const waveScale = 5 + (1 - Math.pow(waveLeft, 2)) * 210;
      arr.wave.scale.setScalar(waveScale);
      arr.wave.material.opacity = 0.75 * (1 - k);
    }
  }
  return pulse;
}

/** 생물 자리 공이 숨 쉬듯 부푼다 */
export function spotsFrame(g: Game) {
  for (const s of g.places.spots) {
    const phase = g.time * 1.4 + s.ph;
    const breath = 1 + Math.sin(phase) * 0.06;
    s.m.scale.setScalar(breath);
  }
}

/* ─── 내부 ─────────────────────────── */

function addItem<T extends THREE.Object3D>(
  items: Item[],
  scene: THREE.Scene,
  obj: T,
  at: () => THREE.Vector3,
  lift = 0,
): T {
  const item: Item = { at, lift, obj, v: new THREE.Vector3() };
  items.push(item);
  scene.add(obj);
  return obj;
}
