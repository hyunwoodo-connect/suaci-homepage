import * as THREE from "three";

import type { Game } from "./Game";

// 개발 중 시험용 — 운영 빌드에서는 NODE_ENV 비교가 상수가 되어 통째로 빠진다.
// ?seed=숫자: 게임 난수를 고정하고, 시제품과 같은지 보는 시험 창구(window.__teum.probe)를 건다.
// 창구가 돌려주는 모양은 시제품 계측 사본과 같다(배치 목록·몸 상태·놀이기구 자리) — /tmp 의 비교 도구가 읽는다

interface DebugWindow {
  __teum?: { game: Game; probe: Probe };
}

/** 시험 창구 */
interface Probe {
  ready(): boolean;
  player(): number[];
  held(): boolean;
  pops(): number;
  vy(): number;
  teleport(v: THREE.Vector3, d: THREE.Vector3 | null, air: number): void;
  vec(): THREE.Vector3;
  creatures(): unknown[];
  bubs(): { t: number }[];
  place(): unknown;
  rideTargets(): unknown[];
}

/** 시험용 주소 인자 ?nodir: 지루함 감독과 방울 길을 끈다(빈 구간을 감독 없이 잴 때). 운영에선 늘 false */
export function isDirectorOff(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return new URLSearchParams(location.search).has("nodir");
}

/** ?seed 가 있으면 그 씨앗(개발에서만). 없으면 null */
export function devSeed(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  const seed = new URLSearchParams(location.search).get("seed");
  if (seed === null) return null;
  const n = Number(seed);
  return n >>> 0;
}

/** ?seed 가 있으면 게임과 시험 창구를 창에 걸어 둔다. 떼는 함수를 돌려준다 */
export function exposeGame(game: Game): () => void {
  if (process.env.NODE_ENV === "production") return () => {};
  if (!new URLSearchParams(location.search).has("seed")) return () => {};
  const w = window as unknown as DebugWindow;
  const probe = createProbe(game);
  w.__teum = { game, probe };
  return () => {
    delete w.__teum;
  };
}

/* ─── 내부 ─────────────────────────── */

const R6 = 1e6;

function n6(x: number): number {
  const scaled = x * R6;
  return Math.round(scaled) / R6;
}

function v6(v: THREE.Vector3): number[] {
  return [n6(v.x), n6(v.y), n6(v.z)];
}

function createProbe(g: Game): Probe {
  const pl = g.s.player;
  const at = (list: readonly { v: THREE.Vector3 }[]) => list.map((o) => v6(o.v));
  return {
    ready: () => g.s.models.waiting.size === 0,
    player: () => [...v6(pl.p), ...v6(pl.h), n6(pl.air), n6(pl.vy)],
    held: () => pl.isHeld,
    pops: () => g.bubbleTrail.pops,
    vy: () => pl.vy,
    teleport: (v, d, air) => pl.teleport(v, d, air),
    vec: () => new THREE.Vector3(),
    creatures: () =>
      g.creatures.list.map((c) => ({
        k: c.k,
        type: c.role === "herd" ? "sheep" : c.role,
        st: c.st,
        home: v6(c.home),
        v: v6(c.v),
        hv: c.hv ? v6(c.hv) : null,
        ctr: c.ctr ? v6(c.ctr) : null,
        legend: c.legend || 0,
        a: n6(c.a),
        follow: c.st === "follow",
      })),
    bubs: () => g.bubbles.list,
    place: () => ({
      WH: n6(g.whale.WH),
      WR: n6(g.whale.WR),
      lawn: [n6(g.signature.lawn.dist), n6(g.signature.lawn.bear), g.signature.lawn.free],
      sites: g.sites.list.map((s) => [s.k, ...v6(s.v), n6(s.top), n6(s.core)]),
      deco: g.sculptures.list.map((o) => [o.I.key, ...v6(o.v), n6(o.H), n6(o.yaw), n6(o.r)]),
      trees: g.trees.list.map((t) => [...v6(t.v), n6(t.H), n6(t.yaw)]),
      bigf: g.bigFlowers.list.map((f) => [...v6(f.v), n6(f.H), n6(f.yaw)]),
      bubs: g.bubbles.list.map((b) => [...v6(b.v), n6(b.h), n6(b.r)]),
      baby: g.babyLimes.list.map((b) => v6(b.v)),
      bal: g.signature.BAL.map((b) => [...v6(b.home), n6(b.alt), b.big ? 1 : 0]),
      flags: g.signature.FLAGS.map((f) => f.s.k),
      rides: {
        rings: g.rings.list.map((r) => [...v6(r.v), n6(r.h)]),
        pads: at(g.pads.list),
        pillars: at(g.pillars.list),
        whirls: at(g.whirls.list),
        chimes: at(g.chimes.list),
        cannons: g.cannons.list.map((c) => [...v6(c.v), ...v6(c.d)]),
        bumpers: at(g.bumpers.list),
        balloons: at(g.balloons.list),
        balls: at(g.balls.list),
        holes: at(g.holes.list),
        stars: at(g.stars.list),
        lakes: g.lakes.list.map((l) => [...v6(l.v), n6(l.r)]),
        slings: at(g.slings.list),
        swings: at(g.swings.list),
        pipes: at(g.pipes.list),
        rails: at(g.rails.rnodes),
        funnels: at(g.funnels.list),
        seeds: at(g.seeds.fields),
        rockets: at(g.rockets.list),
        thermals: at(g.thermals.list),
        wings: at(g.wings.items),
        jets: at(g.jets.jnodes),
        streams: at(g.streams.nodes),
        arches: at(g.arches.anodes),
      },
    }),
    rideTargets: () => rideTargets(g),
  };
}

