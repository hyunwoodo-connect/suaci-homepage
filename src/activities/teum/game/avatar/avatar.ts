import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Hold } from "../models/library";
import type { Services } from "../services";
import { LIME, S } from "../settings";
import { clamp, FWD } from "../world/sphere";
import type { CatIdle } from "./catIdle";
import { createCatIdle, stepCatIdle } from "./catIdle";
import { AVATAR_COMPANION } from "./parts";
import type { PoseFn, PoseInput, RigHandle } from "./rig";
import { setupRig } from "./rig";

// 나: 자리(me)와 기울기(tiltG) 안에 몸. 뼈대 있는 아바타가 오기 전까지는 도형 몸과 라임 공 고양이가 대신 선다.
// 몸 자리는 Player.place() 가 정한 세계 자리(P)를 따라가고, 기울기·몸짓·크기는 여기서 정한다

/** 등에 다는 날개(날개 놀이기구가 만든다) */
interface BackWings {
  mine: THREE.Group;
}

/** 고양이의 한 자세 */
interface CatStance {
  height: number;
  ahead: number;
  nod: number;
  roll: number;
  tall: number;
  turn: number;
  wag: number;
  bob: number;
}

/** 고양이 자리(내 몸 기준 옆·뒤, m) */
const CAT_SIDE = -0.95,
  CAT_BACK = -0.45;
/** 꼬리: 몸 가운데에서 뒤로·위로(m) · 한 번 반짝이는 시간(초)·가장 클 때의 크기(m) */
const CAT_TAIL_BACK = -0.34,
  CAT_TAIL_UP = 0.16,
  TWINKLE_SECONDS = 0.16,
  TWINKLE_SIZE = 1.5;
/** 따라올 때의 고양이 몸짓: 떠 있는 높이(m)·오르내리는 폭(m)·빠르기(rad/s)·고개 숙임(rad, 음수가 축 늘어짐) */
const CAT_FOLLOW = { height: 0.4, bob: 0.03, rate: 1.4, nod: -0.3 } as const;

/**
 * 한가한 몸짓마다의 고양이 자세: 떠 있는 높이(m — 0 이면 따라올 때의 몸짓 그대로)·앞서 나가는 거리(m)·고개 숙임(rad)·옆으로 기울임(rad)·
 * 세로로 늘임(1 이 그대로)·뒤돌아보는 각(rad)·꼬리를 흔드는(몸을 살랑이는) 폭(rad)·까딱이는 폭(rad)
 */
