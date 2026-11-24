import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { GameEvents } from "../events";
import { Player } from "../player/player";
import { S } from "../settings";
import { Culler, dipOf, horizonCos } from "./culler";
import { Terrain } from "./terrain";

// 지평선 너머는 그리지 않는다: 눈높이와 물건 꼭대기 높이로 '보일 수 있는 가장 먼 거리'를 잰다

/** 눈높이 eye(m)에서 꼭대기 top(m)인 것이 보이는 가장 먼 땅 위 거리(m) */
const farthest = (eye: number, top: number) => {
  const eyeDip = dipOf(eye),
    topDip = dipOf(top),
    cos = horizonCos(eyeDip, topDip);
  return Math.acos(cos) * S.R;
};

describe("dipOf · horizonCos", () => {
  it("눈높이 4m → 땅바닥의 것은 64m 까지 보인다(행성이 작아 지평선이 가깝다)", () => {
    expect(farthest(4, 0)).toBeCloseTo(64.4, 0);
  });

  it("같은 눈높이에서 키 20m 나무는 → 훨씬 멀리(206m)까지 보인다", () => {
    expect(farthest(4, 20)).toBeCloseTo(206.1, 0);
  });

  it("높이 올라갈수록 → 낮은 것도 멀리까지 보인다", () => {
    expect(farthest(70, 3)).toBeGreaterThan(farthest(4, 3) * 2.5);
  });

  it("각에 얹은 여유(pad) → 그만큼 더 멀리까지 남긴다", () => {
    const tight = dipOf(4),
      loose = dipOf(4, 0.04),
      thing = dipOf(0);
    const gain = Math.acos(horizonCos(loose, thing)) - Math.acos(horizonCos(tight, thing));
    expect(gain).toBeCloseTo(0.04, 6);
  });

  it("땅 아래 높이(음수) → 땅바닥으로 본다", () => {
    expect(dipOf(-5)).toEqual(dipOf(0));
  });
});

describe("Culler 의 눈높이", () => {
  /** 출발점 근처에 선 몸과, 그 위 height(m)에 둔 카메라 */
  function world(height: number) {
    const terrain = new Terrain(7, { flowers: 0, mounds: 0, clouds: 0 }, []);
    const player = new Player(terrain, new GameEvents());
    player.goHome();
    player.updateAlt();
    player.place(0);
    const camera = new THREE.PerspectiveCamera();
    const radius = S.R + height;
    camera.position.copy(player.p).multiplyScalar(radius);
    const culler = new Culler(new THREE.Scene(), player, camera);
    return { player, culler };
  }
  /** 지금 눈높이에서 땅바닥의 것이 보이는 가장 먼 거리(m) */
  const reach = (culler: Culler) => Math.acos(horizonCos(culler.eye, dipOf(0))) * S.R;

  it("처음 고르기 전 → 아무것도 가리지 않는다(행성 반대편까지 보이는 값)", () => {
    const { culler } = world(4);
    expect(horizonCos(culler.eye, dipOf(0))).toBe(-1);
  });

  it("땅 가까이의 카메라 → 낮은 것은 150m 안팎까지만 남긴다(전에는 가까운 것 기준 494m 까지 그렸다)", () => {
    const { culler } = world(4);
    culler.update({ dt: 1 / 60, time: 0 });
    expect(reach(culler)).toBeGreaterThan(64.4);
    expect(reach(culler)).toBeLessThan(160);
  });

  it("카메라가 높으면 → 더 멀리까지 남긴다", () => {
    const low = world(4),
      high = world(80);
    low.culler.update({ dt: 1 / 60, time: 0 });
    high.culler.update({ dt: 1 / 60, time: 0 });
    expect(reach(high.culler)).toBeGreaterThan(reach(low.culler) * 2);
  });

  it("카메라가 내 발밑보다 낮게 있어도 → 내 높이로 잰다(덜 가려진 쪽으로)", () => {
    const { culler, player } = world(-50);
    culler.update({ dt: 1 / 60, time: 0 });
    const mine = player.P.length() - S.R;
    expect(reach(culler)).toBeGreaterThan(farthest(mine, 0));
  });
});
