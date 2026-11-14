import * as THREE from "three";

import type { CreatureSetting } from "../../assets/settings";
import { CREATURES, herdSpecies, lakeSpecies, skySpecies } from "../../assets/settings";
import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Random } from "../core/random";
import type { ModelBatch } from "../models/batch";
import type { Holder } from "../player/player";
import type { Services } from "../services";
import { S } from "../settings";
import { fr } from "../world/hash";
import { from, offset, offsetInto } from "../world/sphere";
import type { Creature, CreatureRole, Pose, Sense } from "./creature";
import type { Habit, HabitCtx } from "./habits";
import { HABITS } from "./habits";
import { away, face, go } from "./moves";

// 생물: 놀이기구가 아니라 손님이다. 저마다 제 할 일을 하다가 나를 알아채고, 동작이 끊기지 않고 이어진다. 이름은 없다.
// 땅 위의 손님(걷는 찻주전자·카드 병정·뛰는 버섯…), 셋씩 낮게 도는 하늘 무리(열쇠·날개 하트·편지·찻잔·종), 해파리 우산,
// 호수의 헤엄치는 것(물고기·일각고래·물개), 그리고 온 행성에 세 곳씩뿐인 전설의 손님(라임 사슴·날개 달린 왕관).
// 종의 생김새·크기·걸음새·버릇은 설정 표(assets/settings 의 CREATURES) 한곳에 있고, 여기는 갈래(땅·하늘·해파리·호수)마다의
// 공통 상태 기계와 놓는 규칙만 둔다. 종마다 다른 것은 버릇(habits)에게 묻는다.
// 그리기는 종마다 한 묶음(ModelBatch): 가까이 보이는 것만 매 프레임 채워 그린다

/** 내가 멀어지면 내 앞쪽으로 옮겨 가는 무리 */
interface RoamGroup {
  mem: Creature[];
  kind: "herd" | "flock" | "jelly";
  ctr: THREE.Vector3;
}

/** 지나온 자리 하나 */
interface Footstep {
  p: THREE.Vector3;
  a: number;
}

/** 생물이 보는 다른 것들 */
export interface CreatureLinks {
  /** 지나온 자리(줄지어 따라오는 손님이 밟는다): 남은 수와 i 번째로 최근 것 */
  footsteps: { readonly length: number; at(i: number): Footstep };
  /** 따라오는 꼬마 라임 수(손님은 그 뒤에 선다) */
  babyLimes: { joined: number };
  lakes: { list: readonly { v: THREE.Vector3; r: number }[] };
  /** 전설을 만난 자리에 도장 */
  signature: { stampAt(v: THREE.Vector3): void };
  /** 고래 등에 타면 고래도 만난 것으로 친다 */
  whale: Holder;
}

/** 종 하나: 설정·그리는 묶음·버릇 */
interface Species {
  set: CreatureSetting;
  batch: ModelBatch;
  habits: Habit[];
  /** 하늘을 돌다 나를 찾아오는 버릇이 있다(제 궤도로 천천히 돌아온다) */
  tame: boolean;
  /** 놀랐을 때 갈 상태 */
  scaredTo: string;
}

/** 가까이 있는 것만 움직이는 경계(시제품: v·p < 0.8 이면 쉰다)와, 다시 고르기 전까지 버틸 여유 */
const REST_COS = 0.8,
  ACTIVE_MARGIN = 60,
  /** 이만큼 움직이거나 이 시간이 지나면 다시 고른다(생물은 초속 14m 를 넘지 않는다) */
  REBUILD_MOVE = 30,
  REBUILD_TIME = 1;

const cf = new THREE.Vector3(),
  cx = new THREE.Vector3(),
  cm = new THREE.Matrix4(),
  cv = new THREE.Vector3(),
  cw = new THREE.Vector3(),
  nv = new THREE.Vector3(),
  lookAt = new THREE.Vector3(),
  cq = new THREE.Quaternion(),
  cq2 = new THREE.Quaternion(),
  ceu = new THREE.Euler();

/** 생물 전체 */
export class Creatures implements Thing {
  readonly list: Creature[] = [];
  /** 만난 종류(처음 만나면 더 크게 반짝) */
  readonly met = new Set<string>();
  /** 줄지어 따라오는 손님 */
  readonly followers: Creature[] = [];
  private readonly roam: RoamGroup[] = [];
  private readonly legends: Creature[] = [];
  private readonly species = new Map<string, Species>();
  private readonly batches: ModelBatch[] = [];
  private readonly rng: Random;
  private readonly pPrev = new THREE.Vector3();
  private pspd = 0;
  private readonly ctx: HabitCtx;
  // ---- 가까운 것만 움직이기 ----
  private active: number[] = [];
  private readonly activeMark: Uint8Array;
  private readonly lastAt = new THREE.Vector3();
  private lastTime = -1e9;
  private lastJumps = -1;
  private nowTime = 0;
  private readonly restCut: number;

  constructor(
    private readonly s: Services,
    private readonly links: CreatureLinks,
  ) {
    this.rng = s.rng.fork("creatures");
    this.ctx = {
      s,
      dt: 0,
      time: 0,
      meet: (c) => this.meet(c),
      nearestOtherHerd: (c) => this.nearestOtherHerd(c),
      visit: { t: 0, ctr: null },
    };
    const restAngle = Math.acos(REST_COS) + ACTIVE_MARGIN / S.R;
    this.restCut = Math.cos(restAngle);
    this.place();
    this.activeMark = new Uint8Array(this.list.length);
    this.pPrev.copy(s.player.p);
  }

