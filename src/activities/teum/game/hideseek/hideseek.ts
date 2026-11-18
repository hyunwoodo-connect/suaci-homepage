import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Tappable } from "../core/tap";
import type { Services } from "../services";
import { S } from "../settings";
import type { BystanderCreatures, KeepOff } from "./bystanders";
import { Bystanders } from "./bystanders";
import { HideFx } from "./effects";
import { FindLog } from "./findStats";
import type { Pattern, PropSpec } from "./findTuning";
import { FIND } from "./findTuning";
import { HidingScene } from "./hiding";
import { LimeBox } from "./limebox";
import { BoxLine } from "./line";
import { LookAround } from "./lookAround";
import { Mushrooms } from "./mushrooms";
import { JUNKS, OpenFx } from "./openFx";
import { shakeStarts } from "./opening";
import { splitAt, STAGE } from "./openTuning";
import { OUTLINE_VIEW } from "./outline";
import { HideOverlay, LIDS_MOVE } from "./overlay";
import { buildStamp, forcedLevel, hideSet, isLookAround, isStatsShown } from "./params";
import { classOf, dealPatterns, dealRound, moveTargets } from "./patterns";
import type { PickTarget } from "./picker";
import { pickAt } from "./picker";
import type { Candidate } from "./props";
import { Props } from "./props";
import type { Seeker } from "./seeker";
import { createSeeker } from "./seeker";
import { roundSpots, STAGE_HUB } from "./spots";
import { Timeline } from "./timeline";
import type { BloomSpot } from "./trail";
import { FlowerTrail, longestTrail } from "./trail";
import { HIDE } from "./tuning";
import type { UnboxLinks } from "./unbox";
import { dealContents, Unboxing } from "./unbox";
import type { WarmCat, WarmTarget } from "./warmth";
import { Warm } from "./warmth";

// 숨바꼭질 한 판 — 조각 02 '찾는 손맛': 힌트 없이 '의심 → 가까워짐 → 눌러서 찾기'.
//   판 영역에 후보 물건(props)이 스물 넘게 있고, 넷에만 상자가 숨어 있다. 숨는 패턴은 넷(patterns):
//     A 혼자 튀는 애(같은 물건 무리 가운데 하나 — 리본 끝이 삐죽 나오고 혼자 살짝 떤다) · B 길 끝(꽃 길의 끝 물건 속) ·
//     C 속에 쏙(낱개 물건 속 — 겉으로는 안 보인다) · D 높은 곳(탑 꼭대기·통통 구름 위 — 리본과 눈이 빼꼼, 올라가서 눌러야 한다)
//   내 행동은 하나, 물건을 누르는 것이다(candidate.tapReach 안에서). 상자가 든 물건이면 찾은 것, 아니면 꽝(말랑 찌그러진다) —
//     꽝 곁에 진짜 상자가 있으면 빼꼼 나와 메롱 하고 보이는 포물선으로 다른 물건에 이사 간다(miss)
//   가까워지는 것은 소리와 세계 안의 움직임으로만 안다(warmth — 키득·고양이 꼬리·물건의 바스락). 화면에는 위 칸 넷과 큰 글자뿐
//   버섯(mushrooms)은 높이 올라가 둘러보고 높은 곳에 닿는 이동 수단이다. 생물은 구경꾼(bystanders) — 눌러도 반응하지 않고 달아나지도 않는다
// 흐름: 꼭꼭 숨어라(hiding — 상자들이 등 뒤로 달려 나가고, 눈을 감은 동안 물건 속에 든다) → 찾기(해는 지지 않는다 — 넷을 다 찾아야 끝난다) →
//   금색 상자 → '깔까?' → 언박싱(unbox) → '한 판 더'.
// 앞 조각의 생물 도움·전설·해 지기·몰래 움직이기·아닌 척하기는 꺼 두었다(파일은 남아 있다 — helpers·hints·legend·sunset·sneak·disguise·coach·focus).
// 값은 hideseek.data.json(FIND·HIDE), 정한 때에 할 일은 timeline. 유영 조작 값과 맵은 건드리지 않는다

/** 판 흐름 */
type Phase = "wait" | "hiding" | "seek" | "bonus" | "prompt" | "wipe" | "unbox" | "end";

/** 누른 것: 후보 물건 · 버섯 */
/**
 * 열어 보는 중인 물건 하나(누른 때부터 끝까지). 두근은 꽝이든 아니든 같고, 갈리는 때(splitAt)에 팡 아니면 푸슉.
 * 누르는 순간 든 상자를 붙잡아 둔다 — 두근거리는 사이에 상자가 이사 가 버리지 않게
 */
interface Opening {
  c: Candidate;
  /** 누른 때부터(초) */
  t: number;
  /** 든 상자(없으면 꽝) */
  hider: Hider | null;
  /** 다음에 낼 덜컹 소리(몇째) */
  knock: number;
  /** 찾음: 상자가 솟기 시작한 높이·꼭대기 높이(m) · 내려앉을 자리와 그 땅 높이 · 춤 박자에 뿌린 별 수 */
  from: number;
  apex: number;
  land: THREE.Vector3;
  landAt: number;
  stars: number;
}

/** 숨은 상자 하나: 숨은 물건·패턴, 지금 하는 일(물건 속 · 빼꼼 나와 메롱 · 이사 중) */
interface Hider {
  k: Seeker;
  pattern: Pattern;
  host: Candidate;
  mode: "in" | "taunt" | "hop";
  modeT: number;
  /** 메롱 뒤에 이사 갈 물건(없으면 제자리로 들어간다) · 이사 떠난 자리와 높이(m) */
  next: Candidate | null;
  readonly hopFrom: THREE.Vector3;
  hopBase: number;
  /** 이사한 횟수 · 마지막으로 이사한 때(찾기 시작부터 초) */
  moves: number;
  movedAt: number;
  /** 내가 곁(candidate.tapReach)에 있나 · 곁에 왔다가 못 찾고 나간 횟수 */
  isNear: boolean;
  nearMisses: number;
  /** 다음 몸짓(리본 빼꼼·혼자 떨기)까지(초) · 리본을 내밀고 있는 남은 시간(초 — 패턴 B) */
  fidgetWait: number;
  peekLeft: number;
  /** 이 상자의 꽃 길(패턴 B 만 — 상자가 이사 가면 따라 옮기고, 찾으면 거둔다) */
  trail: FlowerTrail | null;
}

