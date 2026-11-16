import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Tappable } from "../core/tap";
import type { Services } from "../services";
import { S } from "../settings";
import { HideFx } from "./effects";
import type { ItemCreatures } from "./items";
import { Items } from "./items";
import type { LegendWhale } from "./legend";
import { Legend } from "./legend";
import { BOX_FLY_TIME, LimeBox, SNEEZE_AT } from "./limebox";
import { HANDS_MOVE, HideOverlay } from "./overlay";
import { hideSet, isLookAround, isStatsShown } from "./params";
import { placeOf, roundSpots, sphereAt, STAGE_HUB } from "./spots";
import type { FoundHow, RoundEnd } from "./stats";
import { RoundLog } from "./stats";
import type { HideSpot } from "./tuning";
import { HIDE, LOST_RUN_MIN } from "./tuning";
import type { BoxFavor, UnboxLinks } from "./unbox";
import { dealContents, Unboxing } from "./unbox";

// 숨바꼭질 한 판(조각 01b '유영에서 게임으로'). 도움은 역할 하나씩이다:
//   눈 — 삐져나온 리본·빼꼼을 본다. 눈으로만 찾은 상자는 언박싱에서 꽝이 없다
//   칙 — 수상한 곳을 찔러 본다: 칙이 닿는 거리·화면 안의 상자만 재채기한다(화면 밖이면 내 머리 위 '킁?'). 높이 숨은 상자는 밑에서 맞히면 굴러떨어진다
//   생물(아이템) — 잡아서 쓴다: 먼 방향을 알려 주거나(일러바치기) 판을 흔든다(깨우기). 전설의 생물은 닿으면 가장 먼 상자 앞까지 태워 준다
//   못 찾겠다 — 오래 못 찾았을 때만 뜨고, 그렇게 찾은 상자는 꽝 확정
// 흐름: 상자 넷이 앞에 섰다가 '꼭꼭 숨어라'(내가 손가락 틈으로 보는 동안 우왕좌왕 흩어져 달려간다) → 눈을 뜨면 '술래는 너' → 찾기(해가 서서히 진다) →
//   넷을 다 찾으면 금색 상자가 떨어지고 '깔까?' → 언박싱 → '한 판 더'. 해가 다 지면 남은 상자들이 몰려나와 이겼다고 뛴다(찾은 것만 깔 수 있다).
// 장면의 순서와 시각은 연출 지시서를 따르고, 값은 hideseek.data.json(HIDE). 정한 때에 할 일은 after 로 걸어 둔다.
// 유영 조작 값과 맵은 건드리지 않는다 — 상자를 놓고, 칙을 듣고, 카메라를 잠깐 빌릴 뿐이다

/** 판 흐름 */
type Phase = "wait" | "hiding" | "seek" | "lost" | "bonus" | "prompt" | "wipe" | "unbox" | "end";

/** 숨는 애 하나의 처지 */
interface Seeker {
  box: LimeBox;
  spot: HideSpot;
  /** 숨음 · 칙에 맞음(곧 굴러떨어진다) · 굴러떨어지는 중 · 들켜 뛰는 중 · 칸에 듦 */
  state: "hidden" | "struck" | "falling" | "caught" | "slot";
  /** 달려갈 곳(숨으러 갈 때는 숨는 자리의 땅 위 자리, 해가 진 뒤에는 내 둘레)과 빠르기(m/s, 0 이면 서 있다) */
  to: THREE.Vector3;
  speed: number;
  /** 마지막 재채기 시각(게임 초) */
  sneezedAt: number;
  /** 이번 프레임 화면 안에 있나 */
  seen: boolean;
  /** 내가 바로 곁까지 왔었나(지나쳐 멀어지면 '휴') */
  wasClose: boolean;
  /** 한 번이라도 재채기·폴짝·일러바침의 대상이 됐나(그러면 눈으로만 찾은 것이 아니다) */
  helped: boolean;
  /** '못 찾겠다'로 드러났나(언박싱에서 꽝 확정) */
  gaveUp: boolean;
  /** 전설의 생물이 곁을 지나갈 때 움찔했나(한 번만) */
  flinched: boolean;
  /** 눈으로만 찾았나, 찾은 차례(칸 번호) */
  eyes: boolean;
  slot: number;
}

/** 숨바꼭질이 쓰는 것(Game 이 만들 때 넘긴다) */
export interface HideSeekLinks {
  /** 입력: 막기·끌기가 끝난 뒤 지난 시간(ms)·끌지 않고 누르고 있는 시간(초) */
  input: { hold(on: boolean): void; msSinceDragEnd(): number; pressSeconds(): number };
  /** 꾸미기 씬: 열려 있나 · 옷장 단추 숨기기 */
  studio: { readonly isOpen: boolean; setWearHidden(hidden: boolean): void };
  /** 언박싱의 일어나는 일(커지기·고래) */
  unbox: UnboxLinks;
  /** 생물(잡아서 아이템으로 쓴다) */
  creatures: ItemCreatures;
  /** 전설의 손님이 되는 고래 */
  whale: LegendWhale;
  /** 하늘: 노을이 진 정도(0 낮 … 1 해가 졌다) */
  sky: { setDusk(k: number): void };
  /** at 둘레 reach(m) 안의 것(나무·조형물·통통 구름·소원 나무)을 흔든다 */
  shake(at: THREE.Vector3, reach: number): void;
  /** 시간을 seconds 초 멈추고 화면을 살짝 당긴다(찾는 순간) */
  pause(seconds: number): void;
  /** 장소(소원 나무 …)가 반응할 때 라임빛으로 물드나 — 판 동안은 끈다(라임색은 상자의 것) */
  setPlaceGlow(on: boolean): void;
}

// 판의 거리·시간·문구는 hideseek.data.json(HIDE). 아래는 장면의 세부
/** 줄 선 상자들이 차례로 폴짝하는 간격(초) · 우왕좌왕하며 서로에게 달려드는 빠르기·흩어져 달려가는 빠르기(m/s) · 우왕좌왕하다 버둥거리는 시간(초) */
const WAVE_GAP = 0.1,
  FLUSTER_SPEED = 3.5,
  SCATTER_SPEED = 13,
  FLUSTER_FLAIL = 0.3;
/** 발밑 먼지: 간격(초)·크기(m)·남는 시간(초) */
const DUST_EVERY = 0.12,
  DUST_SIZE = 0.55,
  DUST_LIFE = 0.5;
/** 칙에 걸림: 안개가 닿아 재채기를 시작하기까지(초) · 안개 알갱이가 상자로 흘러가는 수 */
const CHIK_DELAY = 0.2,
  MIST_DOTS = 5;
/** 말풍선이 떠 있는 시간(초)과 상자·내 머리 위로 띄우는 높이(m) */
const BUBBLE_TIME = 1.1,
  BUBBLE_OVER_BOX = 0.5,
  BUBBLE_OVER_ME = 1.9;
