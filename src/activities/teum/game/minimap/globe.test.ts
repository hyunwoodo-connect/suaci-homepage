import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { GlobeView } from "./globe";
import { aimView, dragView, project } from "./globe";

function view(): GlobeView {
  return { c: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3() };
}

describe("지구본 보는 틀", () => {
  it("aimView: 내 자리 → 원 가운데, 보는 쪽 → 원 위쪽, 오른쪽 → 원 오른쪽", () => {
    const v = view();
    const p = new THREE.Vector3(0, 1, 0),
      forward = new THREE.Vector3(0, 0, -1);
    aimView(v, p, forward);
    const pt = { x: 0, y: 0, z: 0 };
    project(v, p, pt);
    expect(pt.x).toBeCloseTo(0);
    expect(pt.y).toBeCloseTo(0);
    expect(pt.z).toBeCloseTo(1);
    const ahead = new THREE.Vector3(0, 1, -0.2).normalize();
    project(v, ahead, pt);
    expect(pt.y).toBeGreaterThan(0);
    // 북쪽(-z)을 보고 서면 오른쪽은 동쪽(+x)
    const east = new THREE.Vector3(0.2, 1, 0).normalize();
    project(v, east, pt);
    expect(pt.x).toBeGreaterThan(0);
  });

  it("dragView: 오른쪽으로 끌면 → 왼쪽에 있던 땅이 가운데로 온다", () => {
    const v = view();
    aimView(v, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
    const west = new THREE.Vector3(-0.3, 1, 0).normalize();
    const pt = { x: 0, y: 0, z: 0 };
    const before = project(v, west, pt).x;
    dragView(v, 0.3, 0);
    const after = project(v, west, pt).x;
    expect(after).toBeGreaterThan(before);
  });
});