  /** 따라오지 않는 생물 하나라도 14m 안에 있나(무리는 무리 중심으로 본다) — 지루함 감독이 '새로 마주친 순간'을 센다 */
  isAnyNear(p: Readonly<THREE.Vector3>): boolean {
    for (const c of this.list) {
      if (c.st === "follow") continue;
      const at = c.hv || c.v;
      if (at.dot(p) > 0.9996 && p.angleTo(at) * S.R < 14) return true;
    }
    return false;
  }

  /** 생물 프레임: 멀어진 무리는 앞쪽으로 옮기고, 가까운 생물은 저마다의 상태대로 움직이고, 보이는 것을 그린다 */
  update(f: Frame) {
    const { player } = this.s,
      dt = f.dt,
      p = player.p,
      x = this.ctx;
    this.nowTime = f.time;
    x.dt = dt;
    x.time = f.time;
    // 전설의 손님 곁에는 늘 빛가루가 인다(지난 프레임에 보였던 자리에서)
    for (const c of this.legends)
      if (c.visible && c.rng.next() < dt * 5) this.s.fx.burst(c.pos, 2, 4);
    // 순간 이동은 빠르기로 치지 않는다
    const sp = (p.angleTo(this.pPrev) * S.R) / Math.max(dt, 1e-3);
    if (sp < 60) this.pspd += (sp - this.pspd) * 0.25;
    this.pPrev.copy(p);
    const held = player.held,
      calm = !held && this.pspd < 1.5,
      rush = !held && this.pspd > 7;
    if (x.visit.t > 0) x.visit.t -= dt;
    for (const grp of this.roam) {
      const d = grp.ctr.angleTo(p) * S.R;
      cw.copy(grp.ctr).sub(p);
      const behind = cw.dot(player.h) < 0;
      if (d > 250 || (d > 150 && behind)) this.placeRoam(grp, false);
    }
    if (player.isHeldBy(this.links.whale)) this.met.add("whale");
    this.refreshActive();
    for (const b of this.batches) b.begin();
    const altA = player.P.length() - S.R;
    for (const i of this.active) {
      const c = this.list[i];
      if (c.v.dot(p) < REST_COS && c.st !== "follow" && c.st !== "fly") {
        c.visible = false;
        continue;
      } // 아주 먼 것은 쉬게 둔다
      const dP = c.v.angleTo(p) * S.R,
        dA = altA - c.a;
      const pose: Pose = { amt: 0, head: 0 };
      if (c.st === "follow") this.follow(c, pose);
      else if (c.role === "herd") this.herd(c, dP, dA, calm, rush, pose);
      else if (c.role === "flock") this.flock(c, dP, dA, pose);
      else if (c.role === "fish") this.fish(c, dP, calm, rush, pose);
      else this.jelly(c, dP, dA);
      const amtEase = ease(7, dt),
        headEase = ease(5, dt);
      c.amt += (pose.amt - c.amt) * amtEase;
      c.head += (pose.head - c.head) * headEase; // 동작과 동작 사이는 늘 부드럽게 넘어간다
      this.put(c, dt);
    }
    for (const b of this.batches) b.end();
  }

  /** 치운다(그리는 묶음은 모델 창구가 치운다) */
  dispose() {
    this.list.length = 0;
  }

  /* ─── 내부: 갈래마다의 상태 기계 ─────────────────────────── */

  // 만난 손님은 그 방문 동안 줄지어 따라온다
  private follow(c: Creature, pose: Pose) {
    const dt = this.ctx.dt,
      steps = this.links.footsteps;
    const lastHist = steps.length - 1;
    const trailIndex = 5 * (this.links.babyLimes.joined + c.order + 1) + 2;
    const histIndex = Math.min(lastHist, trailIndex);
    const hg = histIndex >= 0 ? steps.at(histIndex) : undefined;
    if (hg) {
      const d = c.v.angleTo(hg.p) * S.R;
      if (d > 0.25) {
        const chase = d * 4;
        const sp = Math.min(14, chase);
        const stride = sp > 5 ? 2.6 : 4.6;
        go(c, hg.p, sp, dt, stride);
        const pace = 0.4 + sp / 6;
        pose.amt = Math.min(1, pace);
      }
      const gl = this.s.terrain.groundAt(c.v),
        air0 = hg.a - 1.6 - gl;
      const trailAlt = hg.a - 1.6;
      const targetAlt = Math.max(gl, trailAlt);
      const altEase = ease(8, dt);
      c.a += (targetAlt - c.a) * altEase;
      if (air0 > 0.6) pose.amt = 0.3;
    }
    pose.head = 0.3;
    const pitchEase = ease(8, dt),
      sinkEase = ease(10, dt);
    c.pitch += (0 - c.pitch) * pitchEase;
    c.sink += (0 - c.sink) * sinkEase;
    if (c.gait === "hop") {
      if (c.hop > 0 || c.hopV > 0) {
        c.hop += c.hopV * dt;
        c.hopV -= 22 * dt;
        if (c.hop <= 0) {
          c.hop = 0;
          c.hopV = 0;
        }
      } else if (pose.amt > 0.3) {
        c.hopV = 4;
        c.hop = 0.01;
      }
    }
  }