/** 숨바꼭질이 쓰는 것(Game 이 만들 때 넘긴다) */
export interface HideSeekLinks {
  /** 입력: 막기·끌지 않고 누르고 있는 시간(초) */
  input: { hold(on: boolean): void; pressSeconds(): number };
  /** 꾸미기 씬: 열려 있나 · 옷장 단추 숨기기 */
  studio: { readonly isOpen: boolean; setWearHidden(hidden: boolean): void };
  /** 언박싱의 일어나는 일(커지기·고래) */
  unbox: UnboxLinks;
  /** 생물(버섯과 구경꾼을 판에 부른다) */
  creatures: BystanderCreatures;
  /** 고래: 타고 있으면 내려 준다 */
  whale: { dismount(): void };
  /** 하늘: 노을이 진 정도(0 낮 — 이 판은 해가 지지 않는다) */
  sky: { setDusk(k: number): void };
  /** 옆을 따라다니는 고양이(꼬리 반짝임) */
  cat: WarmCat;
  /** 장소(소원 나무 …)가 반응할 때 라임빛으로 물드나 — 판 동안은 끈다(라임색은 상자의 것) */
  setPlaceGlow(on: boolean): void;
  /** 장소 이름표·말풍선 — 판 동안은 숨긴다(화면에 글자를 띄우지 않는다) */
  setLabels(on: boolean): void;
  /** 내 뒤에 다른 것(만난 손님·꼬마 라임·별)이 따라붙어도 되나 — 판 동안은 끈다(찾은 상자만 줄을 선다) */
  setCompany(on: boolean): void;
  /** 세상의 것들(랜드마크·장소·생물)이 내게 반응하나 — 판 동안은 끈다(꿈틀하는 것은 후보 물건뿐이다) */
  setReactions(on: boolean): void;
}

/** 누른 물건으로 날아가는 안개 알갱이 수 */
const MIST_DOTS = 8,
  MIST_SIZE = 0.6,
  MIST_LIFE = 0.3;
/** 덜컹이 시작되는 때들과 결과가 갈리는 때(누른 때부터 초) */
const SHAKES = shakeStarts(STAGE.open),
  SPLIT = splitAt(STAGE.open);
/** 찾음(갈린 뒤부터 초): 상자가 솟기 시작 · 춤과 "찾았다!" */
const LAUNCH_AFTER = 0.02,
  DANCE_AFTER = 1.02;
/** 이사 오는 상자를 기다릴 때: 갈리는 때 바로 앞(초)에 멈춰 숨죽인다 */
const HOLD_SHY = 0.001;
/** 내려앉을 자리를 찾아보는 방향(내 쪽에서 비켜난 각의 배수 — 다른 물건과 겹치면 다음 것) · 다른 물건에서 띄울 거리(m) */
const LAND_TURNS = [1, -1, 2, -2, 0, 3, -3],
  LAND_ROOM = 0.4;
/** 상자가 내려앉는 자리: 물건 가장자리에서(m)·내 쪽에서 옆으로 비켜난 각(rad) · 착지의 작은 튐(m) · 먼지 고리(m) · 빛의 크기(물건 너비의 배) · 춤 별 크기(m) */
const LAND_GAP = 0.9,
  LAND_ASIDE = 0.65,
  LAND_HOP = 0.35,
  LAND_RING = 2.6,
  FLASH_WIDE = 3.2,
  STAR_SIZE = 0.9;
/** 누르는 자리: 사방으로 넓히는 폭·가장 작은 네모(px) */
const TAP_PAD = HIDE.find.tapPad,
  TAP_MIN = HIDE.find.tapMin;
/** 금색 상자: 내려앉은 뒤 손을 흔들고 '깔까?'가 뜨기까지(초) · 먼지 고리의 반지름(m) */
const BONUS_WAVE = 1.1,
  BONUS_RING = 7;
/** 판 끝에서 이만큼(m) 돌아다니면 자유 놀이(끝 단추가 작아진다) */
const FREE_AFTER = 6;
/** 숨은 모습 — 물건 꼭대기 위로 내미는 몫(귀까지 넣은 상자 키에서): A 는 리본 끝만 삐죽 · D 는 리본과 눈까지 · B 는 가끔 리본 끝을 잠깐 */
const EARS_OUT = 0.07,
  HIGH_PEEK = 0.72,
  TRAIL_PEEK = 0.1;
/** 속에 숨은 상자가 물건 꼭대기보다 이만큼(m) 아래에 있다(안 보인다) */
const INSIDE_DIP = 0.3;
/** 몸짓 사이(초, 이 사이 아무 때나) · 길 끝 상자가 리본을 내미는 시간(초) */
const FIDGET_EVERY: readonly [number, number] = [3, 6],
  PEEK_SECONDS = 1.3;
/** 메롱: 물건 밖으로 내미는 몫(상자 키) · 올라오는 빠르기 */
const TAUNT_OUT = 0.8,
  TAUNT_RISE = 12;
/** 곁을 떠난 것으로 치는 거리(candidate.tapReach 에 더한다, m) */
const LEAVE_GAP = 3;
/** 밖으로 나와 보이는 상자를 누르는 자리: 귀까지 넣은 키의 몫·너비의 몫(상자 키의 반 기준) */
const BOX_PICK_TALL = 1.3,
  BOX_PICK_WIDE = 0.75;

const tmp = new THREE.Vector3(),
  at = new THREE.Vector3(),
  ahead = new THREE.Vector3(),
  axis = new THREE.Vector3(),
  eye = new THREE.Vector3(),
  side = new THREE.Vector3();

/** 숨바꼭질 */
export class HideSeek implements Thing, Tappable {
  private phase: Phase = "wait";
  private phaseT = 0;
  private readonly seekers: Seeker[] = [];
  private readonly hiders: Hider[] = [];
  /** 찾은 차례(칸 번호이자 줄에서의 차례) */
  private readonly caught: Seeker[] = [];
  private readonly bonus: LimeBox;
  private hasBonus = false;
  private readonly overlay: HideOverlay;
  private readonly fx: HideFx;
  private readonly openFx: OpenFx;
  private readonly openings: Opening[] = [];
  /** 꽝에서 나오는 것을 돌려 쓰는 차례 */
  private junkTurn = 0;
  /** 구경꾼을 한 번은 앉혔나(첫 판 전에 — 시작부터 주민이 살고 있게) */
  private isSeated = false;
  /** 이사 중인 상자의 세계 자리(구경꾼이 눈으로 쫓는다) */
  private readonly flying = new THREE.Vector3();
  private readonly timeline = new Timeline();
  private readonly hiding: HidingScene;
  private readonly line: BoxLine;
  private readonly unboxing: Unboxing;
  private readonly props: Props;
  /** 꽃 길(길 끝 상자마다 하나 — 필요한 만큼 만들어 다시 쓴다) */
  private readonly trails: FlowerTrail[] = [];
  private readonly hub: THREE.Vector3;
  /** 버섯을 쓴 횟수 가운데 기록에 남긴 것 */
  private loggedJumps = 0;
  private readonly warm: Warm;
  private readonly mushrooms: Mushrooms;
  private readonly bystanders: Bystanders;
  private readonly looker: LookAround | null;
  private readonly log = new FindLog();
  private readonly rand: () => number;
  private time = 0;
  /** 찾기 시작 뒤 흐른 시간(초) */
  private roundT = 0;
  /** 맨 처음 판인가(이 규칙으로 이 기기에서 처음 — 쉬운 패턴) · 주소로 고른 단계·자리 씨앗(없으면 null) */
  private first = false;
  private readonly pickedLevel: number | null;
  private readonly pickedSet: number | null;
  /** 몇째 판인가(이번 방문에서 — 주소로 고른 자리 씨앗에 더한다) */
  private played = 0;
  /** 꾸미기 씬이 열려 있었나 · '한 판 더'를 눌렀는데 놀이기구에서 아직 못 내렸다 · 판 끝 단추가 뜬 자리 */
  private wasStudio = false;
  private isAgainWaiting = false;
  private readonly endAt = new THREE.Vector3();

