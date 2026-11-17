import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Tappable } from "../core/tap";
import type { Creature } from "../creatures/creature";
import type { Services } from "../services";
import { S } from "../settings";
import type { CatLink } from "./coach";
import { Coach } from "./coach";
import { Disguises } from "./disguise";
import { HideFx } from "./effects";
import { CameraFocus } from "./focus";
import type { HelpCreatures, HelpRound } from "./helpers";
import { CreatureHelp } from "./helpers";
import { HidingScene } from "./hiding";
import { Leap } from "./leap";
import type { LegendWhale } from "./legend";
import { Legend } from "./legend";
import { LimeBox, SNEEZE_AT } from "./limebox";
import type { LineTrail } from "./line";
import { BoxLine } from "./line";
import { LookAround } from "./lookAround";
import { HideOverlay, LIDS_MOVE } from "./overlay";
import { buildStamp, hideSet, isLookAround, isStatsShown } from "./params";
import type { PickTarget } from "./picker";
import { pickAt, screenHeight } from "./picker";
import type { Seeker } from "./seeker";
import { createSeeker, farthestHidden, nearestHidden, reachOf } from "./seeker";
import { Sneak } from "./sneak";
import { roundSpots, STAGE_HUB } from "./spots";
import type { FoundHow, RoundEnd } from "./stats";
import { RoundLog } from "./stats";
import { Sunset } from "./sunset";
import { Timeline } from "./timeline";
import type { BehindSpot } from "./tuning";
import { HIDE } from "./tuning";
import type { UnboxLinks } from "./unbox";
import { dealContents, Unboxing } from "./unbox";

// 숨바꼭질 한 판. 어려움은 '어디 숨었나'에만 둔다 — 본 다음에 거기 가는 일은 저절로 된다. 내 행동은 하나, 칙(톡)이다:
//   보이는 상자를 톡 치면 찾은 것이다(찾았다고 정하는 것은 언제나 나 — 가까이 가기만 해서는 안 찾아진다). 미스트가 날아가 상자가 재채기하고,
//     아바타가 스스로 뛰어가(leap) 상자를 톡 친다. 아닌 척하던 상자(disguise)는 들통나며 찾아진다
//   생물을 톡 치면 종류마다 다른 도움을 준다(helpers — 버섯만 밟는다). 전설(legend)은 세 번 치면 태워 준다
//   빈 데를 톡 치면 칙이다: 둘레 상자가 재채기한다(힌트일 뿐 찾은 것이 아니다)
// 숨은 상자 몇은 내가 안 볼 때만 움직인다(sneak). 옆의 고양이와 한 줄 안내(coach)가 다음에 할 것을 알려 준다.
// 흐름: 꼭꼭 숨어라(hiding) → 술래는 너 → 찾기(해가 서서히 진다, 찾은 상자는 내 뒤에 줄을 선다 — line) →
//   넷을 다 찾으면 금색 상자 → '깔까?' → 언박싱(unbox) → '한 판 더'. 3분에 해가 지면 남은 상자들이 이긴다(sunset — 찾은 것만 깐다).
// 판이 도는 동안 누를 단추는 없고, 내 뒤에는 찾은 상자만 따라온다(만난 손님·꼬마 라임·별은 판이 끝난 뒤에).
// 이 파일은 판의 흐름과 찾기를 맡고, 장면마다의 세부는 각 파일에 있다. 값은 hideseek.data.json(HIDE), 정한 때에 할 일은 timeline.
// 유영 조작 값과 맵은 건드리지 않는다 — 상자를 놓고, 칙을 듣고, 카메라를 잠깐 빌릴 뿐이다

/** 판 흐름 */
type Phase = "wait" | "hiding" | "seek" | "lost" | "bonus" | "prompt" | "wipe" | "unbox" | "end";

/** 톡 친 것: 상자 · 생물 · 전설 */
type Picked = { kind: "box"; k: Seeker } | { kind: "creature"; c: Creature } | { kind: "legend" };

/** 숨바꼭질이 쓰는 것(Game 이 만들 때 넘긴다) */
export interface HideSeekLinks {
  /** 지나온 자리 — 찾은 상자의 줄이 밟는다 */
  footsteps: LineTrail;
  /** 입력: 막기·끌기가 끝난 뒤 지난 시간(ms)·끌지 않고 누르고 있는 시간(초) */
  input: { hold(on: boolean): void; msSinceDragEnd(): number; pressSeconds(): number };
  /** 꾸미기 씬: 열려 있나 · 옷장 단추 숨기기 */
  studio: { readonly isOpen: boolean; setWearHidden(hidden: boolean): void };
  /** 언박싱의 일어나는 일(커지기·고래) */
  unbox: UnboxLinks;
  /** 생물(눌러서 도움을 받는다) */
  creatures: HelpCreatures;
  /** 전설의 손님이 되는 고래 */
  whale: LegendWhale;
  /** 하늘: 노을이 진 정도(0 낮 … 1 해가 졌다) */
  sky: { setDusk(k: number): void };
  /** 옆을 따라다니는 고양이 */
  cat: CatLink;
  /** at 둘레 reach(m) 안의 것(나무·조형물·통통 구름·소원 나무)을 흔든다 */
  shake(at: THREE.Vector3, reach: number): void;
  /** 시간을 seconds 초 멈추고 화면을 살짝 당긴다(찾는 순간) */
  pause(seconds: number): void;
  /** 장소(소원 나무 …)가 반응할 때 라임빛으로 물드나 — 판 동안은 끈다(라임색은 상자의 것) */
  setPlaceGlow(on: boolean): void;
  /** 내 뒤에 다른 것(만난 손님·꼬마 라임·별)이 따라붙어도 되나 — 판 동안은 끈다(찾은 상자만 줄을 선다) */
  setCompany(on: boolean): void;
  /** 투시(열쇠): center 둘레 radius(m) 안의 물건을 alpha 몫만 남기고 비춘다(radius 0 이면 끈다) */
  xray(center: THREE.Vector3, radius: number, alpha: number): void;
}

