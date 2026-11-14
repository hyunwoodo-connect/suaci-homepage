import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Hold } from "../models/library";
import type { Services } from "../services";
import { LIME, S } from "../settings";
import { clamp, FWD } from "../world/sphere";
import { AVATAR_COMPANION } from "./parts";
import type { PoseFn, PoseInput } from "./rig";
import { setupRig } from "./rig";

// 나: 자리(me)와 기울기(tiltG) 안에 몸. 뼈대 있는 아바타가 오기 전까지는 도형 몸과 라임 공 고양이가 대신 선다.
// 몸 자리는 Player.place() 가 정한 세계 자리(P)를 따라가고, 기울기·몸짓·크기는 여기서 정한다

/** 등에 다는 날개(날개 놀이기구가 만든다) */
interface BackWings {
  mine: THREE.Group;
}

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
  private tilt = 0;
  private pose: PoseFn | null = null;
  private readonly poseIn: PoseInput = { dt: 0, tot: 0, vy: 0, air: 0, fx: 0, time: 0 };

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
    this.catPrim.position.set(-0.95, 0.55, -0.45);
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
    setupRig(this.s, this, (pose) => {
      this.pose = pose;
    });
    if (!models.has(AVATAR_COMPANION)) return;
    const C = models.fit(AVATAR_COMPANION, 0.48, "h", { ownLime: true });
    C.rotation.y = -Math.PI / 2;
    this.me.add(C);
    models.swapWhenReady(AVATAR_COMPANION, [this.catPrim]);
    C.userData.uLime.value = 0.55; // 고양이는 어느 색에서도 라임
    this.catModel = C;
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
    const catPhase = f.time * 2.3 + 1;
    this.catPrim.position.y = 0.55 + Math.sin(catPhase) * 0.07;
    const targetScale = pl.bodyScale,
      scale = me.scale.x + (targetScale - me.scale.x) * ease(18, dt);
    me.scale.setScalar(scale);
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

  // 고양이 모델이 라임 공 고양이를 따라 둥실, 곁의 작은 라임 빛
  private catFrame() {
    this.catPrim.getWorldPosition(gp);
    this.s.fx.glow(gp, 1.8, 0.5);
    if (this.catModel) this.catModel.position.copy(this.catPrim.position);
  }
}