  constructor(
    private readonly s: Services,
    private readonly links: HideSeekLinks,
    parent: HTMLElement,
  ) {
    const rng = s.rng.fork("hideseek");
    this.rand = () => rng.next();
    this.pickedSet = hideSet();
    this.pickedLevel = forcedLevel();
    this.overlay = new HideOverlay(parent);
    this.fx = new HideFx(s.scene);
    this.openFx = new OpenFx(s.scene, s.mats.lime);
    const hub = s.occ.hubs[STAGE_HUB];
    if (!hub)
      throw new Error(`[teum] hideseek.data.json — stage.hub: 지도에 없는 마을(${STAGE_HUB})`);
    // 상자 넷(숨는 자리는 판마다 물건으로 정한다 — 옛 자리표의 첫 묶음은 자리만 채워 둔다)
    const spots = roundSpots(1);
    for (const spot of spots) {
      const box = new LimeBox(s.models, s.scene, 1, false, this.rand),
        seeker = createSeeker(box, spot);
      this.seekers.push(seeker);
    }
    this.bonus = new LimeBox(s.models, s.scene, HIDE.bonus.scale, true, this.rand);
    this.bonus.visible = false;
    this.bonus.setLongEars(false);
    this.hiding = new HidingScene(s, this.seekers, this.fx, this.overlay, this.timeline);
    this.line = new BoxLine(s);
    this.unboxing = new Unboxing(s, links.unbox, this.fx, this.rand);
    this.props = new Props(s, hub, this.rand);
    this.hub = hub;
    this.warm = new Warm(s, links.cat, this.rand);
    this.mushrooms = new Mushrooms(s, links.creatures, this.props, this.rand);
    this.bystanders = new Bystanders(links.creatures, this.rand);
    const press = () => links.input.pressSeconds();
    this.looker = isLookAround() ? new LookAround(s, press) : null;
    if (isStatsShown()) {
      const stamp = buildStamp();
      this.overlay.showStamp(stamp);
    }
  }

  /** 언박싱(과 그리로 넘어가는 동안)은 누름을 혼자 받는다 — 다른 놀이기구가 나를 붙잡아 줄 앞에서 데려가지 않게 */
  get takesTaps(): boolean {
    return this.phase === "unbox" || this.phase === "wipe";
  }

  /** 판이 도는 중인가(꼭꼭 숨어라~찾기) — 그동안은 바닥·장소가 누름에 반응하지 않는다(누를 수 있는 것은 후보 물건과 버섯뿐) */
  get isRoundOn(): boolean {
    return this.phase === "hiding" || this.phase === "seek";
  }

  /**
   * 길 끝이 될 수 있는 물건(낱개)마다 놓일 꽃 길 — 가장 길게 놓았을 때(지도 점검과 내려다본 지도가 본다).
   * 길을 놓을 데가 없는 물건은 꽃이 없다
   */
  trailPlans(): { host: string; blooms: BloomSpot[] }[] {
    const T = FIND.trail,
      cls = classOf("B");
    return this.props.list
      .filter((c) => c.spec.cls === cls)
      .map((c) => {
        const found = longestTrail(this.s, this.hub, c, this.props.list, T.count[1], T.gap[1]);
        return { host: c.spec.id, blooms: found ?? [] };
      });
  }

  /**
   * 화면 (x, y)를 눌렀다: 리본 달린 물건에 걸리면 그것이 반응하고 true. 걸린 것이 없으면 false —
   * 리본이 없는 것(랜드마크·조형물·나무·놀이기구·생물·버섯·빈 데)은 판 중에 눌러도 아무 일도 없다
   */
  pick(x: number, y: number): boolean {
    if (this.phase !== "seek" || this.links.studio.isOpen) return false;
    const targets = this.pickTargets(),
      view = { w: innerWidth, h: innerHeight };
    const hit = pickAt(x, y, targets, this.s.camera.camera, view, TAP_PAD, TAP_MIN);
    if (!hit) return false;
    return this.tapProp(hit);
  }

  /** 빈 데 누름: 언박싱 중이면 지금 상자를 연다. 판 중에는 아무 일도 없다(바닥은 반응하지 않는다) */
  onTap() {
    if (this.phase === "unbox") this.unboxing.tap();
  }

  /** 한 프레임: 판 흐름·상자·물건(따라가는 카메라 뒤에 — 둘러보기·언박싱이 카메라를 잠깐 빌린다) */
  update(f: Frame) {
    const dt = f.dt;
    this.time = f.time;
    OUTLINE_VIEW.value.set(innerWidth, innerHeight);
    const studioOpen = this.links.studio.isOpen;
    if (studioOpen !== this.wasStudio) this.switchStudio(studioOpen);
    // 꾸미기 씬이 열려 있는 동안은 판을 멈추고 카메라를 씬에 맡긴다(숨는 장면이면 닫힌 뒤에 처음부터 — 입력은 씬이 막고 있다)
    if (studioOpen) {
      if (this.phase === "hiding") this.restart();
      this.unboxing.dropCamera();
      this.looker?.drop();
    } else this.step(dt);
    for (const k of this.seekers) k.box.update(dt, f.time);
    this.bonus.update(dt, f.time);
    this.fx.update(dt);
    this.openFx.update(dt);
    for (const trail of this.trails) trail.update(dt);
    this.unboxing.update(dt, f.time);
    const canLook = this.phase === "seek" || this.phase === "prompt" || this.phase === "end";
    if (!studioOpen) this.looker?.update(dt, canLook);
    this.overlay.update(this.s.camera.camera, dt);
  }

  dispose() {
    this.overlay.dispose();
    this.fx.dispose();
    this.openFx.dispose();
    this.unboxing.dispose();
    this.props.dispose();
    for (const trail of this.trails) trail.dispose();
    for (const k of this.seekers) k.box.dispose();
    this.bonus.dispose();
  }

  /* ─── 내부: 판 흐름 ─────────────────────────── */

