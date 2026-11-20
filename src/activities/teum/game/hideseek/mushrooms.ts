import * as THREE from "three";

import { ease } from "../core/frame";
import type { Creature } from "../creatures/creature";
import type { Services } from "../services";
import { S } from "../settings";
import type { BystanderCreatures } from "./bystanders";
import { FIND } from "./findTuning";
import { sphereAt } from "./spots";
import { HIDE } from "./tuning";

// 버섯 높이 뛰기 — 힌트가 아니라 이동 수단: 높이 올라가 둘러보고, 높은 곳(탑 꼭대기·통통 구름 위)에 닿는다.
//   위에 올라서면 납작 눌렸다가 mushroom.height 까지 튄다. 누르는 것이 아니다 — 판 중에 눌리는 것은 리본 달린 물건뿐이다(조각 03).
//   꼭대기에서 mushroom.hang 초 동안 천천히 내려온다. 그동안 카메라는 나를 보지 않고 앞쪽 아래를 넓게 본다(끌면 둘러본다 — 끄는 대로 몸이 돈다).
//   끌어서 내려앉을 곳을 mushroom.drift(m)까지 옮길 수 있고, 물건 꼭대기 위로 내려오면 거기 올라선다.
// 버섯은 이름표도 고리도 없다 — 제자리에서 통통 뛰는 모습이 표시다. 자리는 hideseek.data.json 의 mushrooms

/** 버섯 하나 */
interface Shroom {
  c: Creature;
  /** 다음 통통까지(초) · 다시 탈 수 있을 때까지(초) */
  hopWait: number;
  cool: number;
  /** 방금 탔다 — 내가 한 번 떠났다 와야 올라서는 것으로 다시 태운다(갓 위에 내려앉은 채 되풀이해 튀지 않게) */
  mustLeave: boolean;
}

/** 뛰는 단계: 뛰어 올라타는 중 · 납작 눌림 · 솟구침 · 꼭대기에서 내려옴 */
type Step = "squash" | "launch" | "hang";

/** 내 발밑의 올라설 곳(물건 꼭대기)의 높이(m, 땅에서 — 없으면 0) */
export interface Floors {
  floorUnder(): number;
}

/** 눌리는 시간·솟는 시간(초) · 눌리는 깊이(키의 몫) */
const SQUASH = 0.18,
  LAUNCH = 0.75,
  SINK = 0.45;
/** 통통: 뛰는 세기(m/s)·간격(초, 이 둘레에서 들쭉날쭉) · 한 번 탄 버섯을 다시 탈 수 있기까지(초) */
const HOP_POWER = 5.2,
  HOP_EVERY = 1.1,
  COOLDOWN = 1.5;
/** 올라선 것으로 치는 높이(m, 갓에서 이 위로는 아니다) · 떠난 것으로 치는 거리(mushroom.stepReach 에 더한다, m) · 카메라가 둘러보기로 넘어가는·돌아오는 빠르기 */
const STEP_AIR = 2.5,
  LEAVE_GAP = 1.5,
  SURVEY_IN = 4,
  SURVEY_OUT = 5;

const at = new THREE.Vector3();

/** 버섯 높이 뛰기 */
export class Mushrooms {
  private readonly list: Shroom[] = [];
  private riding: Shroom | null = null;
  private step: Step = "squash";
  private stepT = 0;
  /** 버섯 갓의 높이(m, 땅에서) · 솟구친 자리(여기서 mushroom.drift 넘게 못 간다) */
  private top = 0;
  private readonly from = new THREE.Vector3();
  /** 이 판에 버섯을 쓴 횟수 */
  private used = 0;

  constructor(
    private readonly s: Services,
    private readonly creatures: BystanderCreatures,
    private readonly floors: Floors,
    private readonly rand: () => number,
  ) {
    for (let i = 0; i < FIND.mushrooms.length; i++) {
      const [c] = creatures.invite("mushroom", 1),
        hopWait = rand() * HOP_EVERY;
      if (c) this.list.push({ c, hopWait, cool: 0, mustLeave: false });
    }
  }

  /** 이 판에 버섯을 쓴 횟수 */
  get uses(): number {
    return this.used;
  }

  /** 버섯으로 떠 있는 중인가(솟구치거나 내려오는 중) */
  get isUp(): boolean {
    return this.riding !== null && (this.step === "launch" || this.step === "hang");
  }

  /** 판 시작: 버섯들을 제자리에 앉힌다 */
  begin(hub: THREE.Vector3) {
    this.stop();
    this.used = 0;
    this.list.forEach((m, i) => {
      const spot = FIND.mushrooms[i];
      sphereAt(at, hub, spot.x, spot.y);
      this.creatures.seat([m.c], at, null, null, true);
      m.cool = 0;
      m.mustLeave = false;
    });
  }

