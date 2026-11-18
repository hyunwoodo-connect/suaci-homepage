import * as THREE from "three";

import type { Hold } from "../models/library";
import type { Services } from "../services";
import { S } from "../settings";
import { UP } from "../world/sphere";
import type { PropSpec } from "./findTuning";
import { FIND } from "./findTuning";
import { openPose } from "./opening";
import { STAGE } from "./openTuning";
import type { Hull } from "./outline";
import { addHull } from "./outline";
import type { PickTarget } from "./picker";
import { Ribbons } from "./ribbons";
import { sphereAt, startPoint } from "./spots";

// 후보 물건: 상자가 들어갈 수 있는 물건들(찻잔·바구니·쿠키 단지·화분·선물 더미). 넷에만 상자가 있고 나머지는 꽝이다.
//   물건마다 라임 리본이 달려 있다 — 리본 달린 것만 열어 볼 수 있다(조각 03). 리본은 바람에 살랑이고,
//   내가 candidate.wiggleReach 안에 들어오면 쫑긋 튀며 물건이 한 번 꿈틀한다. 눌릴 거리가 되면 물건에 흰 테두리가 켜진다
//   누르면 두근(덜컹 세 번) 뒤에 팡 아니면 푸슉 — 몸짓은 opening 이 셈한다. 상자가 든 물건은 내가 가까이 오면 바스락 흔들린다(뜨거워 차가워)
//   열어 본 꽝은 리본이 풀려 늘어지고 그 판에 다시 눌리지 않는다. 찾은 물건은 리본이 다시 묶이고 흰 하트가 얹힌다
// 무리(같은 물건 넷 이상)·낱개·높은 곳(쌓아 올린 탑 꼭대기, 통통 구름 위) 세 갈래 — 자리는 hideseek.data.json 의 props.
// 물건 속으로는 못 들어가고(막힌다), 위에서 내려오면 꼭대기에 올라선다

/** 후보 물건 하나 */
export interface Candidate {
  spec: PropSpec;
  /** 자리(단위 벡터) · 물건 바닥의 높이(m, 행성 겉에서) · 물건의 키(m) · 뚜껑(몸통 윗면)의 높이(m, 바닥에서 — 상자가 여기서 내민다) · 반너비(m) */
  v: THREE.Vector3;
  base: number;
  tall: number;
  lid: number;
  wide: number;
  /** 발치의 반너비(m — 탑은 밑동의 가장 굵은 칸, 그 밖에는 반너비와 같다). 곁에 무엇을 세울 때 이만큼 비킨다 */
  foot: number;
  /** 속에 든 상자의 크기 배수(물건 옆으로 삐져나오지 않게) */
  fit: number;
  /** 찾았다(리본에 흰 하트가 얹힌다) */
  isFound: boolean;
  /** 이 판에 열어 봤다(꽝 — 리본이 풀렸다. 다시 눌리지 않고 상자도 다시 들어가지 않는다) */
  isOpened: boolean;
}

/** 물건 하나의 화면 쪽(틀과 몸짓) */
interface Shown {
  c: Candidate;
  root: THREE.Group;
  /** 움직이는 몸(꼭대기 물건 — 탑의 밑은 가만히 있다) */
  body: THREE.Group;
  /** 발밑 땅 높이(m) · 몸통이 막는 반지름(m — 탑은 밑동의 가장 굵은 칸까지) */
  ground: number;
  core: number;
  isNear: boolean;
  wiggleT: number;
  /** 바스락: 남은 시간(초)과 세기(1 이 warm.rustleDegrees) */
  rustleT: number;
  rustleK: number;
  /** 리본 번호 */
  bow: number;
  /** 눌릴 거리일 때 켜지는 흰 테두리(모델이 온 뒤에 생긴다) */
  hull: Hull | null;
  /** 열어 보는 중: 누른 때부터(초, 아니면 -1)와 결과 */
  openT: number;
  openHit: boolean;
}

/** 다시 꿈틀하려면 이만큼(m) 더 멀어졌다 와야 한다 · 바스락 한 번의 길이(초)·빠르기(rad/s) · 혼자 살짝 떨 때의 세기 */
const REARM = 2,
  RUSTLE_SECONDS = 0.55,
  RUSTLE_RATE = 46,
  TREMBLE = 0.4;