  // 땅 위 무리: 풀 뜯기·쳐다보기·다가오기·기대기·놀라 달아나기·돌아보기·집으로. 종마다의 버릇이 그 앞뒤에 끼어든다
  private herd(c: Creature, dP: number, dA: number, calm: boolean, rush: boolean, pose: Pose) {
    const x = this.ctx,
      dt = x.dt,
      p = this.s.player.p,
      sp = this.species.get(c.k)!;
    c.a = this.s.terrain.groundAt(c.v);
    const sinkEase = ease(10, dt),
      rollEase = ease(6, dt);
    c.sink += (0 - c.sink) * sinkEase;
    c.roll += (0 - c.roll) * rollEase;
    if (c.hop > 0 || c.hopV > 0) {
      c.hop += c.hopV * dt;
      c.hopV -= 22 * dt;
      if (c.hop <= 0) {
        c.hop = 0;
        c.hopV = 0;
      }
    }
    const scare = dP < 9 && rush && Math.abs(dA) < 6,
      seen = dP < 13 && Math.abs(dA) < 7;
    const sense: Sense = { dP, dA, scare, seen };
    for (const h of sp.habits) h.before?.(c, sense, pose, x);
    let pitchOwned = false;
    for (const h of sp.habits) if (h.pitch?.(c, x)) pitchOwned = true;
    if (!pitchOwned) {
      const pitchEase = ease(8, dt);
      c.pitch += (0 - c.pitch) * pitchEase;
    }
    for (const h of sp.habits) h.touch?.(c, sense, x);
    const st = c.st;
    if (st === "graze" || st === "wander" || st === "watch") {
      if (scare) {
        c.st = sp.scaredTo;
        c.t = 0;
      } else if (seen) {
        // 풀 뜯다 말고 고개를 들어 쳐다본다
        c.st = "watch";
        pose.head = 0.75;
        const turn = ease(2.2, dt);
        face(c, p, turn);
        if (calm && dP < 6.5 && Math.abs(dA) < 4) {
          c.still += dt;
          if (c.still > 2.2) c.st = "come";
        } else {
          const stillLeft = c.still - dt;
          c.still = Math.max(0, stillLeft);
        }
      } else if (st === "watch") {
        c.st = "graze";
        c.t = c.rng.range(2, 5);
      } else if (st === "graze") {
        pose.head = -1;
        c.t -= dt;
        if (c.t <= 0) {
          c.st = "wander";
          // 난수 순서: 거리 → 방향
          const wanderDist = c.rng.range(1, 5.5);
          const wanderBearing = 360 * c.rng.next();
          c.goal = offset(c.hv!, wanderDist, wanderBearing);
        }
      } else {
        pose.amt = 0.7;
        if (go(c, c.goal!, 0.9, dt) < 0.4) {
          c.st = "graze";
          c.t = c.rng.range(3, 8);
        }
      }
    } else if (st === "startle") {
      // 움찔 — 몸을 낮췄다가
      c.t += dt;
      pose.head = 1;
      c.sink = 0.14;
      if (c.t > 0.16) {
        c.st = "run";
        c.t = 2.3;
        c.rs = 8.5;
        c.hopV = 5.5;
        c.hop = 0.01;
      }
    } else if (st === "run") {
      // 통통 뛰어 달아나다가 점점 느려진다
      away(c, p, c.rs!, dt);
      pose.amt = 1;
      pose.head = 0.4;
      const slowed = c.rs! - 3.1 * dt;
      c.rs = Math.max(1.4, slowed);
      c.t -= dt;
      if (c.hop <= 0 && c.rs > 2.6) {
        c.hopV = 2.2 + c.rs * 0.35;
        c.hop = 0.01;
      }
      if (c.t <= 0 && c.hop <= 0) {
        c.st = "lookback";
        c.t = c.rng.range(1.4, 2.2);
      }
    } else if (st === "lookback") {
      pose.head = 0.8;
      const turn = ease(3, dt);
      face(c, p, turn);
      c.t -= dt;
      if (scare) {
        c.st = "startle";
        c.t = 0;
      } else if (c.t <= 0) c.st = "home";
    } else if (st === "home") {
      pose.amt = 0.8;
      if (scare) {
        c.st = "startle";
        c.t = 0;
      } else if (go(c, c.home, 1.4, dt) < 1.2) {
        c.st = "graze";
        c.t = c.rng.range(2, 5);
        c.still = 0;
      }
    } else if (st === "come") {
      // 가만히 있으면 걸어와서
      pose.head = 0.5;
      if (scare) {
        c.st = "startle";
        c.t = 0;
      } else if (dP > 16) c.st = "home";
      else if (dP > 2.1) {
        go(c, p, 1.7, dt);
        pose.amt = 0.9;
      } else {
        c.st = "nuzzle";
        c.t = 0;
      }
    } else if (st === "nuzzle") {
      // 머리를 비비며 기댄다
      c.t += dt;
      const turn = ease(4, dt);
      face(c, p, turn);
      const nuzzlePhase = c.t * 5;
      pose.head = 0.2 + 0.6 * Math.sin(nuzzlePhase);
      const leanT = c.t / 1.6;
      const lean = Math.min(1, leanT) * Math.PI;
      c.roll = 0.12 * Math.sin(lean);
      if (c.t > 0.5) this.meet(c);
      if (c.t > 1.7 && !this.join(c)) {
        c.st = "graze";
        c.t = c.rng.range(3, 6);
        c.still = 0;
      }
    } else {
      // 버릇이 맡는 상태(카드의 넘어짐처럼 공통 상태 기계 안에서 도는 것)
      for (const h of sp.habits) h.states?.[st]?.(c, x);
    }
    if (c.gait === "hop" && pose.amt > 0.3 && c.hop <= 0 && c.hopV <= 0 && c.st !== "run") {
      c.hopV = 4;
      c.hop = 0.01;
    } // 뛰는 손님은 걸음 대신 통통
  }

