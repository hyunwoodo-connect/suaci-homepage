import * as THREE from "three";

import type { PuffData } from "./fx/ripples";
import { nextSprout } from "./rides/seeds";
import { say } from "./hud";
import type { Game } from "./state";
import { LIME, S } from "./state";
import { reactPlace } from "./world/places";
import { FWD } from "./world/sphere";
import { groundAt } from "./world/terrain";

// 입력: 끌기(손가락을 대고 미는 쪽으로 간다) / 칙(짧게 톡). 방향키·WASD 도 끌기와 같다

/** 끌고 있는 손가락 하나: 시작 자리(x0·y0)와 지금 방향(fx·fy)·세기(m) */
export interface Pointer {
  id: number | null;
  x0: number;
  y0: number;
  t0: number;
  drag: boolean;
  fx: number;
  fy: number;
  m: number;
}

/** 입력 상태와 떼어 낼 리스너 */
export interface Input {
  inp: Pointer;
  keys: Set<string>;
  detach: () => void;
}

/** 이만큼 움직이면 끌기 */
const DRAG_PX = 8;
/** 이보다 짧게 떼면 칙 */
const TAP_MS = 250;
/** 이만큼 끌면 최대 세기 */
const FULL_PX = 60;

const ray = new THREE.Raycaster(),
  ndc = new THREE.Vector2();

/** 캔버스와 창에 입력을 단다 */
export function attachInput(g: Game, canvas: HTMLCanvasElement): Input {
  const inp: Pointer = { id: null, x0: 0, y0: 0, t0: 0, drag: false, fx: 0, fy: 0, m: 0 };
  const keys = new Set<string>();
  const { stick, knob, hint } = g.hud;
  const onMenu = (e: Event) => e.preventDefault();
  const onDown = (e: PointerEvent) => {
    if (inp.id !== null) return;
    inp.id = e.pointerId;
    inp.x0 = e.clientX;
    inp.y0 = e.clientY;
    inp.t0 = performance.now();
    inp.drag = false;
    inp.m = 0;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== inp.id) return;
    const dx = e.clientX - inp.x0,
      dy = e.clientY - inp.y0,
      len = Math.hypot(dx, dy);
    if (!inp.drag && len > DRAG_PX) {
      inp.drag = true;
      hint.style.opacity = "0";
      stick.style.display = knob.style.display = "block";
      stick.style.left = inp.x0 + "px";
      stick.style.top = inp.y0 + "px";
    }
    if (inp.drag) {
      inp.fx = dx / len;
      inp.fy = -dy / len;
      const reach = len / FULL_PX;
      inp.m = Math.min(1, reach);
      const k = Math.min(len, 42) / len;
      knob.style.left = inp.x0 + dx * k + "px";
      knob.style.top = inp.y0 + dy * k + "px";
    }
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== inp.id) return;
    if (!inp.drag && performance.now() - inp.t0 < TAP_MS) chik(g, e.clientX, e.clientY);
    inp.id = null;
    inp.drag = false;
    inp.m = 0;
    stick.style.display = knob.style.display = "none";
  };
  const onKeyDown = (e: KeyboardEvent) => keys.add(e.key.toLowerCase());
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
  canvas.addEventListener("contextmenu", onMenu);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  const detach = () => {
    canvas.removeEventListener("contextmenu", onMenu);
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
  return { inp, keys, detach };
}

/**
 * 칙: 날개면 날갯짓, 레일이면 뛰어오르기, 그네면 뛰어내리기, 따라오던 별은 터지고, 풍선은 놓는다.
 * 그리고 누른 땅에 라임 원이 퍼지며 둘레 꽃이 피고, 가까운 장소·종·기둥·구름·고리가 가까운 순서로 울린다
 */
export function chik(g: Game, x: number, y: number) {
  const { pl, rides } = g,
    p = pl.p;
  if (rides.wing.t > 0) {
    const flapVy = Math.max(pl.vy, 0) + 5.5;
    pl.vy = Math.min(9, flapVy);
    if (pl.air <= 0) pl.air = 0.01;
    rides.wing.flap = 1;
  } // 날갯짓
  if (g.rails.railOn) {
    pl.vy = 9;
    g.rails.railCool = 1.0;
  } // 레일에서 뛰어오른다
  if (rides.swing.on) rides.swing.kick = true;
  const followers = g.stars.followers;
  if (followers.length) {
    // 따라오던 별이 불꽃처럼 터진다
    for (const st of followers) {
      st.st = 2;
      st.t = 0;
      // 난수 순서: 흩어지는 방향 x·y·z → 위로 솟는 힘
      const dirX = Math.random() - 0.5;
      const dirY = Math.random() - 0.5;
      const dirZ = Math.random() - 0.5;
      const lift = 7 + Math.random() * 6;
      st.vel.set(dirX, dirY, dirZ).multiplyScalar(14).addScaledVector(p, lift);
    }
    followers.length = 0;
  }
  if (rides.balloon.on) {
    rides.balloon.on = false;
    rides.balloon.b!.cool = 6;
  } // 하늘을 눌러도 풍선은 놓는다
  // 화면 좌표 → -1..1(위가 +)
  const ndcX = (x / innerWidth) * 2 - 1;
  const ndcY = -(y / innerHeight) * 2 + 1;
  ndc.set(ndcX, ndcY);
  ray.setFromCamera(ndc, g.camera);
  const hit = ray.intersectObject(g.ground.planet, false)[0];
  if (!hit) return;
  const n = hit.point.clone().normalize();
  const puffGeo = new THREE.CircleGeometry(1, 36);
  const puffMat = new THREE.MeshBasicMaterial({
    color: LIME,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const m = new THREE.Mesh(puffGeo, puffMat);
  m.quaternion.setFromUnitVectors(FWD, n);
  m.userData = { n, t: 0, g: groundAt(g, n) } satisfies PuffData;
  g.scene.add(m);
  g.ripples.puffs.push(m);
  g.hud.hint.style.opacity = "0";
  const bumps = g.terrain.bumps;
  for (let k = 0; k < bumps.v.length; k++)
    if (2 * (1 - n.dot(bumps.v[k])) * S.R * S.R < 144) bumps.lit[k] = 1; // 칙 둘레의 꽃이 한꺼번에 핀다
  for (let i = 0; i < 3; i++) if (n.angleTo(g.places.PV[i]) * S.R < 13) reactPlace(g, i);
  for (const f of g.seeds.fields)
    if (n.angleTo(f.v) * S.R < f.r) {
      // 씨앗밭 안이면 구름 싹이 솟는다
      const sp = nextSprout(g);
      sp.on = true;
      sp.v.copy(n);
      sp.t = 0;
      sp.g = groundAt(g, n);
      sp.cool = 0;
      sp.sq = 0;
      if (!g.said.seed) {
        g.said.seed = true;
        say(g, "칙 씨앗밭 — 칙 한 자리에 구름 싹이 솟습니다");
      }
      break;
    }
  const lists: { v: THREE.Vector3; ringAt: number }[][] = [
    g.chimes,
    g.pillars.list,
    g.pads.list,
    g.rings,
  ];
  for (const list of lists)
    for (const o of list) {
      // 가까운 것부터 차례로 울린다
      const dist = n.angleTo(o.v) * S.R;
      if (dist < 18) o.ringAt = g.time + 0.05 + dist * 0.05;
    }
}
