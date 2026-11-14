import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Tappable } from "../core/tap";
import type { Hold } from "../models/library";
import type { Services } from "../services";
import { S } from "../settings";
import { from, UP } from "../world/sphere";

// 날개 — 주우면 한동안 천천히 떨어지고, 칙 할 때마다 날갯짓해서 올라간다.
// 모델이 오면 코드로 그린 흰 판 두 장 대신 나비 날개를 쓴다. 등에 붙는 것과 땅에 놓인 아이템이 같은 모델이고,
// 날갯짓은 모델을 접었다 펴는 정점 변형(하늘 무리와 같은 3번 방식) — 그 변형에는 날개마다 다른 위상이 쓰이지 않아 모두 한 값으로 같이 휜다

/** 주울 수 있는 날개 하나 */
export interface WingItem {
  g: THREE.Group;
  dist: number;
  bear: number;
  v: THREE.Vector3;
  gnd: number;
  cool: number;
}

/** 나비 날개 크기: 등 날개는 뒤에서 보는 카메라라 크면 몸을 다 가린다(머리와 다리가 보이는 크기로) */
const BACK_W = 1.5,
  ITEM_W = 3.6;
/** 날갯짓 변형 방식(정점 셰이더 3번) */
const FLAP_KIND = 3;

const yq2 = new THREE.Quaternion(),
  yq3 = new THREE.Quaternion();

/** 날개 전체: 주울 것들과 내 등의 날개 */
export class Wings implements Thing, Tappable {
  readonly items: WingItem[];
  /** 내 등의 날개(아바타가 몸에 붙인다) */
  readonly mine: THREE.Group;
  /** 날갯짓 세기(칙 할 때 1, 서서히 0) */
  private flap = 0;
  private readonly wingGeo = new THREE.SphereGeometry(1, 14, 10);
  private readonly wingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private readonly holds: Hold[] = [];

  constructor(private readonly s: Services) {
    this.items = s.layout.wing.map(({ dist, bear }) => {
      const gr = this.wingPair(1.1);
      s.scene.add(gr);
      return { g: gr, dist, bear, v: new THREE.Vector3(), gnd: 0, cool: 0 };
    });
    this.mine = this.wingPair(0.62);
    this.mine.position.set(0, 0.28, -0.22);
    this.mine.visible = false;
  }

  /** 자리 */
  layout(keep: THREE.Vector3[]) {
    const { terrain, culler } = this.s;
    for (const w of this.items) {
      const spot = from(w.dist, w.bear);
      w.v.copy(spot);
      w.gnd = terrain.featGround(w.v);
      keep.push(w.v);
      culler.track(w.g, w.v);
    }
  }

  /** 자리 차지 */
  claim() {
    for (const w of this.items) this.s.occ.fill(w.v, 5);
  }

  /** 나비 날개 모델: 흰 판 대신 등과 아이템에 끼운다. 날갯짓은 키마다 같이 쓰는 변형 값으로 */
  fitModels() {
    const models = this.s.models;
    if (!models.has("w_butterfly")) return;
    const motion = models.motionOf("w_butterfly");
    motion.uAk.value = FLAP_KIND;
    motion.uAx.value = 0;
    motion.uAn.value.set(0, 0, 0.5, 0);
    const back = this.butterfly(BACK_W);
    back.position.set(0, 0.42, 0.0);
    this.mine.add(back);
    const backPlates = this.plates(this.mine);
    models.swapWhenReady("w_butterfly", backPlates);
    for (const w of this.items) {
      const plates = this.plates(w.g);
      const item = this.butterfly(ITEM_W);
      w.g.add(item);
      models.swapWhenReady("w_butterfly", plates);
    }
  }

  /** 날개를 달고 있으면 칙 할 때마다 날갯짓한다 */
  onTap() {
    const player = this.s.player;
    if (player.wingsLeft <= 0) return;
    player.flap();
    this.flap = 1;
  }

  /** 주우면 달고, 끝나기 직전에는 깜빡인다 */
  update(f: Frame) {
    const { player, hud, models } = this.s,
      dt = f.dt,
      time = f.time,
      mine = this.mine;
    for (const w of this.items) {
      const altOffset = player.alt - (w.gnd + 2.2);
      if (w.cool > 0) w.cool -= dt;
      else if (player.p.angleTo(w.v) * S.R < 2.8 && Math.abs(altOffset) < 4.5) {
        player.giveWings(16);
        w.cool = 12;
        hud.say("날개 — 칙 할 때마다 날갯짓합니다");
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
      const flapWave = Math.sin(flapPhase);
      w.g.children[0].rotation.z = flapWave * 0.35;
      w.g.children[1].rotation.z = -flapWave * 0.35;
    }
    const flapLeft = this.flap - dt * 3;
    this.flap = Math.max(0, flapLeft);
    const wingsLeft = player.wingsLeft;
    const blinkPhase = time * 18;
    mine.visible = wingsLeft > 0 && (wingsLeft > 2.5 || Math.sin(blinkPhase) > 0); // 끝나기 직전에는 깜빡인다
    const beatPhase = time * 6;
    const fl = 0.25 + Math.sin(beatPhase) * 0.2 + this.flap * 0.9;
    mine.children[0].rotation.z = fl;
    mine.children[1].rotation.z = -fl;
    if (this.holds.length) {
      const an = models.motionOf("w_butterfly").uAn.value;
      an.y = time * 9;
      an.z = 0.4 + this.flap * 0.6;
    }
  }

  /** 치운다(모델 재질은 모델 것이라 두고 간다) */
  dispose() {
    for (const w of this.items) w.g.removeFromParent();
    this.mine.removeFromParent();
    this.wingGeo.dispose();
    this.wingMat.dispose();
  }

  // 흰 판 날개 한 쌍(모델이 오기 전, 또는 모델이 없을 때)
  private wingPair(sz: number): THREE.Group {
    const gr = new THREE.Group();
    for (const sg of [-1, 1]) {
      const w = new THREE.Mesh(this.wingGeo, this.wingMat);
      const span = sz * 1.3,
        thickness = sz * 0.22,
        depth = sz * 0.62;
      w.scale.set(span, thickness, depth);
      w.position.x = sg * sz * 1.25;
      gr.add(w);
    }
    return gr;
  }

  // 흰 판 두 장(날개 묶음의 맨 앞 둘)
  private plates(gr: THREE.Group): THREE.Object3D[] {
    return gr.children.slice(0, 2);
  }

  // 나비 날개 틀 하나: 날개가 옆(z)으로 펴지게 돌려 둔다
  private butterfly(size: number): Hold {
    const g = this.s.models.fit("w_butterfly", size, "w");
    g.rotation.y = -Math.PI / 2;
    this.holds.push(g);
    return g;
  }
}