/** 재채기한 상자를 가리던 것이 흔들리는 거리(m) */
const SHAKE_NEAR = 5;
/** 찾았다: 포기하고 크게 뛰는 높이(제 키의 배수) */
const FOUND_HOP = 1.5;
/** '여기야!' 하며 뛰는 높이(m) · 해가 진 뒤: 튀어나오는 높이·둘러싸고 뛰는 높이(m)·내 둘레 거리(m)·카메라가 물러나는 배수 */
const HERE_HOP = 3,
  LOST_POP = 2.6,
  LOST_HOP = 1.2,
  LOST_RING = 3.4,
  LOST_ZOOM = 1.5;
/** 금색 상자: 내려앉은 뒤 손을 흔들고 '깔까?'가 뜨기까지(초) · 먼지 고리의 반지름(m) */
const BONUS_WAVE = 1.1,
  BONUS_RING = 7;
/** 킥킥거리는 간격(초, 이 둘레에서 들쭉날쭉) */
const GIGGLE_EVERY = 9;
/** 화면 안으로 치는 범위(화면 끝에서 조금 안쪽 — 가장자리에 걸친 것은 못 본 것) */
const SEEN_EDGE = 0.94;
/** 멈춰서 둘러보기 카메라: 도는 빠르기(rad/s — 10초에 한 바퀴)·뒤로(m)·위로(m) */
const LOOK_TURN = 0.63,
  LOOK_BACK = 9,
  LOOK_RISE = 4.2;

const tmp = new THREE.Vector3(),
  at = new THREE.Vector3(),
  ahead = new THREE.Vector3(),
  rightV = new THREE.Vector3(),
  ndc = new THREE.Vector3(),
  orbit = new THREE.Vector3(),
  lookAim = new THREE.Vector3(),
  rigAim = new THREE.Vector3();

/** 숨바꼭질 */
export class HideSeek implements Thing, Tappable {
  private phase: Phase = "wait";
  private phaseT = 0;
  private set: number;
  private readonly seekers: Seeker[] = [];
  /** 찾은 차례 */
  private readonly caught: Seeker[] = [];
  private readonly bonus: LimeBox;
  private hasBonus = false;
  private readonly overlay: HideOverlay;
  private readonly fx: HideFx;
  private readonly unboxing: Unboxing;
  private readonly items: Items;
  private readonly legend: Legend;
  private readonly log = new RoundLog();
  private readonly look: boolean;
  private readonly rand: () => number;
  private time = 0;
  /** 정한 때에 할 일(판의 시계 clock 으로 잰다 — 시간이 멈춘 동안은 가지 않는다) */
  private readonly todo: { at: number; run: () => void }[] = [];
  private clock = 0;
  /** 찾기 시작 뒤 흐른 시간(초 — 이만큼 해가 진다) */
  private roundT = 0;
  /** 마지막으로 찾은 뒤(참을성)·마지막으로 찾거나 '못 찾겠다'를 누른 뒤(단추) 흐른 시간(초) */
  private sinceFind = 0;
  private stuckT = 0;
  private giveUpShown = false;
  /** 찾기까지 간 판 수(0 이면 지금이 첫 판 — 첫 상자가 못 숨고, 안내 줄이 뜨고, 전설의 생물이 반드시 나온다) */
  private played = 0;
  private first = false;
  private easyT = 0;
  /** 다음 킥킥까지(초) */
  private giggleT = 0;
  /** 숨는 장면: 우왕좌왕하는 중 · 흩어져 달려가는 중, 먼지를 찍을 때까지 */
  private flustering = false;
  private scurrying = false;
  private dustT = 0;
  /** 한 줄 안내: 칙을 쏴 봤나 · '톡'이 떴나 · 아이템을 써 봤나 · '칸을 눌러 써 봐'가 떴나 · 지금 떠 있는 글 */
  private chikEver = false;
  private tapHint = false;
  private itemEver = false;
  private itemHint = false;
  private hint: string | null = null;
  /** 전설의 생물: 표시가 떠 있나 · 데려다주는 상자 */
  private legendShown = false;
  private target: Seeker | null = null;
  /** 지금 일러바침을 당하는 상자(생물이 멈추면 움찔한다) */
  private tattled: Seeker | null = null;
  /** 해가 진 뒤 내 머리 위에 올라탄 상자 */
  private rider: Seeker | null = null;
  private lookK = 0;
  private lookAngle = 0;

  constructor(
    private readonly s: Services,
    private readonly links: HideSeekLinks,
    parent: HTMLElement,
  ) {
    const rng = s.rng.fork("hideseek");
    this.rand = () => rng.next();
    this.set = hideSet();
    this.look = isLookAround();
    this.overlay = new HideOverlay(parent);
    this.fx = new HideFx(s.scene);
    for (let i = 0; i < 4; i++) {
      const box = new LimeBox(s.models, s.scene, 1, false, this.rand);
      const seeker: Seeker = {
        box,
        spot: roundSpots(this.set)[i],
        state: "hidden",
        to: new THREE.Vector3(),
        speed: 0,
        sneezedAt: -1e9,
        seen: false,
        wasClose: false,
        helped: false,
        gaveUp: false,
        flinched: false,
        eyes: false,
        slot: 0,
      };
      this.seekers.push(seeker);
    }
    this.bonus = new LimeBox(s.models, s.scene, HIDE.bonus.scale, true, this.rand);
    this.bonus.visible = false;
    this.unboxing = new Unboxing(s, links.unbox, this.fx, this.rand);
    const hub = s.occ.hubs[STAGE_HUB];
    if (!hub)
      throw new Error(`[teum] hideseek.data.json — stage.hub: 지도에 없는 마을(${STAGE_HUB})`);
    this.items = new Items(s, links.creatures, this.fx, hub);
    this.legend = new Legend(links.whale, this.fx, this.rand, s.camera.camera);
  }

  /** 언박싱(과 그리로 넘어가는 동안)은 칙을 혼자 받는다 — 다른 놀이기구가 나를 붙잡아 줄 앞에서 데려가지 않게 */
  get takesTaps(): boolean {
    return this.phase === "unbox" || this.phase === "wipe";
  }

  /**
   * 칙: 찾는 중이면 내 둘레로 안개가 퍼지고, 그 안·화면 안의 숨은 상자가 재채기한다(화면 밖이면 내 머리 위 '킁?').
   * 높이 숨은 상자는 밑(수평 drop.reach 안)에서 화면에 넣고 맞히면 굴러떨어진다. 헛나가도 안개가 닿은 것은 흔들린다. 언박싱 중이면 지금 상자를 연다
   */
  onTap() {
    if (this.phase === "unbox") {
      this.unboxing.tap();
      return;
    }
    if (this.phase !== "seek" || this.links.studio.isOpen || this.legend.isCarrying) return;
    const { player, terrain, events } = this.s;
    const p = player.p as THREE.Vector3;
    const ground = terrain.groundAt(p);
    this.fx.sonar(p, ground, HIDE.chik.reach);
    this.links.shake(p, HIDE.chik.reach);
    this.chikEver = true;
    let sneezed = 0,
      isSniffing = false;
    for (const k of this.seekers) {
      if (k.state !== "hidden") continue;
      const near = this.reachOf(k);
      if (near.isHigh && near.flat <= HIDE.drop.reach && k.seen) {
        this.knockDown(k);
        sneezed++;
        continue;
      }
      if (near.dist > HIDE.chik.reach) continue;
      if (!k.seen) {
        isSniffing = true;
        continue;
      }
      if (this.time - k.sneezedAt < HIDE.chik.sneezeCooldown) continue;
      k.sneezedAt = this.time;
      this.pullMist(k);
      this.after(CHIK_DELAY, () => this.sneeze(k));
      sneezed++;
    }
    if (isSniffing) {
      this.overlay.bubble(HIDE.copy.sniff, (out) => this.overMe(out), BUBBLE_TIME);
      events.emit("hideSniffed", {});
    }
    const afterDrag = this.links.input.msSinceDragEnd();
    this.log.chik(sneezed > 0, afterDrag);
    events.emit("hideChik", { sneezed });
  }