/** 이보다 멀면(m, 물건 가장자리에서) 몸짓도 부딪힘도 보지 않는다 */
const FAR = 16;
/** 몸통이 막는 반지름(반너비의 몫) · 꼭대기에서 이만큼(m) 아래까지는 올라선 것으로 친다 */
const BODY_SHARE = 0.8,
  STEP_UP = 1;
/** 윗면이 열린 물건(뚜껑 높이가 키의 이 몫 이상 — 찻잔)은 리본을 가운데가 아니라 가장자리(반너비의 이 몫)에 단다 */
const OPEN_TOP = 0.99,
  RIM_SHARE = 0.86;
/** 눌릴 거리의 물건에 켜지는 흰 테두리 굵기(px — 물건 모두가 같은 값을 본다) */
const OUTLINE = { value: STAGE.outlinePx };
/** 색 없이 온 모델에 칠할 때: 회색 텍스처(밝기 반쯤)에 곱하는 색을 이만큼 밝힌다 */
const PAINT_GAIN = 1.7;
/** 누르는 자리의 반너비·반높이(물건 크기의 몫) */
const PICK_SHARE = 0.5;

const at = new THREE.Vector3(),
  q = new THREE.Quaternion(),
  yawQ = new THREE.Quaternion(),
  toStart = new THREE.Vector3();

/** 후보 물건 전체 */
export class Props {
  readonly list: Candidate[] = [];
  private readonly shown: Shown[] = [];
  private readonly ribbons: Ribbons;

  /** hub: 무대 마을 중심 */
  constructor(
    private readonly s: Services,
    hub: THREE.Vector3,
    rand: () => number,
  ) {
    this.ribbons = new Ribbons(s);
    for (const kind of Object.values(FIND.kinds))
      if (kind.paint) this.paint(kind.model, kind.paint);
    for (const spec of FIND.props) this.build(spec, hub, rand);
  }

  /** 판 시작·끝: 리본을 모두 다시 묶고 몸짓을 그친다 */
  reset() {
    this.ribbons.reset();
    for (const o of this.shown) {
      o.c.isFound = o.c.isOpened = false;
      o.wiggleT = o.openT = -1;
      o.rustleT = 0;
      o.rustleK = 1;
      o.isNear = false;
      // 멀리 있는 물건은 몸짓을 다시 셈하지 않으므로, 하던 몸짓(부푼 크기·기울기)을 여기서 푼다
      o.body.scale.set(1, 1, 1);
      o.body.rotation.z = 0;
      if (o.hull) o.hull.visible = false;
    }
  }

  /** spec 의 물건 */
  of(spec: PropSpec): Candidate {
    return this.list.find((c) => c.spec === spec)!;
  }

  /** 물건 가운데의 세계 자리 */
  center(c: Candidate, out: THREE.Vector3): THREE.Vector3 {
    const radius = S.R + c.base + c.tall / 2;
    return out.copy(c.v).multiplyScalar(radius);
  }

  /** 나와의 거리(m — 물건 가운데까지) */
  distance(c: Candidate): number {
    return this.center(c, at).distanceTo(this.s.player.P);
  }

  /**
   * 지금 누르면 닿는가: candidate.tapReach 안이고, 높은 곳 물건이면 내 몸이 그 바닥 가까이(candidate.highBelow)까지 올라와 있어야 한다
   * (밑에서 눌러서는 안 된다 — 버섯이나 통통 구름으로 올라가서 누른다)
   */
  canReach(c: Candidate): boolean {
    const C = FIND.candidate;
    if (this.distance(c) > C.tapReach) return false;
    if (c.spec.cls !== "high") return true;
    const mine = this.s.player.P.length() - S.R;
    return mine >= c.base - C.highBelow;
  }