/** 칙 헛나감·너무 멂: 안개 알갱이 수 · 너무 멀 때 미스트가 가다 떨어지는 몫 */
const MIST_DOTS = 5,
  FAR_SHARE = 0.45;
/** 말풍선이 떠 있는 시간(초: 에취!)과 상자 머리 위로 띄우는 높이(m) */
const BUBBLE_TIME = 1.1,
  BUBBLE_OVER = 0.5;
/** 재채기한 상자를 가리던 것이 흔들리는 거리(m) */
const SHAKE_NEAR = 5;
/** 찾았다: 포기하고 크게 뛰는 높이(제 키의 배수) · 뛰어가 내리는 자리(상자 앞 m) */
const FOUND_HOP = 1.2,
  LAND_BEFORE = 1;
/** 누르는 자리: 귀까지 넣은 키의 몫(상자 키 기준) · 너비의 몫 */
const PICK_TALL = 1.3,
  PICK_WIDE = 0.75;
/** 금색 상자: 내려앉은 뒤 손을 흔들고 '깔까?'가 뜨기까지(초) · 먼지 고리의 반지름(m) */
const BONUS_WAVE = 1.1,
  BONUS_RING = 7;
/** 킥킥거리는 간격(초, 이 둘레에서 들쭉날쭉) */
const GIGGLE_EVERY = 9;
/** 화면 안으로 치는 범위(화면 끝에서 조금 안쪽 — 가장자리에 걸친 것은 못 본 것) · 눈이 마주친 것으로 치는 화면 가운데 범위 */
const SEEN_EDGE = 0.94,
  WATCH = HIDE.nearby.watchShare;
/** redFrom 까지 가는 노을의 몫 · 회중시계가 해를 되돌리는 빠르기(판의 초를 1초에) */
const DUSK_EARLY = 0.4,
  REWIND_RATE = 14;

const tmp = new THREE.Vector3(),
  at = new THREE.Vector3(),
  ahead = new THREE.Vector3(),
  ndc = new THREE.Vector3();

/** 숨바꼭질 */
export class HideSeek implements Thing, Tappable {
  private phase: Phase = "wait";
  private phaseT = 0;
  /** 숨는 자리 묶음(?hide — '한 판 더'마다 다음 묶음) */
  private set: number;
  private readonly seekers: Seeker[] = [];
  /** 찾은 차례(칸 번호이자 줄에서의 차례) */
  private readonly caught: Seeker[] = [];
  private readonly bonus: LimeBox;
  private hasBonus = false;
  private readonly overlay: HideOverlay;
  private readonly fx: HideFx;
  private readonly timeline = new Timeline();
  private readonly hiding: HidingScene;
  private readonly line: BoxLine;
  private readonly sunset: Sunset;
  private readonly coach: Coach;
  private readonly unboxing: Unboxing;
  private readonly help: CreatureHelp;
  private readonly legend: Legend;
  private readonly leap: Leap;
  private readonly focus: CameraFocus;
  private readonly sneak: Sneak;
  private readonly disguises: Disguises;
  private readonly looker: LookAround | null;
  private readonly log = new RoundLog();
  private readonly rand: () => number;
  private time = 0;
  /** 찾기 시작 뒤 흐른 시간(초 — 이만큼 해가 진다) · 회중시계가 되돌릴 남은 시간(초) */
  private roundT = 0;
  private rewindLeft = 0;
  /** 마지막으로 찾은 뒤(참을성) · 마지막으로 찾거나 생물을 쓴 뒤(생물이 부르러 온다) 흐른 시간(초) */
  private sinceFind = 0;
  private stuckT = 0;
  /** 찾기까지 간 판 수(0 이면 지금이 첫 판 — 첫 상자가 못 숨고, 안내 줄이 뜨고, 전설의 생물이 반드시 나온다) */
  private played = 0;
  private first = false;
  /** 첫 판의 첫 상자가 혼자 재채기하기까지 · 다음 킥킥까지(초) */
  private easyT = 0;
  private giggleT = 0;
  /** 뛰어가는 중인 상자(내리면 찾은 것) */
  private leapTo: Seeker | null = null;
  /** 전설의 생물: 표시가 떠 있나 · 데려다주는 상자 */
  private legendShown = false;
  private target: Seeker | null = null;