  /** 한 프레임: 판 흐름·상자·카메라(따라가는 카메라 뒤에 — 둘러보기·언박싱이 잠깐 빌린다) */
  update(f: Frame) {
    const dt = f.dt;
    this.time = f.time;
    const studioOpen = this.links.studio.isOpen;
    // 꾸미기 씬이 열려 있는 동안은 판을 멈추고 카메라를 씬에 맡긴다(숨는 장면이면 닫힌 뒤에 처음부터 — 입력은 씬이 막고 있다)
    if (studioOpen) {
      if (this.phase === "hiding") this.restart();
      this.unboxing.dropCamera();
      this.lookK = 0;
    } else this.step(dt);
    for (const k of this.seekers) k.box.update(dt, f.time);
    this.bonus.update(dt, f.time);
    this.fx.update(dt);
    this.unboxing.update(dt, f.time);
    if (!studioOpen) this.lookAround(dt);
    this.overlay.update(this.s.camera.camera, dt);
  }

  dispose() {
    this.overlay.dispose();
    this.fx.dispose();
    this.unboxing.dispose();
    for (const k of this.seekers) k.box.dispose();
    this.bonus.dispose();
  }

  /* ─── 내부: 판 흐름 ─────────────────────────── */

  private step(dt: number) {
    this.phaseT += dt;
    this.clock += dt;
    this.runDue();
    switch (this.phase) {
      case "wait":
        this.begin();
        break;
      case "hiding":
        this.whileHiding(dt);
        break;
      case "seek":
        this.seek(dt);
        break;
      case "lost":
        this.whileLost(dt);
        break;
      case "bonus":
        this.dropBonus();
        break;
      case "prompt":
        this.whilePrompting();
        break;
      case "wipe":
        this.whileWiped();
        break;
      default:
        break;
    }
    for (const k of this.seekers)
      if (k.state === "falling" && !k.box.isTumbling) this.catchBox(k, "drop");
    if (this.items.update(dt)) this.told();
    if (this.phase !== "seek") this.legend.fade(dt);
    // 끝 단추는 놀이기구에서 내린 뒤에 누른다 — 실린 채 광장으로 옮기면 그 놀이기구가 나를 놓지 못한 채로 남는다
    const riding = this.s.player.isHeld;
    this.overlay.setEndingAway(riding);
  }

  // 정한 때에 할 일을 건다(판의 시계로 seconds 뒤)
  private after(seconds: number, run: () => void) {
    const due = this.clock + seconds;
    this.todo.push({ at: due, run });
  }

  private runDue() {
    for (let i = 0; i < this.todo.length;) {
      if (this.todo[i].at > this.clock) {
        i++;
        continue;
      }
      const [job] = this.todo.splice(i, 1);
      job.run();
    }
  }

  // 판 시작(꼭꼭 숨어라): 무대 마을 출발 자리로 옮기고, 상자 넷이 내 앞에 한 줄로 서서 차례로 폴짝한다. 장면의 나머지는 시각마다 걸어 둔다
  private begin() {
    const { player, occ, hud, camera } = this.s;
    // 놀이기구에 실려 있으면 내릴 때까지 기다린다(옮기면 그 놀이기구가 나를 놓지 못한다)
    if (player.isHeld) return;
    const hub = occ.hubs[STAGE_HUB];
    player.goHome(hub);
    hud.setQuiet(true);
    camera.setZoom(1);
    this.links.input.hold(true);
    this.links.studio.setWearHidden(true);
    this.links.sky.setDusk(0);
    this.links.setPlaceGlow(false);
    const o = this.overlay;
    o.setHands("open");
    o.resetSlots();
    o.showSlots(true);
    o.showEnding(null);
    o.showGiveUp(false);
    o.showItemSlot(false);
    o.setItem(null);
    o.showStats(null);
    this.showLegendMark(false);
    this.showHint(null);
    this.fx.clear();
    this.todo.length = 0;
    this.caught.length = 0;
    this.hasBonus = false;
    this.bonus.visible = false;
    this.target = null;
    this.rider = null;
    this.flustering = this.scurrying = false;
    this.first = this.played === 0;
    const spots = roundSpots(this.set);
    const p = player.p as THREE.Vector3,
      h = player.h as THREE.Vector3;
    rightV.crossVectors(p, h).normalize();
    const back = tmp.copy(h).negate();
    this.seekers.forEach((k, i) => {
      k.spot = spots[i];
      k.state = "hidden";
      k.speed = 0;
      k.sneezedAt = -1e9;
      k.seen = k.wasClose = k.helped = k.gaveUp = k.flinched = false;
      const place = this.placeFor(k, i);
      sphereAt(k.to, hub, place.x, place.y);
      const across = (i - 1.5) * HIDE.start.lineGap;
      const aheadArc = HIDE.start.lineAhead / S.R,
        acrossArc = across / S.R;
      ahead.copy(p).addScaledVector(h, aheadArc).addScaledVector(rightV, acrossArc).normalize();
      const ground = this.s.terrain.groundAt(ahead);
      k.box.put(ahead, ground, back);
      k.box.setPeek(null);
      this.after(i * WAVE_GAP, () => k.box.hop());
    });
    const screen = `${innerWidth}x${innerHeight}`,
      now = Date.now();
    this.log.begin(this.set, this.look, screen, now, this.time);
    const T = HIDE.start,
      textAt = this.sceneTime(T.textAt),
      closeAt = this.sceneTime(T.closeAt),
      openAt = this.sceneTime(T.openAt);
    const hideFor = closeAt - textAt;
    this.after(textAt, () => {
      o.showBig(HIDE.copy.hide, hideFor);
      o.setHands("peeking");
    });
    this.after(this.sceneTime(T.startleAt), () => this.fluster());
    this.after(this.sceneTime(T.scurryAt), () => this.scatter());
    this.after(closeAt, () => o.setHands("closed"));
    this.after(closeAt + HANDS_MOVE, () => this.settleIn());
    this.after(openAt, () => o.setHands("open"));
    this.after(this.sceneTime(T.goAt), () => this.startSeek());
    this.goTo("hiding");
  }