  // 하늘을 도는 셋: 제 궤도를 돌다가, 버릇(visit)이 있으면 다가온 나를 찾아와 몸 둘레를 돈다
  private flock(c: Creature, dP: number, dA: number, pose: Pose) {
    const x = this.ctx,
      dt = x.dt,
      sp = this.species.get(c.k)!,
      sense: Sense = { dP, dA, scare: false, seen: false };
    let visiting = false;
    for (const h of sp.habits) if (h.fly?.(c, sense, pose, x)) visiting = true;
    if (visiting) return;
    c.ph += dt * (9 + 6 * c.amt);
    c.ang! += ((c.dir! * 6.5) / c.rad!) * 57.3 * dt;
    offsetInto(nv, c.ctr!, c.rad!, c.ang!);
    const lookAng = c.ang! + c.dir! * 10;
    offsetInto(lookAt, c.ctr!, c.rad!, lookAng);
    const turn = ease(8, dt);
    face(c, lookAt, turn);
    // 길들인 것(나를 찾아오는 것)은 제 궤도로 천천히 돌아온다
    const settleRate = sp.tame ? 2.5 : 30;
    const settle = ease(settleRate, dt);
    c.v.lerp(nv, settle).normalize();
    const bobPhase = x.time * 0.6 + c.an.x;
    const targetA = c.g0! + c.alt! + 1.2 * Math.sin(bobPhase) + c.slot! * 0.5;
    c.a += (targetA - c.a) * settle;
    const flapPhase = x.time * 0.9 + c.an.x * 2;
    pose.amt = 0.55 + 0.45 * Math.sin(flapPhase);
    c.roll = -c.dir! * 0.3;
    if (dP < 9 && Math.abs(dA) < 6) this.meet(c);
  }

  // 호수: 수면에서 원을 그리며 헤엄치다가 뛰어오르고, 멈춘 사람에게 다가와 방울을 불고, 놀라면 잠수한다
  private fish(c: Creature, dP: number, calm: boolean, rush: boolean, pose: Pose) {
    const x = this.ctx,
      dt = x.dt,
      p = this.s.player.p,
      ripples = this.s.ripples;
    const wsp = c.st === "jump" ? 5.5 : c.st === "visit" ? 0 : c.st === "dive" ? 4.5 : 1.3;
    c.ph += dt * (5 + wsp * 2.2);
    if (wsp > 0) {
      c.ang! += ((c.dir! * wsp) / c.rad!) * 57.3 * dt;
      offsetInto(nv, c.home, c.rad!, c.ang!);
      const lookAng = c.ang! + c.dir! * 12;
      offsetInto(lookAt, c.home, c.rad!, lookAng);
      const turn = ease(6, dt);
      face(c, lookAt, turn);
      c.v.copy(nv);
    }
    const scare = dP < 9 && rush;
    if (c.st === "swim") {
      const swimPhase = x.time * 1.4 + c.an.x;
      const swimAlt = 0.25 + 0.07 * Math.sin(swimPhase);
      const altEase = ease(5, dt),
        pitchEase = ease(5, dt);
      c.a += (swimAlt - c.a) * altEase;
      c.pitch += (0 - c.pitch) * pitchEase;
      pose.amt = 0.35;
      c.rt = (c.rt || 0) - dt;
      if (c.rt <= 0 && dP < 60) {
        c.rt = c.rng.range(0.9, 1.6);
        ripples.ripple(c.v, 0.45, 0);
      }
      c.jt! -= dt;
      if (c.jt! <= 0) {
        c.st = "jump";
        c.t = 0;
        c.jt = c.rng.range(4, 9);
        this.splash(c, 4);
      }
      if (dP < 12 && calm) {
        c.still += dt;
        if (c.still > 1.5) {
          c.st = "visit";
          c.t = 0;
          c.bt = 1;
        }
      } else c.still = 0;
      if (scare) {
        c.st = "dive";
        c.t = 0;
        this.splash(c, 5);
      }
    } else if (c.st === "jump") {
      // 물 위로 뛰어올랐다가 머리부터 들어간다
      c.t += dt;
      const k = c.t / 0.95;
      c.a = 0.25 + 9 * k * (1 - k);
      c.pitch = 0.95 * (1 - 2 * k);
      pose.amt = 1;
      if (k >= 1) {
        c.st = "swim";
        this.splash(c, 5);
      }
    } else if (c.st === "visit") {
      // 멈춰 선 사람 쪽으로 몸을 돌리고 고개를 내밀어 방울을 분다
      const turn = ease(3, dt);
      face(c, p, turn);
      const bobPhase = x.time * 2;
      const visitAlt = 0.5 + 0.08 * Math.sin(bobPhase);
      const altEase = ease(4, dt);
      c.a += (visitAlt - c.a) * altEase;
      c.pitch += (0.4 - c.pitch) * altEase;
      pose.amt = 0.15;
      c.t += dt;
      c.bt! -= dt;
      if (c.bt! <= 0) {
        c.bt = 2.3;
        cv.copy(c.pos).addScaledVector(c.v, 0.9);
        this.s.fx.burst(cv, 3, 4);
        ripples.ripple(c.v, 0.7, 0);
      }
      if (c.t > 2.5) this.meet(c);
      if (scare) {
        c.st = "dive";
        c.t = 0;
        this.splash(c, 5);
      } else if (dP > 17) c.st = "swim";
    } else if (c.st === "dive") {
      // 고개를 숙이고 물속으로
      c.t += dt;
      const pitchEase = ease(12, dt),
        altEase = ease(5, dt);
      c.pitch += (-1.1 - c.pitch) * pitchEase;
      c.a += (-3 - c.a) * altEase;
      pose.amt = 1;
      if (c.t > 0.9) {
        c.st = "under";
        c.t = c.rng.range(3, 5);
      }
    } else if (c.st === "under") {
      c.a = -3;
      c.pitch = 0.9;
      c.t -= dt;
      if (c.t <= 0 && !scare) {
        c.st = "jump";
        c.t = 0;
        this.splash(c, 4);
      }
    }
  }