  constructor(
    private readonly s: Services,
    private readonly links: HideSeekLinks,
    parent: HTMLElement,
  ) {
    const rng = s.rng.fork("hideseek");
    this.rand = () => rng.next();
    this.set = hideSet();
    this.overlay = new HideOverlay(parent);
    this.fx = new HideFx(s.scene);
    const spots = roundSpots(this.set);
    for (const spot of spots) {
      const box = new LimeBox(s.models, s.scene, 1, false, this.rand);
      const seeker = createSeeker(box, spot);
      this.seekers.push(seeker);
    }
    this.bonus = new LimeBox(s.models, s.scene, HIDE.bonus.scale, true, this.rand);
    this.bonus.visible = false;
    this.bonus.setLongEars(false);
    this.hiding = new HidingScene(s, this.seekers, this.fx, this.overlay, this.timeline);
    this.line = new BoxLine(s, links.footsteps);
    this.sunset = new Sunset(s, this.overlay, this.timeline);
    this.coach = new Coach(this.overlay, links.cat);
    this.unboxing = new Unboxing(s, links.unbox, this.fx, this.rand);
    this.focus = new CameraFocus(s);
    this.leap = new Leap(s);
    const round: HelpRound = {
      isSeeking: () => this.phase === "seek",
      hidden: () => this.findable(),
      lurable: () => this.findable().filter((k) => !this.disguises.isBeside(k)),
      lure: (k, to) => this.sneak.lure(k, to),
      rewind: (seconds) => {
        this.rewindLeft += seconds;
      },
      xray: (center, radius, alpha) => links.xray(center, radius, alpha),
      // 생물을 쓴 뒤 잠깐 잠갔다 푸는 것 — 그 사이 해가 졌거나 전설에 실려 가면 풀지 않는다
      hold: (on) => {
        const isOwnedElsewhere = this.phase !== "seek" || this.legend.isCarrying || this.leapTo;
        if (!on && isOwnedElsewhere) return;
        links.input.hold(on);
      },
    };
    this.help = new CreatureHelp(
      s,
      links.creatures,
      round,
      this.fx,
      this.overlay,
      this.focus,
      this.timeline,
      this.rand,
    );
    const hands = {
      place: (k: Seeker, spot: BehindSpot) => this.hiding.placeAt(k, spot),
      ground: (spot: BehindSpot) => this.hiding.groundOf(spot),
    };
    this.sneak = new Sneak(s, this.fx, this.overlay, hands, this.rand);
    const disguiseLinks = { help: this.help, cat: links.cat, trail: links.footsteps };
    this.disguises = new Disguises(s, disguiseLinks, this.overlay, this.rand);
    const hub = s.occ.hubs[STAGE_HUB];
    if (!hub)
      throw new Error(`[teum] hideseek.data.json — stage.hub: 지도에 없는 마을(${STAGE_HUB})`);
    this.legend = new Legend(links.whale, this.fx, this.rand, s.camera.camera);
    const press = () => links.input.pressSeconds();
    this.looker = isLookAround() ? new LookAround(s, press) : null;
    if (isStatsShown()) {
      const stamp = buildStamp();
      this.overlay.showStamp(stamp);
    }
  }

  /** 언박싱(과 그리로 넘어가는 동안)은 칙을 혼자 받는다 — 다른 놀이기구가 나를 붙잡아 줄 앞에서 데려가지 않게 */
  get takesTaps(): boolean {
    return this.phase === "unbox" || this.phase === "wipe";
  }

  /**
   * 화면 (x, y)를 톡 쳤다: 상자·생물·전설에 걸리면 그것에 칙이 날아가고 true(빈 데 칙은 하지 않는다).
   * 걸린 것이 없으면 false — 그러면 빈 데 칙(onTap)이 된다
   */
  pick(x: number, y: number): boolean {
    if (this.phase !== "seek" || this.links.studio.isOpen) return false;
    // 찾는 중인 상자(미스트가 날아가거나 뛰어가는 중)가 있거나 전설에 실려 가는 동안의 톡은 삼킨다 —
    // 둘을 잇달아 치면 앞의 것이 뛰어가는 사이 뒤의 것이 '맞았는데 못 찾은' 채로 남아 판이 끝나지 않는다
    const isBusy = this.leapTo || this.seekers.some((k) => k.state === "struck");
    if (isBusy || this.legend.isCarrying) return true;
    const targets = this.pickTargets(),
      view = { w: innerWidth, h: innerHeight },
      F = HIDE.find;
    const hit = pickAt(x, y, targets, this.s.camera.camera, view, F.tapPad, F.tapMin);
    if (!hit) return false;
    if (hit.kind === "box") this.tapBox(hit.k);
    else if (hit.kind === "creature") this.tapCreature(hit.c);
    else this.tapLegend();
    return true;
  }

  /**
   * 빈 데 칙: 찾는 중이면 내 둘레로 안개가 퍼지고, 그 안의 숨은 상자가 재채기한다(화면 밖이어도 — 말풍선이 그쪽 화면 가장자리에 뜬다).
   * 아닌 척하는 상자는 움찔만 한다. 헛나가도 안개가 닿은 것은 흔들린다. 언박싱 중이면 지금 상자를 연다
   */
  onTap() {
    if (this.phase === "unbox") {
      this.unboxing.tap();
      return;
    }
    const isCarried = this.legend.isCarrying || this.leapTo !== null;
    if (this.phase !== "seek" || this.links.studio.isOpen || isCarried) return;
    const { player, terrain, events } = this.s;
    const p = player.p as THREE.Vector3;
    const ground = terrain.groundAt(p);
    this.fx.sonar(p, ground, HIDE.chik.reach);
    this.links.shake(p, HIDE.chik.reach);
    this.coach.chik();
    let sneezed = 0;
    for (const k of this.findable()) {
      const near = reachOf(k, player);
      if (near.dist > HIDE.chik.reach) continue;
      if (this.disguises.isPretending(k)) {
        k.box.flinch();
        continue;
      }
      if (this.time - k.sneezedAt < HIDE.chik.sneezeCooldown) continue;
      k.sneezedAt = this.time;
      this.pullMist(k, 1);
      this.timeline.after(HIDE.find.mistSeconds, () => this.sneeze(k));
      sneezed++;
    }
    const afterDrag = this.links.input.msSinceDragEnd();
    this.log.chik(sneezed > 0, afterDrag);
    events.emit("hideChik", { sneezed });
  }