  private step(dt: number) {
    this.phaseT += dt;
    this.timeline.tick(dt);
    const isSeeking = this.phase === "seek";
    this.props.update(dt, isSeeking, this.time);
    this.mushrooms.update(dt, isSeeking);
    // 열어 보기는 판이 넘어가도 끝까지 간다(넷째 상자가 줄에 설 때 다른 물건의 꽝이 진행 중일 수 있다)
    for (let i = this.openings.length - 1; i >= 0; i--)
      if (this.stepOpening(this.openings[i], dt)) this.openings.splice(i, 1);
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
    const hasLine = isSeeking || this.phase === "bonus" || this.phase === "prompt";
    if (hasLine) this.line.update(dt);
    // '한 판 더'를 눌렀을 때 놀이기구에 실려 있었으면 내린 뒤에 시작한다(실린 채 옮기면 그 놀이기구가 나를 놓지 못한다)
    if (this.isAgainWaiting && !this.s.player.isHeld) {
      this.isAgainWaiting = false;
      this.startAgain();
    }
    // 판 끝에서 돌아다니기 시작하면 자유 놀이: '한 판 더'가 작아지고 세상의 안내 글이 돌아온다
    const roam = this.s.player.p.angleTo(this.endAt) * S.R,
      isFree = this.phase === "end" && roam > FREE_AFTER;
    this.overlay.setEndingSmall(isFree);
    if (isFree) this.s.hud.setQuiet(false);
  }

  // 꾸미기 씬으로 들어간다: 언박싱 효과(거대해짐)를 끝내고 고래에서 내려 주고 판 화면을 통째로 숨긴다. 나오면 들어가기 전 화면 그대로
  private switchStudio(open: boolean) {
    this.wasStudio = open;
    this.overlay.setHidden(open);
    if (!open) return;
    this.unboxing.resetHappenings(true);
    this.links.whale.dismount();
    this.overlay.clearFloating();
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
    const L = this.links;
    L.input.hold(true);
    L.studio.setWearHidden(true);
    L.sky.setDusk(0);
    L.setPlaceGlow(false);
    L.setLabels(false);
    L.setCompany(false);
    L.setReactions(false);
    const o = this.overlay;
    o.setLids(false);
    o.resetSlots();
    o.showSlots(true);
    o.showEnding(null);
    o.showStats(null);
    this.fx.clear();
    this.openFx.clear();
    this.openings.length = 0;
    this.s.camera.kickFov(0);
    this.timeline.clear();
    this.caught.length = 0;
    this.hiders.length = 0;
    this.line.clear();
    for (const trail of this.trails) trail.clear();
    // 지난 판에 찾은 물건의 리본도 여기서 거둔다(꼭꼭 숨어라 장면에 남아 있지 않게)
    this.props.reset();
    this.warm.stop();
    this.mushrooms.stop();
    this.loggedJumps = 0;
    this.hasBonus = false;
    this.bonus.visible = false;
    const screen = `${innerWidth}x${innerHeight}`,
      now = Date.now();
    this.log.begin(screen, now, this.time);
    // 맨 처음 판: 이 규칙(조각 02)으로 이 기기에서 처음 하는 판 — 앞 조각을 해 본 기기도 처음은 쉽게. 주소로 단계를 골랐으면 그대로
    this.first = this.pickedLevel === null ? this.log.isFirstOnDevice : this.pickedLevel === 0;
    // 주민은 첫 판 전부터 광장에 산다. "꼭꼭 숨어라" 동안은 눈을 가리듯 등을 돌린다
    this.bystanders.watch(null);
    if (!this.isSeated) {
      const keepOff = this.keepOff();
      // 버섯도 제자리에 먼저 앉힌다(첫 판의 "꼭꼭 숨어라"에 한데 몰려 있지 않게)
      this.mushrooms.begin(hub);
      this.bystanders.seat(hub, keepOff);
    }
    this.isSeated = true;
    this.bystanders.turnAway(true);
    this.hiding.start(hub, null, this.first, HIDE.difficulty[0], {
      // 눈을 감은 동안: 상자들이 물건 속에 들고, 꽃 길이 놓이고, 버섯과 구경꾼이 제자리에 앉는다
      settled: () => this.settle(hub),
      go: () => this.startSeek(),
    });
    this.goTo("hiding");
  }

  // 눈을 감은 동안: 패턴 넷을 섞어 물건을 고르고 상자를 숨긴다
  private settle(hub: THREE.Vector3) {
    this.mushrooms.begin(hub);
    const keepOff = this.keepOff();
    this.bystanders.seat(hub, keepOff);
    const rand = this.dealRand(),
      patterns = dealPatterns(this.first, rand),
      // 꽃 길을 놓을 데가 없는 물건은 이번 판에 길 끝으로 쓰지 않는다(이 빠진 길은 길로 안 읽힌다).
      // 그런 물건뿐이라 못 고르면 가리지 않고 고른다 — 길 없는 길 끝이 판이 멈추는 것보다 낫다
      canEnd = (p: PropSpec) => this.canTrail(this.props.of(p)),
      dealt =
        dealRound(FIND.props, patterns, rand, canEnd) ?? dealRound(FIND.props, patterns, rand);
    if (!dealt)
      throw new Error("[teum] hideseek.data.json — props: 상자 넷을 숨길 물건을 고르지 못했다");
    dealt.forEach((d, i) => {
      const k = this.seekers[i],
        host = this.props.of(d.prop);
      const h: Hider = {
        k,
        pattern: d.pattern,
        host,
        mode: "in",
        modeT: 0,
        next: null,
        hopFrom: new THREE.Vector3(),
        hopBase: 0,
        moves: 0,
        movedAt: -Infinity,
        isNear: false,
        nearMisses: 0,
        fidgetWait: this.nextFidget(),
        peekLeft: 0,
        trail: null,
      };
      this.hiders.push(h);
      this.tuck(h);
      if (d.pattern !== "B") return;
      h.trail = this.takeTrail();
      h.trail.show(host, this.props.list, this.rand);
    });
    const ids = dealt.map((d) => d.prop.id);
    this.log.dealt(patterns, ids);
    this.tellHiding();
  }

  // 리본 달린 물건들(구경꾼이 그 둘레에는 서지 않는다 — 물건을 가려 못 누르게 하면 안 된다)
  private keepOff(): KeepOff[] {
    return this.props.list.map((c) => ({ v: c.v, r: c.foot }));
  }

  // 상자가 숨어 있는 물건들을 구경꾼에게 알린다(곁의 생물이 가끔 힐끗거린다 — 아주 약한 단서)
  private tellHiding() {
    const spots = this.hiders.filter((h) => h.k.state === "hidden").map((h) => h.host.v);
    this.bystanders.setHiding(spots);
  }

  // 그 물건 앞에 꽃 길을 놓을 수 있나: 가장 짧은 길을 가장 넓은 간격으로 놓아 본다
  private canTrail(c: Candidate): boolean {
    const T = FIND.trail;
    return longestTrail(this.s, this.hub, c, this.props.list, T.count[0], T.gap[1]) !== null;
  }

  // 아직 쓰지 않은 꽃 길 하나(모자라면 만든다 — 길 끝 상자가 둘이면 길도 둘이다)
  private takeTrail(): FlowerTrail {
    const used = this.hiders.flatMap((h) => (h.trail ? [h.trail] : [])),
      free = this.trails.find((t) => !used.includes(t));
    if (free) return free;
    const made = new FlowerTrail(this.s, this.hub);
    this.trails.push(made);
    return made;
  }

  // 자리를 고르는 난수: 주소로 자리 씨앗(?hide=N)을 골랐으면 그 씨앗(판마다 하나씩 더한다), 아니면 놀이 난수
  private dealRand(): () => number {
    if (this.pickedSet === null) return this.rand;
    let seed = (this.pickedSet + this.played) * 7919 + 17;
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }

