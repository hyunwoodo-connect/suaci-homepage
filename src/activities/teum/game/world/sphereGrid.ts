// 행성 위 자리(단위 벡터)를 칸으로 나눠 두는 공간 분할. "이 둘레에 무엇이 있나"를 전부 훑지 않고 몇 칸만 본다.
// 칸은 단위 벡터의 xyz 를 같은 간격(cell, 현 길이 단위)으로 자른 정육면체 — 공 표면에 걸친 칸만 생긴다.
// 돌려주는 것은 후보(가까울 수 있는 것)이고, 정확한 거리 검사는 부른 쪽이 한다.
// 후보의 차례는 칸 차례다 — 부르는 쪽(땅 높이의 최댓값, 빈자리의 '하나라도', 꽃 피우기)은 차례와 상관없는 셈만 한다.
// 프레임마다 부르므로 정렬하지 않는다(정렬이 임시 배열을 만들어 가비지가 된다)

/** 단위 벡터 하나(three 의 Vector3 도 된다) */
export interface UnitLike {
  x: number;
  y: number;
  z: number;
}

/** 칸 나눔. 넣은 순서대로 번호(id)가 붙는다 */
export class SphereGrid {
  private readonly cells = new Map<number, number[]>();
  private readonly keyOf: number[] = [];
  /** 들어 있는 수 */
  size = 0;

  /** cell: 칸 한 변(현 길이, 반지름 1 기준). 0.08 ≈ 행성 위 42m */
  constructor(private readonly cell: number) {}

  /** 하나 넣는다. 번호를 돌려준다 */
  add(v: UnitLike): number {
    const id = this.size++;
    const key = this.key(v);
    this.keyOf.push(key);
    this.bucket(key).push(id);
    return id;
  }

  /** 움직인 것의 칸을 고친다 */
  move(id: number, v: UnitLike) {
    const key = this.key(v);
    const old = this.keyOf[id];
    if (key === old) return;
    const list = this.cells.get(old)!;
    const at = list.indexOf(id);
    list.splice(at, 1);
    this.keyOf[id] = key;
    this.bucket(key).push(id);
  }

  /** v 에서 현 길이 chord 안에 있을 수 있는 것의 번호를 out 에(칸 차례로, 겹치지 않게 — 하나는 한 칸에만 있다) */
  query(v: UnitLike, chord: number, out: number[]): number[] {
    out.length = 0;
    const spanCells = chord / this.cell,
      span = Math.ceil(spanCells);
    const ix = this.cellOf(v.x),
      iy = this.cellOf(v.y),
      iz = this.cellOf(v.z);
    for (let x = ix - span; x <= ix + span; x++)
      for (let y = iy - span; y <= iy + span; y++)
        for (let z = iz - span; z <= iz + span; z++) {
          const key = pack(x, y, z);
          const list = this.cells.get(key);
          if (!list) continue;
          for (let i = 0; i < list.length; i++) out.push(list[i]);
        }
    return out;
  }

  private key(v: UnitLike): number {
    const ix = this.cellOf(v.x),
      iy = this.cellOf(v.y),
      iz = this.cellOf(v.z);
    return pack(ix, iy, iz);
  }

  // 한 축의 칸 번호(-1..1 을 cell 간격으로)
  private cellOf(x: number): number {
    const shifted = (x + 1) / this.cell;
    return Math.floor(shifted);
  }

  private bucket(key: number): number[] {
    let list = this.cells.get(key);
    if (!list) {
      list = [];
      this.cells.set(key, list);
    }
    return list;
  }
}

/** 각도(라디안) → 현 길이(반지름 1). 그 각 안의 것은 이 현 길이 안에 있다 */
export function chordOf(angle: number): number {
  const half = Math.min(Math.PI, angle) / 2;
  return 2 * Math.sin(half);
}

/* ─── 내부 ─────────────────────────── */

// 칸 좌표(각각 0..1023)를 수 하나로
function pack(x: number, y: number, z: number): number {
  return ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
}