  // 해파리: 갓을 오므릴 때마다 조금씩 솟고, 천천히 가라앉는다. 밟으면 출렁하며 튕겨 준다
  private jelly(c: Creature, dP: number, dA: number) {
    const x = this.ctx,
      dt = x.dt,
      pl = this.s.player;
    c.ph += dt * 2.1;
    const drift = dt * 0.12;
    cw.copy(c.f).applyAxisAngle(c.v, drift);
    c.f.copy(cw);
    if (c.v.angleTo(c.home) * S.R > 40) face(c, c.home, 0.05);
    const glide = (0.6 * dt) / S.R;
    c.v.addScaledVector(c.f, glide).normalize();
    const pulsePhase = c.ph - 1.9;
    const swayPhase = x.time * 0.3 + c.an.x;
    c.a = c.base! + 0.8 * Math.sin(pulsePhase) + Math.sin(swayPhase) * 0.8;
    if (c.hop !== 0 || c.hopV !== 0) {
      c.hopV += (-60 * c.hop - 7 * c.hopV) * dt;
      c.hop += c.hopV * dt;
      if (Math.abs(c.hop) < 0.01 && Math.abs(c.hopV) < 0.05) {
        c.hop = 0;
        c.hopV = 0;
      }
    } // 밟히면 출렁
    const hh = c.batch.hh;
    if (!pl.held && dP < 2.4 && dA > hh * 0.6 && dA < hh * 2 + 1.6 && pl.vy <= 0.5) {
      pl.bounce(9);
      c.hopV = -5;
      c.hop = -0.01;
      c.ph = 4.7;
      this.meet(c);
    }
    const headGap = dA - hh;
    if (dP < 7 && Math.abs(headGap) < 6) this.meet(c);
  }

  /* ─── 내부: 그리기·만나기 ─────────────────────────── */

  // 보는 쪽으로 세우고, 숙이고(pitch) 기울이고(roll), 땅 높이·뛰기·가라앉기를 더해 묶음에 넣는다
  private put(c: Creature, dt: number) {
    const visEase = ease(5, dt);
    c.vis += (c.want - c.vis) * visEase;
    const near = c.v.dot(this.s.player.p) > 0.9 && c.vis > 0.03;
    c.visible = near;
    if (!near) return;
    const B = c.batch;
    cx.crossVectors(c.f, c.v).normalize();
    cf.crossVectors(c.v, cx).normalize();
    cm.makeBasis(cf, c.v, cx);
    cq.setFromRotationMatrix(cm);
    if (c.pitch || c.roll) {
      ceu.set(c.roll, 0, c.pitch);
      cq2.setFromEuler(ceu);
      cq.multiply(cq2);
    }
    const lift = B.hh * (1 - c.sink);
    const radius = S.R + c.a + c.hop + lift;
    c.pos.copy(c.v).multiplyScalar(radius);
    const scale = B.k * c.vis;
    c.an.y = c.ph;
    c.an.z = c.amt;
    c.an.w = c.head;
    B.push(c.pos, cq, scale, c.an);
  }

  // 만났다: 처음 보는 종류면 더 크게 반짝. 전설의 손님을 만난 자리에는 그 방문 동안 작은 라임 워드마크가 남는다
  private meet(c: Creature) {
    if (c.met) return;
    c.met = true;
    if (c.legend) {
      const at = c.v.clone();
      this.links.signature.stampAt(at);
    }
    const first = !this.met.has(c.k);
    this.met.add(c.k);
    const sparkN = first ? 16 : 6;
    const sparkPower = first ? 9 : 6;
    this.s.fx.burst(c.pos, sparkN, sparkPower);
    if (first) this.s.fx.burst(c.pos, 10, 13);
  }

