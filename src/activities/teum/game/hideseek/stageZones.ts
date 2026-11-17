import { BOX_HALF, startPoint } from "./spots";
import { FIND } from "./findTuning";
import { openSeats } from "./bystanders";
import { HIDE } from "./tuning";

// 숨바꼭질이 무대(마을 가운데 기준 평면 m)에 차지하는 자리: 후보 물건·탑·통통 구름 위 물건·버섯·구경꾼 자리·출발 줄.
// 값(hideseek.data.json)만으로 셈한다 — 흩뿌리는 것이 이 자리를 피하게 먼저 맡아 두는 데(Game)와 지도 점검(maps)이 같이 쓴다.
// 금색 상자·언박싱 줄은 그때 내가 선 자리 앞에 놓여서 정해진 자리가 없다(여기 없다)

/** 자리의 갈래 */
export type StageZoneKind = "prop" | "tower" | "perch" | "mushroom" | "seat" | "start";

/** 무대의 자리 하나 */
export interface StageZone {
  id: string;
  kind: StageZoneKind;
  x: number;
  y: number;
  /** 차지하는 반지름(m) */
  r: number;
  /** 몸이 놓이는 높이(땅에서 m): 바닥 · 꼭대기 */
  lo: number;
  hi: number;
}

/** 모델의 반너비(m)를 묻는 창구: 에셋 키·맞춘 크기·크기를 재는 쪽(w 너비, h 키) */
export type HalfWidthOf = (model: string, size: number, by: "h" | "w") => number;

/** 물건 둘레에 더 비워 두는 거리(m) · 버섯에 올라타고 내릴 자리(m) · 구경꾼 한 무리의 자리(m) */
export const PROP_PAD = 0.5,
  MUSHROOM_ROOM = 2,
  SEAT_ROOM = 1.5;
/** 버섯·구경꾼·출발 줄 상자의 키(m — 몸이 겹치는 높이를 가릴 때만 쓴다) */
const LOW_TALL = 3;

/** 무대의 자리 전부 */
export function stageZones(halfWidthOf: HalfWidthOf): StageZone[] {
  const out: StageZone[] = [];
  for (const spec of FIND.props) {
    const kind = FIND.kinds[spec.kind],
      half = halfWidthOf(kind.model, spec.size, kind.by),
      tall = tallOf(kind.model, spec.size, kind.by, halfWidthOf);
    if (spec.under.length) {
      // 탑: 맨 밑 물건의 너비로 선다. 키는 쌓은 것 + 꼭대기 물건
      const bottom = halfWidthOf(kind.model, spec.under[0], kind.by);
      let lift = 0;
      for (const size of spec.under)
        lift += tallOf(kind.model, size, kind.by, halfWidthOf) * kind.nest;
      const r = Math.max(bottom, half) + PROP_PAD,
        hi = lift + tall;
      out.push({ id: spec.id, kind: "tower", x: spec.x, y: spec.y, r, lo: 0, hi });
      continue;
    }
    const lo = spec.base ?? 0,
      zoneKind: StageZoneKind = lo > 0 ? "perch" : "prop";
    out.push({
      id: spec.id,
      kind: zoneKind,
      x: spec.x,
      y: spec.y,
      r: half + PROP_PAD,
      lo,
      hi: lo + tall,
    });
  }
  FIND.mushrooms.forEach((m, i) =>
    out.push({
      id: `mushroom${i + 1}`,
      kind: "mushroom",
      x: m.x,
      y: m.y,
      r: MUSHROOM_ROOM,
      lo: 0,
      hi: LOW_TALL,
    }),
  );
  openSeats().forEach((seat, i) =>
    out.push({
      id: `seat${i + 1}`,
      kind: "seat",
      x: seat.x,
      y: seat.y,
      r: SEAT_ROOM,
      lo: 0,
      hi: LOW_TALL,
    }),
  );
  const line = startLine();
  out.push(...line);
  return out;
}

/** 에셋의 원본 크기 상자([minX, minY, minZ, maxX, maxY, maxZ])로 반너비를 셈하는 창구 */
export function halfWidthFromBoxes(boxOf: (model: string) => readonly number[]): HalfWidthOf {
  return (model, size, by) => {
    if (by === "w") return size / 2;
    const b = boxOf(model),
      across = b[3] - b[0],
      deep = b[5] - b[2],
      wide = Math.max(across, deep),
      tall = b[4] - b[1];
    return ((wide / tall) * size) / 2;
  };
}

/* ─── 내부 ─────────────────────────── */

// 맞춘 크기일 때의 키(m): by 가 h 면 그 크기, w 면 너비에서 거꾸로 셈한다(반너비 창구가 너비:키 비율을 안다)
function tallOf(model: string, size: number, by: "h" | "w", halfWidthOf: HalfWidthOf): number {
  if (by === "h") return size;
  // 키 1 일 때의 너비
  const wideAtUnit = halfWidthOf(model, 1, "h") * 2;
  return wideAtUnit > 0 ? size / wideAtUnit : size;
}

// 출발 줄: 출발 자리와, 그 앞(마을 가운데 쪽) lineAhead 에 lineGap 간격으로 서는 상자 넷
function startLine(): StageZone[] {
  const { x, y } = startPoint(),
    far = Math.hypot(x, y),
    ux = -x / far,
    uy = -y / far,
    T = HIDE.start,
    out: StageZone[] = [{ id: "start", kind: "start", x, y, r: 1, lo: 0, hi: LOW_TALL }];
  for (let i = 0; i < 4; i++) {
    const across = (i - 1.5) * T.lineGap,
      bx = x + ux * T.lineAhead - uy * across,
      by = y + uy * T.lineAhead + ux * across;
    out.push({
      id: `start-box${i + 1}`,
      kind: "start",
      x: bx,
      y: by,
      r: BOX_HALF,
      lo: 0,
      hi: LOW_TALL,
    });
  }
  return out;
}
