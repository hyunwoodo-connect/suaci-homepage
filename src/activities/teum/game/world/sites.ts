import * as THREE from "three";

import { blockAt } from "../collide";
import { burst } from "../fx/sparks";
import { say } from "../hud";
import type { Hold } from "../models";
import type { Game } from "../state";
import { S, WHITE } from "../state";
import type { LayoutSite } from "./layout";
import type { GreyMesh } from "./materials";
import { place } from "./places";
import { ball, label } from "./shapes";
import { from, heading } from "./sphere";

// 랜드마크(멀리서 보이는 큰 것)와 쉬는 곳(구석의 조용한 자리) — 종류마다 하나씩만 있다.
// 가까이 가면 이름표가 뜨고, 한 번 꿀렁 인사하고, 저마다 다르게 움직인다. 속으로는 못 들어간다

/** 랜드마크·쉬는 곳 하나 */
export interface Site extends LayoutSite {
  g: THREE.Group;
  prim: GreyMesh;
  lit: number;
  cool: number;
  /** 쉬는 곳 고리 안에 들어온 정도 */
  inn: number;
  was: boolean;
  top: number;
  model: Hold | null;
  pos: THREE.Vector3;
  v: THREE.Vector3;
  ring?: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  bub?: THREE.Sprite;
  core: number;
  near: number;
  hello: number;
  tick: number;
  wasNear: boolean;
  hit: number;
  tag: THREE.Sprite;
  /** 미끄럼틀: 내려가는 방향(모델 기준)과 길이 — 모델이 와야 안다 */
  fx?: number;
  fz?: number;
  sl?: number;
}

/** 미끄럼틀을 타는 동안: 꼭대기로 올라갔다가 미끄러져 내려온다 */
export interface SlideRide {
  on: boolean;
  t: number;
  s: Site | null;
  s0: THREE.Vector3;
  a: THREE.Vector3;
  b: THREE.Vector3;
  d: THREE.Vector3;
}

// 이 갈래의 자리는 조형물 크기를 정할 때 보지 않는다(따로 피하거나 겹쳐도 되는 것)
const SKIP_IN_SIZING = ["site", "tree", "hill", "hub", "place", "lake", "jet"];

const siteCol = new THREE.Color();