  /** 한 프레임: 판 흐름·상자·카메라(따라가는 카메라 뒤에 — 생물 보기·둘러보기·언박싱이 잠깐 빌린다) */
  update(f: Frame) {
    const dt = f.dt;
    this.time = f.time;
    const studioOpen = this.links.studio.isOpen;
    // 꾸미기 씬이 열려 있는 동안은 판을 멈추고 카메라를 씬에 맡긴다(숨는 장면이면 닫힌 뒤에 처음부터 — 입력은 씬이 막고 있다)
    if (studioOpen) {
      if (this.phase === "hiding") this.restart();
      this.unboxing.dropCamera();
      this.looker?.drop();
      this.focus.drop();
    } else this.step(dt);
    for (const k of this.seekers) k.box.update(dt, f.time);
    this.bonus.update(dt, f.time);
    this.fx.update(dt);
    this.unboxing.update(dt, f.time);
    const canLook = this.phase === "seek" || this.phase === "prompt" || this.phase === "end";
    if (!studioOpen) {
      this.focus.update(dt);
      this.looker?.update(dt, canLook);
    }
    this.overlay.update(this.s.camera.camera, dt);
  }

  dispose() {
    this.overlay.dispose();
    this.fx.dispose();
    this.unboxing.dispose();
    this.help.dispose();
    this.disguises.dispose();
    for (const k of this.seekers) k.box.dispose();
    this.bonus.dispose();
  }

  /* ─── 내부: 판 흐름 ─────────────────────────── */

  private step(dt: number) {
    this.phaseT += dt;
    this.timeline.tick(dt);
    switch (this.phase) {
      case "wait":
        this.begin();
        break;
      case "hiding":
        // 큰 바퀴를 돌던 고래가 숨는 장면 도중에 나를 태워 가지 않게 한다
        this.links.unbox.keepWhaleOff();
        this.hiding.update(dt);
        break;
      case "seek":
        this.seek(dt);
        break;
      case "lost":
        this.sunset.update(dt);
        break;
      case "bonus":
        this.dropBonus();
        break;
      case "prompt":
        this.whilePrompting();
        break;
      case "wipe":
        this.links.unbox.keepWhaleOff();
        break;
      default:
        break;
    }
    for (const k of this.seekers)
      if (k.state === "falling" && !k.box.isTumbling) this.catchBox(k, "tap");
    this.followLeap(dt);
    const hasLine =
      this.phase === "seek" ||
      this.phase === "lost" ||
      this.phase === "bonus" ||
      this.phase === "prompt";
    if (hasLine) this.line.update(dt);
    if (this.phase !== "seek") this.legend.fade(dt);
    // 끝 단추는 놀이기구에서 내린 뒤에 누른다 — 실린 채 광장으로 옮기면 그 놀이기구가 나를 놓지 못한 채로 남는다
    const riding = this.s.player.isHeld;
    this.overlay.setEndingAway(riding);
  }