// 놀이기구·장소마다 그 자리(와 높이) — 시제품 계측 사본과 같은 차례·같은 자리
function rideTargets(g: Game): unknown[] {
  const out: unknown[] = [],
    S = 520;
  const add = (name: string, v: THREE.Vector3 | undefined, air: number) => {
    if (!v) return;
    const unit = v.clone().normalize();
    const at = v6(unit);
    out.push([name, at, air]);
  };
  const off = (v: THREE.Vector3, d: THREE.Vector3, k: number) => {
    const step = k / S;
    return v.clone().addScaledVector(d, step).normalize();
  };
  const T = g;
  const ring = T.rings.list[0];
  const ringAir = ring.h - 1.2;
  add("ring", ring.v, ringAir);
  const pad = T.pads.list.find((x) => !x.hop),
    hop = T.pads.list.find((x) => x.hop);
  add("pad", pad?.v, 0.01);
  add("hop", hop?.v, 0.01);
  add("pillar", T.pillars.list[0].v, 0.01);
  add("stream", T.streams.nodes[0].v, 0.01);
  add("whirl", T.whirls.list[0].v, 0.01);
  add("chime", T.chimes.list[0].v, 0.01);
  add("cannon", T.cannons.list[0].v, 0.01);
  add("bumper", T.bumpers.list[0].v, 0.01);
  add("balloon", T.balloons.list[0].v, 0.01);
  const half = T.arches.anodes.length / 2;
  const archMid = Math.floor(half);
  const an = T.arches.anodes[archMid];
  add("arch", an.v, an.hh);
  add("ball", T.balls.list[1].v, 0.01);
  add("lake", T.lakes.list[0].v, 0.01);
  add("sling", T.slings.list[0].v, 0.01);
  add("swing", T.swings.list[0].v, 0.01);
  const pipe = T.pipes.list[0];
  const pipeSide = off(pipe.v, pipe.side, 12);
  add("pipe", pipeSide, 0.01);
  const rn = T.rails.rnodes[5];
  const railAir = rn.hh - 0.6;
  add("rail", rn.v, railAir);
  const funnelIn = off(T.funnels.list[0].v, g.s.player.h as THREE.Vector3, 10);
  add("funnel", funnelIn, 0.01);
  add("seed", T.seeds.fields[0].dots[0].v, 0.01);
  add("rocket", T.rockets.list[0].v, 0.01);
  add("thermal", T.thermals.list[0].v, 0.01);
  add("wing", T.wings.items[0].v, 0.01);
  add("hole", T.holes.list[0].v, 0.01);
  add("jet", T.jets.jnodes[3].v, 44);
  add("comet", T.comet.v, 46);
  const whaleAir = T.whale.WH + 4;
  add("whale", T.whale.v, whaleAir);
  for (const k of ["slide", "dome", "stairs", "carousel", "ferris", "moon", "lime", "island"]) {
    const s = T.sites.list.find((x) => x.k === k);
    if (!s) continue;
    const siteName = "site-" + k,
      siteAir = s.lift ? s.lift : 0.01;
    add(siteName, s.v, siteAir);
  }
  const tree = T.trees.list[0],
    flower = T.bigFlowers.list[0],
    deco = T.sculptures.list[0],
    bub = T.bubbles.list[0],
    bal = T.signature.BAL[0];
  const treeAir = tree.H + 1,
    flowerAir = flower.H + 0.5;
  add("tree", tree.v, treeAir);
  add("bigflower", flower.v, flowerAir);
  add("deco", deco.v, deco.H);
  add("baby", T.babyLimes.list[0].v, 0.01);
  add("bubble", bub.v, bub.h);
  add("fountain", T.places.PV[1], 0.01);
  add("wishtree", T.places.PV[0], 0.01);
  add("lighthouse", T.places.PV[3], 0.01);
  const balAir = bal.alt - 3;
  add("logoballoon", bal.home, balAir);
  return out;
}
