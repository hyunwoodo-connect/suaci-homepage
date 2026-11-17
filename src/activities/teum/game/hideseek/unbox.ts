import * as THREE from "three";

import { ease } from "../core/frame";
import type { Hold } from "../models/library";
import type { Services } from "../services";
import { S } from "../settings";
import type { HideFx } from "./effects";
import { LimeBox } from "./limebox";
import type { Content } from "./tuning";
import { HIDE } from "./tuning";

// 언박싱(최소한만): 찾은 상자들(넷을 다 찾았으면 보너스 상자까지)이 아바타 앞에 한 줄로 서고, 카메라가 앞으로 돌아 그 줄과 아바타를 비춘다.
// 화면을 누르면 지금 상자(왼쪽부터 차례로)가 한 번에 들썩, 두 번에 열린다. 내용물 다섯 가지:
//   꽝 — 상자 속 상자 속 상자(셋째는 비었다) · 라임 한 알이 굴러 나와 통통 튀며 도망간다 · 비눗방울만 한가득
//   일어나는 일 — 60초 동안 아바타가 4배로 커진다 · 고래가 내 쪽으로 와서 천천히 지나간다(올라탈 수 있게)
// 다 열면 카메라가 돌아오고 손을 놓아 준다(커진 몸·고래는 그 뒤로도 이어진다).
// 무엇이 꽝이고 무엇이 일어나는 일인지, 꽝이 몇 개까지인지, 커지는 배수·시간은 hideseek.data.json 의 unbox

/** 상자 사이(m)·아바타 앞으로 줄 선 거리(m) */
const ROW_GAP = 1.05,
  ROW_AHEAD = 2.6;
/** 줄 서러 가는 빠르기(m/s) */
const ROW_SPEED = 7;
/** 연 뒤 다음 상자를 열 수 있을 때까지(초)·마지막을 연 뒤 끝내기까지(초) */
const NEXT_WAIT = 0.6,
  END_WAIT = 2.2;
/** 상자 속 상자: 크기 배수와 다음이 나오기까지(초) */
const NESTED_SCALES = [0.62, 0.38],
  NESTED_STEP = 0.85;
/** 굴러 나가는 라임: 빠르기(m/s)·사는 시간(초)·크기(m) */
const LIME_SPEED = 5,
  LIME_LIFE = 3.4,
  LIME_SIZE = 0.5;
/** 비눗방울 수·피는 시간(초)·사는 시간(초) */
const BUBBLE_N = 44,
  BUBBLE_SPREAD = 1.4,
  BUBBLE_LIFE = 5;
/** 커지는 배수·시간(초) */
const GIANT_SIZE = HIDE.unbox.giantSize,
  GIANT_TIME = HIDE.unbox.giantSeconds;

/** 언박싱이 쓰는 것 */
export interface UnboxLinks {
  /** 아바타 크기를 바꾼다(1 이 그대로) */
  grow(k: number): void;
  /** 고래를 부른다(over: 지나갈 자리, dir: 지나갈 쪽) */
  callWhale(over: THREE.Vector3, dir: THREE.Vector3): void;
  /** 언박싱 동안 고래가 나를 태우지 않게 */
  keepWhaleOff(): void;
}

/** 굴러 나가는 라임 */
interface Runaway {
  t: number;
  v: THREE.Vector3;
  dir: THREE.Vector3;
  base: number;
}

/** 비눗방울 하나 */
interface Bubble {
  m: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  t: number;
  life: number;
  vel: THREE.Vector3;
  size: number;
  wob: number;
  on: boolean;
}

const right = new THREE.Vector3(),
  slot = new THREE.Vector3(),
  aim = new THREE.Vector3(),
  camPos = new THREE.Vector3(),
  camLook = new THREE.Vector3(),
  rigLook = new THREE.Vector3(),
  rollAxis = new THREE.Vector3(),
  tmp = new THREE.Vector3();

