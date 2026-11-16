import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Tappable } from "../core/tap";
import { lineSteps } from "../scenery/footsteps";
import type { Services } from "../services";
import { S } from "../settings";
import { HideFx } from "./effects";
import { LimeBox } from "./limebox";
import { CURTAIN_MOVE, HideOverlay } from "./overlay";
import { hideSet, isLookAround, isStatsShown } from "./params";
import type { HideSpot } from "./spots";
import { placeOf, roundSpots, sphereAt, STAGE_HUB } from "./spots";
import { RoundLog } from "./stats";
import type { UnboxLinks } from "./unbox";
import { dealContents, Unboxing } from "./unbox";

// 숨바꼭질 한 판(조각 01 '찾는 맛' 시험판): 꼭꼭 숨어라(5초) → 찾기(칙·재채기·막히면 저절로 재채기와 꾀꼬리) → 넷을 다 찾으면
// 보너스 상자가 떨어지고 '깔까?' → 언박싱 → '한 판 더'. 유영 조작 값과 맵은 건드리지 않는다 — 상자를 놓고, 칙을 듣고, 카메라를 잠깐 빌릴 뿐이다.
// 찾은 상자는 지금 있는 동행 줄(내 발자취)에 선다: 꼬마 라임 뒤, 만난 손님 앞(손님은 상자 수만큼 뒤로 물러난다)

/** 판 흐름 */
type Phase = "wait" | "ready" | "curtain" | "seek" | "bonus" | "prompt" | "wipe" | "unbox" | "end";

/** 숨는 애 하나의 처지 */
interface Seeker {
  box: LimeBox;
  spot: HideSpot;
  /** 숨음 · 들켜 뛰는 중 · 줄에 섬 */
  state: "hidden" | "leaping" | "line";
  /** 마지막 재채기 시각(게임 초) */
  sneezedAt: number;
  leapT: number;
}

/** 숨바꼭질이 쓰는 것(Game 이 만들 때 넘긴다) */
export interface HideSeekLinks {
  /** 지나온 자리(찾은 상자가 줄지어 밟는다) */
  footsteps: { readonly length: number; at(i: number): { p: THREE.Vector3; a: number } };
  /** 따라오는 꼬마 라임 수(상자는 그 뒤에 선다) */
  babyLimes: { readonly joined: number };
  /** 입력: 막기·끌기가 끝난 뒤 지난 시간(ms)·끌지 않고 누르고 있는 시간(초) */
  input: { hold(on: boolean): void; msSinceDragEnd(): number; pressSeconds(): number };
  /** 꾸미기 씬: 열려 있나 · 옷장 단추 숨기기 */
  studio: { readonly isOpen: boolean; setWearHidden(hidden: boolean): void };
  /** 언박싱의 일어나는 일(커지기·고래) */
  unbox: UnboxLinks;
}

/** 판 시작: 상자 넷이 줄 서 있는 시간(초) · 가려진 시간(초) */
const READY_TIME = 1.4,
  COVERED_TIME = 3;
/** 줄 선 상자: 플레이어 앞(m)·사이(m). 기획은 3m — 폰 세로 화면에서는 가운데 둘이 아바타 머리에 가려서 8m 로(머리 위로 보인다) */
const LINEUP_AHEAD = 8,
  LINEUP_GAP = 1.5;
/** 칙이 닿는 거리(m) · 같은 상자가 다시 재채기하기까지(초) */
const CHIK_REACH = 40,
  SNEEZE_COOL = 3;
/** 이만큼(m, 3차원) 닿으면 찾았다 */
const FIND_REACH = 6;
/** 못 찾을 때: 저절로 재채기(초마다) · 꾀꼬리 단추(초) */
const AUTO_SNEEZE = 60,
  KKOEKKORI_AFTER = 120;
/** 언박싱으로 넘어갈 때 가림막이 덮고 있는 시간(초) */
const WIPE_HOLD = 0.25;
/** 들켜 뛰는 시간(초) 뒤에 줄에 선다 */
const LEAP_TIME = 0.5;
/** 줄 서러 오는 빠르기: 거리의 몇 배(m/s)와 가장 빠르게 */
const CHASE_K = 4,
  CHASE_MAX = 14;
