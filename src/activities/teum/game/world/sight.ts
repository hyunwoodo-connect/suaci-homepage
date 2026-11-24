import * as THREE from "three";

// 이번 프레임의 시야: 화면에 걸치는 것만 그린다.
// 세로로 긴 화면은 둘레의 일부만 비춘다 — 가까운 것을 통째로 그리면 꼭짓점 셈의 대부분이 화면 밖의 것에 쓰인다.
// 한꺼번에 그리는 묶음(모델·꽃·기둥 꽃·구름 방석·둔덕)은 그리기 직전에 여기에 물어 화면에 걸치는 것만 칸에 채운다

/** 이번 프레임의 시야 */
export class Sight {
  private readonly frustum = new THREE.Frustum();
  private readonly viewProj = new THREE.Matrix4();

  /** 지금 카메라로 다시 잰다(그리기 직전, 카메라를 다 옮긴 뒤) */
  update(camera: THREE.Camera) {
    camera.updateMatrixWorld();
    this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProj);
  }

  /** 둘레 공이 화면에 걸치나 */
  sees(ball: THREE.Sphere): boolean {
    return this.frustum.intersectsSphere(ball);
  }
}