  // 숨는 장면의 시각: 둘째 판부터는 놀라서 흩어져 화면 밖으로 나가기까지(startleAt~offscreenAt)를 laterShare 로 줄인다
  private sceneTime(x: number): number {
    const T = HIDE.start,
      share = this.first ? 1 : T.laterShare;
    if (x <= T.startleAt) return x;
    const until = Math.min(x, T.offscreenAt),
      cut = until - T.startleAt,
      over = x - T.offscreenAt,
      rest = Math.max(0, over);
    return T.startleAt + cut * share + rest;
  }

  // 상자들이 깜짝 놀라 서로 부딪치며 우왕좌왕한다. 하나는 넘어졌다 일어난다
  private fluster() {
    for (const k of this.seekers) k.box.startle();
    this.flustering = true;
    this.after(0.12, () => {
      this.seekers[2].box.topple();
      this.seekers[1].box.flail(FLUSTER_FLAIL);
    });
  }

  // 넷이 제각각 숨을 곳 쪽으로 종종걸음. 첫 판의 '제일 못 숨은 놈'은 정면 물건 뒤로 가는 것이 다 보인다(화면 밖으로 나갈 때쯤 닿게 달린다)
  private scatter() {
    const T = HIDE.start,
      span = this.sceneTime(T.offscreenAt) - this.sceneTime(T.scurryAt);
    this.flustering = false;
    this.scurrying = true;
    this.seekers.forEach((k, i) => {
      const dist = k.box.v.angleTo(k.to) * S.R;
      k.speed = this.first && i === 0 ? dist / span : SCATTER_SPEED;
    });
    this.s.events.emit("hideStarted", {});
  }

  private whileHiding(dt: number) {
    const terrain = this.s.terrain;
    // 큰 바퀴를 돌던 고래가 숨는 장면 도중에 나를 태워 가지 않게 한다
    this.links.unbox.keepWhaleOff();
    if (this.flustering)
      this.seekers.forEach((k, i) => {
        const other = this.seekers[i ^ 1].box;
        if (k.box.v.angleTo(other.v) * S.R < 0.9) return;
        k.box.stepToward(other.v, FLUSTER_SPEED, dt);
        k.box.setScurry(1);
      });
    if (!this.scurrying) return;
    this.dustT -= dt;
    const isDusty = this.dustT <= 0;
    if (isDusty) this.dustT = DUST_EVERY;
    for (const k of this.seekers) {
      if (k.speed <= 0) continue;
      const left = k.box.stepToward(k.to, k.speed, dt);
      k.box.a = terrain.groundAt(k.box.v);
      k.box.setScurry(1);
      if (isDusty) {
        const foot = S.R + k.box.a + 0.2;
        at.copy(k.box.v).multiplyScalar(foot);
        this.fx.dot(at, DUST_SIZE, DUST_LIFE);
      }
      if (left > 0.2) continue;
      // 다 왔다(제일 못 숨은 놈): 출발 쪽을 보고 서서, 걸린 리본을 한 번 잡아당긴다
      k.speed = 0;
      k.box.setScurry(0);
      k.box.faceTo(this.s.player.p as THREE.Vector3);
      k.box.tug();
    }
  }

  // 손가락 틈이 닫힌 동안: 상자는 숨는 자리에 들고, 판의 생물이 제자리에 앉고, 전설의 생물이 나올 때가 정해진다
  private settleIn() {
    const hub = this.s.occ.hubs[STAGE_HUB];
    this.scurrying = false;
    this.hideAll();
    this.items.reset(hub);
    this.legend.plan(this.first, hub);
  }

  // 눈을 떴다: '술래는 너'와 함께 조작이 풀리고 찾기가 시작된다
  private startSeek() {
    const o = this.overlay;
    o.showBig(HIDE.copy.it);
    o.showItemSlot(true);
    this.links.input.hold(false);
    this.log.seekStarted(this.time);
    this.roundT = 0;
    this.sinceFind = 0;
    this.stuckT = 0;
    this.easyT = 0;
    this.giveUpShown = false;
    this.played++;
    this.goTo("seek");
  }

  // 숨는 자리: 첫 판의 첫 상자만 '제일 못 숨은 놈' — 리본과 귀를 다 내놓는다
  private placeFor(k: Seeker, i: number) {
    const isWorst = this.first && i === 0;
    return isWorst ? placeOf(k.spot, HIDE.start.firstShowShare) : placeOf(k.spot);
  }

  // 숨는 자리로: 뒤에 숨기는 가린 것 뒤에 비켜서고, 높이 숨기는 올라앉거나 매달린다. 모두 출발 쪽을 본다
  private hideAll() {
    const { occ, terrain } = this.s;
    const hub = occ.hubs[STAGE_HUB];
    this.seekers.forEach((k, i) => {
      const place = this.placeFor(k, i);
      sphereAt(at, hub, place.x, place.y);
      const faceX = place.x + place.faceX,
        faceY = place.y + place.faceY;
      const facePoint = sphereAt(tmp, hub, faceX, faceY).sub(at);
      const ground = terrain.groundAt(at);
      const base = place.top === null ? ground : ground + place.top;
      k.box.put(at, base, facePoint);
      if (place.peekX || place.peekY) {
        const peekX = place.x + place.peekX,
          peekY = place.y + place.peekY;
        const peekPoint = sphereAt(ahead, hub, peekX, peekY).sub(at);
        const radial = peekPoint.dot(at);
        peekPoint.addScaledVector(at, -radial).normalize();
        k.box.setPeek(peekPoint);
      } else k.box.setPeek(null);
    });
  }

  // 찾는 중: 화면 안에서 닿으면 찾았다. 해가 서서히 지고, 숨은 상자는 가만있지 않고, 오래 못 찾으면 '못 찾겠다'가 뜬다
  private seek(dt: number) {
    this.roundT += dt;
    this.sinceFind += dt;
    this.stuckT += dt;
    const dusk = duskAt(this.roundT);
    this.links.sky.setDusk(dusk);
    let isNearHidden = false;
    for (const k of this.seekers) {
      if (k.state !== "hidden") continue;
      const center = k.box.center(at);
      k.seen = this.isSeen(center);
      const isWatched = k.seen && Math.abs(ndc.x) <= WATCH && Math.abs(ndc.y) <= WATCH;
      const near = this.reachOf(k);
      if (near.dist <= HIDE.screen.tapHintReach) isNearHidden = true;
      this.idle(k, near.dist, isWatched);
      const isUnder = near.isHigh && near.flat <= HIDE.drop.reach;
      k.box.setWobble(isUnder);
      if (!near.isHigh && near.dist <= HIDE.find.reach && k.seen) this.catchBox(k, "touch");
    }
    this.easeFirstBox(dt);
    this.giggle(dt);
    this.useCreatures();
    this.rideLegend(dt);
    this.teach(isNearHidden);
    if (!this.giveUpShown && this.stuckT >= HIDE.stuck.giveUpAfter && this.hiddenLeft() > 0) {
      this.giveUpShown = true;
      this.overlay.showGiveUp(true, () => this.giveUp());
    }
    const isAllCaught = this.caught.length === this.seekers.length;
    if (isAllCaught) {
      if (this.caught.every((k) => k.state === "slot")) this.endSeek("all");
      return;
    }
    // 굴러떨어지는 상자가 있으면 다 떨어져 찾아질 때까지 해가 기다린다
    const isDropping = this.seekers.some((k) => k.state === "struck" || k.state === "falling");
    if (this.roundT >= HIDE.round.seconds && !isDropping) this.endSeek("sunset");
  }

