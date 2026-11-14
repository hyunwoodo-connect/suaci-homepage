import * as THREE from "three";

import type { Me } from "./avatar/me";
import type { Creatures } from "./creatures";
import type { Fx } from "./fx/sparks";
import type { Petals } from "./fx/petals";
import type { Ripples } from "./fx/ripples";
import type { Trail } from "./fx/ribbons";
import type { Hud } from "./hud";
import type { Input } from "./input";
import type { Models } from "./models";
import type { Arches } from "./rides/arches";
import type { BalloonRide, Balloon } from "./rides/balloons";
import type { Balls } from "./rides/balls";
import type { Bumper } from "./rides/bumpers";
import type { Cannon, CannonRide } from "./rides/cannons";
import type { Chime } from "./rides/chimes";
import type { Comet, CometRide } from "./rides/comet";
import type { Funnel, FunnelRide } from "./rides/funnels";
import type { Hole, Warp } from "./rides/holes";
import type { Jets } from "./rides/jets";
import type { Pads } from "./rides/pads";
import type { Pillars } from "./rides/pillars";
import type { Pipes } from "./rides/pipes";
import type { Rails } from "./rides/rails";
import type { Ring } from "./rides/rings";
import type { Rocket, RocketRide } from "./rides/rockets";
import type { Seeds } from "./rides/seeds";
import type { Sling, SlingRide } from "./rides/slings";
import type { Stars } from "./rides/stars";
import type { Streams } from "./rides/streams";
import type { Swing, SwingRide } from "./rides/swings";
import type { Thermals } from "./rides/thermals";
import type { Whale, WhaleRide } from "./rides/whale";
import type { Whirl, WhirlRide } from "./rides/whirls";
import type { WingState, Wings } from "./rides/wings";
import type { Scenery } from "./scenery";
import type { Zone } from "./scenery/spots";
import type { BubbleTrail } from "./scenery/trail";
import type { Sculptures } from "./sculptures";
import type { Ground } from "./world/ground";
import type { Lakes } from "./world/lakes";
import type { Layout } from "./world/layout";
import type { LookUniforms } from "./world/look";
import type { Mats } from "./world/materials";
import type { Arrival, Places } from "./world/places";
import type { Site, SlideRide } from "./world/sites";
import type { Sky } from "./world/sky";
import type { Stage } from "./world/stage";
import type { Terrain } from "./world/terrain";
import type { Flowers } from "./world/flowers";

// 게임 한 판의 상태. 시제품이 전역에 두던 것을 한 객체(Game)에 모아 모듈마다 넘긴다

/** 맵에서 정한 값(오너가 확인한 값 그대로) */
export interface Settings {
  /** 행성 반지름 */
  R: number;
  /** 놀이 사이 넓이(자리표 거리에 곱한다) */
  wide: number;
  /** 나는 속도 */
  speed: number;
  /** 카메라 거리 */
  camD: number;
  /** 카메라 높이 */
  camH: number;
  /** 시야각 */
  fov: number;
  /** 떠 있는 높이 */
  hover: number;
  /** 도는 빠르기 */
  turn: number;
}

/** 맵 값. 시제품은 숨긴 조정 패널로 바꿀 수 있었지만 패널이 늘 꺼져 있어 늘 이 값이었다 */
export const S: Readonly<Settings> = Object.freeze({
  R: 520,
  wide: 2.2,
  speed: 7,
  camD: 7.5,
  camH: 2.6,
  fov: 58,
  hover: 1.2,
  turn: 1.1,
});

/** 키컬러 라임 */
export const LIME = 0xa9ff39;
/** 톤을 칠하기 전 바탕색 */
export const BG = 0xe6e9e8;
/** 톤을 칠하기 전 놀이기구 색 */
export const GREY_TOY = 0xb9bdbc;
/** 흰색(바꾸지 않는다) */
export const WHITE = new THREE.Color(0xffffff);

/** 나(움직임과 카메라가 같이 쓰는 값) */
export interface Player {
  /** 행성 위 자리(단위 벡터) */
  p: THREE.Vector3;
  /** 보는 쪽 */
  h: THREE.Vector3;
  /** 나아가는 쪽 */
  vel: THREE.Vector3;
  /** 세계 자리 */
  P: THREE.Vector3;
  spd: number;
  boost: number;
  /** 땅 위로 솟은 높이와 그 속도 */
  air: number;
  vy: number;
  /** 비탈에서 붙은 빠르기 */
  sl: number;
  /** 곧게 오래 날 때 붙은 빠르기 */
  cruise: number;
  /** 다음 프레임에 카메라를 바로 붙인다 */
  snap: boolean;
  /** 튕긴 직후 방향이 안 먹는 시간 */
  stun: number;
  /** 부드럽게 따라가는 땅 높이 */
  gh: number;
  tilt: number;
  trailT: number;
  trailReset: boolean;
  /** 등대에서 둘러보는 정도 */
  over: number;
  /** 회오리·깔때기에 실린 정도, 고래·혜성에 탄 정도(카메라가 물러난다) */
  wB: number;
  rB: number;
}

