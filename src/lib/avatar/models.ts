import * as THREE from "three";

import type { AssetLoader } from "@/lib/asset-kit/load";
import type { Manifest } from "@/lib/asset-kit/manifest";

import type { OutfitUniforms } from "./outfit-shader";
import { paintAvatar } from "./paint";
import { AVATAR_BODY, isAvatarModel } from "./parts";
import type { ModelSource } from "./rig-wear";

// 아바타의 몸과 부품 모델을 받아 칠해서 내주는 곳 — 놀이 밖(꾸미기 방)에서 쓴다.
// 놀이 안에서는 놀이의 모델 창구가 같은 일을 한다(세상의 모델과 한 창구로 받는다)

/** 아바타 모델 창구 */
export class AvatarModels implements ModelSource {
  private readonly arrived = new Map<string, THREE.Group>();
  private readonly waiting = new Map<string, ((root: THREE.Group) => void)[]>();
  /** 받아 달라고 부탁해 둔 키(같은 것을 두 번 부탁하지 않는다) */
  private readonly asked = new Set<string>();
  private disposed = false;

  /** outfit: 몸 재질이 읽는 옷 값(옷장이 바꾼다) */
  constructor(
    private readonly manifest: Manifest,
    private readonly loader: AssetLoader,
    private readonly outfit: OutfitUniforms,
  ) {}

  /** 이번 에셋 판에 그 아바타 모델이 있나 */
  has(key: string): boolean {
    return isAvatarModel(key) && Boolean(this.manifest.assets[key]?.box);
  }

  /** 아직 안 받았으면 받아 온다. 받지 못하면 다음에 필요해질 때 다시 받는다 */
  need(key: string) {
    if (!this.has(key) || this.arrived.has(key) || this.asked.has(key)) return;
    this.asked.add(key);
    this.loader
      .fetch(key)
      .then((asset) => {
        if (asset.kind === "model") this.deliver(key, asset.scene);
      })
      .catch((err) => {
        console.error("avatar model", key, err);
        this.asked.delete(key);
      });
  }

  /** 모델이 오면(이미 왔으면 바로) cb */
  when(key: string, cb: (root: THREE.Group) => void) {
    const root = this.arrived.get(key);
    if (root) {
      cb(root);
      return;
    }
    const list = this.waiting.get(key) ?? [];
    list.push(cb);
    this.waiting.set(key, list);
  }

  /** 받은 모델을 넘긴다: 아바타의 칠을 입히고 기다리던 곳에 알린다. 같은 키가 두 길로 와도 한 번만, 치운 뒤에 온 것은 버린다 */
  deliver(key: string, root: THREE.Group) {
    if (this.disposed || this.arrived.has(key)) return;
    const outfit = key === AVATAR_BODY ? this.outfit : null;
    root.traverse((c) => {
      if (c instanceof THREE.Mesh) paintAvatar(c.material as THREE.MeshStandardMaterial, outfit);
    });
    root.updateMatrixWorld(true);
    this.arrived.set(key, root);
    const list = this.waiting.get(key) ?? [];
    this.waiting.delete(key);
    for (const cb of list) cb(root);
  }

  /** 받은 모델의 도형·재질·그림을 비운다(끼운 부품은 받은 모델의 것을 같이 쓴다) */
  dispose() {
    this.disposed = true;
    this.waiting.clear();
    for (const root of this.arrived.values()) {
      root.traverse((c) => {
        if (!(c instanceof THREE.Mesh)) return;
        const mat = c.material as THREE.MeshStandardMaterial;
        c.geometry.dispose();
        mat.map?.dispose();
        mat.dispose();
      });
    }
    this.arrived.clear();
  }
}
