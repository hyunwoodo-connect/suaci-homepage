import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import { HIDE } from "../hideseek/tuning";
import type { Hold } from "../models/library";
import type { Services } from "../services";
import { LIME, S } from "../settings";
import { clamp, FWD } from "../world/sphere";
import { AVATAR_COMPANION } from "./parts";
import type { PoseFn, PoseInput, RigHandle } from "./rig";
import { setupRig } from "./rig";

// 나: 자리(me)와 기울기(tiltG) 안에 몸. 뼈대 있는 아바타가 오기 전까지는 도형 몸과 라임 공 고양이가 대신 선다.
// 몸 자리는 Player.place() 가 정한 세계 자리(P)를 따라가고, 기울기·몸짓·크기는 여기서 정한다

/** 등에 다는 날개(날개 놀이기구가 만든다) */
interface BackWings {
  mine: THREE.Group;
}

/** 고양이가 맡은 냄새: 0 멀다 · 1 킁킁 · 2 통통 · 3 폴짝폴짝 */
export type CatScent = 0 | 1 | 2 | 3;

/** 고양이 자리(내 몸 기준 옆·뒤, m) */
const CAT_SIDE = -0.95,
  CAT_BACK = -0.45;
/** 고개가 상자 쪽에서 흔들리는 폭(rad — hideseek.data.json 의 cat.wobble 도) */
const CAT_WOBBLE = (HIDE.cat.wobble * Math.PI) / 180;
/**
 * 냄새마다의 몸짓: 떠 있는 높이(m)·오르내리는 폭(m)·빠르기(rad/s)·통통 튀나(아니면 둥실)·앞서 나가는 거리(m)·
 * 고개 숙임(rad, 음수가 축 늘어짐)·킁킁거리는 끄덕임(rad)
 */
const CAT_MOODS = [
  { height: 0.4, bob: 0.03, rate: 1.4, hops: false, ahead: 0, nod: -0.3, sniff: 0 },
  { height: 0.58, bob: 0.07, rate: 2.3, hops: false, ahead: 0, nod: 0.12, sniff: 0.1 },
  { height: 0.48, bob: 0.3, rate: 8, hops: true, ahead: 0.7, nod: 0.18, sniff: 0 },
  { height: 0.48, bob: 0.55, rate: 11, hops: true, ahead: 0.25, nod: 0, sniff: 0 },
] as const;

const bx = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  gp = new THREE.Vector3();

/** 나의 몸 */
export class Avatar implements Thing {
  readonly me = new THREE.Group();
  readonly tiltG = new THREE.Group();
  readonly body: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshStandardMaterial>;
  readonly nose: THREE.Mesh<THREE.ConeGeometry, THREE.MeshStandardMaterial>;
  /** 라임 공 고양이(고양이 모델이 오면 숨고 자리만 남는다) */
  readonly catPrim: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  readonly shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  /** 고양이: 모델이 도형 고양이를 따라 둥실, 곁에 작은 라임 빛 */
  readonly cat: Thing;
  private catModel: Hold | null = null;
  /** 고양이가 맡은 냄새(0 멀다 … 3 바로 곁)와 상자가 있는 쪽, 지금 몸짓(천천히 따라간다) */
  private scent: CatScent = 0;
  private readonly scentToward = new THREE.Vector3();
  private catPhase = 1;
  private catHeight = 0.55;
  private catBob = 0.07;
  private catAhead = 0;
  private catYaw = 0;
  private catNod = 0;
  private tilt = 0;
  private pose: PoseFn | null = null;
  /** 뼈대 있는 몸(오기 전에는 null) */
  private rig: RigHandle | null = null;
  private readonly rigWaiting: ((rig: RigHandle) => void)[] = [];
  private readonly poseIn: PoseInput = { dt: 0, tot: 0, vy: 0, air: 0, fx: 0, time: 0 };
  /** 몸 크기 배수(언박싱의 '4배로 커진다') — 바라는 값과 지금 값 */
  private growWant = 1;
  private growth = 1;

