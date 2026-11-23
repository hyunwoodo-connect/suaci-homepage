import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { ModelBatch } from "../models/batch";
import type { Services } from "../services";
import { S } from "../settings";
import type { BehaviorCtx } from "./behaviors";
import { behave } from "./behaviors";
import type { Creature, CreatureLinks, Pose } from "./creature";
import type { PlaceCtx, RoamGroup, Species } from "./placement";
import { placeCreatures, placeHerds, placeRoam } from "./placement";

// 생물: 놀이기구가 아니라 손님이다. 저마다 제 할 일을 하다가 나를 알아채고, 동작이 끊기지 않고 이어진다. 이름은 없다.
// 땅 위의 손님(걷는 찻주전자·카드 병정·뛰는 버섯…), 셋씩 낮게 도는 하늘 무리(열쇠·날개 하트·편지·찻잔·종), 해파리 우산,
// 호수의 헤엄치는 것(물고기·일각고래·물개), 그리고 자리를 옮기지 않는 전설의 손님(라임 사슴·날개 달린 왕관).
// 종의 생김새·크기·걸음새·버릇은 설정 표(assets/settings 의 CREATURES) 한곳에, 어디에 몇 무리인지는 지도(creatures)에 있다.
// 여기는 프레임의 차례(떠도는 무리 옮기기 → 가까운 것 고르기 → 상태 기계 → 그리기)와 만나기를 둔다.
// 갈래(땅·하늘·해파리·호수)마다의 공통 상태 기계는 behaviors, 놓는 규칙은 placement, 종마다 다른 것은 버릇(habits)에 있다.
// 그리기는 종마다 한 묶음(ModelBatch): 가까이 보이는 것만 매 프레임 채워 그린다

/** 가까이 있는 것만 움직이는 경계(v·p < 0.8 이면 쉰다)와, 다시 고르기 전까지 버틸 여유 */
const REST_COS = 0.8,
  ACTIVE_MARGIN = 60,
  /** 이만큼 움직이거나 이 시간이 지나면 다시 고른다(생물은 초속 14m 를 넘지 않는다) */
  REBUILD_MOVE = 30,
  REBUILD_TIME = 1;

const cf = new THREE.Vector3(),
  cx = new THREE.Vector3(),
  cm = new THREE.Matrix4(),
  cw = new THREE.Vector3(),
  cq = new THREE.Quaternion(),
  cq2 = new THREE.Quaternion(),
  ceu = new THREE.Euler();

/** 생물 전체 */
export class Creatures implements Thing {
  readonly list: Creature[] = [];
  /** 만난 종류(처음 만나면 더 크게 반짝) */
  private readonly met = new Set<string>();
  /** 줄지어 따라오는 손님 */
  private readonly followers: Creature[] = [];
  private readonly roam: RoamGroup[] = [];
  private readonly legends: Creature[] = [];
  private readonly batches: ModelBatch[] = [];
  private readonly pPrev = new THREE.Vector3();
  private pspd = 0;
  /** 상태 기계와 버릇이 같이 보는 창구 */
  private readonly ctx: BehaviorCtx;
  /** 놓기가 보는 것(날이 바뀌면 축제 무리를 더 놓고, 멀어진 떠도는 무리를 옮긴다) */
  private readonly placing: PlaceCtx;
  /** 프레임마다 생물마다 새로 만들지 않게 돌려 쓰는 칸 */
  private readonly pose: Pose = { amt: 0, head: 0 };
  // ---- 가까운 것만 움직이기 ----
  private active: number[] = [];
  private activeMark: Uint8Array;
  /** 오늘의 축제 지역에 더 놓인 무리(날이 바뀌면 떠나고 새 축제 지역에 새로 온다) */
  private festivalHerds: Creature[] = [];
  private readonly lastAt = new THREE.Vector3();
  private lastTime = -1e9;
  private lastJumps = -1;
  private nowTime = 0;
  private readonly restCut: number;