  // 숨어 있는 동안: 내가 가까이 오면 숨을 참고, 바로 곁을 지나쳐 멀어지면 '휴', 내밀다 눈이 마주치면 쏙, 오래 못 찾으면 참을성을 잃는다
  private idle(k: Seeker, dist: number, isWatched: boolean) {
    const N = HIDE.nearby,
      b = k.box;
    b.holdBreath(dist <= N.holdBreathReach);
    b.setWatched(isWatched);
    b.setRestless(this.sinceFind >= HIDE.stuck.restlessAfter);
    if (dist <= N.passReach) {
      k.wasClose = true;
      return;
    }
    if (!k.wasClose || dist < N.passReach * 1.6) return;
    k.wasClose = false;
    b.sigh();
    const breath = b.center(at).addScaledVector(b.v, b.hh);
    this.fx.dot(breath, 0.9, 0.8);
    this.s.events.emit("hideBoxSighed", {});
  }

  // 첫 판의 첫 상자: 못 찾고 있으면 몇 초마다 혼자 재채기한다(첫 발견이 빨리 나오게)
  private easeFirstBox(dt: number) {
    const worst = this.seekers[0];
    if (!this.first || worst.state !== "hidden") return;
    this.easyT += dt;
    if (this.easyT < HIDE.start.firstSneezeEvery) return;
    this.easyT = 0;
    this.sneeze(worst);
  }

  // 닿은 생물을 잡는다: 그 생물 그림이 왼쪽 아래 칸으로 빨려 들어온다
  private useCreatures() {
    const got = this.items.catchTouching(at);
    if (!got) return;
    const from = this.screenOf(at);
    this.overlay.setItem(got, () => this.useItem(), from);
    if (!this.itemEver) this.itemHint = true;
  }

  // 칸을 눌렀다: 일러바치기는 가장 가까운 숨은 상자 쪽으로 날아가고, 깨우기는 라임 물결이 땅을 타고 퍼져 닿는 차례대로 숨은 상자를 뛰게 한다
  private useItem() {
    if (this.phase !== "seek") return;
    const near = this.nearestHidden();
    const toward = near ? near.box.v : null;
    const kind = this.items.use(toward);
    this.overlay.setItem(null);
    if (!kind) return;
    this.itemEver = true;
    this.itemHint = false;
    this.log.itemUsed(kind);
    this.s.events.emit("hideItemUsed", { kind });
    if (kind === "tattle") {
      if (near) near.helped = true;
      this.tattled = near;
      return;
    }
    const { player, terrain } = this.s,
      p = player.p as THREE.Vector3,
      I = HIDE.item;
    const ground = terrain.groundAt(p),
      reach = HIDE.stage.radius * 2,
      spread = reach / I.waveSpeed;
    this.fx.sonar(p, ground, reach, spread);
    this.overlay.shake();
    for (const k of this.seekers) {
      if (k.state !== "hidden") continue;
      k.helped = true;
      const wait = (k.box.v.angleTo(p) * S.R) / I.waveSpeed;
      this.after(wait, () => this.wake(k));
    }
  }

  // 물결이 닿았다: 놀라 높이 폴짝폴짝 뛰고, 끝나면 민망한 듯 쏙
  private wake(k: Seeker) {
    if (k.state !== "hidden" || this.phase !== "seek") return;
    const I = HIDE.item;
    k.box.startle();
    k.box.hopFor(I.wakeSeconds, I.wakeHop);
    const center = k.box.center(at);
    this.s.fx.burst(center, 10, 9);
    this.after(I.wakeSeconds + 0.4, () => {
      if (k.state === "hidden" && this.phase === "seek") k.box.sigh();
    });
  }

  // 일러바치던 생물이 멈췄다: 그쪽의 숨은 상자가 움찔한다(배신당했다)
  private told() {
    const k = this.tattled;
    this.tattled = null;
    this.s.events.emit("hideBoxGiggled", {});
    if (k && k.state === "hidden") k.box.flinch();
  }

  // 킥킥: 오래 못 찾았거나(참을성을 잃은 뒤) 해가 저물 무렵이면, 가장 가까운 숨은 상자가 가끔 리본 귀를 흔들며 웃는다
  private giggle(dt: number) {
    const isLate = this.roundT >= HIDE.round.redFrom,
      isBored = this.sinceFind >= HIDE.stuck.restlessAfter;
    if (!isLate && !isBored) {
      this.giggleT = GIGGLE_EVERY * 0.5;
      return;
    }
    this.giggleT -= dt;
    if (this.giggleT > 0) return;
    this.giggleT = GIGGLE_EVERY * (0.7 + this.rand() * 0.6);
    const near = this.nearestHidden();
    if (!near) return;
    near.box.wave();
    this.s.events.emit("hideBoxGiggled", {});
  }

  // 전설의 생물: 나타나고(칸 옆 표시가 깜빡인다), 닿으면 잠깐 멈췄다가 가장 먼 숨은 상자 앞까지 태워 가고, 도착하면 그 상자가 깜짝 놀라 찾아진다
  private rideLegend(dt: number) {
    const event = this.legend.update(dt, this.roundT, () => this.farthestHidden());
    const { events } = this.s;
    if (event === "came") {
      this.log.legendAppeared();
      events.emit("hideLegendCame", {});
    } else if (event === "boarded") {
      this.log.legendRidden();
      this.links.input.hold(true);
      this.links.pause(HIDE.find.pauseSeconds);
      events.emit("hideLegendBoarded", {});
    } else if (event === "arrived") {
      this.links.input.hold(false);
      const k = this.target;
      this.target = null;
      if (k && k.state === "hidden") this.catchBox(k, "legend");
    }
    this.showLegendMark(this.legend.isAround);
    if (!this.legend.isCarrying) return;
    // 타고 가는 동안 곁을 지나친 상자는 올려다보며 움찔한다(눈 밝은 사람은 자리를 하나 더 얻는다)
    const whaleAt = this.links.whale.v;
    for (const k of this.seekers) {
      if (k.state !== "hidden" || k.flinched || k === this.target) continue;
      if (whaleAt.angleTo(k.box.v) * S.R > HIDE.legend.flinchReach) continue;
      k.flinched = true;
      k.box.flinch();
    }
  }

  private showLegendMark(on: boolean) {
    if (on === this.legendShown) return;
    this.legendShown = on;
    this.overlay.showLegendMark(on);
  }

  // 한 줄 안내(첫 판에만, 한 번에 하나): 둘째 상자부터 숨은 상자 가까이 오면 '톡', 첫 생물을 잡으면 '칸을 눌러 써 봐'
  private teach(isNearHidden: boolean) {
    if (!this.first) return;
    if (!this.chikEver && this.caught.length >= 1 && isNearHidden) this.tapHint = true;
    const isTapShown = this.tapHint && !this.chikEver;
    const text = isTapShown ? HIDE.copy.tap : this.itemHint ? HIDE.copy.useItem : null;
    this.showHint(text);
  }