/** 다 찾은 뒤 보너스 상자가 떨어지기까지(초)·떨어지는 높이(m)·크기 */
const BONUS_WAIT = 1,
  BONUS_DROP = 32,
  BONUS_SCALE = 1.4;
/** 멈춰서 둘러보기: 누르고 있을 시간(초)·도는 빠르기(rad/s — 10초에 한 바퀴)·카메라 */
const LOOK_HOLD = 0.5,
  LOOK_TURN = 0.63,
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
  private readonly bonus: LimeBox;
  /** 줄 선 차례(찾은 차례, 보너스는 끝) */
  private readonly line: LimeBox[] = [];
  private readonly overlay: HideOverlay;
  private readonly fx: HideFx;
  private readonly unboxing: Unboxing;
  private readonly log = new RoundLog();
  private readonly look: boolean;
  private readonly rand: () => number;
  private sinceFind = 0;
  private nextAuto = AUTO_SNEEZE;
  private kkoekkoriShown = false;
  private time = 0;
  private lookK = 0;
  private lookAngle = 0;
  /** 이번 판의 상자를 숨는 자리에 놓았나(가림막 뒤에서 한 번) */
  private placed = false;

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
        sneezedAt: -1e9,
        leapT: 0,
      };
      this.seekers.push(seeker);
    }
    this.bonus = new LimeBox(s.models, s.scene, BONUS_SCALE, true, this.rand);
    this.bonus.visible = false;
    this.unboxing = new Unboxing(s, links.unbox, this.fx, this.rand);
  }

  /** 줄에 선 상자 수(손님 줄·카메라가 본다) */
  get joined(): number {
    return this.line.length;
  }

  /** 언박싱(과 그리로 넘어가는 동안)은 칙을 혼자 받는다 — 다른 놀이기구가 나를 붙잡아 줄 앞에서 데려가지 않게 */
  get takesTaps(): boolean {
    return this.phase === "unbox" || this.phase === "wipe";
  }

  /** 칙: 찾는 중이면 내 둘레로 안개가 퍼지고, 40m 안의 숨은 상자가 재채기한다. 언박싱 중이면 지금 상자를 연다 */
  onTap() {
    if (this.phase === "unbox") {
      this.unboxing.tap();
      return;
    }
    if (this.phase !== "seek" || this.links.studio.isOpen) return;
    const { player, terrain, events } = this.s;
    const ground = terrain.groundAt(player.p as THREE.Vector3);
    this.fx.sonar(player.p as THREE.Vector3, ground, CHIK_REACH);
    let sneezed = 0;
    for (const k of this.seekers) {
      if (k.state !== "hidden") continue;
      const d = k.box.center(at).distanceTo(player.P);
      if (d > CHIK_REACH || this.time - k.sneezedAt < SNEEZE_COOL) continue;
      this.sneeze(k, false);
      sneezed++;
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
    // 꾸미기 씬이 열려 있는 동안은 판을 멈추고 카메라를 씬에 맡긴다(시작 전이면 닫힌 뒤에 꼭꼭 숨어라부터 — 입력은 씬이 막고 있다)
    if (studioOpen) {
      if (this.phase === "ready" || this.phase === "curtain") this.restart();
      this.unboxing.dropCamera();
      this.lookK = 0;
    } else this.step(dt);
    for (const k of this.seekers) k.box.update(dt, f.time);
    this.bonus.update(dt, f.time);
    this.followLine(dt);
    this.fx.update(dt);
    this.unboxing.update(dt, f.time);
    if (!studioOpen) this.lookAround(dt);
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
    switch (this.phase) {
      case "wait":
        this.begin();
        break;
      case "ready":
        if (this.phaseT >= READY_TIME) this.cover();
        break;
      case "curtain":
        this.whileCovered();
        break;
      case "seek":
        this.seek(dt);
        break;
      case "bonus":
        this.dropBonus();
        break;
      case "wipe":
        this.whileWiped();
        break;
      default:
        break;
    }
    // 깔까?·한 판 더는 놀이기구에서 내린 뒤에 누른다 — 실린 채 광장으로 옮기면 그 놀이기구가 나를 놓지 못한 채로 남는다
    const riding = this.s.player.isHeld;
    this.overlay.setBigAway(riding);
  }

  // 판 시작: 무대 마을 출발 자리로 옮기고, 상자 넷이 내 앞에 한 줄로 서 있다
  private begin() {
    const { player, occ, hud } = this.s;
    // 놀이기구에 실려 있으면 내릴 때까지 기다린다(옮기면 그 놀이기구가 나를 놓지 못한다)
    if (player.isHeld) return;
    const hub = occ.hubs[STAGE_HUB];
    player.goHome(hub);
    hud.setQuiet(true);
    this.links.input.hold(true);
    this.links.studio.setWearHidden(true);
    this.overlay.setSlots(0, 0);
    this.overlay.showBig(null);
    this.overlay.showKkoekkori(false);
    this.overlay.showStats(null);
    this.line.length = 0;
    this.bonus.visible = false;
    this.placed = false;
    const spots = roundSpots(this.set);
    const p = player.p as THREE.Vector3,
      h = player.h as THREE.Vector3;
    rightV.crossVectors(p, h).normalize();
    const back = tmp.copy(h).negate();
    this.seekers.forEach((k, i) => {
      k.spot = spots[i];
      k.state = "hidden";
      k.sneezedAt = -1e9;
      const across = (i - 1.5) * LINEUP_GAP;
      const aheadArc = LINEUP_AHEAD / S.R,
        acrossArc = across / S.R;
      ahead.copy(p).addScaledVector(h, aheadArc).addScaledVector(rightV, acrossArc).normalize();
      const ground = this.s.terrain.groundAt(ahead);
      k.box.put(ahead, ground, back);
      k.box.setPeek(null);
    });
    const screen = `${innerWidth}x${innerHeight}`,
      now = Date.now();
    this.log.begin(this.set, this.look, screen, now, this.time);
    this.sinceFind = 0;
    this.nextAuto = AUTO_SNEEZE;
    this.kkoekkoriShown = false;
    this.goTo("ready");
  }

  // 가림막이 내려오고(후다닥 흩어지는 소리), 가려진 동안 상자는 숨는 자리로 간다
  private cover() {
    this.overlay.setCurtain(true);
    this.s.events.emit("hideStarted", {});
    this.goTo("curtain");
  }

  private whileCovered() {
    const t = this.phaseT;
    if (t >= CURTAIN_MOVE && !this.placed) this.hideAll();
    if (t < CURTAIN_MOVE + COVERED_TIME) return;
    this.overlay.setCurtain(false);
    this.overlay.setSlots(4, 0);
    this.links.input.hold(false);
    this.links.studio.setWearHidden(false);
    this.log.seekStarted(this.time);
    this.goTo("seek");
  }

  // 숨는 자리로: 뒤에 숨기는 가린 것 뒤에 비켜서고, 높이 숨기는 꼭대기에 앉는다. 모두 출발 쪽을 본다
  private hideAll() {
    this.placed = true;
    const { occ, terrain } = this.s;
    const hub = occ.hubs[STAGE_HUB];
    for (const k of this.seekers) {
      const place = placeOf(k.spot);
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
    }
  }

  // 찾는 중: 닿으면 찾았다. 60초마다 가장 가까운 상자가 저절로 재채기, 120초면 꾀꼬리
  private seek(dt: number) {
    const { player } = this.s;
    for (const k of this.seekers) {
      if (k.state !== "hidden") continue;
      const d = k.box.center(at).distanceTo(player.P);
      if (d <= FIND_REACH) this.find(k, "touch");
    }
    if (this.seekers.every((k) => k.state !== "hidden")) {
      this.overlay.showKkoekkori(false);
      this.goTo("bonus");
      return;
    }
    this.sinceFind += dt;
    if (this.sinceFind >= this.nextAuto) {
      this.nextAuto += AUTO_SNEEZE;
      const near = this.nearestHidden();
      if (near) {
        this.sneeze(near, true);
        this.log.autoSneeze();
      }
    }
    if (!this.kkoekkoriShown && this.sinceFind >= KKOEKKORI_AFTER) {
      this.kkoekkoriShown = true;
      this.overlay.showKkoekkori(true, () => this.callOut());
    }
  }

  // 찾았다: 뛰어오르며 한 바퀴, '찾았다!', 위 칸 하나 채움. 조작은 멈추지 않는다
  private find(k: Seeker, how: "touch" | "kkoekkori") {
    k.state = "leaping";
    k.leapT = 0;
    k.box.setPeek(null);
    k.box.leap();
    const count = this.seekers.filter((x) => x.state !== "hidden").length;
    this.overlay.showFound();
    this.overlay.setSlots(4, count);
    const center = k.box.center(at);
    this.s.fx.burst(center, 14, 8);
    this.log.found(k.spot.id, k.spot.kind, this.time, how);
    this.s.events.emit("hideBoxFound", { count, how });
    this.sinceFind = 0;
    this.nextAuto = AUTO_SNEEZE;
    this.kkoekkoriShown = false;
    this.overlay.showKkoekkori(false);
  }

  // 꾀꼬리: 가장 가까운 남은 상자 하나가 스스로 걸어 나와 줄에 선다
  private callOut() {
    const near = this.nearestHidden();
    if (!near || this.phase !== "seek") return;
    this.find(near, "kkoekkori");
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

  // 재채기: 폴짝, 라임 연기, 화면 밖이면 그쪽 가장자리가 라임빛으로 번진다
  private sneeze(k: Seeker, auto: boolean) {
    k.sneezedAt = this.time;
    k.box.sneeze();
    const center = k.box.center(at);
    this.fx.sneeze(center, this.rand);
    this.s.events.emit("hideBoxSneezed", { auto });
    this.glowIfOffscreen(center);
  }

  private glowIfOffscreen(center: THREE.Vector3) {
    const cam = this.s.camera.camera;
    ndc.copy(center).project(cam);
    const behind = ndc.z > 1;
    let x = ndc.x,
      y = ndc.y;
    if (!behind && Math.abs(x) <= 0.92 && Math.abs(y) <= 0.92) return;
    if (behind) {
      x = -x;
      y = -y;
    }
    const ax = Math.abs(x),
      ay = Math.abs(y);
    const reach = Math.max(ax, ay, 1e-3);
    const ex = x / reach,
      ey = y / reach;
    const sx = (ex + 1) / 2,
      sy = (1 - ey) / 2;
    this.overlay.glowEdge(sx, sy);
  }

  // 다 찾았다: 1초 뒤 보너스 상자(금빛 리본, 1.4배)가 하늘에서 떨어져 줄 끝에 선다. 내려앉으면 '깔까?'
  private dropBonus() {
    const b = this.bonus;
    if (!b.visible) {
      if (this.phaseT < BONUS_WAIT) return;
      const end = this.trailPoint(this.line.length);
      const v = end ? end.p : this.s.player.p;
      const ground = this.s.terrain.groundAt(v as THREE.Vector3);
      const face = tmp.copy(this.s.player.h).negate();
      b.put(v as THREE.Vector3, ground, face);
      b.dropFrom(BONUS_DROP);
      return;
    }
    if (b.isDropping) return;
    const center = b.center(at);
    this.s.fx.burst(center, 24, 11);
    this.s.events.emit("hideBonusLanded", {});
    this.line.push(b);
    this.goTo("prompt");
    this.overlay.showBig("깔까?", () => this.startUnbox());
  }

  // 깔까?: 다른 표시를 다 숨기고, 가림막이 잠깐 덮는 동안 광장 출발 자리로 옮겨 상자 다섯을 앞에 세운다 —
  // 누른 자리가 놀이기구 안·조형물 곁이면 앞에서 비추는 카메라가 막혀서, 언박싱은 늘 트인 광장에서 한다
  private startUnbox() {
    if (this.phase !== "prompt" || this.s.player.isHeld) return;
    this.overlay.showBig(null);
    this.overlay.setSlots(0, 0);
    this.links.input.hold(true);
    this.links.studio.setWearHidden(true);
    this.overlay.setCurtain(true, "");
    this.placed = false;
    this.goTo("wipe");
  }

  private whileWiped() {
    this.links.unbox.keepWhaleOff();
    if (this.phaseT >= CURTAIN_MOVE && !this.placed) {
      this.placed = true;
      // 출발 자리에서 광장 바깥(트인 쪽)을 보고 선다 — 소원 나무 쪽은 공 놀이기구가 줄 가운데를 가린다
      const { player, occ } = this.s;
      const hub = occ.hubs[STAGE_HUB];
      player.goHome(hub);
      const away = tmp.copy(player.h).negate();
      player.teleport(player.p as THREE.Vector3, away, 0);
      this.unboxing.arrange(this.line);
    }
    if (this.phaseT < CURTAIN_MOVE + WIPE_HOLD) return;
    this.overlay.setCurtain(false);
    const contents = dealContents(this.rand);
    this.goTo("unbox");
    this.unboxing.start([...this.line], contents, () => this.endUnbox());
  }

  // 다 열었다: 손을 놓아 주고 '한 판 더'(?debug 면 잰 값도). 판이 끝났으니 안내 줄·말풍선을 돌려준다(고래 타는 법 같은 안내)
  private endUnbox() {
    this.s.hud.setQuiet(false);
    this.links.input.hold(false);
    this.links.studio.setWearHidden(false);
    this.line.length = 0;
    this.log.finish(this.time);
    this.goTo("end");
    this.overlay.showBig("한 판 더", () => this.again());
    this.showStats();
  }

  // 한 판 더: 다음 묶음으로 다시
  private again() {
    if (this.phase !== "end") return;
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

  // 처음(꼭꼭 숨어라)으로. 입력은 begin 이 다시 막는다(꾸미기 씬이 열려 있으면 씬이 막고 있다)
  private restart() {
    this.overlay.setCurtain(false);
    this.goTo("wait");
  }

  private goTo(phase: Phase) {
    this.phase = phase;
    this.phaseT = 0;
  }

  /* ─── 내부: 줄·카메라 ─────────────────────────── */

  // 들킨 상자는 0.5초 뛰고 나서 줄에 선다. 줄 선 상자는 내 발자취를 밟는다(꼬마 라임 뒤, 손님 앞)
  private followLine(dt: number) {
    for (const k of this.seekers) {
      if (k.state !== "leaping") continue;
      k.leapT += dt;
      if (k.leapT >= LEAP_TIME) {
        k.state = "line";
        this.line.push(k.box);
      }
    }
    if (this.phase === "unbox" || this.phase === "wipe") return;
    const terrain = this.s.terrain;
    this.line.forEach((box, i) => {
      if (box.isDropping) return;
      const hg = this.trailPoint(i);
      if (!hg) {
        box.setWalk(0);
        return;
      }
      const d = box.v.angleTo(hg.p) * S.R;
      if (d > 0.25) {
        const chase = d * CHASE_K;
        const speed = Math.min(CHASE_MAX, chase);
        box.stepToward(hg.p, speed, dt);
        const stride = speed / 3,
          pace = Math.min(1, stride);
        box.setWalk(pace);
      } else box.setWalk(0);
      const ground = terrain.groundAt(box.v),
        trailAlt = hg.a - S.hover;
      const want = Math.max(ground, trailAlt),
        follow = ease(8, dt);
      box.a += (want - box.a) * follow;
    });
  }

  // 줄 i 번째 자리(꼬마 라임 뒤). 발자취가 아직 짧으면 가장 오래된 것
  private trailPoint(i: number): { p: THREE.Vector3; a: number } | null {
    const steps = this.links.footsteps;
    const last = steps.length - 1;
    if (last < 0) return null;
    const index = lineSteps(this.links.babyLimes.joined, 0, i);
    const at = Math.min(last, index);
    return steps.at(at);
  }

  // ?look=1: 끌지 않고 0.5초 넘게 누르고 있으면 그 자리에 멈춰 카메라가 천천히 한 바퀴 돈다. 손을 떼면 풀린다
  private lookAround(dt: number) {
    if (!this.look) return;
    const { player, camera } = this.s;
    const canLook = this.phase === "seek" || this.phase === "prompt" || this.phase === "end";
    const held = this.links.input.pressSeconds();
    const looking = canLook && held >= LOOK_HOLD;
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
