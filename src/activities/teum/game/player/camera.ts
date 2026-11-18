import * as THREE from "three";

import type { Frame } from "../core/frame";
import { ease } from "../core/frame";
import { S } from "../settings";
import { clamp } from "../world/sphere";
import type { Terrain } from "../world/terrain";
import type { Player } from "./player";

// 카메라 — 뒤에서 따라간다. 빨라지거나 높이 뜨면 물러나고, 등대에 닿으면 올라 둘러본다.
// 놀이기구는 카메라를 직접 옮기지 않고 섞는 정도만 부탁한다: 회오리·깔때기(spin), 고래·혜성(ride), 등대(overlook),
// 버섯으로 높이 떠 있는 동안(survey — 나를 보지 않고 앞쪽 아래를 넓게 본다: 나는 화면 아래쪽에 작게)

/** 이만큼 데리고 다니면 카메라가 가장 높고 멀다 */
const COMPANY_FULL = 3;
/** 첫 손님 하나로 오르는 몫(0..1) */
const COMPANY_FIRST = 0.6;
/** 화각을 잠깐 바꿀 때 따라가는 빠르기(1/초) */
const KICK_RATE = 22;
/**
 * 높이 떠서 둘러볼 때: 카메라는 내 머리 위(위로·뒤로 m)에서, 앞쪽 아래(앞으로·아래로 m — 45도쯤 숙인다)를 본다 —
 * 나는 화면 아래쪽에 작게 들고 화면은 발밑 앞부터 먼 곳까지 넓게 담는다 · 넓히는 화각(도)
 */
const SURVEY_RISE = 11,
  SURVEY_BACK = 4,
  SURVEY_AHEAD = 26,
  SURVEY_DOWN = 19,
  SURVEY_FOV = 12;
/** 가장 많이 데리고 다닐 때 더 오르는 높이·물러나는 거리·보는 곳을 낮추는 정도(m) */
const COMPANY_RISE = 6,
  COMPANY_BACK = 4.5,
  COMPANY_LOOK_DOWN = 1.5;

const cdir = new THREE.Vector3(),
  tmp = new THREE.Vector3(),
  want = new THREE.Vector3(),
  cn = new THREE.Vector3(),
  look = new THREE.Vector3();