/** 랜드마크·쉬는 곳을 만든다. 크기는 옆의 놀이기구·호수·다른 조형물과 겹치지 않는 만큼까지 키운다 */
export function createSites(g: Game): Site[] {
  const L = g.L;
  // 조형물은 크게 — 다만 옆의 놀이기구·호수·다른 조형물과 겹치지 않는 크기까지만. 떠 있는 것은 그만큼 더 높이
  {
    const pts: THREE.Vector3[] = [];
    for (const [k, list] of Object.entries(L)) {
      if (SKIP_IN_SIZING.includes(k)) continue;
      for (const o of list as { dist?: number; bear?: number }[])
        if (o && typeof o.dist === "number") pts.push(from(o.dist, o.bear!));
    }
    const lk = L.lake.map((l) => ({ v: from(l.dist, l.bear), r: l.r })),
      sv = L.site.map((s) => from(s.dist, s.bear));
    L.site.forEach((s, i) => {
      let k = 1.25;
      if (s.kind === "land") {
        k = 1;
        for (const t of [1.7, 1.45, 1.2]) {
          const rad = s.size * 0.4 * t;
          if (
            s.lift ||
            (!pts.some((q) => q.angleTo(sv[i]) * S.R < rad + 4) &&
              !lk.some((l) => l.v.angleTo(sv[i]) * S.R < l.r + rad) &&
              !L.site.some(
                (o, j) => j !== i && sv[j].angleTo(sv[i]) * S.R < rad + o.size * 0.4 + 3,
              ))
          ) {
            k = t;
            break;
          }
        }
      }
      s.sc = k;
      s.size *= k;
      if (s.kind === "land" && s.r) s.r *= Math.min(1.4, k);
      if (s.lift) s.lift *= 2.2;
    });
  }
  const BUB = bubbleTex(),
    ringGeo = new THREE.TorusGeometry(1, 0.035, 8, 64);
  const made = L.site.map((s) => {
    const gr = new THREE.Group(),
      prim = ball(g.mats, s.kind === "land" ? 5 : 2, 0xc2c6c5, s.kind === "land" ? 5 : 2);
    gr.add(prim);
    let ring: Site["ring"], bub: Site["bub"];
    if (s.kind === "rest") {
      ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.scale.setScalar(s.r);
      ring.position.y = 0.35;
      gr.add(ring);
      bub = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: BUB, transparent: true, depthWrite: false, fog: false }),
      );
      bub.scale.setScalar(3.4);
      bub.position.y = s.size + 3;
      gr.add(bub);
    }
    place(g, gr, () => from(s.dist, s.bear), s.lift || 0);
    const items = g.places.items;
    return {
      ...s,
      sc: s.sc ?? 1,
      g: gr,
      prim,
      lit: 0,
      cool: 0,
      inn: 0,
      was: false,
      top: s.size,
      model: null,
      pos: new THREE.Vector3(),
      v: items[items.length - 1].v,
      ring,
      bub,
      core: s.size * 0.4,
      near: 0,
      hello: 0,
      tick: 0,
      wasNear: false,
      hit: 0,
    };
  });
  // 이름표: 가까이 가면 뜬다
  return made.map((s) => {
    const tag = label(s.name);
    tag.material.opacity = 0;
    tag.material.fog = false;
    const big = s.kind === "land";
    tag.scale.set(big ? 15 : 7.5, big ? 4.7 : 2.4, 1);
    tag.position.y = s.size + (big ? 5 : 6.5);
    s.g.add(tag);
    return Object.assign(s, { tag });
  });
}

