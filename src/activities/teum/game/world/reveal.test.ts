import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { withAllShown } from "./reveal";

describe("withAllShown", () => {
  /** 보이는 것 · 숨긴 것 · 숨긴 묶음 안의 것 · 화면 밖 거르기를 꺼 둔 것 */
  function scene() {
    const root = new THREE.Scene(),
      shown = new THREE.Mesh(),
      hidden = new THREE.Mesh(),
      group = new THREE.Group(),
      inside = new THREE.Mesh(),
      unculled = new THREE.Mesh();
    hidden.visible = false;
    group.visible = false;
    unculled.frustumCulled = false;
    group.add(inside);
    root.add(shown, hidden, group, unculled);
    const all = [shown, hidden, group, inside, unculled];
    const state = () => all.map((o) => [o.visible, o.frustumCulled]);
    return { root, state };
  }

  it("부르는 동안 → 숨긴 것(숨긴 묶음 안의 것까지)도 보이고 화면 밖 거르기가 꺼진다", () => {
    const { root, state } = scene();
    let during: boolean[][] = [];
    withAllShown(root, () => {
      during = state();
    });
    expect(during).toEqual(Array.from({ length: 5 }, () => [true, false]));
  });

  it("부른 뒤 → 원래대로 돌려놓는다", () => {
    const { root, state } = scene();
    const before = state();
    withAllShown(root, () => {});
    expect(state()).toEqual(before);
  });

  it("run 이 던져도 → 원래대로 돌려놓는다", () => {
    const { root, state } = scene();
    const before = state();
    const failing = () =>
      withAllShown(root, () => {
        throw new Error("render");
      });
    expect(failing).toThrow("render");
    expect(state()).toEqual(before);
  });
});