  private showHint(text: string | null) {
    if (text === this.hint) return;
    this.hint = text;
    this.overlay.showHint(text);
  }

  // 찾기가 끝났다: 넷을 다 찾았으면 금색 상자로, 해가 졌으면 남은 상자들이 이긴다
  private endSeek(by: RoundEnd) {
    const o = this.overlay;
    o.showGiveUp(false);
    o.showItemSlot(false);
    this.showHint(null);
    this.showLegendMark(false);
    this.items.drop();
    this.legend.stop();
    this.target = null;
    this.log.ended(by);
    if (by === "all") {
      this.links.input.hold(false);
      o.flashSlots();
      this.s.events.emit("hideAllFound", {});
      this.goTo("bonus");
      return;
    }
    this.lose();
  }

  // 해가 졌다: 해가 톡 떨어지고 조작이 잠긴다. 잠깐 조용하다가 남은 상자들이 동시에 펑 튀어나오고, 내 앞으로 몰려와 둘러싸고 뛰고,
  // 한 놈은 내 머리 위에 올라탄다. 그리고 '한 판 더'(찾은 것이 있으면 '깔까?'도)
  private lose() {
    const L = HIDE.lost,
      o = this.overlay;
    this.links.sky.setDusk(1);
    this.links.input.hold(true);
    const losers = this.seekers.filter((k) => k.state === "hidden");
    for (const k of losers) {
      k.box.setPeek(null);
      k.box.setRestless(false);
      k.box.setWobble(false);
      k.box.holdBreath(false);
    }
    const popFor = L.gatherAt - L.popAt,
      cheerFor = L.buttonsAt - L.gatherAt,
      runFor = L.climbAt - L.gatherAt - LOST_RUN_MIN * 0.5;
    this.after(L.popAt, () => {
      this.s.camera.setZoom(LOST_ZOOM);
      for (const k of losers) {
        k.box.startle();
        k.box.hopFor(popFor, LOST_POP);
        this.fx.pillar(k.box.v, k.box.a, popFor);
      }
    });
    this.after(L.gatherAt, () => {
      o.showBig(HIDE.copy.boxesWin, cheerFor);
      this.s.events.emit("hideBoxesWon", {});
      this.gather(losers, runFor);
    });
    this.after(L.climbAt, () => {
      this.rider = losers[0] ?? null;
    });
    this.after(L.buttonsAt, () => {
      this.release();
      const canOpen = this.caught.length > 0;
      o.showEnding(() => this.again(), canOpen ? () => this.openFound() : null);
    });
    this.goTo("lost");
  }

  // 남은 상자들이 seconds 안에 내 앞으로 몰려온다: 내 앞쪽 반원에 둘러서게(카메라는 내 뒤에 있다)
  private gather(losers: Seeker[], seconds: number) {
    const { player, terrain } = this.s,
      p = player.p as THREE.Vector3,
      h = player.h as THREE.Vector3;
    rightV.crossVectors(p, h).normalize();
    losers.forEach((k, i) => {
      const spread = losers.length > 1 ? i / (losers.length - 1) - 0.5 : 0,
        angle = spread * 2.2,
        fwd = Math.cos(angle) * LOST_RING,
        side = Math.sin(angle) * LOST_RING;
      const fwdArc = fwd / S.R,
        sideArc = side / S.R;
      k.to.copy(p).addScaledVector(h, fwdArc).addScaledVector(rightV, sideArc).normalize();
      // 높이 숨었던 상자는 땅으로 내려와 달린다
      k.box.a = terrain.groundAt(k.box.v);
      k.box.setPeek(null);
      const dist = k.box.v.angleTo(k.to) * S.R;
      k.speed = dist / seconds;
    });
  }

  // 해가 진 뒤: 몰려오는 상자는 종종걸음으로, 다 오면 나를 보고 폴짝폴짝. 머리 위에 올라탄 놈은 나를 따라다닌다
  private whileLost(dt: number) {
    const { player, terrain } = this.s,
      p = player.p as THREE.Vector3;
    for (const k of this.seekers) {
      if (k.state !== "hidden" || k === this.rider) continue;
      if (k.speed <= 0) continue;
      const left = k.box.stepToward(k.to, k.speed, dt);
      k.box.a = terrain.groundAt(k.box.v);
      k.box.setScurry(1);
      if (left > 0.2) continue;
      k.speed = 0;
      k.box.setScurry(0);
      const toMe = tmp.copy(p).sub(k.box.v);
      k.box.faceTo(toMe);
      k.box.hopFor(1e9, LOST_HOP);
    }
    const rider = this.rider;
    if (!rider) return;
    const headTop = player.P.length() - S.R + 0.75;
    rider.box.v.copy(p);
    rider.box.a = headTop;
    rider.box.faceTo(player.h as THREE.Vector3);
  }

  // 해가 진 뒤의 '깔까?': 찾은 것만 깐다
  private openFound() {
    if (this.phase !== "lost" || this.s.player.isHeld) return;
    this.overlay.showEnding(null);
    this.startWipe();
  }

  // 찾았다: 시간이 잠깐 멈추고(상자는 깜짝 자세로 굳는다) → 눈을 가리고 버티다 → 포기하고 크게 폴짝(한 바퀴, 종이 꽃가루, '찾았다!') →
  // 웅크렸다가 화면 위 칸으로 날아간다. 굴러떨어진 상자는 벌떡 일어난 데서 바로 폴짝으로 이어진다. 조작은 멈춘 뒤 바로 풀린다
  private catchBox(k: Seeker, how: FoundHow) {
    const F = HIDE.find,
      b = k.box;
    k.state = "caught";
    k.eyes = how === "touch" && !k.helped;
    k.slot = this.caught.length;
    this.caught.push(k);
    b.setPeek(null);
    b.holdBreath(false);
    b.setRestless(false);
    b.setWobble(false);
    const { id: spot, kind } = k.spot,
      { eyes, gaveUp } = k;
    this.log.found({ spot, kind, how, eyes, gaveUp }, this.time);
    this.sinceFind = 0;
    this.stuckT = 0;
    this.giveUpShown = false;
    this.overlay.showGiveUp(false);
    const isQuick = how === "drop",
      coverFor = isQuick ? 0 : F.coverSeconds;
    if (!isQuick) {
      b.startle(true);
      b.coverEyes(true);
      this.links.pause(F.pauseSeconds);
    }
    this.after(coverFor, () => {
      b.coverEyes(false);
      const high = b.hh * 2 * FOUND_HOP;
      b.hop(high, true);
      const center = b.center(at);
      this.fx.confetti(center, this.rand);
      this.s.fx.burst(center, 14, 8);
      this.overlay.showBig(HIDE.copy.found);
      const count = this.caught.length;
      this.s.events.emit("hideBoxFound", { count, how });
    });
    this.after(coverFor + F.hopSeconds, () => {
      const tall = b.hh * 2,
        center = b.center(at).addScaledVector(b.v, tall);
      const from = this.screenOf(center);
      b.flyAway();
      this.overlay.fillSlot(k.slot, eyes, from, F.flySeconds);
    });
    const done = coverFor + F.hopSeconds + Math.max(F.flySeconds, BOX_FLY_TIME);
    this.after(done, () => {
      k.state = "slot";
    });
  }

