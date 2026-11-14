import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { assetUrl } from "./manifest";
import type { Manifest } from "./manifest";

/** 받은 에셋: 모델(glb 장면) 또는 그림(하늘) */
export type LoadedAsset =
  { kind: "model"; scene: THREE.Group } | { kind: "texture"; texture: THREE.Texture };

/** 에셋 받기. 같은 키는 한 번만 받는다 */
export interface AssetLoader {
  /** 키 하나를 받는다(받는 중이면 그 약속을 같이 기다린다) */
  fetch(key: string): Promise<LoadedAsset>;
  /**
   * 여러 키를 동시에 몇 개씩 받으며, 하나 받을 때마다 `onEach`. 실패한 키는 건너뛴다(그 자리는 도형으로 남는다).
   * `onProgress` 는 받은 바이트(manifest 기준) / 전체.
   */
  loadMany(
    keys: readonly string[],
    onEach: (key: string, asset: LoadedAsset) => void,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void>;
}

/** 동시에 받는 수. 폰 회선에서 앞 것이 뒤 것에 밀리지 않을 만큼만 */
const PARALLEL = 6;

/** manifest 를 보고 받는 로더를 만든다. 배포본은 meshopt 압축이라 디코더를 단다 */
export function createAssetLoader(manifest: Manifest): AssetLoader {
  const gltf = new GLTFLoader();
  gltf.setMeshoptDecoder(MeshoptDecoder);
  const images = new THREE.TextureLoader();
  images.setCrossOrigin("anonymous");
  const cache = new Map<string, Promise<LoadedAsset>>();

  const fetchOne = (key: string): Promise<LoadedAsset> => {
    const cached = cache.get(key);
    if (cached) return cached;
    const entry = manifest.assets[key];
    if (!entry) return Promise.reject(new Error(`manifest 에 없는 에셋: ${key}`));
    const url = assetUrl(entry.file);
    const job = entry.file.endsWith(".glb")
      ? gltf.loadAsync(url).then((g): LoadedAsset => {
          const scene = g.scene;
          dequantize(scene);
          return { kind: "model", scene };
        })
      : images.loadAsync(url).then((texture): LoadedAsset => ({ kind: "texture", texture }));
    cache.set(key, job);
    return job;
  };

  return {
    fetch: fetchOne,
    async loadMany(keys, onEach, onProgress) {
      const bytesOf = (k: string) => manifest.assets[k]?.bytes ?? 0;
      const total = keys.reduce((sum, k) => sum + bytesOf(k), 0);
      let loaded = 0;
      const queue = [...keys];
      const worker = async () => {
        for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
          try {
            const asset = await fetchOne(key);
            onEach(key, asset);
          } catch (err) {
            console.error("teum asset", key, err);
          }
          loaded += bytesOf(key);
          onProgress?.(loaded, total);
        }
      };
      const workers = Array.from({ length: PARALLEL }, worker);
      await Promise.all(workers);
    },
  };
}

/* ─── 내부 ─────────────────────────── */

// 배포본 위치·법선은 정수로 줄여(KHR_mesh_quantization) 담겨 있다. 정수 그대로 두면 지오메트리에 행렬을 곱할 때
// (모델 돌려 두기·여러 개 찍기) -1..1 밖이 잘리므로 받자마자 실수로 푼다
function dequantize(root: THREE.Object3D) {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geometry: THREE.BufferGeometry = o.geometry;
    for (const name of ["position", "normal"]) {
      const attr = geometry.getAttribute(name);
      if (!attr || (attr instanceof THREE.BufferAttribute && attr.array instanceof Float32Array))
        continue;
      const out = new Float32Array(attr.count * attr.itemSize);
      for (let i = 0; i < attr.count; i++) {
        out[i * attr.itemSize] = attr.getX(i);
        out[i * attr.itemSize + 1] = attr.getY(i);
        if (attr.itemSize > 2) out[i * attr.itemSize + 2] = attr.getZ(i);
      }
      geometry.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
    }
  });
}
