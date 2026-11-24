import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { Sight } from "./sight";

// 화면에 걸치는 것만 그린다

/** 원점에서 -z 를 보는 세로 화면 카메라(시야 58°, 폰 비율)로 잰 시야 */
function sightAtOrigin() {
  const camera = new THREE.PerspectiveCamera(58, 390 / 844, 0.1, 900);
  camera.updateProjectionMatrix();
  const sight = new Sight();
  sight.update(camera);
  return sight;
}
/** 카메라 앞 depth(m), 옆으로 side(m)에 놓인 반지름 r 인 공 */
const ball = (depth: number, r: number, side = 0) => {
  const centre = new THREE.Vector3(side, 0, -depth);
  return new THREE.Sphere(centre, r);
};

describe("Sight.sees", () => {
  it("카메라 앞의 공 → 화면에 걸친다", () => {
    expect(sightAtOrigin().sees(ball(100, 2))).toBe(true);
  });

  it("카메라 뒤의 공 → 걸치지 않는다", () => {
    expect(sightAtOrigin().sees(ball(-100, 2))).toBe(false);
  });

  it("옆으로 화면 밖인 공 → 걸치지 않는다", () => {
    expect(sightAtOrigin().sees(ball(100, 2, 80))).toBe(false);
  });

  it("가운데는 화면 밖이어도 둘레가 화면에 닿으면 → 걸친다", () => {
    expect(sightAtOrigin().sees(ball(100, 60, 80))).toBe(true);
  });

  it("멀리 있는 작은 공 → 화면 안이면 걸친다(멀다고 빼지 않는다)", () => {
    expect(sightAtOrigin().sees(ball(500, 1))).toBe(true);
  });

  it("카메라를 돌린 뒤 다시 재면 → 새 쪽을 본다", () => {
    const camera = new THREE.PerspectiveCamera(58, 390 / 844, 0.1, 900);
    camera.updateProjectionMatrix();
    const sight = new Sight();
    sight.update(camera);
    const behind = ball(-100, 2);
    camera.rotation.y = Math.PI;
    sight.update(camera);
    expect(sight.sees(behind)).toBe(true);
  });
});
