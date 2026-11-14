import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Tap, Tappable } from "../core/tap";
import type { Hold } from "../models/library";
import type { Services } from "../services";
import { LIME, S } from "../settings";
import { ball, Bin, box, cyl, label } from "./shapes";
import { from, FWD, offset, UP } from "./sphere";

// 장소 넷(광장·분수·뽑기터·등대)과, 자리(at)와 모양(obj)을 나눠 두는 배치 목록.
// 랜드마크·브랜드 오브젝트도 이 목록에 들어와 같은 차례로 행성 위에 놓이고, 언덕·풍경·생물이 그 자리를 피한다

/** 등대 자리 — 첫 큰 언덕(등대 산)이 그 아래 선다 */
export const LIGHTHOUSE_AT = (): THREE.Vector3 => from(200, 262);

/** 이름 붙은 장소: 한 줄로 잇지 않고 사방에 흩어 둔다 */
interface Place {
  name: string;
  at: () => THREE.Vector3;
}

/** 배치 목록 한 줄: 자리 계산(at)과 놓을 것(obj). layoutItems 가 자리(v)를 채운다 */
export interface Item {
  at: () => THREE.Vector3;
  lift: number;
  obj: THREE.Object3D;
  v: THREE.Vector3;
  /** 장소에 끼운 모델(받기 전엔 빈 틀) */
  model?: Hold;
}

/** 닿으면 반응하는 장소(광장 나무, 분수, 뽑기 기계) */
interface PlaceReaction {
  cool: number;
  lit: number;
  r: number;
  top: number;
  msg: string;
}

/** 생물이 서 있을 자리 — 회색 공 */
interface SpotBall {
  m: THREE.Mesh;
  ph: number;
}

const gp = new THREE.Vector3();

/** 장소 넷과 배치 목록 */
export class Places implements Thing, Tappable {
  /** 장소 자리(layoutPlaces 가 채운다): 광장 나무·분수·뽑기 기계·등대 */
  readonly PV: THREE.Vector3[];
  readonly items: Item[] = [];
  /** 등대: 닿으면 불이 커지고 빛의 고리가 퍼지고 카메라가 올라 둘러본다 */
  readonly lighthouse: Thing;
  /** 생물 자리 공이 숨 쉬듯 부푼다 */
  readonly spots: Thing;
  private readonly list: Place[];
  private readonly PLZ: PlaceReaction[];
  private readonly lamp: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private readonly beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private readonly spotBalls: SpotBall[] = [];
  private spoutT = 0;
  private readonly bin = new Bin();

  constructor(private readonly s: Services) {
    const mats = s.mats;
    this.list = [
      { name: "광장", at: () => from(0, 0) },
      { name: "분수", at: () => from(105, 25) },
      { name: "뽑기터", at: () => from(125, 150) },
      { name: "등대", at: LIGHTHOUSE_AT },
    ];
    const list = this.list;
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
      this.addItem(gr, list[0].at);
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
      this.addItem(gr, list[1].at);
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
      this.addItem(gr, list[2].at);
    }
    {
      const gr = new THREE.Group();
      const tower = cyl(mats, 2.2, 22, 0xc9cdcc);
      const plinth = cyl(mats, 3.4, 1.2, 0xbfc3c2);
      gr.add(tower, plinth);
      const lampGeo = new THREE.SphereGeometry(2.6, 24, 16);
      const lampMat = new THREE.MeshBasicMaterial({ color: LIME, fog: false });
      this.lamp = new THREE.Mesh(lampGeo, lampMat);
      this.lamp.position.y = 24;
      gr.add(this.lamp);
      const beamGeo = new THREE.CylinderGeometry(1.3, 1.3, 200, 12);
      const beamMat = new THREE.MeshBasicMaterial({
        color: LIME,
        fog: false,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      this.beam = new THREE.Mesh(beamGeo, beamMat);
      this.beam.position.y = 125;
      gr.add(this.beam);
      const l = label("등대");
      l.visible = false;
      l.position.y = 32;
      l.scale.set(8.5, 2.7, 1);
      gr.add(l);
      this.addItem(gr, list[3].at);
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
      const spotMat = mats.grey(0xaeb2b1);
      const m = new THREE.Mesh(spotGeo, spotMat);
      // 공마다 숨 쉬는 박자를 어긋나게
      const ph = k * 1.3;
      this.spotBalls.push({ m, ph });
      this.addItem(m, () => offset(list[i].at(), dist, b), 1.4);
    });
    for (const it of this.items) this.bin.keep(it.obj);
    this.PV = list.map(() => new THREE.Vector3());
    this.PLZ = [
      { cool: 0, lit: 0, r: 10, top: 12, msg: "소원 나무 — 흔들리며 불이 켜집니다" },
      { cool: 0, lit: 0, r: 9, top: 6, msg: "미스트 분수 — 물기둥이 밀어 올립니다" },
      { cool: 0, lit: 0, r: 7, top: 9, msg: "뽑기 기계 — 덜컹 흔들립니다" },
    ];
    this.lighthouse = new Lighthouse(s, this.PV, this.lamp, this.beam);
    const spotBalls = this.spotBalls;
    this.spots = {
      update(f: Frame) {
        for (const sb of spotBalls) {
          const phase = f.time * 1.4 + sb.ph;
          const breath = 1 + Math.sin(phase) * 0.06;
          sb.m.scale.setScalar(breath);
        }
      },
      dispose() {},
    };
  }