/** 따라가는 카메라 */
export class CameraRig {
  private over = 0;
  private spin = 0;
  private ride = 0;
  /** 데리고 다니는 손님 수(셋까지)만큼 높이·멀리(0..1, 천천히 따라간다) */
  private company = 0;
  private companyWant = 0;
  /** 높이 떠서 둘러보는 정도(0..1) */
  private survey = 0;
  /** 몸이 커진 만큼 높이·거리를 늘린다(1 이 그대로, 천천히 따라간다) */
  private zoom = 1;
  private zoomWant = 1;
  private kick = 0;
  private kickWant = 0;
  /** 회오리·깔때기에 들어올 때의 보는 쪽(안에서 화면이 같이 돌지 않게) */
  private readonly h0 = new THREE.Vector3();

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly player: Player,
    private readonly terrain: Terrain,
  ) {}

  /** 회오리·깔때기에 실린 정도를 target 쪽으로 */
  easeSpin(target: number, k: number) {
    this.spin += (target - this.spin) * k;
  }
  /** 고래·혜성에 탄 정도를 target 쪽으로 */
  easeRide(target: number, k: number) {
    this.ride += (target - this.ride) * k;
  }
  /** 등대에서 둘러보는 정도를 target 쪽으로 */
  easeOverlook(target: number, k: number) {
    this.over += (target - this.over) * k;
  }
  /** 높이 떠서 둘러보는 정도를 target 쪽으로(버섯 높이 뛰기 — 앞쪽 아래를 넓게 본다) */
  easeSurvey(target: number, k: number) {
    this.survey += (target - this.survey) * k;
  }
  /** 데리고 다니는 손님 수 — 한 명만 와도 내 뒤 줄이 나를 가리지 않을 만큼 오르고, 둘·셋으로 늘면 조금씩 더 높아지고 멀어진다 */
  setCompany(count: number) {
    if (count <= 0) {
      this.companyWant = 0;
      return;
    }
    const more = (count - 1) / (COMPANY_FULL - 1),
      share = COMPANY_FIRST + (1 - COMPANY_FIRST) * more;
    this.companyWant = Math.min(1, share);
  }
  /** 몸이 커졌다(k 배) — 기본 높이·거리를 늘려 몸이 다 들게 한다 */
  setZoom(k: number) {
    this.zoomWant = k;
  }
  /**
   * 화각을 잠깐 좁히거나 넓힌다(share: 몫 — -0.04 면 4% 좁게, 0 이면 제자리). 숨바꼭질의 열어 보기가 쓴다:
   * 두근거릴 때 살짝 다가가고, 팡 터질 때 순간 물러난다
   */
  kickFov(share: number) {
    this.kickWant = share;
  }
  /** 지금 보는 쪽을 붙잡아 둔다(회오리·깔때기에 들어서는 순간) */
  lockHeading(h: THREE.Vector3) {
    this.h0.copy(h);
  }

  /** 카메라를 이번 프레임 자리에 놓는다 */
  update(f: Frame) {
    const pl = this.player,
      camera = this.camera,
      p = pl.p,
      P = pl.P,
      over = this.over,
      wB = this.spin,
      rB = this.ride,
      sv = this.survey;
    const companyStep = f.dt * 2;
    const companyEase = Math.min(1, companyStep);
    this.company += (this.companyWant - this.company) * companyEase;
    const folK = this.company;
    const zoomEase = Math.min(1, companyStep);
    this.zoom += (this.zoomWant - this.zoom) * zoomEase;
    const zoom = this.zoom;
    cdir.copy(pl.h);
    if (wB > 0.01) {
      // 회오리 안에서는 화면이 같이 돌지 않게, 들어올 때의 방향을 유지한다
      const h0Radial = this.h0.dot(p);
      tmp.copy(this.h0).addScaledVector(p, -h0Radial).normalize();
      cdir.lerp(tmp, wB);
      if (cdir.lengthSq() < 1e-4) cdir.copy(tmp);
      const cdirRadial = cdir.dot(p);
      cdir.addScaledVector(p, -cdirRadial).normalize();
    }
    const orbit = 2.6 * over;
    cdir.applyAxisAngle(p, orbit);
    const sp = clamp(pl.tot, 0, 2.2);
    // 빠를수록·높이 뜰수록·회오리(wB)·놀이기구(rB)에 탈수록 위로 올라가고 뒤로 물러난다
    // 손님을 데리고 다니면 높이 올라 내려다본다 — 내 발자취 위에 한 줄로 선 손님들이 나를 가리지 않고 내 아래쪽 화면에 든다
    const followRise =
      S.camH * zoom + 24 * over + pl.air * 0.22 + 5 * wB + 4 * rB + COMPANY_RISE * folK;
    const followBack =
      -S.camD * zoom * (1 + 0.22 * sp) -
      20 * over -
      pl.air * 0.35 -
      9 * wB -
      10 * rB -
      COMPANY_BACK * folK;
    const rise = followRise + (SURVEY_RISE - followRise) * sv,
      back = followBack + (-SURVEY_BACK - followBack) * sv;
    want.copy(P).addScaledVector(p, rise).addScaledVector(cdir, back);
    if (pl.takeSnap()) camera.position.copy(want);
    else {
      const follow = ease(6, f.dt);
      camera.position.lerp(want, follow);
    }
    cn.copy(camera.position).normalize();
    const minR = S.R + this.terrain.groundAt(cn) + 1.2;
    if (camera.position.length() < minR) camera.position.setLength(minR);
    camera.up.copy(p);
    // 둘러볼 때는 나를 보지 않는다: 앞쪽 아래의 먼 곳을 본다
    const followLook = 0.8 + (zoom - 1) * 1.2 - 6 * over - COMPANY_LOOK_DOWN * folK,
      followAhead = 5 + 45 * over;
    const lookRise = followLook + (-SURVEY_DOWN - followLook) * sv,
      lookAhead = followAhead + (SURVEY_AHEAD - followAhead) * sv;
    look.copy(P).addScaledVector(p, lookRise).addScaledVector(cdir, lookAhead);
    camera.lookAt(look);
    const kickStep = f.dt * KICK_RATE;
    const kickEase = Math.min(1, kickStep);
    this.kick += (this.kickWant - this.kick) * kickEase;
    const fov = (S.fov + 9 * Math.min(1.6, sp) + SURVEY_FOV * sv) * (1 + this.kick);
    // 조금씩 바뀔 때마다 투영 행렬을 다시 만들지 않는다
    const fovDelta = camera.fov - fov;
    if (Math.abs(fovDelta) > 0.05) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  /** 치울 것이 없다(카메라는 무대가 치운다) */
  dispose() {}

  /** 창 크기에 맞춘다 */
  resize(renderer: THREE.WebGLRenderer) {
    renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