  // 눈을 떴다: '술래는 너'와 함께 조작이 풀리고 찾기가 시작된다
  private startSeek() {
    this.overlay.showBig(HIDE.copy.it);
    this.bystanders.turnAway(false);
    this.links.input.hold(false);
    this.log.seekStarted(this.time);
    this.roundT = 0;
    this.goTo("seek");
  }

  // 찾는 중: 숨은 상자들의 몸짓, 메롱과 이사, 뜨거워 차가워. 해는 지지 않는다 — 넷을 다 찾아야 끝난다
  private seek(dt: number) {
    this.roundT += dt;
    let nearest: Hider | null = null,
      nearestD = Infinity;
    for (const h of this.hiders) {
      if (h.k.state !== "hidden") continue;
      // 지금 열어 보는 물건에 든 상자는 하던 짓(메롱·이사 준비)을 멈추고 기다린다 — 두근거리는 사이에 날아가 버리지 않게
      if (!this.openings.some((o) => o.hider === h)) this.stepHider(h, dt);
      const dist = this.distanceTo(h);
      // 곁을 지나쳤는지는 물건 속에 있을 때만 센다(메롱·이사 중에는 상자가 제 발로 멀어진다)
      if (h.mode === "in") this.watchNear(h, dist);
      if (dist < nearestD) {
        nearestD = dist;
        nearest = h;
      }
    }
    const target = nearest ? this.warmTarget(nearest, nearestD) : null;
    this.warm.update(dt, target);
    if (this.mushrooms.uses !== this.loggedJumps) {
      this.loggedJumps = this.mushrooms.uses;
      this.log.mushrooms(this.loggedJumps);
    }
    const isAllCaught = this.caught.length === this.seekers.length;
    if (isAllCaught && this.caught.every((k) => k.state === "line")) this.endSeek();
  }

  // 뜨거워 차가워가 보는 것: 가장 가까운 못 찾은 상자까지의 거리와 자리, 바스락거릴 물건(물건 속에 있을 때만 흔들린다)
  private warmTarget(h: Hider, dist: number): WarmTarget {
    const where = h.mode === "hop" ? h.k.box.center(at) : this.props.center(h.host, at);
    return {
      dist,
      at: where,
      rustle: () => {
        if (h.mode === "in") this.props.rustle(h.host);
      },
    };
  }

  // 나와 숨은 상자 사이(m): 물건 속이면 그 물건까지, 이사 중이면 날아가는 상자까지
  private distanceTo(h: Hider): number {
    if (h.mode !== "hop") return this.props.distance(h.host);
    return h.k.box.center(at).distanceTo(this.s.player.P);
  }

  // 곁(candidate.tapReach)에 왔다가 못 찾고 나가면 센다
  private watchNear(h: Hider, dist: number) {
    const reach = FIND.candidate.tapReach;
    if (dist <= reach) {
      h.isNear = true;
      return;
    }
    if (!h.isNear || dist < reach + LEAVE_GAP) return;
    h.isNear = false;
    h.nearMisses++;
    this.log.nearMiss();
  }

  /* ─── 내부: 숨은 상자 ─────────────────────────── */

  // 상자를 물건 속에 넣는다: 물건에 맞게 줄이고, 패턴대로 내민다(A 귀 끝만 · D 리본과 눈 · B·C 안 보인다)
  private tuck(h: Hider) {
    const b = h.k.box,
      c = h.host,
      scale = c.fit,
      base = this.restBase(h, scale);
    h.k.state = "hidden";
    h.mode = "in";
    h.modeT = 0;
    h.peekLeft = 0;
    b.setSize(scale, true);
    const face = this.faceFrom(c.v);
    b.put(c.v, base, face);
    b.setPeek(null);
    b.setLongEars(true);
    b.setOutline(false);
    b.visible = h.pattern === "A" || h.pattern === "D";
  }

  // 물건 속에서의 바닥 높이(m): 패턴마다 내미는 만큼
  private restBase(h: Hider, scale: number): number {
    const c = h.host,
      tall = h.k.box.hh * 2 * scale,
      top = c.base + c.lid;
    if (h.pattern === "A") return top - tall * (1 - EARS_OUT);
    if (h.pattern === "D") return top - tall * (1 - HIGH_PEEK);
    return top - tall - INSIDE_DIP;
  }

  // v 에 선 것이 볼 쪽: 나(없으면 출발 쪽)를 본다
  private faceFrom(v: THREE.Vector3): THREE.Vector3 {
    const p = this.s.player.p;
    tmp.copy(p).sub(v);
    if (tmp.lengthSq() < 1e-10) tmp.copy(this.s.player.h).negate();
    return tmp;
  }

  private nextFidget(): number {
    const [lo, hi] = FIDGET_EVERY;
    return lo + (hi - lo) * this.rand();
  }

  // 숨은 상자의 한 프레임: 물건 속이면 가끔 몸짓(A 혼자 떨기 · B 리본 끝 빼꼼), 메롱 중이면 올라왔다가 이사 가거나 들어가고, 이사 중이면 포물선
  private stepHider(h: Hider, dt: number) {
    h.modeT += dt;
    if (h.mode === "taunt") {
      this.whileTaunting(h, dt);
      return;
    }
    if (h.mode === "hop") {
      this.whileHopping(h);
      return;
    }
    const b = h.k.box;
    if (h.peekLeft > 0) {
      h.peekLeft -= dt;
      if (h.peekLeft <= 0) this.tuck(h);
      return;
    }
    h.fidgetWait -= dt;
    if (h.fidgetWait > 0) return;
    h.fidgetWait = this.nextFidget();
    if (h.pattern === "A") {
      this.props.tremble(h.host);
      b.wave();
    } else if (h.pattern === "D") b.wave();
    else if (h.pattern === "B") {
      // 길 끝 상자: 리본 끝을 잠깐 내밀었다 숨는다
      const scale = h.host.fit,
        tall = b.hh * 2 * scale,
        top = h.host.base + h.host.lid;
      b.a = top - tall * (1 - TRAIL_PEEK);
      b.visible = true;
      b.wave();
      h.peekLeft = PEEK_SECONDS;
    }
  }

  // 메롱: 물건 밖으로 쑥 올라와 리본을 흔든다 → miss.tauntSeconds 뒤 이사 가거나(next) 제자리로 들어간다
  private startTaunt(h: Hider, next: Candidate | null) {
    const b = h.k.box;
    h.mode = "taunt";
    h.modeT = 0;
    h.next = next;
    h.peekLeft = 0;
    b.visible = true;
    b.wave();
    const where = this.props.center(h.host, at),
      pan = this.panOf(where);
    this.s.events.emit("findTaunted", { pan });
    this.log.taunted();
  }