  /** 내 도형 몸·고양이·그림자를 만든다(등의 날개도 같이 단다) */
  constructor(
    private readonly s: Services,
    wings: BackWings,
  ) {
    const bodyGeometry = new THREE.CapsuleGeometry(0.28, 0.5, 4, 14),
      bodyMaterial = s.mats.grey(0x8f9493);
    this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    const noseGeometry = new THREE.ConeGeometry(0.1, 0.24, 12),
      noseMaterial = s.mats.grey(0x6f7473);
    this.nose = new THREE.Mesh(noseGeometry, noseMaterial);
    this.nose.rotation.x = Math.PI / 2;
    this.nose.position.set(0, 0.12, 0.34);
    const catGeometry = new THREE.SphereGeometry(0.13, 14, 10),
      catMaterial = new THREE.MeshBasicMaterial({ color: LIME });
    this.catPrim = new THREE.Mesh(catGeometry, catMaterial);
    this.catPrim.position.set(CAT_SIDE, 0.55, CAT_BACK);
    this.tiltG.add(this.body, this.nose);
    this.me.add(this.tiltG, this.catPrim, wings.mine);
    s.scene.add(this.me);
    const shadowGeometry = new THREE.CircleGeometry(0.4, 24),
      shadowMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      });
    this.shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    s.scene.add(this.shadow);
    this.cat = {
      update: () => this.catFrame(),
      dispose: () => {},
    };
  }

  /** 뼈대 있는 몸과 고양이 모델 자리(받기 전에 끼울 틀을 둔다) */
  fitModels() {
    const { models } = this.s;
    setupRig(this.s, this, (rig) => {
      this.pose = rig.pose;
      this.rig = rig;
      for (const cb of this.rigWaiting.splice(0)) cb(rig);
    });
    if (!models.has(AVATAR_COMPANION)) return;
    const C = models.fit(AVATAR_COMPANION, 0.48, "h", { ownLime: true });
    C.rotation.y = -Math.PI / 2;
    this.me.add(C);
    models.swapWhenReady(AVATAR_COMPANION, [this.catPrim]);
    C.userData.uLime.value = 0.55; // 고양이는 어느 색에서도 라임
    this.catModel = C;
  }

  /** 뼈대 있는 몸이 오면(이미 왔으면 바로) cb — 부품을 끼우는 쪽(옷장)이 쓴다 */
  whenRig(cb: (rig: RigHandle) => void) {
    if (this.rig) cb(this.rig);
    else this.rigWaiting.push(cb);
  }

  /**
   * 고양이가 맡은 냄새(숨바꼭질): 0 멀다 — 축 늘어져 따라온다 · 1 킁킁 — 고개를 상자 쪽으로 · 2 통통 뛰며 반 걸음 앞서 나간다 · 3 제자리에서 폴짝폴짝.
   * toward: 상자가 있는 쪽(행성 위 자리). 고개는 그쪽에서 조금씩 흔들린다(화살표가 아니라 '저쪽인 것 같아')
   */
  setCatScent(level: CatScent, toward: THREE.Vector3 | null) {
    this.scent = toward ? level : 0;
    if (toward) this.scentToward.copy(toward);
  }

  /** 고양이 머리 위의 세계 자리(냄새 표시가 붙는다) */
  catHead(out: THREE.Vector3): THREE.Vector3 {
    this.catPrim.getWorldPosition(out);
    return out.addScaledVector(this.s.player.p, 0.5);
  }

  /** 몸을 k 배로(1 이 그대로). 천천히 커지고 줄어든다(isInstant 면 바로 — 꾸미기 씬으로 들어갈 때) */
  grow(k: number, isInstant = false) {
    this.growWant = k;
    if (isInstant) this.growth = k;
  }

  /** 나를 이번 프레임 자리에 놓는다: 둥실(자리는 Player.place), 앞을 보고, 빠를수록 눕고, 대포·구멍에선 작아진다. 그림자도 */
  update(f: Frame) {
    const pl = this.s.player,
      p = pl.p,
      h = pl.h,
      dt = f.dt,
      me = this.me;
    bx.crossVectors(p, h).normalize();
    m4.makeBasis(bx, p, h);
    me.quaternion.setFromRotationMatrix(m4);
    me.position.copy(pl.P);
    // 빠를수록 앞으로 눕고, 솟을 때는 몸을 일으킨다
    const speed = clamp(pl.tot, 0, 2.4),
      tiltTarget = speed * 0.42 - pl.vy * 0.05;
    this.tilt += (tiltTarget - this.tilt) * ease(5, dt);
    this.tiltG.rotation.x = this.tilt;
    if (this.pose) {
      const i = this.poseIn;
      i.dt = dt;
      i.tot = pl.tot;
      i.vy = pl.vy;
      i.air = pl.air;
      i.fx = pl.dragFx;
      i.time = f.time;
      this.pose(i);
    }
    this.poseCat(f.time, dt);
    this.growth += (this.growWant - this.growth) * ease(2.5, dt);
    const targetScale = pl.bodyScale * this.growth,
      scale = me.scale.x + (targetScale - me.scale.x) * ease(18, dt);
    me.scale.setScalar(scale);
    // 커지면 발이 땅 밑으로 가지 않게 그만큼 올린다(몸 키 1.5m 의 반)
    const growLift = (this.growth - 1) * 0.75;
    if (growLift > 0.001) me.position.addScaledVector(p, growLift);
    // 그림자는 땅에 붙어 높이 뜰수록 넓고 옅어진다
    const sh = this.shadow;
    const groundRadius = S.R + pl.gNow + 0.06;
    sh.position.copy(p).multiplyScalar(groundRadius);
    sh.quaternion.setFromUnitVectors(FWD, p);
    const spread = 1 + pl.air * 0.08;
    sh.scale.setScalar(spread);
    sh.material.opacity = 0.12 / (1 + pl.air * 0.12);
  }

  /** 치운다(모델 재질은 키마다 같이 쓰는 것이라 두고 간다) */
  dispose() {
    this.me.removeFromParent();
    this.shadow.removeFromParent();
    for (const m of [this.body, this.nose, this.catPrim, this.shadow]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }

  // 고양이의 몸짓: 냄새가 짙을수록 높이 빨리 뛰고, 앞서 나가고, 고개를 상자 쪽으로 돌린다. 멀면 낮게 축 늘어진다.
  // 고양이 모델에는 뼈대가 없어 귀·꼬리는 따로 못 움직인다 — 뛰는 빠르기·기울기·방향으로 대신한다
  private poseCat(time: number, dt: number) {
    const mood = CAT_MOODS[this.scent],
      pl = this.s.player,
      k = ease(5, dt);
    this.catHeight += (mood.height - this.catHeight) * k;
    this.catBob += (mood.bob - this.catBob) * k;
    this.catAhead += (mood.ahead - this.catAhead) * k;
    this.catNod += (mood.nod - this.catNod) * k;
    this.catPhase += dt * mood.rate;
    const wave = Math.sin(this.catPhase),
      hop = mood.hops ? Math.abs(wave) : wave;
    const y = this.catHeight + hop * this.catBob,
      z = CAT_BACK + this.catAhead;
    this.catPrim.position.set(CAT_SIDE, y, z);
    // 상자 쪽(내 몸 기준 왼쪽·앞쪽으로 나눠 잰다)에서 ±wobble 만큼 천천히 흔들린다
    let want = 0;
    if (this.scent > 0) {
      bx.crossVectors(pl.p, pl.h).normalize();
      gp.copy(this.scentToward).sub(pl.p);
      const side = gp.dot(bx),
        front = gp.dot(pl.h),
        swing = time * 0.9,
        drift = Math.sin(swing) * CAT_WOBBLE;
      want = Math.atan2(side, front) + drift;
    }
    // 가까운 쪽으로 돈다(한 바퀴 넘게 돌지 않게 -π~π 로 접는다)
    const gap = want - this.catYaw,
      gapY = Math.sin(gap),
      gapX = Math.cos(gap),
      turn = Math.atan2(gapY, gapX);
    this.catYaw += turn * k;
    const C = this.catModel;
    if (!C) return;
    const sniffPhase = time * 13,
      sniff = Math.sin(sniffPhase) * mood.sniff;
    C.rotation.y = -Math.PI / 2 + this.catYaw;
    C.rotation.z = this.catNod + sniff;
  }

  // 고양이 모델이 라임 공 고양이를 따라 둥실, 곁의 작은 라임 빛
  private catFrame() {
    this.catPrim.getWorldPosition(gp);
    this.s.fx.glow(gp, 1.8, 0.5);
    if (this.catModel) this.catModel.position.copy(this.catPrim.position);
  }
}