  /**
   * 누름이 걸리는 것: 후보 물건 모두. 열어 봤거나 찾은 물건도 넣는다 — 눌러도 아무 일 없지만,
   * 빼 버리면 그 뒤에 겹쳐 보이는 물건이 대신 열린다. 열리는지·닿는지는 누른 쪽(숨바꼭질)이 본다
   */
  targets(): PickTarget<Candidate>[] {
    const out: PickTarget<Candidate>[] = [];
    for (const c of this.list) {
      const spot = new THREE.Vector3(),
        center = this.center(c, spot),
        halfH = c.tall * PICK_SHARE;
      out.push({ item: c, center, halfH, halfW: c.wide });
    }
    return out;
  }

  /** 멀리서 눌렀다: 리본만 까딱 흔들린다 */
  flick(c: Candidate) {
    const o = this.shownOf(c);
    this.ribbons.flick(o.bow);
  }

  /** 열어 보기 시작: 리본이 팽팽히 당겨진다 */
  startOpen(c: Candidate) {
    const o = this.shownOf(c);
    o.openT = 0;
    o.wiggleT = -1;
    o.rustleT = 0;
    this.ribbons.setTaut(o.bow, true);
  }

  /** 열어 보는 중: 누른 때부터 t 초(hit: 찾음·꽝 — 갈리기 전에는 보지 않는다) */
  setOpen(c: Candidate, t: number, hit: boolean) {
    const o = this.shownOf(c);
    o.openT = t;
    o.openHit = hit;
  }

  /** 갈렸다: 찾았으면 리본이 위로 튕겨 풀리고, 꽝이면 힘없이 풀려 늘어진다 */
  splitOpen(c: Candidate, hit: boolean) {
    const o = this.shownOf(c);
    if (hit) this.ribbons.pop(o.bow);
    else this.ribbons.setLook(o.bow, "undone");
  }

  /** 열어 보기 끝. 꽝이면 열어 본 것으로 남는다(리본이 풀린 채 — 그 판에 다시 눌리지 않는다) */
  endOpen(c: Candidate, hit: boolean) {
    this.shownOf(c).openT = -1;
    if (!hit) c.isOpened = true;
  }

  /** 찾은 물건: 리본이 다시 묶이고 매듭 위에 흰 하트가 얹힌다 */
  tieHeart(c: Candidate) {
    const o = this.shownOf(c);
    this.ribbons.setLook(o.bow, "heart");
  }

  /** 바스락: 잠깐 흔들린다(상자가 든 물건 — 내가 가까이 있을 때) */
  rustle(c: Candidate) {
    const o = this.shownOf(c);
    o.rustleT = RUSTLE_SECONDS;
    o.rustleK = 1;
  }

  /** 혼자 살짝 떤다(패턴 A — 같은 물건 무리에서 하나만 다르다) */
  tremble(c: Candidate) {
    const o = this.shownOf(c);
    if (o.rustleT > 0) return;
    o.rustleT = RUSTLE_SECONDS;
    o.rustleK = TREMBLE;
  }

  /** 내 발밑의 올라설 곳(물건 꼭대기)의 높이(m, 땅에서 — 없으면 0) */
  floorUnder(): number {
    const p = this.s.player.p;
    let floor = 0;
    for (const o of this.shown) {
      const c = o.c,
        flat = p.angleTo(c.v) * S.R;
      if (flat >= c.wide * BODY_SHARE) continue;
      const top = c.base + c.lid - o.ground;
      floor = Math.max(floor, top);
    }
    return floor;
  }

  /** 한 번 꿈틀한다(이사 온 상자가 쏙 들어왔다) */
  bump(c: Candidate) {
    this.shownOf(c).wiggleT = 0;
  }

  /** 찾았다: 더는 꿈틀하지도 눌리지도 않는다(리본의 하트는 상자가 줄로 떠날 때 tieHeart 가 얹는다) */
  markFound(c: Candidate) {
    c.isFound = true;
  }

