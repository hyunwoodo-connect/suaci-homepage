import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Services } from "../services";
import type { Sky } from "./sky";

// 지금 지역: 내가 선 곳에서 가장 가까운 마을이 지금 지역이다. 하늘빛과 안개색이 그 지역 색으로 천천히 바뀌고,
// 새 지역에 들어서면 빛 방울이 한 번 인다(처음 서 있던 지역은 조용히)

/** 하늘빛·안개에 섞는 가장 큰 정도 */
const SKY_MIX = 0.85,
  FOG_MIX = 0.6;
/** 바뀌는 빠르기(1/초) · 이만큼 그 지역다워지면 들어선 것으로 친다 */
const BLEND_RATE = 1.2,
  ENTER_AT = 0.6;

/** 지금 지역의 하늘·안개 */
export class RegionLook implements Thing {
  /** 지금 지역(아직 없으면 -1) */
  current = -1;
  private w = 0;
  private readonly colors: THREE.Color[];

  constructor(
    private readonly s: Services,
    private readonly sky: Sky,
  ) {
    this.colors = s.map.regions.map((r) => new THREE.Color(r.sky));
  }

  /** 지역다운 정도와 하늘빛을 따라가고, 새 지역에 들어서면 알린다 */
  update(f: Frame) {
    const { player, regions, scene, fx, events } = this.s;
    if (!this.colors.length) return;
    const p = player.p as THREE.Vector3;
    const bi = regions.nearest(p),
      w = regions.weight(p, bi);
    const fade = -BLEND_RATE * f.dt;
    const k = 1 - Math.exp(fade);
    this.w += (w - this.w) * k;
    const SKY = this.sky.SKY;
    SKY.uReg.value.lerp(this.colors[bi], k);
    SKY.uRegW.value = SKY_MIX * this.w;
    const fog = scene.fog as THREE.Fog,
      background = scene.background as THREE.Color;
    const fogMix = FOG_MIX * this.w;
    fog.color.copy(background).lerp(SKY.uReg.value, fogMix);
    if (w > ENTER_AT && bi !== this.current) {
      const was = this.current;
      this.current = bi;
      if (was >= 0) {
        fx.burst(player.P, 18, 10);
        events.emit("regionEntered", { region: bi });
      }
    }
  }

  dispose() {}
}