  /** 한 프레임: 통통 뛰고, 올라서면 태우고, 타는 중이면 솟구쳤다 내려온다 */
  update(dt: number, canRide: boolean) {
    const { player, camera } = this.s;
    for (const m of this.list) {
      if (m.cool > 0) m.cool -= dt;
      this.idleHop(m, dt);
      const flat = player.p.angleTo(m.c.v) * S.R,
        cap = m.c.batch.hh * 2;
      if (flat > HIDE.mushroom.stepReach + LEAVE_GAP) m.mustLeave = false;
      // 갓 위에 내려앉으면 거기 선다(갓 속으로 가라앉지 않게)
      const isOver = m !== this.riding && flat < m.c.batch.rw && player.air >= cap - 1;
      if (isOver && !player.isHeld) player.keepAbove(cap);
      const isOn =
        canRide &&
        !this.riding &&
        !m.mustLeave &&
        m.cool <= 0 &&
        !player.isHeld &&
        player.air < cap + STEP_AIR &&
        flat < HIDE.mushroom.stepReach;
      if (!isOn) continue;
      this.start(m);
      this.squashNow();
    }
    const surveyTarget = this.isUp ? 1 : 0,
      surveyRate = this.isUp ? SURVEY_IN : SURVEY_OUT,
      surveyEase = ease(surveyRate, dt);
    camera.easeSurvey(surveyTarget, surveyEase);
    if (this.riding) this.jump(this.riding, dt);
  }

  /** 그만둔다(판이 넘어간다): 버섯을 놓아주고 카메라를 돌려준다 */
  stop() {
    const m = this.riding;
    this.riding = null;
    if (!m) return;
    m.c.sink = 0;
    m.cool = COOLDOWN;
    m.mustLeave = true;
    this.creatures.dismiss(m.c);
  }

  /** 판을 띄우지 않는 지도: 불러 둔 버섯을 모두 놓아준다 */
  releaseAll() {
    this.stop();
    for (const m of this.list) this.creatures.dismiss(m.c);
    this.list.length = 0;
  }

  /* ─── 내부 ─────────────────────────── */

  private start(m: Shroom) {
    this.riding = m;
    this.top = m.c.batch.hh * 2;
    this.creatures.escort(m.c);
  }

  private goTo(step: Step) {
    this.step = step;
    this.stepT = 0;
  }

  // 갓 위에 올라섰다: 납작 눌린다
  private squashNow() {
    this.goTo("squash");
    this.from.copy(this.s.player.p);
  }

  // 제자리에서 통통(타는 중인 버섯은 빼고)
  private idleHop(m: Shroom, dt: number) {
    if (m === this.riding) return;
    m.hopWait -= dt;
    if (m.hopWait > 0 || m.c.hop > 0) return;
    m.hopWait = HOP_EVERY * (0.7 + this.rand() * 0.6);
    m.c.hopV = HOP_POWER;
  }

  // 타는 중: 뛰어 올라타기 → 납작 → 솟구침(끝이 느려진다) → 꼭대기에서 천천히 내려온다(처음엔 머물다가 갈수록 빨리)
  private jump(m: Shroom, dt: number) {
    const M = HIDE.mushroom,
      c = m.c,
      { player } = this.s;
    this.stepT += dt;
    // 다른 것(놀이기구)이 나를 붙잡으면 그친다
    if (player.isHeld) {
      this.stop();
      return;
    }
    if (this.step === "squash") {
      const part = this.stepT / SQUASH,
        u = Math.min(1, part);
      c.sink = SINK * u;
      player.glide(this.top, 1);
      if (u < 1) return;
      this.used++;
      this.s.events.emit("mushroomJumped", {});
      // 튕겨 낸 갓은 한참 출렁인다
      this.creatures.wobble(c);
      this.goTo("launch");
      return;
    }
    player.leash(this.from, M.drift);
    if (this.step === "launch") {
      const part = this.stepT / LAUNCH,
        u = Math.min(1, part),
        back = 1 - u,
        risen = 1 - back * back * back,
        air = this.top + (M.height - this.top) * risen,
        springAngle = u * Math.PI * 3,
        spring = Math.sin(springAngle) * back,
        quick = u * 6,
        squashed = 1 - Math.min(1, quick);
      c.sink = SINK * squashed - 0.1 * spring;
      player.glide(air, 1);
      if (u >= 1) this.goTo("hang");
      return;
    }
    c.sink = 0;
    const part = this.stepT / M.hang,
      u = Math.min(1, part),
      air = M.height * (1 - u * u),
      isOverCap = player.p.angleTo(c.v) * S.R < c.batch.rw,
      capFloor = isOverCap ? this.top : 0,
      propFloor = this.floors.floorUnder(),
      floor = Math.max(propFloor, capFloor);
    // 물건 꼭대기(또는 타고 올라온 버섯의 갓) 위로 내려왔으면 거기 올라선다
    if (air <= floor || u >= 1) {
      this.stop();
      return;
    }
    player.glide(air, 1);
  }
}