  // 줄지어 따라오기에 넣는다(여섯까지)
  private join(c: Creature): boolean {
    const FOL = this.followers;
    if (FOL.length >= 6 || c.order >= 0) return false;
    c.order = FOL.length;
    FOL.push(c);
    c.st = "follow";
    return true;
  }

  private splash(c: Creature, n: number) {
    const power = 0.5 + n * 0.12;
    const drops = n * 2;
    this.s.ripples.splash(c.v, power, drops);
  }

  // 35m 밖에서 가장 가까운 다른 땅 위 무리(제 무리는 뺀다)
  private nearestOtherHerd(c: Creature) {
    let ctr: THREE.Vector3 | null = null,
      d = 1e9;
    for (const grp of this.roam) {
      if (grp.kind !== "herd" || grp.mem.includes(c)) continue;
      const gd = grp.ctr.angleTo(c.v) * S.R;
      if (gd > 35 && gd < d) {
        d = gd;
        ctr = grp.ctr;
      }
    }
    return { ctr, d };
  }

  // 움직일 생물(하늘 무리·따라오는 것·가까운 것)을 다시 고른다. 내가 많이 움직였거나, 1초 지났거나, 순간 이동했을 때
  private refreshActive() {
    const pl = this.s.player,
      p = pl.p;
    const moved = this.lastAt.angleTo(p) * S.R;
    const stale = this.nowTime - this.lastTime > REBUILD_TIME;
    if (moved < REBUILD_MOVE && !stale && pl.jumps === this.lastJumps) return;
    this.lastAt.copy(p);
    this.lastTime = this.nowTime;
    this.lastJumps = pl.jumps;
    const mark = this.activeMark;
    mark.fill(0);
    const next: number[] = [];
    this.list.forEach((c, i) => {
      if (c.role === "flock" || c.st === "follow" || c.v.dot(p) >= this.restCut) {
        mark[i] = 1;
        next.push(i);
      }
    });
    this.active = next;
  }

  // 무리를 옮겼으면 그 손님들도 움직일 것에 넣는다(다음에 다시 고를 때까지)
  private activate(grp: RoamGroup) {
    let added = false;
    for (const c of grp.mem) {
      const i = this.list.indexOf(c);
      if (i < 0 || this.activeMark[i]) continue;
      this.activeMark[i] = 1;
      this.active.push(i);
      added = true;
    }
    if (added) this.active.sort(byNumber);
  }

  /* ─── 내부: 놓기 ─────────────────────────── */

