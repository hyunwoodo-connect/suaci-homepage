import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { pickAt, screenHeight } from "./picker";

// 원점에서 -z 를 보는 카메라(화면 390×844)
function camera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(58, 390 / 844, 0.1, 1000);
  cam.position.set(0, 0, 0);
  cam.lookAt(0, 0, -1);
  cam.updateMatrixWorld();
  return cam;
}

const VIEW = { w: 390, h: 844 };
const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe("pickAt", () => {
  it("화면 가운데의 것을 가운데에서 누르면 → 그것", () => {
    const targets = [{ item: "box", center: at(0, 0, -20), halfH: 1.25, halfW: 0.8 }];
    expect(pickAt(195, 422, targets, camera(), VIEW, 24, 96)).toBe("box");
  });

  it("멀어서 작게 그려져도 → 적어도 96px 네모로 받는다", () => {
    const targets = [{ item: "box", center: at(0, 0, -80), halfH: 0.1, halfW: 0.1 }];
    expect(pickAt(195 + 45, 422 - 45, targets, camera(), VIEW, 24, 96)).toBe("box");
    expect(pickAt(195 + 60, 422, targets, camera(), VIEW, 24, 96)).toBeNull();
  });

  it("그려진 것보다 사방 24px 넓게 받는다", () => {
    const cam = camera(),
      halfPx = screenHeight(2.5, 10, cam, 844) / 2;
    const targets = [{ item: "box", center: at(0, 0, -10), halfH: 1.25, halfW: 1.25 }];
    expect(pickAt(195, 422 + halfPx + 20, targets, cam, VIEW, 24, 96)).toBe("box");
    expect(pickAt(195, 422 + halfPx + 30, targets, cam, VIEW, 24, 96)).toBeNull();
  });

  it("둘이 겹치면 → 카메라에서 가까운 것", () => {
    const targets = [
      { item: "far", center: at(0, 0, -40), halfH: 1, halfW: 1 },
      { item: "near", center: at(0, 0, -15), halfH: 1, halfW: 1 },
    ];
    expect(pickAt(195, 422, targets, camera(), VIEW, 24, 96)).toBe("near");
  });

  it("카메라 뒤의 것 → 고르지 않는다", () => {
    const targets = [{ item: "behind", center: at(0, 0, 20), halfH: 1, halfW: 1 }];
    expect(pickAt(195, 422, targets, camera(), VIEW, 24, 96)).toBeNull();
  });
});