  private whileTaunting(h: Hider, dt: number) {
    const b = h.k.box,
      c = h.host,
      tall = b.hh * 2 * b.size,
      out = c.base + c.lid - tall * (1 - TAUNT_OUT),
      step = dt * TAUNT_RISE,
      k = Math.min(1, step);
    b.a += (out - b.a) * k;
    if (h.modeT < FIND.miss.tauntSeconds) return;
    if (!h.next) {
      this.tuck(h);
      return;
    }
    // 폴짝 이사: 지금 자리에서 다음 물건 꼭대기로
    h.mode = "hop";
    h.modeT = 0;
    h.hopFrom.copy(b.v);
    h.hopBase = b.a;
    h.moves++;
    h.movedAt = this.roundT;
    this.log.moved();
    b.hop(0, true);
    const where = b.center(at),
      pan = this.panOf(where);
    this.s.events.emit("findHopped", { pan });
    b.center(this.flying);
    this.bystanders.watch(this.flying);
  }

  // 이사 중: 눈에 보이는 포물선으로 다음 물건까지(땅 위로는 고르게, 높이는 miss.moveArc 만큼 솟았다가). 닿으면 그 물건 속으로 쏙
  private whileHopping(h: Hider) {
    const M = FIND.miss,
      b = h.k.box,
      to = h.next;
    if (!to) {
      this.tuck(h);
      return;
    }
    const raw = h.modeT / M.moveSeconds,
      u = Math.min(1, raw),
      angle = h.hopFrom.angleTo(to.v) * u;
    axis.crossVectors(h.hopFrom, to.v).normalize();
    b.v.copy(h.hopFrom).applyAxisAngle(axis, angle).normalize();
    const land = to.base + to.lid,
      level = h.hopBase + (land - h.hopBase) * u,
      hump = 4 * u * (1 - u) * M.moveArc;
    b.a = level + hump;
    ahead.crossVectors(axis, b.v);
    b.faceTo(ahead);
    b.center(this.flying);
    if (u < 1) return;
    h.host = to;
    h.next = null;
    h.isNear = false;
    this.props.bump(to);
    this.tuck(h);
    h.trail?.show(to, this.props.list, this.rand);
    this.bystanders.watch(null);
    this.tellHiding();
  }

  /* ─── 내부: 누르기 ─────────────────────────── */

  // 누를 수 있는 것: 리본이 묶여 있는 후보 물건(닿는지는 누른 뒤에 본다). 버섯은 누르는 것이 아니라 올라서는 것이다
  private pickTargets(): PickTarget<Candidate>[] {
    const targets: PickTarget<Candidate>[] = this.props.targets();
    // 물건 밖으로 나와 보이는 상자(높은 곳의 빼꼼·리본 끝·메롱)를 눌러도 그 물건을 누른 것이다
    for (const h of this.hiders) {
      const b = h.k.box;
      if (h.k.state !== "hidden" || h.mode === "hop" || !b.visible) continue;
      if (this.openings.some((o) => o.c === h.host)) continue;
      const half = b.hh * b.size,
        spot = new THREE.Vector3(),
        center = b.center(spot),
        halfH = half * BOX_PICK_TALL,
        halfW = half * BOX_PICK_WIDE;
      targets.push({ item: h.host, center, halfH, halfW });
    }
    return targets;
  }

  // 리본 달린 물건을 눌렀다: 닿지 않으면(멀거나, 높은 곳을 밑에서) 리본만 까딱한다. 닿으면 열어 보기가 시작된다 —
  // 미스트가 날아가고 리본이 팽팽해진다. 든 상자가 있으면 그 상자를 붙잡아 둔다(두근거리는 사이에 이사 가지 않게)
  private tapProp(c: Candidate): boolean {
    const { events } = this.s;
    // 이미 열어 봤거나 찾았거나 지금 열어 보는 물건: 아무 일도 없다(그 뒤에 겹쳐 보이는 물건이 대신 열리지도 않는다)
    if (c.isFound || c.isOpened || this.openings.some((o) => o.c === c)) return false;
    // 닿지 않는 누름은 누름으로 치지 않는다 — 날갯짓·풍선 놓기 같은 놀이기구 누름이 그 물건에 가려 먹히지 않게
    if (!this.props.canReach(c)) {
      this.props.flick(c);
      this.log.far();
      events.emit("findTapped", { far: true });
      return false;
    }
    const found = this.hiderIn(c);
    this.openings.push({
      c,
      t: 0,
      hider: found ?? null,
      knock: 0,
      from: 0,
      apex: 0,
      land: new THREE.Vector3(),
      landAt: 0,
      stars: 0,
    });
    this.props.startOpen(c);
    this.pullMist(c);
    events.emit("findTapped", { far: false });
    return true;
  }

  // 그 물건에 든 상자(이사 중인 것은 아직 든 것이 아니다)
  private hiderIn(c: Candidate): Hider | null {
    const found = this.hiders.find(
      (x) => x.host === c && x.k.state === "hidden" && x.mode !== "hop",
    );
    return found ?? null;
  }

  // 열어 보기 한 프레임. 끝났으면 true
  private stepOpening(o: Opening, dt: number): boolean {
    const { events, camera } = this.s,
      O = STAGE.open,
      was = o.t;
    let next = o.t + dt;
    // 갈리는 순간 다시 본다: 두근거리는 사이에 이사 온 상자가 들었으면 찾은 것이고,
    // 지금 이 물건으로 날아오는 상자가 있으면 내려앉을 때까지 숨죽인 채 기다린다(상자가 든 채 꽝이 되지 않게)
    if (!o.hider && was < SPLIT && next >= SPLIT) {
      o.hider = this.hiderIn(o.c);
      const isIncoming = this.hiders.some((x) => x.next === o.c && x.k.state === "hidden");
      if (!o.hider && isIncoming) next = SPLIT - HOLD_SHY;
    }
    o.t = next;
    const isHit = o.hider !== null;
    this.props.setOpen(o.c, o.t, isHit);
    // 두근: 덜컹마다 두드림 소리(갈수록 높게). 첫 덜컹에 북 굴림이 깔리고 화면이 살짝 다가간다
    while (o.knock < SHAKES.length && o.t >= SHAKES[o.knock]) {
      const where = this.props.center(o.c, at),
        pan = this.panOf(where);
      events.emit("openKnocked", { step: o.knock, pan });
      if (o.knock === 0) {
        events.emit("openRolled", { pan });
        camera.kickFov(-O.zoomIn);
      }
      o.knock++;
    }
    if (o.t < SPLIT) return false;
    if (was < SPLIT) {
      if (o.hider) this.popOpen(o, o.hider);
      else this.fizzleOpen(o);
    }
    return o.hider ? this.whileFound(o, o.hider, was) : this.whileDud(o, was);
  }