  /** 한 프레임: 가까이 오면 쫑긋·꿈틀, 눌릴 거리면 흰 테두리, 하던 몸짓, 속으로 못 들어가게 막고 위에서 오면 올려 세운다 */
  update(dt: number, isRound: boolean, time: number) {
    const { player } = this.s,
      C = FIND.candidate;
    for (const o of this.shown) {
      const c = o.c,
        flat = player.p.angleTo(c.v) * S.R,
        isIdle = o.wiggleT < 0 && o.openT < 0 && o.rustleT <= 0,
        isLive = isRound && !c.isFound && !c.isOpened;
      if (flat > c.wide + FAR) {
        o.isNear = false;
        if (o.hull) o.hull.visible = false;
        if (isIdle) continue;
      }
      const dist = this.distance(c);
      // 판이 도는 동안, 리본이 묶여 있는 물건만 쫑긋·꿈틀한다
      if (isLive && !o.isNear && dist <= C.wiggleReach) {
        o.isNear = true;
        if (o.openT < 0) o.wiggleT = 0;
        this.ribbons.perk(o.bow);
      } else if (o.isNear && dist > C.wiggleReach + REARM) o.isNear = false;
      // 흰 테두리: 지금 누르면 닿는 것만(테두리가 켜진 것만 눌린다)
      if (o.hull) o.hull.visible = isLive && o.openT < 0 && this.canReach(c);
      this.pose(o, dt);
      if (!player.held) this.collide(o, flat);
    }
    this.ribbons.update(dt, time);
  }

  dispose() {
    for (const o of this.shown) {
      o.hull?.dispose();
      o.root.removeFromParent();
    }
    this.ribbons.dispose();
  }

  /* ─── 내부 ─────────────────────────── */