/**
 * 찾은 상자 found 개(찾은 차례)와 보너스 상자(hasBonus — 3분 안에 넷을 다 찾았을 때만, 맨 끝)의 내용물.
 * 꽝은 한 판에 dudCount 개까지, 그리고 찾은 상자의 절반까지만(한둘만 찾고 진 판이 꽝만 까지 않게). 나머지와 보너스 상자는 일어나는 일.
 * 꽝·일어나는 일은 저마다 섞어 차례로 돌려 쓰고(가짓수보다 상자가 많으면 겹친다), 찾은 상자끼리는 섞는다
 */
export function dealContents(found: number, hasBonus: boolean, rand: () => number): Content[] {
  const { duds, happenings, dudCount } = HIDE.unbox;
  const dudPool = shuffle([...duds], rand),
    happyPool = shuffle([...happenings], rand),
    halfFound = found / 2,
    half = Math.floor(halfFound),
    dudN = Math.min(dudCount, half);
  const out: Content[] = [];
  for (let i = 0; i < found; i++) {
    const isDud = i < dudN,
      pool = isDud ? dudPool : happyPool,
      at = isDud ? i : i - dudN,
      content = pool[at % pool.length];
    out.push(content);
  }
  shuffle(out, rand);
  if (!hasBonus) return out;
  const bonus = happyPool[(found - dudN) % happyPool.length];
  return [...out, bonus];
}

/** 언박싱 */
export class Unboxing {
  /** 지금 아바타 앞에서 여는 중인가(끝나면 false) */
  active = false;
  private boxes: LimeBox[] = [];
  private contents: Content[] = [];
  private current = 0;
  private taps = 0;
  private wait = 0;
  private endWait = -1;
  private camK = 0;
  private onDone: () => void = () => {};
  private readonly minis: LimeBox[];
  private nestedT = -1;
  private nestedStep = 0;
  private readonly nestedAt = new THREE.Vector3();
  private nestedA = 0;
  private readonly lime: Hold | null;
  private runaway: Runaway | null = null;
  private readonly bubbles: Bubble[] = [];
  private bubbleGeo: THREE.SphereGeometry;
  private giantT = 0;