  /** 배치 목록에 하나 넣고 장면에 둔다(랜드마크·브랜드 오브젝트도 여기로) */
  addItem<T extends THREE.Object3D>(obj: T, at: () => THREE.Vector3, lift = 0): Item {
    const item: Item = { at, lift, obj, v: new THREE.Vector3() };
    this.items.push(item);
    this.s.scene.add(obj);
    return item;
  }

  /** 장소 자리 */
  layoutPlaces() {
    this.list.forEach((pl, i) => {
      const at = pl.at();
      this.PV[i].copy(at);
    });
  }

  /** 배치 목록을 행성 위에 놓는다. 그 자리는 둔덕이 덮지 않게(keep) */
  layoutItems(keep: THREE.Vector3[]) {
    const terrain = this.s.terrain;
    for (const it of this.items) {
      const at = it.at();
      it.v.copy(at);
      keep.push(it.v);
      const radius = S.R + it.lift + terrain.featGround(it.v);
      it.obj.position.copy(it.v).multiplyScalar(radius);
      it.obj.quaternion.setFromUnitVectors(UP, it.v);
    }
  }

  /** 자리 차지: 배치 목록의 모든 자리 */
  claim() {
    for (const it of this.items) this.s.occ.fill(it.v, 6);
  }

  /** 장소 모델(광장 나무·분수·뽑기 기계는 저마다 라임으로 물든다) */
  fitModels() {
    this.placeModel(0, "wishtree", 6.4, "h", true);
    this.placeModel(1, "fountain", 3.4, "w", true);
    this.placeModel(2, "gacha", 2.7, "h", true);
    this.placeModel(3, "lighthouse", 46, "h", false);
  }

  /** 칙 둘레 13m 안의 장소가 반응한다 */
  onTap(tap: Tap) {
    const n = tap.ground;
    if (!n) return;
    for (let i = 0; i < 3; i++) if (n.angleTo(this.PV[i]) * S.R < 13) this.react(i);
  }

  /** 장소 셋: 닿으면 반응하고, 분수는 물기둥이 위로 밀어 올린다 */
  update(f: Frame) {
    const { player, fx, terrain } = this.s,
      { PLZ, PV, items } = this,
      dt = f.dt;
    if (!player.held) {
      // 소원 나무 줄기와 뽑기 기계도 속으로 못 들어간다
      player.block(PV[0], 3.2, 20);
      player.block(PV[2], 4, 11);
    }
    for (let i = 0; i < 3; i++) {
      const z = PLZ[i],
        dz = player.p.angleTo(PV[i]) * S.R;
      if (z.cool > 0) z.cool -= dt;
      if (z.cool <= 0 && player.air < 9 && dz < z.r) this.react(i);
      const faded = z.lit - dt * 0.45;
      z.lit = Math.max(0, faded);
      const md = items[i].model;
      if (md) {
        const shakePhase = f.time * 11;
        md.rotation.z = Math.sin(shakePhase) * 0.07 * z.lit;
        md.userData.uLime.value = z.lit * 0.3;
      }
      if (i === 1 && !player.held && dz < 8.5 && player.air < 9) {
        // 분수에 다가가면 물기둥이 밀어 올려 분수 위로 넘어간다(모델 속으로 들어가지 않게)
        player.lift(7.5);
        this.spoutT -= dt;
        if (this.spoutT <= 0) {
          this.spoutT = 0.09;
          const radius = S.R + terrain.featGround(PV[1]) + 3 + player.air * 0.5;
          gp.copy(PV[1]).multiplyScalar(radius);
          fx.burst(gp, 2, 7);
        }
      }
      if (z.lit > 0) {
        const placeR = S.R + terrain.featGround(PV[i]) + z.top * 0.7;
        gp.copy(PV[i]).multiplyScalar(placeR);
        const alpha = z.lit * 0.8;
        fx.glow(gp, 24, alpha);
      }
    }
  }

  /** 치운다 */
  dispose() {
    for (const it of this.items) it.obj.removeFromParent();
    this.lighthouse.dispose();
    this.bin.dispose();
  }