  // 색 없이(회색 텍스처로) 온 모델을 칠한다: 재질 색을 곱한다(그 모델을 쓰는 물건 모두 — 재질을 같이 쓴다)
  private paint(key: string, hex: string) {
    const color = new THREE.Color(hex).multiplyScalar(PAINT_GAIN);
    this.s.models.when(key, (root) => {
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const material: THREE.MeshStandardMaterial = o.material;
        material.color.copy(color);
      });
    });
  }

  private shownOf(c: Candidate): Shown {
    return this.shown.find((o) => o.c === c)!;
  }

  // 물건 하나를 놓는다: 높은 곳이면 밑에 같은 물건을 쌓거나(탑) 정해 둔 높이(통통 구름 위)에 올린다
  private build(spec: PropSpec, hub: THREE.Vector3, rand: () => number) {
    const { models, terrain, scene } = this.s,
      kind = FIND.kinds[spec.kind];
    const spot = new THREE.Vector3(),
      v = sphereAt(spot, hub, spec.x, spec.y).clone(),
      ground = terrain.groundAt(v),
      root = new THREE.Group(),
      body = new THREE.Group();
    models.need(kind.model);
    let lift = spec.base ?? 0,
      widest = 0;
    for (const size of spec.under) {
      const part = models.fit(kind.model, size, kind.by),
        tall = part.userData.hh * 2;
      widest = Math.max(widest, part.userData.rw);
      part.position.y = lift + part.userData.hh;
      part.rotation.y = rand() * Math.PI * 2;
      root.add(part);
      lift += tall * kind.nest;
    }
    const hold: Hold = models.fit(kind.model, spec.size, kind.by);
    hold.position.y = hold.userData.hh;
    body.position.y = lift;
    body.add(hold);
    root.add(body);
    q.setFromUnitVectors(UP, v);
    const yaw = rand() * Math.PI * 2;
    yawQ.setFromAxisAngle(UP, yaw);
    root.quaternion.copy(q).multiply(yawQ);
    const radius = S.R + ground;
    root.position.copy(v).multiplyScalar(radius);
    scene.add(root);
    // 속에 든 상자의 크기: 그 종류의 기본 크기일 때의 배수를 이 물건 크기에 맞춘다
    const fitted = (kind.fit * spec.size) / kind.size;
    const c: Candidate = {
      spec,
      v,
      base: ground + lift,
      tall: hold.userData.hh * 2,
      lid: hold.userData.hh * 2 * kind.lid,
      wide: hold.userData.rw,
      foot: Math.max(widest, hold.userData.rw),
      fit: Math.min(1, fitted),
      isFound: false,
      isOpened: false,
    };
    this.list.push(c);
    const girth = Math.max(widest, c.wide),
      shown: Shown = {
        c,
        root,
        body,
        ground,
        core: girth * BODY_SHARE,
        isNear: false,
        wiggleT: -1,
        rustleT: 0,
        rustleK: 1,
        bow: this.tieRibbon(c, root, body, hub, kind.lid),
        hull: null,
        openT: -1,
        openHit: false,
      };
    this.shown.push(shown);
    // 흰 테두리는 모델이 온 뒤에 그 모양대로 붙인다(꼭대기 물건에만 — 탑의 밑은 누르는 것이 아니다)
    models.when(kind.model, () => {
      shown.hull = addHull(hold, 0xffffff, OUTLINE);
    });
  }

  // 리본을 단다: 너비는 물건 너비의 ribbon.scale. 뚜껑·손잡이가 있는 물건은 맨 위 가운데, 윗면이 열린 물건(찻잔)은 가장자리에 —
  // 가운데는 상자가 귀를 내미는 자리라 비워 둔다. 출발 자리 쪽을 보게 단다(다가갈 때 먼저 보인다)
  private tieRibbon(
    c: Candidate,
    root: THREE.Object3D,
    body: THREE.Object3D,
    hub: THREE.Vector3,
    lidShare: number,
  ): number {
    const start = startPoint(),
      width = STAGE.ribbon.scale * c.wide * 2;
    sphereAt(toStart, hub, start.x, start.y);
    // 출발 자리 쪽(접선)을 물건의 좌표로 옮겨 각을 잰다
    const up = toStart.dot(c.v);
    toStart.addScaledVector(c.v, -up);
    q.copy(root.quaternion).invert();
    toStart.applyQuaternion(q);
    const angle = Math.atan2(toStart.z, toStart.x),
      isOpenTop = lidShare >= OPEN_TOP,
      rim = isOpenTop ? c.wide * RIM_SHARE : 0,
      height = isOpenTop ? c.lid : c.tall,
      x = Math.cos(angle) * rim,
      z = Math.sin(angle) * rim;
    at.set(x, height, z);
    // 리본의 앞(+x)이 그 각을 보게: y 축으로 -angle 돌리면 +x 가 (cos, 0, sin) 으로 간다
    return this.ribbons.add(body, at, width, -angle);
  }

  // 몸짓을 몸에 입힌다: 열어 보는 중이면 그 몸짓(opening)만. 아니면 꿈틀(한 번 늘었다 줄기) · 바스락(좌우로 떨기)
  private pose(o: Shown, dt: number) {
    const C = FIND.candidate,
      W = FIND.warm;
    if (o.openT >= 0) {
      const open = openPose(o.openT, o.openHit, STAGE.open),
        high = open.size * open.tall;
      o.body.scale.set(open.size, high, open.size);
      o.body.rotation.z = open.lean;
      return;
    }
    let tall = 1,
      lean = 0;
    if (o.wiggleT >= 0) {
      o.wiggleT += dt;
      const u = o.wiggleT / C.wiggleSeconds,
        turn = u * Math.PI * 2;
      tall += C.wiggleScale * Math.sin(turn);
      if (u >= 1) o.wiggleT = -1;
    }
    if (o.rustleT > 0) {
      o.rustleT -= dt;
      const left = Math.max(0, o.rustleT) / RUSTLE_SECONDS,
        phase = o.rustleT * RUSTLE_RATE,
        swing = THREE.MathUtils.degToRad(W.rustleDegrees) * o.rustleK;
      lean = Math.sin(phase) * swing * left;
    }
    const wide = 1 + (1 - tall) * 0.6;
    o.body.scale.set(wide, tall, wide);
    o.body.rotation.z = lean;
  }

  // 몸통은 막히고(쌓은 탑은 밑동부터), 위에서 내려오면 꼭대기에 올라선다
  private collide(o: Shown, flat: number) {
    const { player } = this.s,
      c = o.c;
    if (flat > o.core + 1) return;
    const top = c.base + c.lid - o.ground;
    if (player.air >= top - STEP_UP) {
      if (flat < c.wide * BODY_SHARE) player.keepAbove(top);
      return;
    }
    player.block(c.v, o.core, top);
  }
}