/** 이번 프레임의 값 */
export interface Tick {
  dt: number;
  /** 끌기 방향(fx 옆, fy 앞)·세기(m), 놀이기구에 실려 끌기가 안 먹기 전의 세기(m0) */
  fx: number;
  fy: number;
  m: number;
  m0: number;
  /** 놀이기구에 실려 있다 */
  held: boolean;
  /** 이번 프레임 빠르기 */
  tot: number;
  /** 발밑 땅 높이 */
  gNow: number;
  /** 지금 높이 */
  alt: number;
  /** 고래가 출렁이는 높이 */
  wbob: number;
}

/** 실려 가는 동안의 상태(하나씩만 있다) */
export interface Rides {
  arr: Arrival;
  whirl: WhirlRide;
  whale: WhaleRide;
  cannon: CannonRide;
  balloon: BalloonRide;
  warp: Warp;
  sling: SlingRide;
  swing: SwingRide;
  funnel: FunnelRide;
  rocket: RocketRide;
  wing: WingState;
  comet: CometRide;
  slide: SlideRide;
}

/** 처음 한 번만 하는 안내를 했나 */
export interface Said {
  chime: boolean;
  bumper: boolean;
  ball: boolean;
  grow: boolean;
  star: boolean;
  seed: boolean;
  tree: boolean;
  flower: boolean;
  bubble: boolean;
}

/** 게임 한 판 */
export interface Game extends Stage {
  L: Layout;
  mats: Mats;
  ground: Ground;
  sky: Sky;
  lookU: LookUniforms;
  /** 톤을 칠했나(늦게 온 모델이 그 칠을 받는다) */
  lookSet: boolean;
  models: Models;
  time: number;
  pl: Player;
  t: Tick;
  rides: Rides;
  said: Said;
  hud: Hud;
  input: Input;
  places: Places;
  sites: Site[];
  rings: Ring[];
  pads: Pads;
  pillars: Pillars;
  streams: Streams;
  whirls: Whirl[];
  chimes: Chime[];
  whale: Whale;
  cannons: Cannon[];
  bumpers: Bumper[];
  balloons: Balloon[];
  arches: Arches;
  balls: Balls;
  stars: Stars;
  lakes: Lakes;
  slings: Sling[];
  barGeo: THREE.CylinderGeometry;
  swings: Swing[];
  pipes: Pipes;
  rails: Rails;
  funnels: Funnel[];
  seeds: Seeds;
  /** 언덕이 덮으면 안 되는 넓은 놀이 자리 */
  zones: Zone[];
  rockets: Rocket[];
  thermals: Thermals;
  wings: Wings;
  comet: Comet;
  jets: Jets;
  holes: Hole[];
  terrain: Terrain;
  flowers: Flowers;
  petals: Petals;
  me: Me;
  trail: Trail;
  ripples: Ripples;
  fx: Fx;
  scenery: Scenery;
  sculptures: Sculptures;
  bubbleTrail: BubbleTrail;
  creatures: Creatures;
}

/** 나의 처음 값 */
export function createPlayer(): Player {
  return {
    p: new THREE.Vector3(),
    h: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    P: new THREE.Vector3(),
    spd: 0,
    boost: 0,
    air: 0,
    vy: 0,
    sl: 0,
    cruise: 0,
    snap: true,
    stun: 0,
    gh: 0,
    tilt: 0,
    trailT: 0,
    trailReset: false,
    over: 0,
    wB: 0,
    rB: 0,
  };
}

/** 실려 가는 상태의 처음 값 */
export function createRides(): Rides {
  return {
    arr: { on: false, t: 99, wave: null },
    whirl: { on: false, t: 0, w: null, h0: new THREE.Vector3() },
    whale: { on: false, t: 0, cool: 0 },
    cannon: { on: false, t: 0, c: null },
    balloon: { on: false, t: 0, b: null },
    warp: { on: false, t: 0, a: null, b: null, done: false },
    sling: { on: false, t: 0, s: null, inc: 1, s0: new THREE.Vector3() },
    swing: { on: false, t: 0, s: null, dir: 1, touched: false, kick: false },
    funnel: { on: false, f: null, r: 0, sgn: 1 },
    rocket: { on: false, t: 0, o: null },
    wing: { t: 0, flap: 0 },
    comet: { on: false, t: 0, cool: 0 },
    slide: {
      on: false,
      t: 0,
      s: null,
      s0: new THREE.Vector3(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      d: new THREE.Vector3(),
    },
  };
}

/** 처음 한 번 안내의 처음 값 */
export function createSaid(): Said {
  return {
    chime: false,
    bumper: false,
    ball: false,
    grow: false,
    star: false,
    seed: false,
    tree: false,
    flower: false,
    bubble: false,
  };
}

/** 이번 프레임 값의 처음 값 */
export function createTick(): Tick {
  return { dt: 0, fx: 0, fy: 0, m: 0, m0: 0, held: false, tot: 0, gNow: 0, alt: 0, wbob: 0 };
}