  // 못 찾겠다: 큰 글자 없이, 가장 가까운 숨은 상자가 높이 뛰며 '여기야!' 하고 빛기둥이 선다. 찾은 것은 아니고, 그 상자는 언박싱에서 꽝이다
  private giveUp() {
    const near = this.nearestHidden();
    if (!near || this.phase !== "seek") return;
    const seconds = HIDE.stuck.pillarSeconds;
    near.helped = true;
    near.gaveUp = true;
    near.box.hopFor(seconds, HERE_HOP);
    this.fx.pillar(near.box.v, near.box.a, seconds);
    this.overlay.bubble(HIDE.copy.here, (out) => this.overBox(near, out), seconds);
    this.overlay.showGiveUp(false);
    this.giveUpShown = false;
    this.stuckT = 0;
    this.log.gaveUp();
    this.s.events.emit("hideGaveUp", {});
  }

  // 칙에 걸림: 안개 알갱이가 내 자리에서 상자 쪽으로 빨려가듯 흐른다
  private pullMist(k: Seeker) {
    const from = this.s.player.P.clone(),
      to = k.box.center(at).clone();
    for (let i = 1; i <= MIST_DOTS; i++) {
      const share = i / (MIST_DOTS + 1);
      this.after(share * CHIK_DELAY, () => {
        const spot = tmp.copy(from).lerp(to, share);
        this.fx.dot(spot, 0.7, 0.35);
      });
    }
  }

  // 재채기: 에…취! — 터지는 순간 라임 안개, 상자 위 '에취!' 말풍선, 가리고 있던 것이 흔들린다(소리 없이도 보이게). 그 뒤 '들켰나?' 하고 굳는다
  private sneeze(k: Seeker) {
    if (this.phase !== "seek" || (k.state !== "hidden" && k.state !== "struck")) return;
    k.sneezedAt = this.time;
    k.helped = true;
    k.box.sneeze();
    this.after(SNEEZE_AT, () => {
      const center = k.box.center(at);
      this.fx.sneeze(center, this.rand);
      this.overlay.bubble(HIDE.copy.sneeze, (out) => this.overBox(k, out), BUBBLE_TIME);
      this.links.shake(k.box.v, SHAKE_NEAR);
      this.s.events.emit("hideBoxSneezed", {});
    });
  }

  // 높이 숨은 상자가 칙에 맞았다: 재채기 → 그 반동으로 미끄러짐 → 귀로 매달려 버둥 → 뒤집혀 떨어짐 → 납작 → 벌떡. 일어나면 그 자리에서 찾은 것
  private knockDown(k: Seeker) {
    k.state = "struck";
    k.sneezedAt = this.time;
    this.pullMist(k);
    this.after(CHIK_DELAY, () => {
      const ground = this.s.terrain.groundAt(k.box.v);
      const slide = k.spot.kind === "high" ? k.spot.slide : 0;
      this.sneeze(k);
      k.state = "falling";
      k.box.tumbleTo(ground, slide);
      this.s.events.emit("hideBoxDropped", {});
    });
  }

  // 다 찾았다: 칸 넷이 번쩍이고, 금색 리본 상자(1.4배)가 내 앞 하늘에서 떨어져 쿵(화면 흔들림·먼지 고리) → 통통 튀고 → 손을 흔들고 → '깔까?'
  private dropBonus() {
    const b = this.bonus,
      { player, terrain } = this.s;
    if (this.hasBonus) return;
    if (!b.visible) {
      if (this.phaseT < HIDE.bonus.waitSeconds) return;
      const arc = HIDE.bonus.ahead / S.R;
      ahead.copy(player.p).addScaledVector(player.h, arc).normalize();
      const ground = terrain.groundAt(ahead);
      const face = tmp.copy(player.h).negate();
      b.put(ahead, ground, face);
      b.dropFrom(HIDE.bonus.dropHeight);
      this.s.events.emit("hideBonusFalling", {});
      return;
    }
    if (b.isDropping) return;
    const center = b.center(at);
    this.s.fx.burst(center, 24, 11);
    this.fx.sonar(b.v, b.a, BONUS_RING, 0.5);
    this.overlay.shake();
    this.s.events.emit("hideBonusLanded", {});
    this.hasBonus = true;
    b.wave();
    this.after(BONUS_WAVE, () => {
      this.overlay.showBig(HIDE.copy.open);
      this.goTo("prompt");
    });
  }

  // 깔까?: 큰 글자가 떴다 지면 언박싱으로 넘어간다(놀이기구에서 내린 뒤에)
  private whilePrompting() {
    if (this.phaseT < HIDE.screen.bigSeconds || this.s.player.isHeld) return;
    this.startWipe();
  }

  // 언박싱으로: 손가락 틈이 닫히는 동안 광장 출발 자리로 옮긴다
  private startWipe() {
    this.overlay.showSlots(false);
    this.overlay.showStats(null);
    this.s.hud.setQuiet(true);
    this.links.studio.setWearHidden(true);
    this.links.input.hold(true);
    this.overlay.setHands("closed");
    this.after(HANDS_MOVE, () => this.arrangeUnbox());
    this.goTo("wipe");
  }

  // 닫힌 동안 광장 출발 자리로 옮겨 찾은 상자들을 앞에 세운다 —
  // 그 자리가 놀이기구 안·조형물 곁이면 앞에서 비추는 카메라가 막혀서, 언박싱은 늘 트인 광장에서 한다. 못 찾은 상자는 물러난다
  private arrangeUnbox() {
    const { player, occ, camera } = this.s;
    // 닫히는 사이에 놀이기구가 나를 붙잡았으면 내릴 때까지 기다린다(실린 채 옮기면 그 놀이기구가 나를 놓지 못한다)
    if (player.isHeld) {
      this.after(0.2, () => this.arrangeUnbox());
      return;
    }
    const boxes = this.caught.map((k) => k.box);
    if (this.hasBonus) boxes.push(this.bonus);
    for (const k of this.seekers) if (k.state === "hidden") k.box.visible = false;
    this.rider = null;
    camera.setZoom(1);
    // 출발 자리에서 광장 바깥(트인 쪽)을 보고 선다 — 소원 나무 쪽은 공 놀이기구가 줄 가운데를 가린다
    const hub = occ.hubs[STAGE_HUB];
    player.goHome(hub);
    const away = tmp.copy(player.h).negate();
    player.teleport(player.p as THREE.Vector3, away, 0);
    this.unboxing.arrange(boxes);
    this.after(0.25, () => {
      this.overlay.setHands("open");
      const favors = this.caught.map((k) => favorOf(k));
      const contents = dealContents(favors, this.hasBonus, this.rand);
      this.goTo("unbox");
      this.unboxing.start(boxes, contents, () => this.finish());
    });
  }

  private whileWiped() {
    this.links.unbox.keepWhaleOff();
  }

  // 다 열었다: 판이 끝났다 — '한 판 더'
  private finish() {
    this.overlay.showSlots(false);
    this.goTo("end");
    this.release();
    this.overlay.showEnding(() => this.again());
  }