const CAT_IDLES: Readonly<Record<CatIdle, CatStance>> = {
  follow: { height: 0, ahead: 0, nod: 0, roll: 0, tall: 1, turn: 0, wag: 0, bob: 0 },
  sit: { height: 0.27, ahead: 0, nod: 0.1, roll: 0, tall: 0.92, turn: 0, wag: 0.3, bob: 0 },
  lick: { height: 0.27, ahead: 0, nod: -0.55, roll: 0.5, tall: 0.92, turn: 0, wag: 0, bob: 0.09 },
  yawn: { height: 0.32, ahead: 0, nod: 0.45, roll: 0, tall: 1.28, turn: 0, wag: 0, bob: 0 },
  ahead: { height: 0, ahead: 2.3, nod: 0.15, roll: 0, tall: 1, turn: Math.PI, wag: 0, bob: 0 },
};
/** 내가 움직인다고 치는 빠르기(Player.tot) */
const MOVING = 0.06;
/** 꽝의 한숨: 납작해지는 시간(초)과 세로 몫 · 찾았을 때 한 바퀴: 도는 시간(초)과 뛰는 높이(m) */
const SIGH_SECONDS = 1,
  SIGH_FLAT = 0.55,
  CHEER_SECONDS = 0.7,
  CHEER_HOP = 0.5;

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
  /** 고양이의 지금 몸짓(천천히 따라간다) */
  private catPhase = 1;
  private catHeight = 0.55;
  private catBob = 0.07;
  private catAhead = 0;
  private catNod = 0;
  /** 한가한 몸짓(앉기·핥기·하품·앞질러 가기)과 그 자세(천천히 따라간다) */
  private readonly catIdle = createCatIdle();
  private readonly catRand: () => number;
  private catRoll = 0;
  private catTall = 1;
  private catTurn = 0;
  private catWag = 0;
  /** 한숨(꽝)·한 바퀴(찾음)가 남은 시간(초) */
  private sighLeft = 0;
  private cheerLeft = 0;
  /** 꼬리 반짝임: 간격(초 — 0 이면 없음)과 다음 반짝임까지(초) */
  private twinkleEvery = 0;
  private twinkleWait = 0;
  private twinkleLeft = 0;
  private tilt = 0;
  private pose: PoseFn | null = null;
  /** 뼈대 있는 몸(오기 전에는 null) */
  private rig: RigHandle | null = null;
  private readonly rigWaiting: ((rig: RigHandle) => void)[] = [];
  private readonly poseIn: PoseInput = {
    dt: 0,
    tot: 0,
    vy: 0,
    air: 0,
    fx: 0,
    time: 0,
    isReaching: false,
  };
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
      update: (f) => this.catFrame(f.dt),
      dispose: () => {},
    };
    const catRng = s.rng.fork("cat");
    this.catRand = () => catRng.next();
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

  /** 꽝을 열었다: 고양이가 한숨(납작) */
  catSigh() {
    this.sighLeft = SIGH_SECONDS;
    this.cheerLeft = 0;
  }

  /** 상자를 찾았다: 고양이가 한 바퀴 */
  catCheer() {
    this.cheerLeft = CHEER_SECONDS;
    this.sighLeft = 0;
  }

  /**
   * 고양이 꼬리의 반짝임 간격(초 — 0 이면 반짝이지 않는다). 숨은 상자가 가까울수록 빨라진다(뜨거워 차가워 — 어느 쪽인지는 알리지 않는다)
   */
  setCatTwinkle(every: number) {
    this.twinkleEvery = every;
    if (every > 0) this.twinkleWait = Math.min(this.twinkleWait, every);
  }

  /** 한 팔을 위로 든다(풍선 줄을 잡았다) · 내린다 */
  reachUp(on: boolean) {
    this.poseIn.isReaching = on;
  }

  /** 위로 든 손의 세계 자리(뼈대 있는 몸이 오기 전에는 머리 위쯤) */
  reachHand(out: THREE.Vector3): THREE.Vector3 {
    if (this.rig) return this.rig.reachHand(out);
    return out.copy(this.s.player.P).addScaledVector(this.s.player.p, 1);
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

  // 고양이의 몸짓: 낮게 축 늘어져 둥실 따라온다.
  // 한가하면 딴짓을 한다(내가 멈추면 앉아 꼬리를 흔들고, 오래 서 있으면 제 몸을 핥다 하품하고, 걷다가 가끔 앞질러 가서 돌아본다).
  // 고양이 모델에는 뼈대가 없어 귀·꼬리는 따로 못 움직인다 — 뛰는 빠르기·기울기·방향·납작함으로 대신한다
  private poseCat(time: number, dt: number) {
    const mood = CAT_FOLLOW,
      pl = this.s.player,
      k = ease(5, dt),
      isMoving = pl.tot > MOVING || pl.isHeld,
      isBusy = this.sighLeft > 0 || this.cheerLeft > 0,
      roll = this.catRand(),
      idle = CAT_IDLES[stepCatIdle(this.catIdle, dt, isMoving, isBusy, roll)],
      height = idle.height || mood.height,
      bob = idle.height ? 0.015 : mood.bob;
    if (this.sighLeft > 0) this.sighLeft -= dt;
    if (this.cheerLeft > 0) this.cheerLeft -= dt;
    // 꽝이면 한숨(납작하게 축), 찾으면 폴짝 뛰며 한 바퀴
    const isSighing = this.sighLeft > 0,
      cheered = this.cheerLeft > 0 ? 1 - this.cheerLeft / CHEER_SECONDS : 0,
      cheerTurn = cheered * Math.PI,
      cheerArc = Math.sin(cheerTurn),
      tall = isSighing ? SIGH_FLAT : idle.tall,
      nod = isSighing ? -0.35 : mood.nod + idle.nod;
    this.catHeight += (height - this.catHeight) * k;
    this.catBob += (bob - this.catBob) * k;
    this.catAhead += (idle.ahead - this.catAhead) * k;
    this.catNod += (nod - this.catNod) * k;
    this.catRoll += (idle.roll - this.catRoll) * k;
    this.catTall += (tall - this.catTall) * ease(9, dt);
    this.catTurn += (idle.turn - this.catTurn) * k;
    this.catWag += (idle.wag - this.catWag) * k;
    this.catPhase += dt * mood.rate;
    const wave = Math.sin(this.catPhase);
    const y = this.catHeight + wave * this.catBob + CHEER_HOP * cheerArc,
      z = CAT_BACK + this.catAhead;
    this.catPrim.position.set(CAT_SIDE, y, z);
    const C = this.catModel;
    if (!C) return;
    const wagPhase = time * 7,
      wag = Math.sin(wagPhase) * this.catWag,
      lickPhase = time * 10,
      lick = Math.sin(lickPhase) * idle.bob,
      spin = cheered * Math.PI * 2,
      base: number = C.userData.k,
      wide = base / Math.sqrt(this.catTall),
      tallScale = base * this.catTall;
    C.rotation.y = -Math.PI / 2 + this.catTurn + wag + spin;
    C.rotation.z = this.catNod + lick;
    C.rotation.x = this.catRoll;
    C.scale.set(wide, tallScale, wide);
  }

  // 고양이 모델이 라임 공 고양이를 따라 둥실, 곁의 작은 라임 빛. 꼬리(몸 뒤 아래)에서 때마다 빛 방울이 반짝인다
  private catFrame(dt: number) {
    this.catPrim.getWorldPosition(gp);
    this.s.fx.glow(gp, 1.8, 0.5);
    if (this.catModel) this.catModel.position.copy(this.catPrim.position);
    if (this.twinkleLeft > 0) {
      // 반짝: 꼬리 끝에서 작은 빛이 한 번 커졌다 꺼진다
      this.twinkleLeft -= dt;
      const pl = this.s.player,
        left = Math.max(0, this.twinkleLeft) / TWINKLE_SECONDS,
        size = TWINKLE_SIZE * (0.4 + 0.6 * left);
      gp.addScaledVector(pl.h, CAT_TAIL_BACK).addScaledVector(pl.p, CAT_TAIL_UP);
      this.s.fx.glow(gp, size, left);
    }
    if (this.twinkleEvery <= 0) return;
    this.twinkleWait -= dt;
    if (this.twinkleWait > 0) return;
    this.twinkleWait = this.twinkleEvery;
    this.twinkleLeft = TWINKLE_SECONDS;
  }
}
