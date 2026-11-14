import * as THREE from "three";

import { hasModel, whenModel } from "../models";
import type { Game } from "../state";
import { applyLook } from "../world/look";
import { clamp } from "../world/sphere";
import { AVATAR_BODY, DEFAULT_WEAR, PARTS } from "./parts";

// 뼈대가 있는 아바타: 몸짓은 뼈를 코드로 직접 돌려서 만든다. 이 아이는 걷지 않는다. 늘 떠 있다:
// 멈추면 물속처럼 둥실, 나아가면 몸을 눕혀 팔을 날개처럼 펴고, 솟으면 만세, 떨어지면 허우적

/** 뼈 하나의 처음 자세(모델 기준 돌림과 세계 돌림) */
interface Rest {
  q: THREE.Quaternion;
  w: THREE.Quaternion;
  wi: THREE.Quaternion;
}

/** 뼈대 있는 몸이 오면 도형 몸을 숨기고 끼운 뒤, 부품을 차례로 입힌다 */
export function setupAvatar(g: Game) {
  if (!hasModel(g, AVATAR_BODY)) return;
  whenModel(g, AVATAR_BODY, (av) => {
    const M = g.me,
      tiltG = M.tiltG,
      B: Record<string, THREE.Bone> = {},
      uL = { value: 0 };
    av.traverse((c) => {
      if (c instanceof THREE.Bone) B[c.name] = c;
      if (c instanceof THREE.Mesh) {
        c.frustumCulled = false;
        applyLook(g, c.material, uL, "avatar");
      }
    });
    av.updateMatrixWorld(true);
    // 머리 크기: 머리뼈보다 위에 있는 점들만 잰다(자동 뼈대가 손끝을 머리에 묶어 둔 곳이 있어서 뼈 이름으로는 못 잰다). 세계에 놓기 전, 모델 기준일 때 재야 한다
    const hb = new THREE.Box3(),
      tv = new THREE.Vector3(),
      hy0 = B.Head.getWorldPosition(new THREE.Vector3()).y + 0.03;
    av.traverse((c) => {
      if (!(c instanceof THREE.SkinnedMesh)) return;
      c.skeleton.update();
      const ps = c.geometry.attributes.position;
      for (let i = 0; i < ps.count; i++) {
        c.getVertexPosition(i, tv).applyMatrix4(c.matrixWorld);
        if (tv.y > hy0) hb.expandByPoint(tv);
      }
    });
    const hf = B.headfront.getWorldPosition(new THREE.Vector3()),
      hd = B.Head.getWorldPosition(new THREE.Vector3()),
      fs = hf.x - hd.x > 0 ? 1 : -1,
      zl = Math.sign(B.LeftArm.getWorldPosition(new THREE.Vector3()).z - hd.z) || 1;
    const R0: Record<string, Rest> = {};
    for (const k in B) {
      const w = B[k].getWorldQuaternion(new THREE.Quaternion());
      R0[k] = { q: B[k].quaternion.clone(), w, wi: w.clone().invert() };
    }
    const box = new THREE.Box3().setFromObject(av),
      sz = box.getSize(new THREE.Vector3()),
      ct = box.getCenter(new THREE.Vector3()),
      hold = new THREE.Group();
    av.position.sub(ct);
    hold.add(av);
    hold.scale.setScalar(1.5 / sz.y);
    hold.rotation.y = fs > 0 ? -Math.PI / 2 : Math.PI / 2; // 얼굴이 앞(+z)을 보게
    hold.userData = { uLime: uL };
    M.body.visible = false;
    M.nose.visible = false;
    tiltG.add(hold);
    const st = { f: 0, r: 0, b: 0 },
      Q = new THREE.Quaternion(),
      D = new THREE.Quaternion(),
      D2 = new THREE.Quaternion(),
      D3 = new THREE.Quaternion(),
      AX = new THREE.Vector3(1, 0, 0),
      AY = new THREE.Vector3(0, 1, 0),
      AZ = new THREE.Vector3(0, 0, 1);
    // 뼈 하나를 모델 기준으로 돌린다: sw = 앞뒤(아래로 뻗은 팔다리는 +가 앞, 위로 선 몸통·머리는 +가 뒤로 젖힘), lo = 옆으로 기울이기·팔 내리기, tw = 위에서 본 돌리기
    const pose = (name: string, sw: number, lo: number, tw?: number) => {
      const b = B[name],
        r = R0[name];
      if (!b) return;
      D.setFromAxisAngle(AZ, sw * fs);
      if (tw) {
        D3.setFromAxisAngle(AY, tw);
        D.multiply(D3);
      }
      if (lo) {
        D2.setFromAxisAngle(AX, lo);
        D.multiply(D2);
      }
      Q.copy(r.wi).multiply(D).multiply(r.w);
      b.quaternion.copy(r.q).multiply(Q);
    };
    M.avFrame = (dt, tot, vy, air) => {
      const e = (r: number) => 1 - Math.exp(-r * dt),
        inp = g.input.inp,
        fx = inp.drag ? inp.fx || 0 : 0;
      st.f += (clamp(tot / 0.85, 0, 1) - st.f) * e(3.5);
      st.r += ((vy > 2.5 ? 1 : vy < -2 && air > 2 ? -1 : 0) - st.r) * e(6);
      st.b = (st.b || 0) + (fx * Math.min(1, tot) - (st.b || 0)) * e(4);
      const up = Math.max(0, st.r),
        dn = Math.max(0, -st.r),
        gg = st.f * (1 - up) * (1 - dn),
        id = 1 - st.f,
        t = g.time;
      const s1 = Math.sin(t * 1.7),
        s2 = Math.sin(t * 1.7 + 1.3),
        fl = Math.sin(t * 6.5),
        fa = Math.sin(t * 11);
      hold.position.y = 0.06 * s1 * id; // 둥실
      const lean = clamp(1.25 * gg - tiltG.rotation.x, 0, 0.95) * gg; // 화면 기울기와 합쳐서 거의 엎드린 자세까지
      pose("Hips", -lean + 0.05 * s2 * id, fs * 0.4 * st.b, -fs * 0.25 * st.b * 0);
      pose("Spine01", 0.16 * gg + 0.03 * s1, 0);
      pose("neck", 0.3 * gg + 0.15 * up - 0.1 * dn, 0);
      pose("Head", 0.42 * gg + 0.2 * up - 0.15 * dn + 0.04 * s2 * id, -fs * 0.12 * st.b);
      // 다리: 멈추면 물장구처럼 번갈아 늘어뜨리고, 나아가면 뒤로 모아 살랑, 솟으면 곧게, 떨어지면 무릎을 접는다
      const lu = 0.22 * id + 0.12 * id * s1 - 0.2 * gg + 0.2 * gg * fl + 0.55 * dn + 0.08 * dn * fa,
        ru = 0.22 * id - 0.12 * id * s1 - 0.2 * gg - 0.2 * gg * fl + 0.55 * dn - 0.08 * dn * fa;
      pose("LeftUpLeg", lu, 0.05 * zl);
      pose("RightUpLeg", ru, -0.05 * zl);
      pose("LeftLeg", -0.5 * id - 0.15 * id * s1 - 0.12 * gg - 0.18 * gg * fl - 1.0 * dn, 0);
      pose("RightLeg", -0.5 * id + 0.15 * id * s1 - 0.12 * gg + 0.18 * gg * fl - 1.0 * dn, 0);
      pose("LeftFoot", 0.5 * (gg + up), 0);
      pose("RightFoot", 0.5 * (gg + up), 0); // 발끝을 편다
      // 팔: 멈추면 살짝 벌려 늘어뜨리고 살랑, 나아가면 옆으로 펴서 뒤로 젖힌 날개, 솟으면 위로, 떨어지면 위에서 허우적
      const low = 0.8 * id + 0.07 * id * s2 - 0.18 * gg - 1.25 * up - 0.85 * dn,
        back = 0.55 * gg,
        wob = 0.22 * dn * fa + 0.06 * gg * Math.sin(t * 2.3);
      pose("LeftArm", 0.12 * id * s1, (low + wob) * zl + 0.3 * st.b * gg, -fs * zl * back);
      pose("RightArm", -0.12 * id * s1, -(low - wob) * zl + 0.3 * st.b * gg, fs * zl * back);
      pose("LeftForeArm", 0.3 * id, 0.15 * id * zl, 0);
      pose("RightForeArm", 0.3 * id, -0.15 * id * zl, 0);
    };
    // 꾸미기: 칸(slot)마다 하나씩, 같은 칸에 새로 끼우면 바뀐다
    const hs = hb.getSize(new THREE.Vector3()),
      hc = hb.getCenter(new THREE.Vector3()),
      worn: Record<string, THREE.Group | null> = {};
    const wear = (key: string, then: () => void) => {
      const d = PARTS[key];
      if (!d) return then();
      if (worn[d.slot]) {
        worn[d.slot]!.removeFromParent();
        worn[d.slot] = null;
      }
      if (!hasModel(g, key)) return then(); // 없는 이름을 주면 그 칸을 비운다
      whenModel(g, key, (root) => {
        const m = root.clone(true),
          bb = new THREE.Box3().setFromObject(m),
          bs = bb.getSize(new THREE.Vector3()),
          bc = bb.getCenter(new THREE.Vector3()),
          G = new THREE.Group(),
          s = (hs.z * d.w) / bs.z;
        m.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            c.frustumCulled = false;
            c.material = (c.material as THREE.MeshStandardMaterial).clone();
            applyLook(g, c.material, uL, "avatar");
          }
        });
        m.position.copy(bc).negate();
        G.add(m);
        G.scale.setScalar(s);
        G.rotation.y = fs > 0 ? 0 : Math.PI; // 뽑아 온 부품은 앞이 +x를 본다. 그 앞을 얼굴 쪽으로
        if (d.slot === "hair")
          G.position.set(
            hc.x + fs * (d.f || 0) * hs.x,
            hb.max.y + d.top! * hs.y - (bs.y * s) / 2,
            hc.z,
          );
        else
          G.position.set(
            hc.x + fs * (hs.x / 2 + (d.f || 0) * hs.x - (bs.x * s) / 2),
            hc.y + (d.y || 0) * hs.y,
            hc.z,
          );
        av.add(G);
        av.updateMatrixWorld(true);
        B.Head.attach(G);
        worn[d.slot] = G;
        then();
      });
    };
    const wearAll = (i: number) => {
      if (i < DEFAULT_WEAR.length) wear(DEFAULT_WEAR[i], () => wearAll(i + 1));
    };
    wearAll(0);
  });
}
