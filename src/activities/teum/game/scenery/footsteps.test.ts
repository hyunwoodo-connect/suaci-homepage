import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { Services } from "../services";
import { S } from "../settings";
import { Footsteps } from "./footsteps";

// 적도 위에서 내 뒤로 meters 만큼 떨어진 자리
const back = (meters: number) => {
  const angle = -meters / S.R;
  return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
};

// 내가 back(0) 에 서 있고, 뒤로 meters 마다 걸음을 남긴 발자취
function trail(steps: number[]): Footsteps {
  const p = back(0);
  const footsteps = new Footsteps({ player: { p } } as unknown as Services);
  for (const meters of steps) footsteps.hist.push({ p: back(meters), a: 0 });
  return footsteps;
}

describe("Footsteps.behind", () => {
  const out = new THREE.Vector3();
  const metersBack = () => out.angleTo(back(0)) * S.R;

  it("발자취가 없다 → 내 자리", () => {
    trail([]).behind(3, out);
    expect(metersBack()).toBeCloseTo(0, 5);
  });

  it("걸음 사이 → 걸음 수가 아니라 실제 거리로 되짚는다(빨리 날아 걸음이 성겨도)", () => {
    trail([1, 5, 6]).behind(3, out);
    expect(metersBack()).toBeCloseTo(3, 3);
  });

  it("가장 최근 걸음보다 가깝다 → 가장 최근 걸음", () => {
    trail([2]).behind(0.5, out);
    expect(metersBack()).toBeCloseTo(2, 3);
  });

  it("발자취가 거기까지 없다 → 가장 오래된 걸음", () => {
    trail([1, 2]).behind(30, out);
    expect(metersBack()).toBeCloseTo(2, 3);
  });
});
