import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Progress } from "../progress/progress";
import type { VisitLine } from "../progress/rules";
import { visitLandmark } from "../progress/rules";
import type { Deco } from "../sculptures/sculptures";
import type { Services } from "../services";
import { S } from "../settings";
import { LANDMARK_HELLO, LANDMARK_LINES } from "./lines";

// 랜드마크가 말을 건다: 마을마다 선 기준탑(그 지역 종류에서 뽑힌 큰 조형물)이 그 지역의 주인이다.
// 다가가면 말풍선으로 말을 걸고, 몇 번째 왔는지·누굴 데려왔는지 기록(Progress)에 남긴다. 멀리 갔다 돌아오면 다시 말을 건다.
// 축제 지역의 도장·부탁, 덤 상자, 길잡이 화살표는 아직 짓지 않았다(구조만 progress/ 에)

/** 말을 거는 거리: 랜드마크 몸 + 16m 안, 다시 말을 걸게 되는 거리: 몸 + 70m 밖. 랜드마크가 없는 마을은 몸을 8m 로 친다 */
const TALK_REACH = 16,
  REARM_REACH = 70,
  NO_LANDMARK_R = 8;
/** 말풍선이 떠 있는 시간(초) · 랜드마크 땅 위로 이만큼 높은 곳을 가리킨다 */
const TALK_SECONDS = 6.5,
  TALK_LIFT = 9;
/** 말풍선이 화면 가장자리·위아래로 넘지 않게(px · 화면 높이 몫) */
const EDGE_X = 125,
  TOP_MIN = 110,
  TOP_MAX = 0.55;

const at3 = new THREE.Vector3();

/** 랜드마크들 */
export class Landmarks implements Thing {
  private readonly said: boolean[];
  private talkT = 0;
  private talkHk = -1;
  /** 종 → 사는 지역(지역의 residents) */
  private readonly homes = new Map<string, number>();

  constructor(
    private readonly s: Services,
    private readonly landmarks: readonly (Deco | undefined)[],
    private readonly progress: Progress,
  ) {
    this.said = s.occ.hubs.map(() => false);
    s.map.regions.forEach((r, hk) => {
      for (const k of r.residents) this.homes.set(k, hk);
    });
  }

  /** 다가가면 말을 걸고, 말풍선을 랜드마크 위에 둔다(카메라 다음) */
  update(f: Frame) {
    // 맵만 보기(지도 bare)에는 말을 걸지 않는다
    if (this.s.map.bare) return;
    const { player, hud, occ } = this.s,
      p = player.p;
    for (let hk = 0; hk < occ.hubs.length; hk++) {
      const o = this.landmarks[hk],
        v = o ? o.v : occ.hubs[hk],
        r = o ? o.r : NO_LANDMARK_R;
      const d = p.angleTo(v) * S.R;
      // 멀리 갔다 돌아오면 다시 말을 건다(말하는 동안은 두고)
      if (this.said[hk] && this.talkT <= 0 && d > r + REARM_REACH) this.said[hk] = false;
      if (this.said[hk] || d >= r + TALK_REACH) continue;
      this.said[hk] = true;
      this.talkHk = hk;
      this.talkT = TALK_SECONDS;
      const line = this.lineFor(hk);
      hud.showTalk(line);
      this.s.events.emit("landmarkTalked", { region: hk });
    }
    if (this.talkT <= 0) return;
    this.talkT -= f.dt;
    this.place();
    if (this.talkT <= 0) hud.hideTalk();
  }

  dispose() {}

  /* ─── 내부 ─────────────────────────── */

  // 이번에 할 말: 다녀간 것을 기록하고, 첫 방문이면 그 지역의 인사, 아니면 데려온 친구·몇 번째인지
  private lineFor(hk: number): string {
    const progress = this.progress,
      day = this.s.today.day,
      homeOf = (k: string) => this.homes.get(k);
    const visit = visitLandmark(progress.save, hk, day, homeOf);
    progress.commit();
    const name = this.s.map.regions[hk]?.name ?? "";
    return textOf(visit.line, visit.n, name);
  }

  // 말풍선을 랜드마크 꼭대기 위에: 화면 밖이면 가운데 위
  private place() {
    const { hud, occ, terrain, camera } = this.s,
      hk = this.talkHk,
      o = this.landmarks[hk],
      v = o ? o.v : occ.hubs[hk];
    const ground = o ? o.g : terrain.groundAt(v);
    const radius = S.R + ground + TALK_LIFT;
    at3.copy(v).multiplyScalar(radius).project(camera.camera);
    const onScreen = at3.z < 1 && Math.abs(at3.x) < 1.1;
    const sx = (at3.x * 0.5 + 0.5) * innerWidth,
      sy = (-at3.y * 0.5 + 0.5) * innerHeight;
    const xMax = innerWidth - EDGE_X,
      yMax = innerHeight * TOP_MAX,
      left = Math.max(EDGE_X, sx),
      top = Math.max(TOP_MIN, sy);
    const x = onScreen ? Math.min(xMax, left) : innerWidth / 2;
    const y = onScreen ? Math.min(yMax, top) : TOP_MIN;
    hud.placeTalk(x, y);
  }
}

/* ─── 내부 ─────────────────────────── */

// 말 갈래 → 글(대사 파일에서)
function textOf(line: VisitLine, n: number, region: string): string {
  if (line === "hello") return LANDMARK_HELLO[region] ?? LANDMARK_LINES.hello;
  if (line === "again") {
    const count = String(n);
    return LANDMARK_LINES.again.replace("{n}", count);
  }
  return LANDMARK_LINES[line];
}