  // 팡! 물건이 부풀었다 돌아오고 리본이 튕겨 풀린다. 라임 빛·색종이가 위로, 상자가 솟구친다. 곁의 생물과 고양이가 좋아한다
  private popOpen(o: Opening, h: Hider) {
    const { events, camera, terrain } = this.s,
      O = STAGE.open,
      c = o.c,
      k = h.k,
      b = k.box;
    k.state = "caught";
    k.slot = this.caught.length;
    this.caught.push(k);
    h.mode = "in";
    h.next = null;
    this.log.found(
      { prop: c.spec.id, pattern: h.pattern, moves: h.moves, nearMisses: h.nearMisses },
      this.time,
    );
    h.trail?.clear();
    h.trail = null;
    this.props.markFound(c);
    this.props.splitOpen(c, true);
    this.tellHiding();
    const top = c.base + c.lid,
      face = this.faceFrom(c.v);
    b.put(c.v, top, face);
    b.visible = true;
    b.setSize(1);
    b.startle();
    o.from = top;
    o.apex = top + O.riseHeights * b.hh * 2;
    // 내려앉을 자리: 물건 옆 — 내 쪽에서 비스듬히 비켜난 땅(물건도 나도 가리지 않게). 이웃 물건과 겹치면 다른 쪽으로
    const toMe = tmp.copy(face),
      along = toMe.dot(c.v);
    toMe.addScaledVector(c.v, -along).normalize();
    const out = (c.wide + b.hh + LAND_GAP) / S.R;
    for (const turn of LAND_TURNS) {
      const angle = LAND_ASIDE * turn;
      side.copy(toMe).applyAxisAngle(c.v, angle);
      o.land.copy(c.v).addScaledVector(side, out).normalize();
      const isClear = this.props.list.every((p) => {
        const room = p.foot + b.hh + LAND_ROOM;
        return p === c || o.land.angleTo(p.v) * S.R >= room;
      });
      if (isClear) break;
    }
    o.landAt = terrain.groundAt(o.land);
    const center = this.props.center(c, at),
      pan = this.panOf(center),
      glow = c.wide * FLASH_WIDE;
    this.openFx.flash(center, glow, O.flashSeconds);
    this.openFx.confetti(center, O.confetti, this.rand);
    events.emit("openPopped", { pan });
    camera.kickFov(O.zoomOut);
    this.timeline.after(O.zoomOutSeconds, () => camera.kickFov(0));
    this.overlay.shake();
    this.bystanders.cheer(c.v);
    this.links.cat.catCheer();
  }

  // 찾음(갈린 뒤): 상자가 제 키의 open.riseHeights 배까지 솟고 → 공중 한 바퀴 돌며 물건 옆으로 내려앉고 → 춤("찾았다!"·팡파레·위 칸) →
  // 나를 보고 폴짝 뛴 뒤 줄로 간다. 그때 물건의 리본이 다시 묶이고 흰 하트가 얹힌다
  private whileFound(o: Opening, h: Hider, was: number): boolean {
    const O = STAGE.open,
      k = h.k,
      b = k.box,
      c = o.c,
      after = o.t - SPLIT,
      before = was - SPLIT,
      apexAt = LAUNCH_AFTER + O.riseSeconds,
      landAt = apexAt + O.spinSeconds;
    if (after < apexAt) {
      const raw = (after - LAUNCH_AFTER) / O.riseSeconds,
        u = THREE.MathUtils.clamp(raw, 0, 1),
        rest = 1 - u;
      b.a = o.from + (o.apex - o.from) * (1 - rest * rest);
      return false;
    }
    if (before < apexAt) b.hop(0, true);
    if (after < landAt) {
      // 한 바퀴 도는 사이에 물건 옆으로 건너가며 떨어진다(갈수록 빠르게)
      const u = (after - apexAt) / O.spinSeconds,
        angle = c.v.angleTo(o.land) * u;
      axis.crossVectors(c.v, o.land).normalize();
      b.v.copy(c.v).applyAxisAngle(axis, angle).normalize();
      b.a = o.apex + (o.landAt - o.apex) * u * u;
      return false;
    }
    if (before < landAt) {
      const face = this.faceFrom(o.land);
      b.put(o.land, o.landAt, face);
      b.hop(LAND_HOP);
      const radius = S.R + o.landAt + 0.08,
        feet = tmp.copy(o.land).multiplyScalar(radius);
      this.openFx.ring(feet, LAND_RING);
    }
    if (after >= DANCE_AFTER && before < DANCE_AFTER) {
      b.dance(O.danceSeconds);
      this.overlay.showBig(HIDE.copy.found);
      this.overlay.fillSlot(k.slot);
      const count = this.caught.length;
      this.s.events.emit("findFound", { count });
    }
    // 춤 박자마다 발밑에 작은 라임 별
    const beat = O.danceSeconds / O.danceBeats,
      beats = (after - DANCE_AFTER) / beat,
      due = Math.floor(beats) + 1;
    while (after >= DANCE_AFTER && o.stars < Math.min(due, O.danceBeats)) {
      const sideways = o.stars % 2 === 0 ? 1 : -1;
      side.crossVectors(o.land, this.s.player.h).normalize();
      const radius = S.R + o.landAt + 0.3,
        aside = sideways * b.hh,
        feet = tmp.copy(o.land).multiplyScalar(radius).addScaledVector(side, aside);
      this.openFx.star(feet, STAR_SIZE);
      o.stars++;
    }
    if (o.t < O.leaveAt) return false;
    // 나를 보고 한 번 폴짝 → 줄로
    const face = this.faceFrom(o.land);
    b.faceTo(face);
    b.hop();
    this.props.tieHeart(c);
    this.props.endOpen(c, true);
    this.timeline.after(LimeBox.hopSeconds, () => {
      k.state = "line";
      this.line.join(b, k.slot);
    });
    return true;
  }

  // 푸슉. 물건이 꺼지고 리본이 힘없이 풀린다. 흰 김 한 줄기 — 위로 솟는 것도 빛도 색종이도 없다
  private fizzleOpen(o: Opening) {
    const { events, camera } = this.s,
      c = o.c;
    this.props.splitOpen(c, false);
    this.log.wrong();
    const top = this.topOf(c, at),
      pan = this.panOf(top);
    this.openFx.steam(top, this.rand);
    events.emit("openFizzled", { pan });
    camera.kickFov(0);
    this.bystanders.puzzle(c.v);
    this.links.cat.catSigh();
  }

  // 꽝(갈린 뒤): 꺼진 물건에서 시시한 것 하나가 나오고(세 가지를 돌려 쓴다) → 도리도리("나 아니야")에 내려가는 두 음 →
  // 끝. 곁에 진짜 상자가 있으면 그때 메롱 이사가 이어진다
  private whileDud(o: Opening, was: number): boolean {
    const O = STAGE.open,
      c = o.c,
      junkAt = SPLIT + O.sinkSeconds;
    if (o.t >= junkAt && was < junkAt) {
      const kind = JUNKS[this.junkTurn % JUNKS.length],
        top = this.topOf(c, at),
        toward = this.faceFrom(c.v),
        along = toward.dot(c.v);
      toward.addScaledVector(c.v, -along).normalize();
      const floor = S.R + this.s.terrain.groundAt(c.v);
      this.junkTurn++;
      this.openFx.junk(kind, top, toward, c.wide, floor, O.junkSeconds);
    }
    if (o.t >= O.refuseAt && was < O.refuseAt) this.s.events.emit("findMissed", {});
    if (o.t < O.missEnd) return false;
    this.props.endOpen(c, false);
    this.timeline.after(O.tauntAfter - O.missEnd, () => this.tauntNear(c));
    return true;
  }