  // 장소가 반응한다: 불이 켜지고 빛이 튀고 둘레 꽃이 핀다
  private react(i: number) {
    const z = this.PLZ[i],
      PV = this.PV,
      { terrain, fx, hud } = this.s;
    if (z.cool > 0) return;
    z.lit = 1;
    z.cool = 2.5;
    hud.say(z.msg);
    const radius = S.R + terrain.featGround(PV[i]) + z.top;
    gp.copy(PV[i]).multiplyScalar(radius);
    fx.burst(gp, 14, 9);
    terrain.lightFlowers(PV[i], 500); // 둘레 꽃도 같이 핀다
  }

  private placeModel(i: number, k: string, size: number, by: string, ownLime: boolean) {
    const models = this.s.models;
    if (!models.has(k)) return;
    const gr = this.items[i].obj,
      m = models.fit(k, size, by, { ownLime });
    m.position.y = m.userData.hh;
    const prim = gr.children.filter(
      (c) => c instanceof THREE.Mesh && c !== this.lamp && c !== this.beam,
    );
    gr.add(m);
    models.swapWhenReady(k, prim);
    this.items[i].model = m;
  }
}

/* ─── 내부 ─────────────────────────── */

// 등대에 닿으면: 불이 커지고 빛의 고리가 퍼지고(고리 하나를 다시 쓴다), 카메라가 올라 둘러본다
class Lighthouse implements Thing {
  private on = false;
  private t = 99;
  private readonly wave: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private waving = false;

  constructor(
    private readonly s: Services,
    private readonly PV: THREE.Vector3[],
    private readonly lamp: THREE.Mesh,
    private readonly beam: THREE.Mesh,
  ) {
    const waveGeo = new THREE.RingGeometry(0.965, 1, 120);
    const waveMat = new THREE.MeshBasicMaterial({
      color: LIME,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
      // 납작한 판이라 앞뒤를 두 번 나눠 그릴 까닭이 없다(나누면 three 가 프레임마다 셰이더를 다시 고른다)
      forceSinglePass: true,
    });
    this.wave = new THREE.Mesh(waveGeo, waveMat);
    this.wave.visible = false;
    s.scene.add(this.wave);
  }

  update(f: Frame) {
    const { player, camera, hud, fx, terrain } = this.s,
      PV = this.PV,
      dt = f.dt;
    const dL = player.p.angleTo(PV[3]) * S.R;
    if (!this.on && dL < 17) {
      this.on = true;
      this.t = 0;
      hud.say("등대 — 불이 켜집니다");
      this.wave.quaternion.setFromUnitVectors(FWD, PV[3]);
      const waveRadius = S.R + terrain.featGround(PV[3]) + 3;
      this.wave.position.copy(PV[3]).multiplyScalar(waveRadius);
      this.wave.material.opacity = 0.75;
      this.wave.scale.setScalar(1);
      this.wave.visible = true;
      this.waving = true;
    }
    if (this.on && dL > 48 && this.t > 9) this.on = false;
    this.t += dt;
    const live = this.t < 8;
    // 카메라가 올라 둘러보는 정도: 닿은 뒤 서서히 올랐다가 8초 안에 내려온다
    const rise = THREE.MathUtils.smoothstep(this.t, 0.2, 1.8),
      fall = THREE.MathUtils.smoothstep(this.t, 6.2, 8);
    const oT = live ? rise * (1 - fall) : 0;
    const overEase = ease(4, dt);
    camera.easeOverlook(oT, overEase);
    const pulseLeft = 1 - this.t / 3.5;
    const pulse = live ? Math.max(0, pulseLeft) : 0;
    const flickerPhase = f.time * 2;
    const lampScale = 1 + 0.7 * pulse + Math.sin(flickerPhase) * 0.04;
    this.lamp.scale.setScalar(lampScale);
    const beamWidth = 1 + 3 * pulse;
    this.beam.scale.set(beamWidth, 1, beamWidth);
    if (this.waving) {
      const k = this.t / 5.5;
      if (k >= 1) {
        this.waving = false;
        this.wave.visible = false;
      } else {
        // 처음엔 빠르게, 끝으로 갈수록 느리게 퍼진다
        const waveLeft = 1 - k;
        const waveScale = 5 + (1 - Math.pow(waveLeft, 2)) * 210;
        this.wave.scale.setScalar(waveScale);
        this.wave.material.opacity = 0.75 * (1 - k);
      }
    }
    // 등대 불빛(멀리서도 보이게 크게 번진다)
    gp.copy(PV[3]);
    const beaconR = S.R + terrain.featGround(PV[3]) + 24;
    gp.multiplyScalar(beaconR);
    const beaconSize = 42 + pulse * 30;
    const beaconAlpha = 0.55 + pulse * 0.4;
    fx.glow(gp, beaconSize, beaconAlpha);
  }

  dispose() {
    this.wave.removeFromParent();
    this.wave.geometry.dispose();
    this.wave.material.dispose();
  }
}
