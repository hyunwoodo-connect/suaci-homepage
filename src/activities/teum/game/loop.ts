import { meFrame, shadowFrame } from "./avatar/me";
import { signatureFrame } from "./brand/signature";
import { cameraFrame } from "./camera";
import { creaturesFrame, legendsFrame } from "./creatures";
import { trailFrame } from "./fx/ribbons";
import { ripplesFrame } from "./fx/ripples";
import { fxFrame } from "./fx/sparks";
import { hudFrame } from "./hud";
import { moveFrame, readInput, updateAlt } from "./player";
import { archesFrame } from "./rides/arches";
import { balloonsFrame, balloonsPose } from "./rides/balloons";
import { ballsFrame } from "./rides/balls";
import { bumpersFrame } from "./rides/bumpers";
import { cannonsFrame } from "./rides/cannons";
import { chimesFrame } from "./rides/chimes";
import { cometFrame } from "./rides/comet";
import { funnelsFrame } from "./rides/funnels";
import { holesFrame } from "./rides/holes";
import { jetsFrame } from "./rides/jets";
import { padsFrame } from "./rides/pads";
import { pillarsFrame } from "./rides/pillars";
import { pipesFrame } from "./rides/pipes";
import { railsFrame } from "./rides/rails";
import { ringsFrame } from "./rides/rings";
import { rocketsFrame, rocketsPose } from "./rides/rockets";
import { seedsFrame } from "./rides/seeds";
import { slingsFrame, slingsPose } from "./rides/slings";
import { starModelsFrame, starsFrame } from "./rides/stars";
import { streamsFrame } from "./rides/streams";
import { swingsFrame, swingsPose } from "./rides/swings";
import { thermalsFrame } from "./rides/thermals";
import { whaleFrame, whaleMove } from "./rides/whale";
import { whirlsFrame } from "./rides/whirls";
import { wingsFrame } from "./rides/wings";
import { catFrame, sceneryFrame } from "./scenery";
import { directorFrame } from "./scenery/director";
import { bubbleTrailFrame } from "./scenery/trail";
import { sculpturesFrame } from "./sculptures";
import type { Game } from "./state";
import { flowersFrame } from "./world/flowers";
import { lakesFrame } from "./world/lakes";
import { lighthouseFrame, placesFrame, spotsFrame } from "./world/places";
import { sitesFrame } from "./world/sites";
import { cloudsFrame } from "./world/terrain";

/**
 * 한 프레임. 놀이기구는 시제품과 같은 순서로 나를 건드린다(앞의 것이 바꾼 높이·속도를 뒤의 것이 본다) — 순서를 바꾸지 않는다.
 * now·last 는 requestAnimationFrame 시각(ms). 한 프레임은 길어도 0.1 초로 자른다
 */
export function frame(g: Game, now: number, last: number) {
  const elapsed = (now - last) / 1000;
  const dt = Math.min(0.1, elapsed);
  g.time += dt;
  g.lakes.lakeT.value = g.time;
  readInput(g, dt);
  // 고래: 출발점 둘레를 천천히 돈다
  whaleMove(g);
  moveFrame(g);
  // ---- 놀이기구 ----
  ringsFrame(g);
  padsFrame(g);
  pillarsFrame(g);
  streamsFrame(g);
  whirlsFrame(g);
  whaleFrame(g);
  chimesFrame(g);
  cannonsFrame(g);
  bumpersFrame(g);
  balloonsFrame(g);
  archesFrame(g);
  ballsFrame(g);
  lakesFrame(g);
  slingsFrame(g);
  swingsFrame(g);
  pipesFrame(g);
  railsFrame(g);
  funnelsFrame(g);
  seedsFrame(g);
  rocketsFrame(g);
  thermalsFrame(g);
  wingsFrame(g);
  cometFrame(g);
  jetsFrame(g);
  holesFrame(g);
  updateAlt(g);
  // ---- 나와, 나를 따라 움직이는 것들 ----
  meFrame(g);
  balloonsPose(g);
  shadowFrame(g);
  trailFrame(g);
  starsFrame(g);
  rocketsPose(g);
  slingsPose(g);
  swingsPose(g);
  // ---- 풍경·생물 ----
  sitesFrame(g);
  sceneryFrame(g);
  sculpturesFrame(g);
  signatureFrame(g);
  bubbleTrailFrame(g);
  directorFrame(g);
  legendsFrame(g);
  creaturesFrame(g);
  placesFrame(g);
  cloudsFrame(g);
  const pulse = lighthouseFrame(g);
  hudFrame(g);
  cameraFrame(g);
  spotsFrame(g);
  ripplesFrame(g);
  flowersFrame(g);
  fxFrame(g, pulse);
  catFrame(g);
  starModelsFrame(g);
  g.renderer.render(g.scene, g.camera);
}