  constructor(
    private readonly s: Services,
    private readonly links: UnboxLinks,
    private readonly fx: HideFx,
    private readonly rand: () => number,
  ) {
    const { models, scene } = s;
    this.minis = NESTED_SCALES.map((k) => {
      const box = new LimeBox(models, scene, k, false, rand);
      // 겉 상자가 줄 설 때의 크기로 서 있으니 속 상자도 같은 배수로 줄인다(속 상자가 더 크면 안 된다)
      box.setSize(HIDE.line.scale, true);
      box.setLongEars(false);
      box.visible = false;
      return box;
    });
    this.lime = models.has("lime") ? models.fit("lime", LIME_SIZE, "h") : null;
    if (this.lime) {
      this.lime.visible = false;
      scene.add(this.lime);
    }
    this.bubbleGeo = new THREE.SphereGeometry(1, 16, 12);
    for (let i = 0; i < BUBBLE_N; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xeafcff,
        emissive: 0x9fd8ff,
        emissiveIntensity: 0.25,
        roughness: 0.08,
        metalness: 0,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      });
      const m = new THREE.Mesh(this.bubbleGeo, mat);
      m.visible = false;
      scene.add(m);
      const bubble: Bubble = {
        m,
        t: 0,
        life: 1,
        vel: new THREE.Vector3(),
        size: 1,
        wob: 0,
        on: false,
      };
      this.bubbles.push(bubble);
    }
  }

  /** 상자들(왼쪽부터 여는 차례)을 아바타 앞 한 줄에 바로 세운다(가림막 뒤에서) */
  arrange(boxes: LimeBox[]) {
    const h = this.s.player.h as THREE.Vector3;
    boxes.forEach((box, i) => {
      this.slotOf(i, boxes.length, slot);
      const ground = this.s.terrain.groundAt(slot);
      box.put(slot, ground, h);
      box.setPeek(null);
    });
  }

  /** 상자들(왼쪽부터 여는 차례)을 아바타 앞에 세우고 언박싱을 시작한다. 다 열면 onDone */
  start(boxes: LimeBox[], contents: Content[], onDone: () => void) {
    this.boxes = boxes;
    this.contents = contents;
    this.current = 0;
    this.taps = 0;
    this.wait = 0.9;
    this.endWait = -1;
    this.active = true;
    this.onDone = onDone;
    for (const b of boxes) b.setPeek(null);
  }

  /** 화면을 눌렀다: 지금 상자가 한 번에 들썩, 두 번에 열린다 */
  tap() {
    if (!this.active || this.wait > 0 || this.current >= this.boxes.length) return;
    const box = this.boxes[this.current];
    const { events, fx } = this.s;
    if (this.taps === 0) {
      this.taps = 1;
      box.jiggle();
      events.emit("hideBoxShaken", {});
      return;
    }
    const content = this.contents[this.current];
    box.pop();
    const at = box.center(tmp);
    fx.burst(at, 18, 9);
    events.emit("hideBoxOpened", { content });
    this.play(content, box);
    this.current++;
    this.taps = 0;
    this.wait = NEXT_WAIT;
    if (this.current >= this.boxes.length) this.endWait = END_WAIT;
  }

  /** 한 프레임: 줄 세우기·카메라·내용물 */
  update(dt: number, time: number) {
    if (this.active) this.showcase(dt);
    const camEase = ease(3, dt),
      camTarget = this.active ? 1 : 0;
    this.camK += (camTarget - this.camK) * camEase;
    if (this.camK > 0.002) this.aimCamera();
    this.playNested(dt, time);
    this.playLime(dt, time);
    this.playBubbles(dt);
    if (this.giantT > 0) {
      this.giantT -= dt;
      if (this.giantT <= 0) this.links.grow(1);
    }
  }

  /** 커진 몸을 되돌린다(한 판 더 — 꼭꼭 숨어라 줄을 큰 몸이 가리지 않게). 지나가는 고래는 그대로 간다 */
  resetHappenings() {
    if (this.giantT <= 0) return;
    this.giantT = 0;
    this.links.grow(1);
  }

  /** 카메라를 바로 놓는다(꾸미기 씬이 열리면 씬이 카메라를 쓴다) */
  dropCamera() {
    this.camK = 0;
  }

  dispose() {
    for (const b of this.minis) b.dispose();
    this.lime?.removeFromParent();
    for (const b of this.bubbles) {
      b.m.removeFromParent();
      b.m.material.dispose();
    }
    this.bubbleGeo.dispose();
  }

  /* ─── 내부 ─────────────────────────── */

  // 아바타 앞에 한 줄로 세운다(왼쪽부터 여는 차례). 마지막을 열고 조금 뒤에 끝낸다
  private showcase(dt: number) {
    const { player } = this.s;
    this.links.keepWhaleOff();
    if (this.wait > 0) this.wait -= dt;
    const h = player.h as THREE.Vector3;
    const n = this.boxes.length;
    for (let i = 0; i < n; i++) {
      const box = this.boxes[i];
      if (!box.visible || box.isPopping) continue;
      this.slotOf(i, n, slot);
      const left = box.stepToward(slot, ROW_SPEED, dt);
      const walking = left > 0.05 ? 1 : 0;
      box.setScurry(walking);
      box.a = this.s.terrain.groundAt(box.v);
      if (left <= 0.05) box.faceTo(h);
    }
    if (this.endWait >= 0) {
      this.endWait -= dt;
      if (this.endWait <= 0) {
        this.active = false;
        this.endWait = -1;
        this.onDone();
      }
    }
  }

  // 줄 i 번째 자리(아바타 앞 ROW_AHEAD m, 카메라에서 봐서 왼쪽부터)
  private slotOf(i: number, n: number, out: THREE.Vector3): THREE.Vector3 {
    const { player } = this.s,
      p = player.p,
      h = player.h;
    right.crossVectors(p, h).normalize();
    const mid = (n - 1) / 2,
      across = (i - mid) * ROW_GAP,
      aheadArc = ROW_AHEAD / S.R,
      acrossArc = across / S.R;
    return out.copy(p).addScaledVector(h, aheadArc).addScaledVector(right, acrossArc).normalize();
  }

  // 카메라: 아바타 앞(얼굴 쪽)에서 상자 줄과 아바타를 비춘다. 세로 화면은 줄 너비가 다 들게 멀리
  private aimCamera() {
    const { player, camera } = this.s,
      cam = camera.camera,
      p = player.p,
      h = player.h;
    const vfov = THREE.MathUtils.degToRad(cam.fov),
      halfFov = vfov / 2,
      halfTan = Math.tan(halfFov),
      hfovTan = halfTan * cam.aspect;
    const n = Math.max(1, this.boxes.length),
      rowHalf = ((n - 1) / 2) * ROW_GAP + 0.8;
    const growth = this.giantT > 0 ? GIANT_SIZE : 1,
      tall = 1.6 * growth;
    const byWidth = (rowHalf * 1.15) / hfovTan,
      byHeight = tall / halfTan;
    const dist = Math.max(5.5, byWidth, byHeight);
    const ground = S.R + player.gNow;
    aim.copy(p).multiplyScalar(ground);
    const camAhead = ROW_AHEAD + dist,
      camUp = 1.6 + dist * 0.18,
      lookAhead = ROW_AHEAD * 0.55,
      lookUp = 0.7 * growth;
    camPos.copy(aim).addScaledVector(h, camAhead).addScaledVector(p, camUp);
    camLook.copy(aim).addScaledVector(h, lookAhead).addScaledVector(p, lookUp);
    // 따라가는 카메라가 보던 곳(10m 앞)과 섞는다
    cam.getWorldDirection(rigLook);
    rigLook.multiplyScalar(10).add(cam.position);
    const k = this.camK;
    cam.position.lerp(camPos, k);
    rigLook.lerp(camLook, k);
    cam.up.copy(p);
    cam.lookAt(rigLook);
  }

  // 내용물을 펼친다
  private play(content: Content, box: LimeBox) {
    const { player } = this.s;
    const at = box.center(tmp);
    switch (content) {
      case "nested":
        this.nestedT = 0;
        this.nestedStep = 0;
        this.nestedAt.copy(box.v);
        this.nestedA = box.a;
        this.openMini(0, box.f);
        break;
      case "lime":
        this.rollLime(box);
        break;
      case "bubbles":
        this.blowBubbles(at);
        break;
      case "giant":
        this.giantT = GIANT_TIME;
        this.links.grow(GIANT_SIZE);
        break;
      case "whale": {
        const over = player.p.clone(),
          dir = player.h.clone();
        this.links.callWhale(over, dir);
        break;
      }
    }
  }

  // 상자 속 상자: 작은 것이 튀어나오고, 조금 뒤 그것도 열려 더 작은 것이, 셋째는 비었다
  private openMini(i: number, face: THREE.Vector3) {
    const box = this.minis[i];
    box.put(this.nestedAt, this.nestedA, face);
    box.hop();
  }

  private playNested(dt: number, time: number) {
    for (const b of this.minis) b.update(dt, time);
    if (this.nestedT < 0) return;
    this.nestedT += dt;
    if (this.nestedT < NESTED_STEP) return;
    this.nestedT = 0;
    const box = this.minis[this.nestedStep];
    box.pop();
    const at = box.center(tmp);
    this.s.fx.burst(at, 8, 5);
    this.nestedStep++;
    const isLast = this.nestedStep >= this.minis.length;
    this.s.events.emit("hideNestedPopped", { empty: isLast });
    if (isLast) {
      // 셋째는 비었다 — 작은 연기만
      this.fx.sneeze(at, this.rand);
      this.nestedT = -1;
      return;
    }
    this.openMini(this.nestedStep, box.f);
  }

  // 라임 한 알: 상자 자리에서 옆(오른쪽 또는 왼쪽)으로 통통 튀며 굴러 도망간다
  private rollLime(box: LimeBox) {
    const L = this.lime;
    if (!L) return;
    const p = this.s.player.p;
    right.crossVectors(p, this.s.player.h).normalize();
    const sideRoll = this.rand();
    if (sideRoll < 0.5) right.negate();
    this.runaway = { t: 0, v: box.v.clone(), dir: right.clone(), base: box.a };
    L.visible = true;
  }

  private playLime(dt: number, time: number) {
    const r = this.runaway,
      L = this.lime;
    if (!r || !L) return;
    r.t += dt;
    if (r.t > LIME_LIFE) {
      L.visible = false;
      this.runaway = null;
      return;
    }
    const step = (LIME_SPEED * dt) / S.R;
    rollAxis.crossVectors(r.v, r.dir).normalize();
    r.v.applyAxisAngle(rollAxis, step).normalize();
    const radial = r.dir.dot(r.v);
    r.dir.addScaledVector(r.v, -radial).normalize();
    // 튀는 높이는 점점 낮아지고, 끝에 가서 작아지며 사라진다
    const fade = 1 - r.t / LIME_LIFE,
      bouncePhase = r.t * 7,
      wave = Math.sin(bouncePhase),
      bounce = Math.abs(wave) * 0.9 * fade,
      fadeOut = fade * 4,
      shrink = Math.min(1, fadeOut);
    const ground = this.s.terrain.groundAt(r.v);
    const radius = S.R + ground + LIME_SIZE * 0.5 + bounce;
    L.position.copy(r.v).multiplyScalar(radius);
    const rolled = time * 9,
      size = L.userData.k * shrink;
    L.quaternion.setFromAxisAngle(rollAxis, rolled);
    L.scale.setScalar(size);
  }

  // 비눗방울: 상자 자리에서 1.4초 동안 한가득 올라간다
  private blowBubbles(at: THREE.Vector3) {
    // at 은 돌려 쓰는 벡터일 수 있다 — 위쪽은 따로 복사해 둔다
    const up = at.clone().normalize();
    let delay = 0;
    for (const b of this.bubbles) {
      const spreadX = this.rand() - 0.5,
        spreadY = this.rand() - 0.5,
        spreadZ = this.rand() - 0.5;
      b.vel.set(spreadX, spreadY, spreadZ).multiplyScalar(1.6);
      const rise = 1.2 + this.rand() * 1.6;
      b.vel.addScaledVector(up, rise);
      b.m.position.copy(at);
      b.size = 0.12 + this.rand() * 0.32;
      b.life = BUBBLE_LIFE * (0.6 + this.rand() * 0.5);
      b.wob = this.rand() * 6;
      delay -= BUBBLE_SPREAD / BUBBLE_N;
      b.t = delay;
      b.on = true;
    }
  }

  private playBubbles(dt: number) {
    for (const b of this.bubbles) {
      if (!b.on) continue;
      b.t += dt;
      if (b.t < 0) continue;
      if (b.t > b.life) {
        b.on = false;
        b.m.visible = false;
        continue;
      }
      b.m.visible = true;
      b.m.position.addScaledVector(b.vel, dt);
      // 조금씩 흔들리며 올라간다
      const swayPhase = b.t * 3 + b.wob,
        sway = Math.sin(swayPhase) * 0.4 * dt;
      tmp.set(sway, 0, -sway);
      b.m.position.add(tmp);
      const u = b.t / b.life,
        grown = b.t * 5,
        popIn = Math.min(1, grown),
        size = b.size * popIn;
      b.m.scale.setScalar(size);
      b.m.material.opacity = 0.42 * (1 - u * u);
    }
  }
}

/* ─── 내부 ─────────────────────────── */

function shuffle<T>(list: T[], rand: () => number): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const roll = rand() * (i + 1);
    const j = Math.floor(roll);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
