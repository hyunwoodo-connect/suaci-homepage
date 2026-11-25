import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { blankOutfit } from "./outfit-shader";
import { paintAvatar } from "./paint";

// three 가 재질을 그리기 직전에 넘겨주는 셰이더(칠이 끼어드는 자리만 남긴 것)
function compile(mat: THREE.MeshStandardMaterial) {
  const sh = {
    uniforms: {} as Record<string, THREE.IUniform>,
    vertexShader: "void main() {\n#include <begin_vertex>\n}",
    fragmentShader: "void main() {\n#include <map_fragment>\n#include <opaque_fragment>\n}",
  };
  mat.onBeforeCompile(sh as never, undefined as never);
  return sh;
}

describe("paintAvatar", () => {
  it("몸(옷 값을 준 것) → 옷 값이 셰이더에 물리고 옷 자리를 덮는 조각이 들어간다", () => {
    const mat = new THREE.MeshStandardMaterial(),
      outfit = blankOutfit();
    paintAvatar(mat, outfit);
    const sh = compile(mat);
    expect(sh.uniforms.uSkC).toBe(outfit.uSkC);
    expect(sh.vertexShader).toContain("vOp = position");
    expect(sh.fragmentShader).toContain("rawC");
  });

  it("부품(옷 값 없음) → 톤만 입는다: 옷 값도 옷 조각도 없고 꼭짓점 셰이더는 그대로", () => {
    const mat = new THREE.MeshStandardMaterial();
    paintAvatar(mat, null);
    const sh = compile(mat);
    expect(sh.uniforms.uSkC).toBeUndefined();
    expect(sh.vertexShader).not.toContain("vOp");
    expect(sh.fragmentShader).not.toContain("rawC");
  });

  it("몸이든 부품이든 → 채도를 올리고 라임을 지키는 조각이 들어가고, 끼어든 자리 표시는 남는다", () => {
    for (const outfit of [blankOutfit(), null]) {
      const mat = new THREE.MeshStandardMaterial();
      paintAvatar(mat, outfit);
      const sh = compile(mat);
      expect(sh.uniforms.uSat.value).toBeGreaterThan(1);
      expect(sh.fragmentShader).toContain("uSat");
      expect(sh.fragmentShader).toContain("khOn");
      expect(sh.fragmentShader).toContain("#include <opaque_fragment>");
    }
  });

  it("몸과 부품 → 셰이더를 나눠 쓴다(같은 것끼리는 같이 쓴다)", () => {
    const body = new THREE.MeshStandardMaterial(),
      hair = new THREE.MeshStandardMaterial(),
      bag = new THREE.MeshStandardMaterial();
    paintAvatar(body, blankOutfit());
    paintAvatar(hair, null);
    paintAvatar(bag, null);
    expect(body.customProgramCacheKey()).not.toBe(hair.customProgramCacheKey());
    expect(hair.customProgramCacheKey()).toBe(bag.customProgramCacheKey());
  });

  it("요철·금속 그림이 있던 재질 → 떼고, 금속 느낌 없이 매끈하게", () => {
    const mat = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 1 });
    mat.normalMap = new THREE.Texture();
    mat.metalnessMap = new THREE.Texture();
    paintAvatar(mat, null);
    expect(mat.normalMap).toBeNull();
    expect(mat.metalnessMap).toBeNull();
    expect(mat.metalness).toBe(0);
    expect(mat.roughness).toBeLessThan(0.5);
  });
});
