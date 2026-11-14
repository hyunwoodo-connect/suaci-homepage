import type * as THREE from "three";

import type { Random } from "./core/random";
import type { Fx } from "./fx/fx";
import type { Ripples } from "./fx/ripples";
import type { Hud } from "./hud";
import type { Mats } from "./look";
import type { ModelLibrary } from "./models/library";
import type { CameraRig } from "./player/camera";
import type { Player } from "./player/player";
import type { Culler } from "./world/culler";
import type { Layout } from "./world/layout";
import type { Occupancy } from "./world/occupancy";
import type { Terrain } from "./world/terrain";

// 세계 위의 것들이 만들 때 받는 창구 묶음. 이것 말고 다른 모듈의 상태를 직접 만지지 않는다
// (다른 놀이기구가 필요하면 Game 이 만들 때 그 객체를 넘겨 준다)

/** 공통 창구 */
export interface Services {
  scene: THREE.Scene;
  /** 이번 판의 자리표(배치가 값을 덧붙인다) */
  layout: Layout;
  /** 땅 높이 */
  terrain: Terrain;
  /** 자리 차지(빈자리·비행 통로·넓은 놀이 자리·마을 중심) */
  occ: Occupancy;
  /** 가까운 것만 장면에 두기 */
  culler: Culler;
  /** 나 — 좁은 요청으로만 */
  player: Player;
  camera: CameraRig;
  /** 빛 방울·빛 */
  fx: Fx;
  /** 칙 원·물결·물방울 */
  ripples: Ripples;
  /** 안내 한 줄 */
  hud: Hud;
  models: ModelLibrary;
  mats: Mats;
  /** 게임 난수(갈래마다 fork 해서 쓴다) */
  rng: Random;
}