  // 물건 윗면 가운데의 세계 자리
  private topOf(c: Candidate, out: THREE.Vector3): THREE.Vector3 {
    const radius = S.R + c.base + c.lid;
    return out.copy(c.v).multiplyScalar(radius);
  }

  // 꽝 곁(miss.tauntReach)의 진짜 상자가 메롱 한다: 가장 가까운 하나. 이사는 상자 하나당 miss.cooldown 초에 한 번, 한 판 miss.maxMoves 번까지
  private tauntNear(dud: Candidate) {
    const M = FIND.miss;
    let best: Hider | null = null,
      bestD = M.tauntReach;
    for (const h of this.hiders) {
      if (h.k.state !== "hidden" || h.mode !== "in") continue;
      // 지금 열어 보는 물건에 든 상자는 나오지 않는다
      if (this.openings.some((o) => o.hider === h)) continue;
      const dx = h.host.spec.x - dud.spec.x,
        dy = h.host.spec.y - dud.spec.y,
        gap = Math.hypot(dx, dy);
      if (gap > bestD) continue;
      bestD = gap;
      best = h;
    }
    if (!best) return;
    const canMove = best.moves < M.maxMoves && this.roundT - best.movedAt >= M.cooldown,
      next = canMove ? this.moveTarget(best) : null;
    this.startTaunt(best, next);
  }

  // 이사 갈 물건: 같은 갈래, miss.moveRange 안, 다른 상자가 들지 않았고 아직 찾지 않은 것 가운데 아무거나(없으면 null)
  private moveTarget(h: Hider): Candidate | null {
    const hosts = this.hiders.flatMap((x) => (x.next ? [x.host, x.next] : [x.host]));
    // 길 끝 상자는 꽃 길을 놓을 수 있는 물건으로만 이사 간다
    const isTaken = (spec: Candidate["spec"]) => {
      const c = this.props.of(spec);
      // 열어 본 물건(리본이 풀렸다)·지금 열어 보는 물건에는 들어가지 않는다
      if (c.isFound || c.isOpened || hosts.includes(c)) return true;
      if (this.openings.some((o) => o.c === c)) return true;
      return h.pattern === "B" && !this.canTrail(c);
    };
    const open = moveTargets(h.host.spec, FIND.props, isTaken);
    if (open.length === 0) return null;
    const roll = this.rand() * open.length,
      spec = open[Math.floor(roll)];
    return this.props.of(spec);
  }

  // 내 손에서 미스트 줄기가 누른 물건으로 날아간다(open.mistSeconds 에 닿는다). 흰 알갱이 — 판 영역의 라임색은 상자와 리본뿐이다
  private pullMist(c: Candidate) {
    const from = this.s.player.P.clone(),
      spot = new THREE.Vector3(),
      to = this.props.center(c, spot);
    for (let i = 1; i <= MIST_DOTS; i++) {
      const part = i / (MIST_DOTS + 1),
        wait = part * STAGE.open.mistSeconds;
      this.timeline.after(wait, () => {
        const mote = tmp.copy(from).lerp(to, part);
        this.fx.dot(mote, MIST_SIZE, MIST_LIFE, 0xffffff);
      });
    }
  }

  // 화면에서 본 좌우(-1 왼쪽 … 1 오른쪽)
  private panOf(world: THREE.Vector3): number {
    const camera = this.s.camera.camera;
    camera.getWorldPosition(eye);
    tmp.copy(world).sub(eye).normalize();
    side.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const pan = tmp.dot(side) * 1.6;
    return THREE.MathUtils.clamp(pan, -1, 1);
  }

  /* ─── 내부: 판 끝 ─────────────────────────── */

  // 넷을 다 찾았다: 금색 상자로
  private endSeek() {
    this.warm.stop();
    this.mushrooms.stop();
    this.s.camera.setZoom(1);
    this.links.input.hold(false);
    this.overlay.flashSlots();
    this.s.events.emit("hideAllFound", {});
    this.goTo("bonus");
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
      // 주민이 금색 상자가 떨어지는 자리를 둥글게 둘러선다
      const spot = ahead.clone();
      this.bystanders.gather(spot);
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
  // 그 자리가 놀이기구 안·물건 곁이면 앞에서 비추는 카메라가 막혀서, 언박싱은 늘 트인 광장에서 한다
  private arrangeUnbox() {
    const { player, occ, camera } = this.s;
    // 닫히는 사이에 놀이기구가 나를 붙잡았으면 내릴 때까지 기다린다(실린 채 옮기면 그 놀이기구가 나를 놓지 못한다)
    if (player.isHeld) {
      this.timeline.after(0.2, () => this.arrangeUnbox());
      return;
    }
    const boxes = this.caught.map((k) => k.box);
    if (this.hasBonus) boxes.push(this.bonus);
    for (const b of boxes) b.setSize(HIDE.line.scale, true);
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
    this.goTo("end");
    this.release();
    // 판이 끝나면 리본이 모두 다시 묶이고, 주민은 제 하루로 돌아간다
    this.props.reset();
    this.bystanders.release();
    this.overlay.showSlots(false);
    this.endAt.copy(this.s.player.p);
    this.overlay.showEnding(() => this.again());
  }

  // 판에서 놓아 준다: 손을 놓고, 옷장 단추·장소의 라임빛·따라붙는 손님·세상의 반응을 돌려주고, 기록을 닫는다(?debug 면 잰 값도)
  private release() {
    const L = this.links;
    L.setPlaceGlow(true);
    L.setLabels(true);
    L.setCompany(true);
    L.setReactions(true);
    L.input.hold(false);
    L.studio.setWearHidden(false);
    this.log.finish(this.time);
    if (!isStatsShown()) return;
    const lines = this.log.lines();
    this.overlay.showStats(lines);
  }

  // 한 판 더: 고래에서 내려 주고 0.3초 눈을 감았다가(감은 동안 커진 몸을 바로 되돌린다) 다음 판으로. 다른 놀이기구에 실려 있으면 내린 뒤에
  private again() {
    if (this.phase !== "end" || this.isAgainWaiting) return;
    this.overlay.showEnding(null);
    // 눈을 감는 동안 옷장을 못 열게(감은 채 꾸미기 씬이 열리면 새 판이 시작되지 못한다)
    this.links.studio.setWearHidden(true);
    this.links.whale.dismount();
    if (this.s.player.isHeld) {
      this.isAgainWaiting = true;
      return;
    }
    this.startAgain();
  }

  private startAgain() {
    this.log.again();
    this.played++;
    this.overlay.setLids(true);
    // 눈을 감은 동안 커진 몸을 바로 되돌린다(효과가 걸린 채 새 판이 시작되지 않게)
    this.timeline.after(LIDS_MOVE, () => {
      this.unboxing.resetHappenings(true);
      this.restart();
    });
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
}
