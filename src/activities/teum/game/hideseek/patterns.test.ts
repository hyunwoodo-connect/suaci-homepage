import { describe, expect, it } from "vitest";

import type { Pattern } from "./findTuning";
import { CLUSTER_MIN, FIND } from "./findTuning";
import { classOf, dealPatterns, dealRound, moveTargets, usableHighs } from "./patterns";
import { startPoint } from "./spots";

/** 씨앗이 정해진 난수(시험마다 같은 차례) */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const between = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe("dealPatterns", () => {
  it("맨 처음 판 → 값 파일의 hide.first 그대로(A 둘·B·D, 속에 쏙은 없다)", () => {
    const patterns = dealPatterns(true, seeded(1));
    expect(patterns).toEqual(FIND.hide.first);
    expect(patterns).not.toContain("C");
  });

  it("둘째 판부터 → 같은 패턴은 둘까지, 속에 쏙은 하나까지 — 여러 판이면 네 패턴이 다 나온다", () => {
    const rand = seeded(7),
      seen = new Set<Pattern>();
    for (let round = 0; round < 200; round++) {
      const patterns = dealPatterns(false, rand);
      expect(patterns).toHaveLength(4);
      for (const p of ["A", "B", "C", "D"] as const) {
        const n = patterns.filter((x) => x === p).length,
          most = p === "C" ? FIND.hide.insideMax : FIND.hide.patternMax;
        expect(n).toBeLessThanOrEqual(most);
      }
      for (const p of patterns) seen.add(p);
    }
    expect([...seen].sort()).toEqual(["A", "B", "C", "D"]);
  });
});

describe("dealRound", () => {
  it("패턴마다 그 갈래의 물건 → 서로 다른 무리, 서로 hide.minApart 넘게, 출발 자리에서 hide.minFromStart 넘게", () => {
    const rand = seeded(3),
      start = startPoint();
    for (let round = 0; round < 200; round++) {
      const patterns = dealPatterns(round === 0, rand),
        dealt = dealRound(FIND.props, patterns, rand);
      expect(dealt).not.toBeNull();
      const hidings = dealt!;
      hidings.forEach((h, i) => {
        expect(h.pattern).toBe(patterns[i]);
        expect(h.prop.cls).toBe(classOf(h.pattern));
        expect(between(h.prop, start)).toBeGreaterThanOrEqual(FIND.hide.minFromStart);
      });
      const groups = new Set(hidings.map((h) => h.prop.group));
      expect(groups.size).toBe(4);
      for (const a of hidings)
        for (const b of hidings)
          if (a !== b) expect(between(a.prop, b.prop)).toBeGreaterThanOrEqual(FIND.hide.minApart);
    }
  });
});

describe("moveTargets", () => {
  it("같은 갈래이고 miss.moveRange 안이고 비어 있는 물건만", () => {
    const [min, max] = FIND.miss.moveRange;
    for (const from of FIND.props) {
      const targets = moveTargets(from, FIND.props, () => false);
      for (const t of targets) {
        expect(t.cls).toBe(from.cls);
        expect(between(t, from)).toBeGreaterThanOrEqual(min);
        expect(between(t, from)).toBeLessThanOrEqual(max);
      }
    }
    const from = FIND.props.find((p) => p.cls === "solo")!,
      open = moveTargets(from, FIND.props, () => false),
      none = moveTargets(from, FIND.props, () => true);
    expect(open.length).toBeGreaterThan(0);
    expect(none).toHaveLength(0);
  });
});

describe("후보 물건의 자리(hideseek.data.json 의 props·mushrooms)", () => {
  it("무리는 같은 물건 넷 이상, 낱개·무리·탑의 물건은 이사 갈 곳이 하나는 있다", () => {
    const groups = new Map<string, number>();
    for (const p of FIND.props)
      if (p.cls === "cluster") groups.set(p.group, (groups.get(p.group) ?? 0) + 1);
    for (const n of groups.values()) expect(n).toBeGreaterThanOrEqual(CLUSTER_MIN);
    for (const p of FIND.props) {
      const isTower = p.cls === "high" && p.under.length > 0;
      if (p.cls === "high" && !isTower) continue;
      const targets = moveTargets(p, FIND.props, () => false);
      expect(targets.length, p.id).toBeGreaterThan(0);
    }
  });

  it("높은 곳은 모두 hide.highNear 안에 버섯이 있거나 통통 구름 위다", () => {
    const highs = FIND.props.filter((p) => p.cls === "high");
    expect(usableHighs(FIND.props)).toHaveLength(highs.length);
  });

  it("물건끼리 겹치지 않고, 출발 자리 12m 안에는 없다(줄 서는 자리·언박싱 자리를 비운다)", () => {
    const start = startPoint();
    for (const a of FIND.props) {
      expect(between(a, start), a.id).toBeGreaterThanOrEqual(12);
      for (const b of FIND.props) {
        if (a === b) continue;
        const room = (a.size + b.size) / 2;
        expect(between(a, b), `${a.id}·${b.id}`).toBeGreaterThanOrEqual(room * 0.9);
      }
    }
  });

  it("버섯은 물건에서 4m 넘게 떨어져 있다", () => {
    for (const m of FIND.mushrooms)
      for (const p of FIND.props) expect(between(m, p), p.id).toBeGreaterThanOrEqual(4);
  });
});
