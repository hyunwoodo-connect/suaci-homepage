import * as THREE from "three";

import type { Services } from "../services";
import { S } from "../settings";
import { offset, UP } from "../world/sphere";
import type { Mists } from "./mist";

// 쉬는 곳의 라임 깃발 — 글자 없이 색만. 멀리서 '저기 쉴 곳'이라고 알려 주고, 쉬는 곳에 들어서는 순간 안개가 한 번 퍼진다

/** 깃발을 꽂는 쉬는 곳(Sites 의 한 줄) */
export interface RestSite {
  k: string;
  kind: string;
  v: THREE.Vector3;
  r: number;
  dist: number;
}

/** 쉬는 곳 깃발 */
export interface Flag {
  s: RestSite;
  fl: THREE.Mesh;
  inn: boolean;
}

/** 쉬는 곳마다 깃발 하나 */
export class RestFlags {
  readonly list: Flag[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mat: THREE.Material;
  private readonly groups: THREE.Group[] = [];

  /** poleMat = 깃대 재질(풍선 줄과 같이 쓴다 — 치우는 것은 풍선 쪽) */
  constructor(
    private readonly s: Services,
    sites: readonly RestSite[],
    poleMat: THREE.Material,
    private readonly mists: Mists,
  ) {
    const tri = new THREE.BufferGeometry();
    const triPos = new THREE.Float32BufferAttribute([0, 0, 0, 0, -1.1, 0, 2.3, -0.55, 0], 3);
    tri.setAttribute("position", triPos);
    tri.computeVertexNormals();
    const fMat = new THREE.MeshBasicMaterial({ color: 0xa9ff39, side: THREE.DoubleSide }),
      pGeo = new THREE.CylinderGeometry(0.06, 0.06, 7, 6);
    this.geos.push(tri, pGeo);
    this.mat = fMat;
    for (const site of sites) {
      if (site.kind !== "rest") continue;
      const flagFar = (site.r || 6) * 0.95;
      const v = offset(site.v, flagFar, 40),
        gr = new THREE.Group(),
        pole = new THREE.Mesh(pGeo, poleMat),
        fl = new THREE.Mesh(tri, fMat);
      pole.position.y = 3.5;
      fl.position.y = 6.9;
      gr.add(pole, fl);
      gr.traverse((c) => {
        c.frustumCulled = false;
      });
      const ground = s.terrain.groundAt(v);
      const baseR = S.R + Math.max(ground, 0);
      gr.position.copy(v).multiplyScalar(baseR);
      gr.quaternion.setFromUnitVectors(UP, v);
      s.scene.add(gr);
      this.groups.push(gr);
      this.list.push({ s: site, fl, inn: false });
    }
  }

  /** 깃발이 나부끼고, 쉬는 곳에 들어서는 순간 내 자리에서 안개가 퍼진다 */
  update(time: number) {
    const { player } = this.s,
      p = player.p,
      P = player.P;
    for (const fl of this.list) {
      const flutterA = time * 2.2 + fl.s.dist,
        flutterB = time * 5.1;
      fl.fl.rotation.y = 0.5 * Math.sin(flutterA) + 0.25 * Math.sin(flutterB);
      const restR = fl.s.r || 6;
      const inn = player.air < 4 && p.angleTo(fl.s.v) * S.R < restR;
      if (inn && !fl.inn) this.mists.puff(P, 8);
      fl.inn = inn;
    }
  }

  /** 치운다 */
  dispose() {
    for (const g of this.groups) g.removeFromParent();
    for (const g of this.geos) g.dispose();
    this.mat.dispose();
  }
}