/** 랜드마크·쉬는 곳: 인사·이름표·부딪힘·저마다의 움직임, 그리고 미끄럼틀 타기 */
export function sitesFrame(g: Game) {
  const { pl, t, time } = g,
    { p, vel, P } = pl,
    dt = t.dt,
    held = t.held,
    R0 = g.rides.slide,
    bumps = g.terrain.bumps,
    lime = g.mats.lime;
  if (R0.on) {
    // 미끄럼틀: 꼭대기로 올라갔다가 미끄러져 내려온다
    const s = R0.s!,
      T1 = 0.9,
      T2 = 1.5;
    R0.t += dt;
    pl.vy = 0;
    if (R0.t < T1) {
      const k = R0.t / T1,
        e = k * k * (3 - 2 * k);
      p.copy(R0.s0).lerp(R0.a, e).normalize();
      pl.air = s.top * 0.74 * e;
    } else {
      const k = Math.min(1, (R0.t - T1) / T2);
      p.copy(R0.a)
        .lerp(R0.b, k * k * 0.6 + k * 0.4)
        .normalize();
      pl.air = Math.max(0.05, s.top * 0.74 * Math.pow(1 - k, 1.4));
      vel.copy(R0.d).addScaledVector(p, -R0.d.dot(p)).normalize();
    }
    if (R0.t >= T1 + T2) {
      R0.on = false;
      pl.boost = 6;
      pl.stun = 0.6;
      s.cool = 4;
      s.hit = 2.5;
      s.lit = 1;
      burst(g, P.clone(), 10, 7);
    }
  }
  for (const s of g.sites) {
    if (s.cool > 0) s.cool -= dt;
    if (s.hit > 0) s.hit -= dt;
    s.pos.copy(s.g.position).addScaledVector(s.v, s.top * 0.5);
    const dg = p.angleTo(s.v) * S.R,
      d3 = s.sky ? P.distanceTo(s.pos) : dg,
      big = s.kind === "land";
    // 가까이 가면: 이름표가 뜨고, 한 번 꿀렁 인사하고, 저마다 다르게 움직인다
    const nr = (s.sky ? d3 : pl.air < s.top + 14 ? dg : 1e9) < s.core + (big ? 30 : 13);
    s.near += ((nr ? 1 : 0) - s.near) * (1 - Math.exp(-3 * dt));
    s.hello = Math.max(0, s.hello - dt * 0.9);
    if (nr && !s.wasNear) {
      s.hello = 1;
      if (s.cool <= 0) {
        say(g, s.msg);
        s.cool = 5;
      }
    }
    s.wasNear = nr;
    s.tag.material.opacity = s.near;
    // 부딪힘
    if (!held) {
      let bump = false;
      if (s.k === "dome") {
        // 돔은 막지 않는다. 닿는 곳이 어디든 크게 튕겨 올린다
        const hd = dg < s.core ? s.top * Math.sqrt(1 - (dg / s.core) * (dg / s.core)) : -1;
        if (hd >= 0 && pl.air < hd + 0.4) {
          pl.air = hd + 0.5;
          pl.vy = Math.max(pl.vy, 14);
          bump = true;
        }
      } else if (s.k === "slide") {
        if (s.model && s.sl !== undefined && s.hit <= 0 && pl.air < 5 && dg < s.core * 0.8) {
          R0.on = true;
          R0.t = 0;
          R0.s = s;
          R0.s0.copy(p);
          R0.d.set(s.fx!, 0, s.fz!).applyQuaternion(s.g.quaternion).normalize();
          R0.a
            .copy(s.v)
            .addScaledVector(R0.d, (-s.sl * 0.42) / S.R)
            .normalize();
          R0.b
            .copy(s.v)
            .addScaledVector(R0.d, (s.sl * 0.6) / S.R)
            .normalize();
          bump = true;
          say(g, s.msg);
        }
      } else if (s.k === "stairs") {
        if (dg < s.core + 1.5 && pl.air < s.top) {
          pl.vy = Math.max(pl.vy, 13);
          if (pl.air <= 0) pl.air = 0.01;
          bump = true;
        }
      } // 계단은 막지 않고 위로 올려 보낸다
      else if (s.sky) {
        if (d3 < s.core) {
          const a0 = pl.air;
          pl.air = 0;
          bump = blockAt(
            g,
            s.v,
            Math.sqrt(Math.max(1, s.core * s.core - Math.pow(P.length() - s.pos.length(), 2))) + 1,
            1,
          );
          pl.air = a0;
        }
      } else bump = blockAt(g, s.v, s.core, s.top);
      if (bump && s.hit <= 0) {
        s.hit = 0.6;
        s.lit = 1;
        s.hello = 1;
        burst(g, P.clone(), 6, 5);
        for (let k = 0; k < bumps.v.length; k++)
          if (2 * (1 - s.v.dot(bumps.v[k])) * S.R * S.R < (big ? 900 : 300)) bumps.lit[k] = 1;
      }
    }
    if (s.kind === "rest") {
      // 쉬는 곳: 고리 안에 있으면 고리와 말풍선이 라임이 된다
      const inside = pl.air < 4 && dg < s.r;
      s.inn += ((inside ? 1 : 0) - s.inn) * (1 - Math.exp(-5 * dt));
      s.was = inside;
      siteCol.copy(WHITE).lerp(lime, s.inn);
      s.ring!.material.color.copy(siteCol);
      s.bub!.material.color.copy(siteCol);
      s.ring!.scale.setScalar(s.r * (1 + 0.03 * Math.sin(time * 2 + s.dist)));
      s.bub!.position.y = s.top + 3 + Math.sin(time * 1.6 + s.bear) * 0.35;
      s.bub!.scale.setScalar(3.4 + s.inn * 0.8);
      s.tag.position.y = s.top + 6.6;
      if (inside && pl.spd > 0) pl.spd *= Math.exp(-0.9 * dt); // 쉬는 곳에서는 저절로 느려진다
    }
    s.lit = Math.max(0, s.lit - dt * 0.4);
    const m = s.model;
    if (!m) continue;
    const u = m.userData,
      top = s.pos.clone().addScaledVector(s.v, s.top * 0.45);
    s.tick -= dt;
    m.scale.set(
      u.k * (1 - 0.05 * s.hello * Math.sin(time * 13)),
      u.k * (1 + 0.09 * s.hello * Math.sin(time * 13)),
      u.k * (1 - 0.05 * s.hello * Math.sin(time * 13)),
    );
    u.uLime.value = Math.max(s.lit * 0.35, s.kind === "rest" ? s.inn * 0.12 : 0);
    if (s.k === "carousel") {
      m.rotation.y += dt * (0.2 + 2.2 * s.near);
      m.position.y = u.hh + Math.abs(Math.sin(time * 3)) * 0.5 * s.near;
    } // 다가가면 빨리 돈다
    else if (s.k === "ferris") {
      if (u.spin) {
        u.spin.rotation.z += dt * (0.1 + 0.7 * s.near);
        for (const qq of u.parts!) qq.userData.uLime.value = s.lit * 0.35;
      } else m.rotation.z = Math.sin(time * 1.2) * 0.06 * s.near;
      if (s.near > 0.5 && s.tick <= 0) {
        s.tick = 0.35;
        const a = time * 1.4;
        burst(
          g,
          s.pos
            .clone()
            .addScaledVector(s.v, Math.sin(a) * s.top * 0.42)
            .addScaledVector(heading(s.v, 90), Math.cos(a) * s.top * 0.42),
          1,
          3,
        );
      }
    } // 불빛이 바퀴를 따라 돈다
    else if (s.k === "castle" || s.k === "palace") {
      if (s.near > 0.5 && s.tick <= 0) {
        s.tick = 0.9;
        burst(g, top.addScaledVector(s.v, 3), 12, 12);
      }
    } // 지붕에서 불꽃이 터진다
    else if (s.k === "moon") {
      m.rotation.y += dt * (0.08 + 0.9 * s.near);
      m.position.y = u.hh + Math.sin(time * 0.5) * 1.2;
      if (s.near > 0.5 && s.tick <= 0) {
        s.tick = 0.5;
        burst(g, s.pos, 2, 6);
      }
    } else if (s.k === "island") {
      m.position.y = u.hh + Math.sin(time * 0.5 + 2) * (1.2 + 2 * s.near);
      m.rotation.y += dt * 0.05;
    } else if (s.k === "campfire") {
      if (s.near > 0.3 && s.tick <= 0) {
        s.tick = 0.22;
        burst(g, s.pos, 1, 4);
      }
    } // 불티가 오른다
    else if (s.k === "bathtub") {
      if (s.near > 0.3 && s.tick <= 0) {
        s.tick = 0.3;
        burst(g, top, 1, 2.5);
      }
    } // 거품이 오른다
    else if (s.k === "hammock")
      m.rotation.x = Math.sin(time * 1.8) * 0.12 * s.near; // 흔들린다
    else if (s.k === "stairs") m.rotation.z = 0;
    else m.rotation.z = Math.sin(time * 2.2 + s.dist) * 0.04 * s.near;
  }
}

/* ─── 내부 ─────────────────────────── */

// 말풍선: 나중에 여기서 이야기를 나눈다
function bubbleTex() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#fff";
  c.beginPath();
  c.roundRect(10, 16, 108, 76, 34);
  c.fill();
  c.beginPath();
  c.moveTo(44, 88);
  c.lineTo(40, 116);
  c.lineTo(68, 90);
  c.fill();
  c.fillStyle = "#2b2e2d";
  for (const x of [42, 64, 86]) {
    c.beginPath();
    c.arc(x, 54, 7, 0, 6.3);
    c.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