  // 생물을 놓는다: 출발 앞 첫 무리, 마을마다 아홉 무리, 떠도는 무리, 마을 하늘의 무리, 전설, 호수, 해파리
  private place() {
    const s = this.s,
      { player, occ } = s,
      p = player.p,
      h = player.h,
      HV = occ.hubs,
      SP = herdSpecies(),
      FLK = skySpecies(),
      LAKE = lakeSpecies();
    const mkHerd = (hv: THREE.Vector3, n: number) => {
      const sp = SP[n % SP.length],
        out: Creature[] = [];
      for (let j = 0; j < sp.count; j++) {
        const bearing = (j * 360) / sp.count + n * 40;
        const spot = offset(hv, 2.8, bearing);
        const c = this.crit(sp.key, "herd", spot, { gait: sp.gait, st: "graze", hv });
        if (!c) continue;
        c.t = c.rng.range(1, 6);
        out.push(c);
      }
      return out;
    };
    // 땅 위의 손님: 첫 무리는 출발하자마자 눈앞에
    const startStep = 13 / S.R;
    const v0 = p.clone().addScaledVector(h, startStep).normalize();
    occ.fill(v0, 5);
    mkHerd(v0, 0);
    for (let hk = 0, n = 1; hk < HV.length; hk++)
      for (let q0 = 0, got = 0; q0 < 60 && got < 9; q0++) {
        const i = hk * 70 + q0;
        const distHash = fr(i, 201);
        const dist = 8 + 105 * Math.sqrt(distHash);
        const bearing = 360 * fr(i, 202);
        const v = occ.hubAt(hk, dist, bearing);
        if (!occ.isFree(v, 6)) continue;
        got++;
        occ.fill(v, 5);
        mkHerd(v, n);
        n++;
      } // 마을마다 아홉 무리
    // 어디로 가든 앞길에 손님이 있게: 떠도는 무리는 내가 멀어지면 내 앞쪽 먼 곳으로 조용히 옮겨 간다
    for (let i = 0; i < 27; i++) {
      const herdN = i + 1;
      const here = p.clone();
      const mem = mkHerd(here, herdN);
      this.roam.push({ mem, kind: "herd", ctr: here });
    }
    for (let i = 0; i < 10; i++) {
      const grp: RoamGroup = { mem: [], kind: "flock", ctr: p.clone() },
        rad = 14 + 16 * fr(i, 243),
        dir = i % 2 ? 1 : -1,
        alt = 4 + 6 * fr(i, 244),
        a0 = 360 * fr(i, 245);
      const kind = FLK[i % FLK.length];
      for (let j = 0; j < 3; j++) {
        const ang = a0 - dir * j * 14;
        const o = { ctr: grp.ctr, rad, dir, alt, ang, slot: j, st: "fly", g0: 0 };
        const c = this.crit(kind.key, "flock", grp.ctr, o);
        if (c) grp.mem.push(c);
      }
      this.roam.push(grp);
    }
    for (let i = 0; i < 12; i++) {
      const grp: RoamGroup = { mem: [], kind: "jelly", ctr: p.clone() };
      const c = this.crit("umbrella", "jelly", grp.ctr, { base: 6 });
      if (c) grp.mem.push(c);
      this.roam.push(grp);
    }
    for (const grp of this.roam) this.placeRoam(grp, true); // 빈자리를 못 찾아도 어딘가에는 놓는다
    // 하늘 무리: 마을 하늘을 셋씩 낮게 돈다(마을마다 셋, 다섯 종을 돌려 가며)
    for (let hk = 0; hk < HV.length; hk++)
      for (let q0 = 0; q0 < 3; q0++) {
        const i = hk * 9 + q0;
        const ctrDist = 12 + 60 * fr(i, 211);
        const ctrBearing = 360 * fr(i, 212);
        const ctr = occ.hubAt(hk, ctrDist, ctrBearing),
          rad = 14 + 16 * fr(i, 213),
          dir = q0 % 2 ? 1 : -1,
          alt = 4 + 6 * fr(i, 214),
          a0 = 360 * fr(i, 215);
        const kindAt = (hk * 2 + q0) % FLK.length;
        const kind = FLK[kindAt];
        const g0 = s.terrain.groundAt(ctr);
        for (let j = 0; j < 3; j++) {
          const start = offset(ctr, rad, a0);
          const ang = a0 - dir * j * 14;
          this.crit(kind.key, "flock", start, { ctr, rad, dir, alt, ang, slot: j, st: "fly", g0 });
        }
      }
    // 전설의 손님: 온 행성에 세 곳씩뿐이고 자리를 옮기지 않는다. 곁에는 늘 빛가루가 인다
    for (const [key, set] of Object.entries(CREATURES)) {
      const L = set.legend;
      if (!L) continue;
      for (const [hk, d, b] of L.at) {
        const at = offset(HV[hk], d, b);
        if (L.kind === "ground") {
          const c = this.crit(key, "herd", at, { gait: "walk", st: "graze", hv: at, legend: 1 });
          if (!c) continue;
          c.t = c.rng.range(1, 6);
          this.legends.push(c);
        } else {
          const start = offset(at, 22, 0);
          const o = { ctr: at, rad: 22, dir: 1, alt: 16, ang: 0, slot: 0, st: "fly", legend: 1 };
          const c = this.crit(key, "flock", start, o);
          if (!c) continue;
          c.g0 = s.terrain.groundAt(at);
          this.legends.push(c);
        }
      }
    }
    // 호수: 호수마다 둘, 세 종을 돌려 가며 수면에서 원을 그리며 헤엄친다
    this.links.lakes.list.forEach((l, i) => {
      for (let j = 0; j < 2; j++) {
        const rad = 3 + j * 1.5;
        const pondDist = l.r * (0.4 + 0.25 * j);
        const pondBearing = i * 67 + j * 170;
        const pondAt = offset(l.v, pondDist, pondBearing);
        const kindAt = (i + j) % LAKE.length;
        const kind = LAKE[kindAt];
        const dir = j ? -1 : 1;
        const c = this.crit(kind.key, "fish", pondAt, { st: "swim", rad, dir });
        if (!c) continue;
        c.ang = 360 * c.rng.next();
        c.jt = c.rng.range(2, 8);
        c.a = 0.25;
        offsetInto(c.v, c.home, rad, c.ang);
      }
    });
    // 해파리: 마을 둘레와 마을 사이 하늘
    const jl = (v: THREE.Vector3) => {
      const c = this.crit("umbrella", "jelly", v, {});
      if (c) c.base = s.terrain.groundAt(c.v) + 5.5;
    };
    const jellyAt: [number, number][] = [
      [185, 12],
      [185, 100],
      [185, 192],
      [185, 281],
      [560, 45],
    ];
    for (const [d, b] of jellyAt) {
      const spot = from(d, b);
      jl(spot);
    }
    for (let hk = 0; hk < HV.length; hk++)
      for (let j = 0; j < 7; j++) {
        const jellySeed = hk * 11 + j;
        const dist = 18 + 95 * fr(jellySeed, 221);
        const bearing = 360 * fr(jellySeed, 222);
        const spot = occ.hubAt(hk, dist, bearing);
        jl(spot);
      }
  }

