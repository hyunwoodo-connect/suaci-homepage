import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import { dropUnusedMaps } from "./material";

describe("dropUnusedMaps", () => {
  it("금속·거칠기·요철 그림 → 재질에서 떼고 비운다", () => {
    const mat = new THREE.MeshStandardMaterial(),
      normal = new THREE.Texture(),
      dispose = vi.spyOn(normal, "dispose");
    mat.normalMap = normal;
    dropUnusedMaps(mat);
    expect(mat.normalMap).toBeNull();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("남겨 쓰는 칸(그늘)이 같은 그림을 가리키면 → 떼기만 하고 비우지 않는다", () => {
    const mat = new THREE.MeshStandardMaterial(),
      shared = new THREE.Texture(),
      dispose = vi.spyOn(shared, "dispose");
    mat.aoMap = shared;
    mat.roughnessMap = shared;
    dropUnusedMaps(mat);
    expect(mat.roughnessMap).toBeNull();
    expect(mat.aoMap).toBe(shared);
    expect(dispose).not.toHaveBeenCalled();
  });

  it("색 그림 → 건드리지 않는다", () => {
    const mat = new THREE.MeshStandardMaterial(),
      color = new THREE.Texture();
    mat.map = color;
    dropUnusedMaps(mat);
    expect(mat.map).toBe(color);
  });
});