  constructor(
    private readonly s: Services,
    private readonly links: CreatureLinks,
  ) {
    const rng = s.rng.fork("creatures"),
      species = new Map<string, Species>();
    this.ctx = {
      s,
      dt: 0,
      time: 0,
      meet: (c) => this.meet(c),
      nearestOtherHerd: (c) => this.nearestOtherHerd(c),
      visit: { t: 0, ctr: null },
      links,
      species,
      sense: { dP: 0, dA: 0, scare: false, seen: false },
      followers: this.followers,
    };
    this.placing = {
      s,
      rng,
      links,
      list: this.list,
      species,
      batches: this.batches,
      roam: this.roam,
      legends: this.legends,
      herdN: 1,
    };
    const restAngle = Math.acos(REST_COS) + ACTIVE_MARGIN / S.R;
    this.restCut = Math.cos(restAngle);
    this.festivalHerds = placeCreatures(this.placing);
    this.activeMark = new Uint8Array(this.list.length);
    s.events.on("dayChanged", ({ festival }) => this.setFestival(festival));
    this.pPrev.copy(s.player.p);
  }

  /** 따라오지 않는 생물 하나라도 14m 안에 있나(무리는 무리 중심으로 본다) — 지루함 감독이 '새로 마주친 순간'을 센다 */
  isAnyNear(p: Readonly<THREE.Vector3>): boolean {
    for (const c of this.list) {
      if (c.st === "follow" || c.gone) continue;
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
      if (d > 250 || (d > 150 && behind)) {
        placeRoam(this.placing, grp, false);
        this.activate(grp);
      }
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
      const pose = this.pose;
      pose.amt = 0;
      pose.head = 0;
      behave(c, dP, dA, calm, rush, pose, x);
      const amtEase = ease(7, dt),
        headEase = ease(5, dt);
      c.amt += (pose.amt - c.amt) * amtEase;
      c.head += (pose.head - c.head) * headEase; // 동작과 동작 사이는 늘 부드럽게 넘어간다
      this.put(c, dt);
    }
    for (const b of this.batches) b.end();
    // 데리고 다니는 손님 수만큼 카메라가 높아지고 멀어진다(다 같이 화면에 들어오게)
    this.s.camera.setCompany(this.followers.length);
  }

  /** 치운다(그리는 묶음은 모델 창구가 치운다) */
  dispose() {
    this.list.length = 0;
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
    const events = this.s.events,
      kind = c.k;
    if (c.legend) {
      const at = c.v.clone();
      this.links.signature.stampAt(at);
      events.emit("legendMet", { kind });
    }
    const first = !this.met.has(c.k);
    this.met.add(c.k);
    const legend = Boolean(c.legend);
    events.emit("creatureMet", { kind, first, legend });
    const sparkN = first ? 16 : 6;
    const sparkPower = first ? 9 : 6;
    this.s.fx.burst(c.pos, sparkN, sparkPower);
    if (first) this.s.fx.burst(c.pos, 10, 13);
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
      if (c.gone) return;
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

  // 날이 바뀌어 축제 지역이 바뀌었다: 어제 더 온 무리는 떠나고(따라오는 것은 남는다), 새 축제 지역에 무리가 더 온다
  private setFestival(hk: number) {
    for (const c of this.festivalHerds)
      if (c.st !== "follow") {
        c.gone = true;
        c.visible = false;
      }
    const own = this.s.map.regions[hk].herds.length,
      want = own * this.s.map.creatures.festival;
    this.festivalHerds = placeHerds(this.placing, hk, own, want);
    if (this.activeMark.length < this.list.length) {
      const grown = new Uint8Array(this.list.length);
      grown.set(this.activeMark);
      this.activeMark = grown;
    }
    this.lastTime = -1e9;
  }
}

/* ─── 내부 ─────────────────────────── */

function byNumber(a: number, b: number): number {
  return a - b;
}