  // 생물 하나를 만든다(그 종의 그리기 묶음에 자리를 하나 더한다). 모델이 manifest 에 없으면 null
  private crit(
    k: string,
    role: CreatureRole,
    v: THREE.Vector3,
    o: Partial<Creature>,
  ): Creature | null {
    const sp = this.speciesOf(k);
    if (!sp) return null;
    const index = this.list.length;
    const name = "c" + index;
    const rng = this.rng.fork(name);
    const bendPhase = 6.28 * rng.next();
    const at = v.clone().normalize();
    const base: Creature = {
      k,
      role,
      batch: sp.batch,
      rng,
      an: new THREE.Vector4(bendPhase, 0, 0, 0),
      v: at,
      home: at.clone(),
      f: new THREE.Vector3(),
      pos: new THREE.Vector3(),
      visible: false,
      a: this.s.terrain.groundAt(v),
      ph: 6.28 * rng.next(),
      st: "idle",
      t: 0,
      still: 0,
      hop: 0,
      hopV: 0,
      vis: 1,
      want: 1,
      order: -1,
      met: false,
      sink: 0,
      pitch: 0,
      roll: 0,
      amt: 0,
      head: 0,
    };
    const c: Creature = Object.assign(base, o);
    const faceBearing = 360 * rng.next();
    const facePoint = offset(c.v, 2, faceBearing);
    c.f.copy(facePoint).sub(c.v);
    const fUp = c.f.dot(c.v);
    c.f.addScaledVector(c.v, -fUp).normalize();
    this.list.push(c);
    return c;
  }

  // 종 하나를 준비한다: 설정·그리는 묶음(크기는 종마다 하나)·버릇
  private speciesOf(k: string): Species | null {
    const known = this.species.get(k);
    if (known) return known;
    const set = CREATURES[k];
    if (!set || !this.s.models.has(k)) return null;
    const { size, by } = sizeOf(set);
    const batch = this.s.models.batch(k, CAPACITY, size, by, set.motion);
    if (!batch) return null;
    const habits = (set.habits ?? []).map((name) => HABITS[name]);
    const tame = habits.some((h) => h.fly);
    const scaredHabit = habits.find((h) => h.scaredTo);
    const scaredTo = scaredHabit?.scaredTo ?? "startle";
    const sp: Species = { set, batch, habits, tame, scaredTo };
    this.species.set(k, sp);
    this.batches.push(batch);
    return sp;
  }

  // 떠도는 무리를 옮긴다: 처음엔 내 둘레 아무 데나, 그 뒤엔 내 앞쪽 먼 곳(가는 방향 쪽으로 좁혔다)
  private placeRoam(grp: RoamGroup, first: boolean) {
    const { player, occ } = this.s,
      p = player.p,
      r = this.rng;
    for (let k = 0; k < 24; k++) {
      if (first) {
        // 난수 순서: 거리 → 방향
        const dist = r.range(25, 210);
        const bearing = 360 * r.next();
        offsetInto(cv, p, dist, bearing);
      } else this.ahead(110, 190, 0.6);
      if (grp.kind !== "herd" || occ.isFree(cv, 6)) break;
    }
    this.setGroup(grp, cv);
    if (!first) this.activate(grp);
  }

  // 가는 쪽에서 ±spread 라디안, dmin~dmax 앞의 자리를 cv 에
  private ahead(dmin: number, dmax: number, spread: number) {
    const { p, h } = this.s.player,
      r = this.rng;
    // 난수 순서: 방향 → 거리
    const turn = r.range(-spread, spread);
    cw.copy(h).applyAxisAngle(p, turn);
    const dist = r.range(dmin, dmax);
    const arc = dist / S.R;
    const stepLen = Math.tan(arc);
    cv.copy(p).addScaledVector(cw, stepLen).normalize();
  }

  // 무리 하나를 새 중심(at)으로. 앞장서는 중인 회중시계·따라오는 손님은 하던 것을 마저 한다
  private setGroup(grp: RoamGroup, at: THREE.Vector3) {
    const terrain = this.s.terrain;
    grp.ctr = at.clone();
    const ctr = grp.ctr;
    grp.mem.forEach((c, j) => {
      if (c.st === "follow" || c.st === "lead" || c.st === "beckon") return;
      c.led = false;
      c.bowed = false;
      if (c.role === "herd") {
        c.hv = ctr;
        const bearing = (j * 360) / grp.mem.length + 20;
        offsetInto(c.home, ctr, 2.8, bearing);
        c.pitch = 0;
        c.sink = 0;
        c.v.copy(c.home);
        c.st = "graze";
        c.t = c.rng.range(1, 6);
        c.still = 0;
        c.hop = 0;
        c.hopV = 0;
        c.met = false;
      } else if (c.role === "flock") {
        c.ctr = ctr;
        c.g0 = terrain.groundAt(ctr);
        offsetInto(c.v, ctr, c.rad!, c.ang!);
        c.met = false;
      } else {
        c.home.copy(ctr);
        c.v.copy(ctr);
        c.base = terrain.groundAt(ctr) + 5.5;
        c.met = false;
      }
    });
  }
}

/* ─── 내부 ─────────────────────────── */

/** 종마다 그리는 묶음 하나의 칸 수(가장 많은 종도 이 안에 든다) */
const CAPACITY = 128;

// 종의 크기와 재는 쪽: 땅 위 무리·해파리는 키(h), 하늘 무리는 너비(w), 호수는 앞뒤(x), 전설은 정한 대로
function sizeOf(set: CreatureSetting): { size: number; by: string } {
  if (set.herd) return { size: set.herd.size, by: "h" };
  if (set.sky) return { size: set.sky.size, by: "w" };
  if (set.lake) return { size: set.lake.size, by: "x" };
  if (set.jelly) return { size: set.jelly.size, by: "h" };
  if (set.legend) return { size: set.legend.size, by: set.legend.by };
  return { size: 2.5, by: "h" };
}

function byNumber(a: number, b: number): number {
  return a - b;
}