  // 판에서 놓아 준다(다 열었거나, 해가 져서 단추가 떴다): 손을 놓고, 안내 줄·말풍선·옷장 단추·장소의 라임빛을 돌려주고, 기록을 닫는다(?debug 면 잰 값도)
  private release() {
    this.s.hud.setQuiet(false);
    this.links.setPlaceGlow(true);
    this.links.input.hold(false);
    this.links.studio.setWearHidden(false);
    this.log.finish(this.time);
    this.showStats();
  }

  // 한 판 더: 다음 묶음으로 다시
  private again() {
    if (this.phase !== "end" && this.phase !== "lost") return;
    if (this.s.player.isHeld) return;
    this.log.again();
    this.set++;
    this.unboxing.resetHappenings();
    this.restart();
  }

  private showStats() {
    if (!isStatsShown()) return;
    const lines = this.log.lines();
    this.overlay.showStats(lines);
  }

  // 처음(꼭꼭 숨어라)으로. 걸어 둔 일은 버린다. 입력은 begin 이 다시 막는다(꾸미기 씬이 열려 있으면 씬이 막고 있다)
  private restart() {
    this.todo.length = 0;
    this.overlay.setHands("open");
    this.overlay.showSlots(false);
    this.goTo("wait");
  }

  private goTo(phase: Phase) {
    this.phase = phase;
    this.phaseT = 0;
  }

  /* ─── 내부: 거리·화면·카메라 ─────────────────────────── */

  // 나와 상자 사이: 3차원 거리(m)·수평 거리(m)·내 높이보다 drop.minAbove 넘게 위인가(그러면 닿아서 못 찾는다)
  private reachOf(k: Seeker): { dist: number; flat: number; isHigh: boolean } {
    const { player } = this.s;
    const center = k.box.center(at);
    const altA = player.P.length() - S.R,
      above = k.box.altitude - altA;
    REACH.dist = center.distanceTo(player.P);
    REACH.flat = k.box.v.angleTo(player.p) * S.R;
    REACH.isHigh = above > HIDE.drop.minAbove;
    return REACH;
  }

  // 화면 안인가(가장자리에 걸친 것·카메라 뒤는 아니다). 화면 위 자리는 ndc 에 남는다
  private isSeen(world: THREE.Vector3): boolean {
    ndc.copy(world).project(this.s.camera.camera);
    return ndc.z < 1 && Math.abs(ndc.x) <= SEEN_EDGE && Math.abs(ndc.y) <= SEEN_EDGE;
  }

  // 화면 좌표(px). 카메라 뒤면 null
  private screenOf(world: THREE.Vector3): { x: number; y: number } | null {
    ndc.copy(world).project(this.s.camera.camera);
    if (ndc.z >= 1) return null;
    const x = (ndc.x + 1) * 0.5 * innerWidth,
      y = (1 - ndc.y) * 0.5 * innerHeight;
    return { x, y };
  }

  // 말풍선 자리: 상자 위 · 내 머리 위
  private overBox(k: Seeker, out: THREE.Vector3) {
    const lift = k.box.hh + BUBBLE_OVER_BOX;
    k.box.center(out).addScaledVector(k.box.v, lift);
  }

  private overMe(out: THREE.Vector3) {
    const { player } = this.s;
    out.copy(player.P).addScaledVector(player.p, BUBBLE_OVER_ME);
  }

  private hiddenLeft(): number {
    return this.seekers.filter((k) => k.state === "hidden").length;
  }

  private nearestHidden(): Seeker | null {
    const P = this.s.player.P;
    let best: Seeker | null = null,
      bestD = Infinity;
    for (const k of this.seekers) {
      if (k.state !== "hidden") continue;
      const d = k.box.center(at).distanceTo(P);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    return best;
  }

  // 전설의 생물이 데려다줄 곳: 가장 먼 숨은 상자의 자리(그 상자를 기억해 둔다)
  private farthestHidden(): THREE.Vector3 | null {
    const p = this.s.player.p;
    let best: Seeker | null = null,
      bestD = -1;
    for (const k of this.seekers) {
      if (k.state !== "hidden") continue;
      const d = k.box.v.angleTo(p);
      if (d > bestD) {
        bestD = d;
        best = k;
      }
    }
    this.target = best;
    return best ? best.box.v : null;
  }

  // ?look=1: 끌지 않고 0.5초 넘게 누르고 있으면 그 자리에 멈춰 카메라가 천천히 한 바퀴 돈다. 손을 떼면 풀린다
  private lookAround(dt: number) {
    if (!this.look) return;
    const { player, camera } = this.s;
    const canLook = this.phase === "seek" || this.phase === "prompt" || this.phase === "end";
    const held = this.links.input.pressSeconds();
    const looking = canLook && held >= HIDE.look.holdSeconds;
    if (looking) {
      player.slowDown(6);
      this.lookAngle += LOOK_TURN * dt;
    }
    const target = looking ? 1 : 0,
      k = ease(4, dt);
    this.lookK += (target - this.lookK) * k;
    if (this.lookK < 0.01) {
      this.lookK = 0;
      this.lookAngle = 0;
      return;
    }
    const cam = camera.camera,
      p = player.p as THREE.Vector3,
      P = player.P;
    orbit.copy(player.h).multiplyScalar(-LOOK_BACK).applyAxisAngle(p, this.lookAngle);
    orbit.add(P).addScaledVector(p, LOOK_RISE);
    lookAim.copy(P).addScaledVector(p, 0.6);
    cam.getWorldDirection(rigAim);
    rigAim.multiplyScalar(10).add(cam.position);
    cam.position.lerp(orbit, this.lookK);
    rigAim.lerp(lookAim, this.lookK);
    cam.up.copy(p);
    cam.lookAt(rigAim);
  }
}

/** 찾기 시작 뒤 t 초의 노을(0 낮 … 1 해가 졌다): redFrom 까지는 은은하게, 그 뒤로 눈에 띄게 붉어진다 */
export function duskAt(t: number): number {
  const { seconds, redFrom } = HIDE.round;
  if (t <= redFrom) return DUSK_EARLY * (t / redFrom);
  const share = (t - redFrom) / (seconds - redFrom),
    late = Math.min(1, share);
  return DUSK_EARLY + (1 - DUSK_EARLY) * late;
}

/* ─── 내부 ─────────────────────────── */

/** 나와 상자 사이(프레임마다 새로 만들지 않고 돌려 쓴다) */
const REACH = { dist: 0, flat: 0, isHigh: false };

/** 눈이 마주친 것으로 치는 화면 가운데 범위(화면 좌표 -1..1 의 절반 너비) */
const WATCH = HIDE.nearby.watchShare;

/** redFrom 까지 가는 노을의 몫 */
const DUSK_EARLY = 0.4;

// 찾은 상자가 언박싱에서 받는 대접: '못 찾겠다'로 찾았으면 꽝 확정, 눈으로만 찾았으면 꽝 없음
function favorOf(k: Seeker): BoxFavor {
  if (k.gaveUp) return "gaveUp";
  return k.eyes ? "eyes" : "helped";
}