  // 판 시작: 무대 마을 출발 자리로 옮기고, 지난 판의 흔적을 거두고, 숨는 장면을 건다
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
    this.links.setCompany(false);
    const o = this.overlay;
    o.setLids(false);
    o.resetSlots();
    o.showSlots(true);
    o.showEnding(null);
    o.showStats(null);
    o.setPointer(null);
    this.showLegendMark(false);
    this.coach.begin();
    this.fx.clear();
    this.timeline.clear();
    this.caught.length = 0;
    this.line.clear();
    this.sunset.clear();
    this.disguises.clear();
    this.sneak.stop();
    this.hasBonus = false;
    this.bonus.visible = false;
    this.target = null;
    this.leapTo = null;
    this.rewindLeft = 0;
    this.first = this.played === 0;
    const screen = `${innerWidth}x${innerHeight}`,
      now = Date.now(),
      look = this.looker !== null;
    this.log.begin(this.set, look, screen, now, this.time);
    const spots = roundSpots(this.set);
    this.hiding.start(hub, spots, this.first, {
      // 눈을 감은 동안: 판의 생물이 섞인 자리에 앉고, 아닌 척하는 상자가 저마다 자리를 잡고, 움직일 상자가 정해지고,
      // 전설의 생물이 나올 때가 정해진다
      settled: () => {
        this.help.reset(hub, this.first);
        this.disguises.place(this.seekers, hub);
        // 움직이는 상자는 뒤에 숨은 것에서 고른다(높이 숨은 것은 제자리, 첫 판의 '제일 못 숨은 놈'도 제자리)
        const movers = this.seekers.filter((k, i) => {
          const isWorst = this.first && i === 0;
          return k.spot.kind === "behind" && !isWorst;
        });
        this.sneak.begin(movers, this.first);
        this.legend.plan(this.first, hub);
      },
      go: () => this.startSeek(),
    });
    this.goTo("hiding");
  }

  // 눈을 떴다: '술래는 너'와 함께 조작이 풀리고 찾기가 시작된다
  private startSeek() {
    this.overlay.showBig(HIDE.copy.it);
    this.links.input.hold(false);
    this.log.seekStarted(this.time);
    this.roundT = 0;
    this.sinceFind = 0;
    this.stuckT = 0;
    this.easyT = 0;
    this.played++;
    this.goTo("seek");
  }

  // 찾는 중: 해가 서서히 지고, 숨은 상자는 멀어도 보이게 커지고, 몇은 내가 안 볼 때 움직이고, 고양이가 냄새를 맡고, 생물이 도움을 준다
  private seek(dt: number) {
    this.roundT += dt;
    this.sinceFind += dt;
    this.stuckT += dt;
    this.rewind(dt);
    const dusk = duskAt(this.roundT);
    this.links.sky.setDusk(dusk);
    const player = this.s.player,
      cam = this.s.camera.camera;
    let isNearHidden = false,
      nearest: Seeker | null = null,
      nearestD = Infinity;
    for (const k of this.seekers) {
      if (k.state !== "hidden") continue;
      const center = k.box.center(at);
      k.seen = k.box.visible && this.isSeen(center);
      if (!k.box.visible) continue;
      const isWatched = k.seen && Math.abs(ndc.x) <= WATCH && Math.abs(ndc.y) <= WATCH;
      const near = reachOf(k, player);
      // 내 곁을 따라오는 아닌 척(내 줄·고양이)은 고양이가 냄새로 가리키지 않는다(늘 가장 가까워 다른 상자를 가린다)
      const isBeside = this.disguises.isBeside(k);
      if (near.dist <= HIDE.screen.tapHintReach) isNearHidden = true;
      if (near.flat < nearestD && !isBeside) {
        nearestD = near.flat;
        nearest = k;
      }
      if (!this.sneak.isMoving(k)) this.idle(k, near.dist, isWatched);
      // 내 곁을 따라오는 아닌 척은 키우지 않는다(멀어질 일이 없다)
      const far = cam.position.distanceTo(center);
      if (!isBeside) this.growToShow(k, far);
    }
    const occupied = (spot: BehindSpot) => this.seekers.some((k) => k.spot.id === spot.id);
    this.sneak.update(dt, occupied);
    this.disguises.update(dt, this.caught.length);
    this.help.update(dt);
    if (this.stuckT >= HIDE.stuck.callAfter && this.help.call()) this.stuckT = 0;
    const scentAt = nearest ? nearest.box.v : null;
    this.coach.sniff(scentAt, nearestD, this.first, this.roundT);
    this.easeFirstBox(dt);
    this.giggle(dt);
    this.rideLegend(dt);
    this.pointAtFirst();
    const firstBox = this.seekers[0],
      isFirstBoxSeen = this.first && firstBox.state === "hidden" && firstBox.seen;
    this.coach.teach(
      {
        isFirst: this.first,
        found: this.caught.length,
        isNearHidden,
        isFirstBoxSeen,
        isHelperNear: this.help.isHelperNear,
      },
      dt,
    );
    const isAllCaught = this.caught.length === this.seekers.length;
    if (isAllCaught) {
      if (this.caught.every((k) => k.state === "line")) this.endSeek("all");
      return;
    }
    // 찾는 중인 상자(미스트가 날아가거나 뛰어가거나 굴러떨어지는 중)가 있으면 다 찾아질 때까지 해가 기다린다
    const isFinding = this.seekers.some((k) => k.state === "struck" || k.state === "falling");
    if (this.roundT >= HIDE.round.seconds && !isFinding) this.endSeek("sunset");
  }

  // 회중시계: 해가 눈에 띄게 되감긴다
  private rewind(dt: number) {
    if (this.rewindLeft <= 0) return;
    const fast = REWIND_RATE * dt,
      step = Math.min(this.rewindLeft, fast);
    this.rewindLeft -= step;
    const back = this.roundT - step;
    this.roundT = Math.max(0, back);
  }

  // 멀어도 폰에서 보이게: 숨은 상자가 화면에서 box.minScreen(px) 밑으로 작아지지 않게 거리 따라 키운다(maxGrow 배까지)
  private growToShow(k: Seeker, dist: number) {
    const B = HIDE.box,
      cam = this.s.camera.camera,
      tall = k.box.hh * 2,
      px = screenHeight(tall, dist, cam, innerHeight),
      need = B.minScreen / Math.max(1, px),
      grow = Math.min(B.maxGrow, need),
      size = Math.max(1, grow);
    k.box.setSize(size);
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

  // 첫 판 첫 상자: 화면에 들면 그 위에서 손가락이 톡톡(한 번 찾으면 다시 안 뜬다) — 누르기를 알려 주는 씬이 오기 전까지
  private pointAtFirst() {
    const k = this.seekers[0],
      isShown = this.first && this.caught.length === 0 && k.state === "hidden" && k.seen;
    this.overlay.setPointer(isShown ? (out) => overBox(k, out) : null);
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
    const hidden = this.findable(),
      near = nearestHidden(hidden, this.s.player.P);
    if (!near) return;
    near.box.wave();
    this.s.events.emit("hideBoxGiggled", {});
  }

  // 누를 수 있는 것: 찾을 수 있는 숨은 상자(귀까지 넣은 네모) · 쓸 수 있는 생물 · 지나가는 전설
  private pickTargets(): PickTarget<Picked>[] {
    const targets: PickTarget<Picked>[] = [];
    for (const k of this.findable()) {
      const b = k.box,
        tall = b.hh * b.size,
        ears = tall * (PICK_TALL - 1),
        center = new THREE.Vector3();
      b.center(center).addScaledVector(b.v, ears);
      targets.push({
        item: { kind: "box", k },
        center,
        halfH: tall * PICK_TALL,
        halfW: tall * PICK_WIDE,
      });
    }
    const creatures: PickTarget<Creature>[] = [];
    this.help.targets(creatures);
    for (const t of creatures) targets.push({ ...t, item: { kind: "creature", c: t.item } });
    const center = new THREE.Vector3(),
      body = this.legend.body(center);
    if (body) targets.push({ item: { kind: "legend" }, center, ...body });
    return targets;
  }

  // 상자를 톡: 미스트가 날아가 재채기하면(아닌 척이면 들통나며) 아바타가 뛰어가 찾는다. 너무 멀면 미스트가 가다 떨어지고 상자가 메롱
  private tapBox(k: Seeker) {
    const { player, events } = this.s,
      dist = reachOf(k, player).dist;
    if (dist > this.help.tapReach) {
      this.pullMist(k, FAR_SHARE);
      this.log.tooFar();
      events.emit("hideBoxTapped", { far: true });
      this.timeline.after(HIDE.find.mistSeconds, () => {
        if (k.state !== "hidden") return;
        k.box.wave();
        k.box.hop(0.5);
      });
      return;
    }
    k.state = "struck";
    k.box.setFrozen(false);
    this.log.tapped(dist);
    this.pullMist(k, 1);
    events.emit("hideBoxTapped", { far: false });
    this.timeline.after(HIDE.find.mistSeconds, () => {
      if (this.phase !== "seek") return;
      this.disguises.reveal(k);
      this.sneeze(k);
      this.leapToBox(k);
    });
  }

  // 아바타가 뛰어간다: 상자 앞(나 쪽으로 조금)에 내린다. 놀이기구에 실려 있으면 뛰지 않고 그 자리에서 찾는다
  private leapToBox(k: Seeker) {
    const { player, terrain } = this.s,
      b = k.box,
      back = (b.hh * b.size + LAND_BEFORE) / S.R;
    tmp.copy(player.p).sub(b.v);
    const up = tmp.dot(b.v);
    tmp.addScaledVector(b.v, -up).normalize();
    ahead.copy(b.v).addScaledVector(tmp, back).normalize();
    const ground = terrain.groundAt(ahead),
      above = b.a - ground,
      landAir = Math.max(0, above);
    this.leapTo = k;
    const isLeaping = this.leap.start(ahead, landAir);
    if (isLeaping) this.s.events.emit("hideLeapt", {});
    else this.arrive();
  }

  private followLeap(dt: number) {
    const landed = this.leap.update(dt);
    if (landed) this.arrive();
  }

  // 다 뛰어갔다: 톡! 높이 숨은 상자는 굴러떨어진 뒤, 나머지는 바로 찾은 것
  private arrive() {
    const k = this.leapTo;
    this.leapTo = null;
    if (!k || k.state !== "struck") return;
    const terrain = this.s.terrain,
      ground = terrain.groundAt(k.box.v),
      above = k.box.a - ground;
    if (above <= HIDE.drop.minAbove) {
      this.catchBox(k, "tap");
      return;
    }
    const slide = k.spot.kind === "high" ? k.spot.slide : 0;
    k.state = "falling";
    k.box.tumbleTo(ground, slide);
    this.s.events.emit("hideBoxDropped", {});
  }

  // 생물을 톡: 눌러서 쓰는 거리 안이면 그 생물만의 도움, 너무 멀면 안 닿는다
  private tapCreature(c: Creature) {
    const d = c.v.angleTo(this.s.player.p) * S.R;
    if (d > HIDE.help.tapReach) {
      this.log.tooFar();
      this.s.events.emit("hideBoxTapped", { far: true });
      return;
    }
    const kind = this.help.use(c);
    if (!kind) return;
    this.log.helped(kind);
    this.stuckT = 0;
  }

  // 전설을 톡: 물방울 하나가 찬다. 너무 멀면(수평 legend.catchReach 밖) 안 닿는다
  private tapLegend() {
    const d = this.links.whale.v.angleTo(this.s.player.p) * S.R;
    if (d > HIDE.legend.catchReach) {
      this.s.events.emit("hideBoxTapped", { far: true });
      return;
    }
    const hits = this.legend.hit();
    this.s.events.emit("hideLegendHit", { hits });
  }

  // 전설의 생물: 나타나고(칸 옆 표시가 깜빡이고 안내 줄), 세 번 맞히면 내려와 태워 가장 먼 숨은 상자 앞까지 가고, 도착하면 그 상자가 찾아진다
  private rideLegend(dt: number) {
    const event = this.legend.update(dt, this.roundT, () => this.legendTarget());
    const { events } = this.s;
    if (event === "came") {
      this.log.legendAppeared();
      this.coach.legendCame();
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
      if (k && k.state === "hidden") {
        this.disguises.reveal(k);
        this.catchBox(k, "legend");
      }
    }
    this.showLegendMark(this.legend.isAround);
    if (!this.legend.isCarrying) return;
    // 타고 가는 동안 곁을 지나친 상자는 올려다보며 움찔한다(눈 밝은 사람은 자리를 하나 더 얻는다)
    const whaleAt = this.links.whale.v;
    for (const k of this.findable()) {
      if (k.flinched || k === this.target) continue;
      if (whaleAt.angleTo(k.box.v) * S.R > HIDE.legend.flinchReach) continue;
      k.flinched = true;
      k.box.flinch();
    }
  }

  // 전설의 생물이 데려다줄 곳: 가장 먼 숨은 상자의 자리(그 상자를 기억해 둔다 — 도착하면 찾은 것이 된다)
  private legendTarget(): THREE.Vector3 | null {
    const hidden = this.findable(),
      best = farthestHidden(hidden, this.s.player.p);
    this.target = best;
    return best ? best.box.v : null;
  }

  private showLegendMark(on: boolean) {
    if (on === this.legendShown) return;
    this.legendShown = on;
    this.overlay.showLegendMark(on);
  }

  // 지금 찾을 수 있는 숨은 상자(내 줄에 끼기 전의 상자처럼 아무 데도 없는 것은 빼고)
  private findable(): Seeker[] {
    return this.seekers.filter(
      (k) => k.state === "hidden" && k.box.visible && this.disguises.canFind(k),
    );
  }

  // 찾기가 끝났다: 넷을 다 찾았으면 금색 상자로, 해가 졌으면 남은 상자들이 이긴다
  private endSeek(by: RoundEnd) {
    this.coach.stop();
    this.showLegendMark(false);
    this.help.stop();
    this.sneak.stop();
    this.legend.stop();
    this.leap.stop();
    this.focus.drop();
    this.overlay.setPointer(null);
    this.links.xray(this.s.player.P as THREE.Vector3, 0, 1);
    this.leapTo = null;
    this.target = null;
    this.s.camera.setZoom(1);
    this.log.spotted(this.sneak.spotted);
    this.log.ended(by);
    if (by === "all") {
      this.links.input.hold(false);
      this.overlay.flashSlots();
      this.s.events.emit("hideAllFound", {});
      this.goTo("bonus");
      return;
    }
    // 해가 톡 떨어지고 조작이 잠긴다. 장면이 끝나면 '한 판 더'(찾은 것이 있으면 작은 '깔까?'도)
    this.links.sky.setDusk(1);
    this.links.input.hold(true);
    // 아직 줄에 끼지 못한 상자는 아무 데도 없으니 이긴 상자들에 끼지 않는다
    const losers = this.seekers.filter((k) => k.state === "hidden" && k.box.visible);
    for (const k of losers) k.box.setFrozen(false);
    this.disguises.undress();
    this.sunset.start(losers, () => {
      this.release();
      const canOpen = this.caught.length > 0;
      this.overlay.showEnding(() => this.again(), canOpen ? () => this.openFound() : null);
    });
    this.goTo("lost");
  }

  // 해가 진 뒤의 '깔까?': 찾은 것만 깐다
  private openFound() {
    if (this.phase !== "lost" || this.s.player.isHeld) return;
    this.overlay.showEnding(null);
    this.startWipe();
  }

  // 찾았다: 시간이 잠깐 멈추고(상자는 깜짝 자세로 굳는다) → 눈을 가리고 버티다 → 포기하고 크게 폴짝(한 바퀴, 종이 꽃가루, '찾았다!') →
  // 내 뒤 줄에 선다(위 칸이 하나 찬다). 굴러떨어진 상자는 벌떡 일어난 데서 바로 폴짝으로 이어진다. 조작은 멈춘 뒤 바로 풀린다
  private catchBox(k: Seeker, how: FoundHow) {
    const F = HIDE.find,
      b = k.box;
    const as = this.disguises.kindOf(k),
      shownFor = this.disguises.shownFor(k),
      wasFalling = k.state === "falling";
    k.state = "caught";
    k.slot = this.caught.length;
    this.caught.push(k);
    b.setFrozen(false);
    b.setPeek(null);
    b.holdBreath(false);
    b.setRestless(false);
    b.setWobble(false);
    const { id: spot, kind } = k.spot;
    this.log.found({ spot, kind, how, as, shownFor }, this.time);
    this.sinceFind = 0;
    this.stuckT = 0;
    // 굴러떨어진 상자는 벌떡 일어난 데서 바로 폴짝
    const coverFor = wasFalling ? 0 : F.coverSeconds;
    if (!wasFalling) {
      b.startle(true);
      b.coverEyes(true);
      this.links.pause(F.pauseSeconds);
    }
    this.timeline.after(coverFor, () => {
      const high = b.hh * 2 * FOUND_HOP;
      b.coverEyes(false);
      b.hop(high, true);
      const center = b.center(at);
      this.fx.confetti(center, this.rand);
      this.s.fx.burst(center, 14, 8);
      this.overlay.showBig(HIDE.copy.found);
      const count = this.caught.length;
      this.s.events.emit("hideBoxFound", { count, how });
    });
    this.timeline.after(coverFor + F.hopSeconds, () => {
      k.state = "line";
      this.line.join(b, k.slot);
      this.overlay.fillSlot(k.slot);
    });
  }

  // 칙에 걸림: 안개 알갱이가 내 자리에서 상자 쪽으로 빨려가듯 흐른다(share — 너무 멀면 가다 떨어진다)
  private pullMist(k: Seeker, share: number) {
    const from = this.s.player.P.clone(),
      to = k.box.center(at).clone(),
      isShort = share < 1,
      down = this.s.player.p.clone();
    for (let i = 1; i <= MIST_DOTS; i++) {
      const part = (i / (MIST_DOTS + 1)) * share,
        wait = part * HIDE.find.mistSeconds;
      this.timeline.after(wait, () => {
        const mote = tmp.copy(from).lerp(to, part);
        // 너무 멀면 힘없이 처진다
        const droop = -part * 4;
        if (isShort) mote.addScaledVector(down, droop);
        this.fx.dot(mote, 0.7, 0.35);
      });
    }
  }

  // 재채기: 에…취! — 터지는 순간 라임 안개, 상자 위 '에취!' 말풍선, 가리고 있던 것이 흔들린다(소리 없이도 보이게). 그 뒤 '들켰나?' 하고 굳는다
  private sneeze(k: Seeker) {
    if (this.phase !== "seek" || (k.state !== "hidden" && k.state !== "struck")) return;
    k.sneezedAt = this.time;
    k.box.sneeze();
    this.timeline.after(SNEEZE_AT, () => {
      const center = k.box.center(at);
      this.fx.sneeze(center, this.rand);
      this.overlay.bubble(HIDE.copy.sneeze, (out) => overBox(k, out), BUBBLE_TIME);
      this.links.shake(k.box.v, SHAKE_NEAR);
      this.s.events.emit("hideBoxSneezed", {});
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
      b.setSize(1, true);
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
    this.timeline.after(BONUS_WAVE, () => {
      this.overlay.showBig(HIDE.copy.open);
      this.goTo("prompt");
    });
  }

  // 깔까?: 큰 글자가 떴다 지면 언박싱으로 넘어간다(놀이기구에서 내린 뒤에)
  private whilePrompting() {
    if (this.phaseT < HIDE.screen.bigSeconds || this.s.player.isHeld) return;
    this.startWipe();
  }

  // 언박싱으로: 눈을 감는 동안 광장 출발 자리로 옮긴다
  private startWipe() {
    this.overlay.showSlots(false);
    this.overlay.showStats(null);
    this.s.hud.setQuiet(true);
    this.links.studio.setWearHidden(true);
    this.links.input.hold(true);
    this.overlay.setLids(true);
    this.timeline.after(LIDS_MOVE, () => this.arrangeUnbox());
    this.goTo("wipe");
  }

  // 눈을 감은 동안 광장 출발 자리로 옮겨 찾은 상자들을 앞에 세운다(줄 설 때의 작은 크기로) —
  // 그 자리가 놀이기구 안·조형물 곁이면 앞에서 비추는 카메라가 막혀서, 언박싱은 늘 트인 광장에서 한다. 못 찾은 상자는 물러난다
  private arrangeUnbox() {
    const { player, occ, camera } = this.s;
    // 닫히는 사이에 놀이기구가 나를 붙잡았으면 내릴 때까지 기다린다(실린 채 옮기면 그 놀이기구가 나를 놓지 못한다)
    if (player.isHeld) {
      this.timeline.after(0.2, () => this.arrangeUnbox());
      return;
    }
    const boxes = this.caught.map((k) => k.box);
    if (this.hasBonus) boxes.push(this.bonus);
    for (const k of this.seekers) if (k.state === "hidden") k.box.visible = false;
    for (const b of boxes) b.setSize(HIDE.line.scale, true);
    this.sunset.clear();
    camera.setZoom(1);
    // 출발 자리에서 광장 바깥(트인 쪽)을 보고 선다 — 소원 나무 쪽은 공 놀이기구가 줄 가운데를 가린다
    const hub = occ.hubs[STAGE_HUB];
    player.goHome(hub);
    const away = tmp.copy(player.h).negate();
    player.teleport(player.p as THREE.Vector3, away, 0);
    this.unboxing.arrange(boxes);
    this.timeline.after(0.25, () => {
      this.overlay.setLids(false);
      const found = this.caught.length;
      const contents = dealContents(found, this.hasBonus, this.rand);
      this.goTo("unbox");
      this.unboxing.start(boxes, contents, () => this.finish());
    });
  }

  // 다 열었다: 판이 끝났다 — '한 판 더'
  private finish() {
    this.overlay.showSlots(false);
    this.goTo("end");
    this.release();
    this.overlay.showEnding(() => this.again());
  }

  // 판에서 놓아 준다(다 열었거나, 해가 져서 단추가 떴다): 손을 놓고, 옷장 단추·장소의 라임빛·따라붙는 손님을 돌려주고,
  // 기록을 닫는다(?debug 면 잰 값도)
  private release() {
    this.s.hud.setQuiet(false);
    this.links.setPlaceGlow(true);
    this.links.setCompany(true);
    this.links.input.hold(false);
    this.links.studio.setWearHidden(false);
    this.log.finish(this.time);
    if (!isStatsShown()) return;
    const lines = this.log.lines();
    this.overlay.showStats(lines);
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

  // 처음(꼭꼭 숨어라)으로. 걸어 둔 일은 버린다. 입력은 begin 이 다시 막는다(꾸미기 씬이 열려 있으면 씬이 막고 있다)
  private restart() {
    this.timeline.clear();
    this.overlay.setLids(false);
    this.overlay.showSlots(false);
    this.goTo("wait");
  }

  private goTo(phase: Phase) {
    this.phase = phase;
    this.phaseT = 0;
  }

  /* ─── 내부: 화면 ─────────────────────────── */

  // 화면 안인가(가장자리에 걸친 것·카메라 뒤는 아니다). 화면 위 자리는 ndc 에 남는다
  private isSeen(world: THREE.Vector3): boolean {
    ndc.copy(world).project(this.s.camera.camera);
    return ndc.z < 1 && Math.abs(ndc.x) <= SEEN_EDGE && Math.abs(ndc.y) <= SEEN_EDGE;
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

// 말풍선 자리: 상자 위
function overBox(k: Seeker, out: THREE.Vector3) {
  const lift = k.box.hh * k.box.size + BUBBLE_OVER;
  k.box.center(out).addScaledVector(k.box.v, lift);
}
