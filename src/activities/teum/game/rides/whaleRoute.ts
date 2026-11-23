import * as THREE from "three";

import { S } from "../settings";
import { fromInto } from "../world/sphere";

// 고래가 도는 길. 온 행성이 뭍이면 큰 바퀴(출발 마을에서 떠나 행성을 한 바퀴, 바퀴마다 방향을 90 도씩 바꿔 여섯 마을을 지난다),
// 뭍이 반구뿐이면 섬 일주(뭍의 가운데를 둘러 마을 곁을 지나는 고리) — 등에 탄 채 바다 한가운데에 내려놓지 않으려는 것이다.
// 길마다 높이 표의 칸(cell)과 시계의 자리(at)·보는 칸(tableAt)을 같은 셈으로 답한다

/** 고래가 도는 길 */
export interface WhaleRoute {
  /** 높이 표의 수(길이 다른 바퀴마다 하나) */
  readonly tables: number;
  /** 표 table 을 n 칸으로 나눈 i 번째 칸의 가운데 자리 */
  cell(table: number, i: number, n: number, out: THREE.Vector3): THREE.Vector3;
  /** 시계 tt 의 자리 */
  at(tt: number, out: THREE.Vector3): THREE.Vector3;
  /** 시계 tt 가 보는 표와 그 표 안의 몫(0..1) */
  tableAt(tt: number): { table: number; along: number };
}

/** 한 바퀴의 길이(자리표 거리 — 행성 둘레)와 빠르기(자리표 거리/초) */
const LAP = 1485.2,
  SPEED = 6.8;
/** 출발 마을에서 조금 떨어진 곳에서 떠난다(바퀴의 몫) */
const LAP_START = 0.02;
/** 바퀴의 끝 몫(TURN_FROM 뒤 TURN_SPAN 동안 다음 방향으로 부드럽게 돈다) */
const TURN_FROM = 0.94,
  TURN_SPAN = 0.06;
/** 큰 바퀴의 높이 표: 방향 0 도 바퀴와 90 도 바퀴(180·270 도 바퀴는 같은 길을 거꾸로 간다) */
const TOUR_BEARS = [0, 90];
/** 섬 일주: 뭍의 가운데에서 이 각(도)만큼 떨어진 고리 — 세 마을(가운데에서 약 55 도)의 안쪽 곁을 지난다 */
const ISLAND_RING = 45;

/** 큰 바퀴: 행성을 크게 돌며 여섯 마을을 지난다 */
export function grandTour(): WhaleRoute {
  return {
    tables: TOUR_BEARS.length,
    cell(table, i, n, out) {
      const dist = (LAP * (i + 0.5)) / n;
      return fromInto(out, dist, TOUR_BEARS[table]);
    },
    at(tt, out) {
      const l = (tt * SPEED) / LAP + LAP_START,
        lap = Math.floor(l),
        frac = l - lap;
      let bear = 90 * lap;
      if (frac > TURN_FROM) {
        const u = (frac - TURN_FROM) / TURN_SPAN;
        bear += 90 * u * u * (3 - 2 * u);
      }
      const dist = LAP * frac;
      return fromInto(out, dist, bear);
    },
    tableAt(tt) {
      const l = (tt * SPEED) / LAP + LAP_START,
        lap = Math.floor(l),
        frac = l - lap;
      const along = lap % 4 < 2 ? frac : 1 - frac;
      return { table: lap % 2, along };
    },
  };
}

/** 섬 일주: 뭍의 가운데(centre)를 둘러 도는 고리. 출발 마을 곁에서 떠난다 */
export function islandLoop(centre: THREE.Vector3): WhaleRoute {
  const ring = (ISLAND_RING * Math.PI) / 180;
  const start = new THREE.Vector3();
  fromInto(start, 0, 0);
  // 고리의 기준: 가운데에서 출발 마을 쪽(u)과 그 옆(w)
  const startAlong = start.dot(centre);
  const u = start.clone().addScaledVector(centre, -startAlong).normalize();
  const w = new THREE.Vector3().crossVectors(centre, u);
  const up = Math.cos(ring),
    out0 = Math.sin(ring);
  const point = (turn: number, out: THREE.Vector3) => {
    const along = Math.cos(turn) * out0,
      aside = Math.sin(turn) * out0;
    return out.copy(centre).multiplyScalar(up).addScaledVector(u, along).addScaledVector(w, aside);
  };
  // 고리 한 바퀴의 길이(m)와 시계 1초에 도는 각
  const lapMetres = 2 * Math.PI * S.R * out0;
  const turnPerSecond = (2 * Math.PI * SPEED * S.wide) / lapMetres;
  return {
    tables: 1,
    cell(_table, i, n, out) {
      const turn = (2 * Math.PI * (i + 0.5)) / n;
      return point(turn, out);
    },
    at(tt, out) {
      const turn = tt * turnPerSecond;
      return point(turn, out);
    },
    tableAt(tt) {
      const laps = (tt * turnPerSecond) / (2 * Math.PI);
      const whole = Math.floor(laps);
      return { table: 0, along: laps - whole };
    },
  };
}
