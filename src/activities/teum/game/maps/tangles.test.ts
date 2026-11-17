import { describe, expect, it } from "vitest";

import { offset, START } from "../world/sphere";
import type { Body, BodyPart } from "./tangles";
import { findTangles, groundRadius } from "./tangles";

/** 출발점에서 dist(m) 떨어진 자리의 몸 */
function body(name: string, dist: number, parts: BodyPart[], more: Partial<Body> = {}): Body {
  return { name, owner: name, layer: "흩뿌림", v: offset(START, dist, 0), parts, ...more };
}

const post = (r: number, tall = 4): BodyPart[] => [{ r, lo: 0, hi: tall }];

describe("findTangles", () => {
  it("몸이 닿지 않으면 → 없다", () => {
    const found = findTangles([body("a", 0, post(2)), body("b", 5, post(2))], []);
    expect(found).toEqual([]);
  });

  it("같은 높이에서 몸이 겹치면 → 겹침, 깊이는 겹친 만큼", () => {
    const found = findTangles([body("a", 0, post(2)), body("b", 3, post(2))], []);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("겹침");
    expect(found[0].depth).toBeCloseTo(1, 1);
  });

  it("가운데가 상대 몸 안이면 → 올라탐", () => {
    const found = findTangles([body("ride", 0, post(4)), body("flower", 1, post(0.5))], []);
    expect(found[0].kind).toBe("올라탐");
  });

  it("높이가 서로 다르면(갓 아래를 지나가면) → 없다", () => {
    const crown: BodyPart[] = [
      { r: 1, lo: 0, hi: 20 },
      { r: 12, lo: 20, hi: 40 },
    ];
    const found = findTangles([body("tree", 0, crown), body("pot", 6, post(1, 3))], []);
    expect(found).toEqual([]);
  });

  it("무른 것끼리(갓과 갓)는 → 세지 않는다", () => {
    const soft: BodyPart[] = [{ r: 10, lo: 10, hi: 30, isSoft: true }];
    const found = findTangles([body("a", 0, soft), body("b", 8, soft)], []);
    expect(found).toEqual([]);
  });

  it("한 덩어리·이어 붙은 것은 → 세지 않는다", () => {
    const a = body("a", 0, post(2), { owner: "path" }),
      b = body("b", 2, post(2), { owner: "path" }),
      c = body("c", 4, post(2), { attached: "path" });
    expect(findTangles([a, b, c], [])).toEqual([]);
  });

  it("타는 곳 3m 안에 흩뿌린 것이 있으면 → 길 막음", () => {
    const ride = body("ride", 0, post(4), { layer: "손", isAccess: true });
    const found = findTangles([ride, body("flower", 6, post(0.5))], []);
    expect(found[0].kind).toBe("길 막음");
    expect(found[0].depth).toBeCloseTo(1.5, 1);
  });

  it("손으로 놓은 것끼리 타는 곳 가까이 붙은 것은 → 길 막음으로 세지 않는다", () => {
    const a = body("a", 0, post(4), { layer: "손", isAccess: true }),
      b = body("b", 9, post(4), { layer: "손", isAccess: true });
    expect(findTangles([a, b], [])).toEqual([]);
  });

  it("문은 타는 곳과 겹쳐도 → 세지 않는다", () => {
    const ride = body("ride", 0, post(3), { layer: "손", isAccess: true }),
      gate = body("gate", 2, post(8, 30), { isGate: true });
    expect(findTangles([ride, gate], [])).toEqual([]);
  });

  it("땅에 선 것의 가운데가 호수 안이면 → 물 위(뜬 것은 뺀다)", () => {
    const pond = { name: "lake#0", v: START.clone(), r: 10 },
      floating = body("bubble", 2, [{ r: 1, lo: 4, hi: 6, isSoft: true }]),
      found = findTangles([body("pot", 4, post(1)), floating], [pond]);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("물 위");
    expect(found[0].depth).toBeCloseTo(6, 1);
  });

  it("덩어리 둘 사이는 가장 깊은 한 번만 → 한 줄", () => {
    const a = body("a.0", 0, post(2), { owner: "a" }),
      a2 = body("a.1", 1, post(2), { owner: "a" }),
      b = body("b", 3, post(2));
    const found = findTangles([a, a2, b], []);
    expect(found).toHaveLength(1);
    expect(found[0].a.name).toBe("a.1");
  });
});

describe("groundRadius", () => {
  it("땅에 닿는 토막 가운데 가장 넓은 것 — 뜬 토막은 뺀다", () => {
    const parts: BodyPart[] = [
      { r: 1, lo: 0, hi: 10 },
      { r: 9, lo: 10, hi: 20 },
    ];
    expect(groundRadius(body("tree", 0, parts))).toBe(1);
  });
});
