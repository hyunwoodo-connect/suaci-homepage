import * as THREE from "three";

import type { AvatarLook, Locks, LookTab } from "./outfit";
import { DEFAULT_LOOK, isPartTab, isPrint, lookAssetKeys, printKey, randomLook } from "./outfit";
import type { OutfitUniforms } from "./outfit-shader";
import type { PartSlot } from "./parts";
import { PART_SLOTS } from "./parts";
import type { AvatarProfile } from "./profile";
import type { RigHandle } from "./rig";

// 옷장: 지금 차림을 몸에 입히고(옷은 몸 셰이더 값, 소품은 뼈에 끼우기) 아바타 기록에 둔다(놀이마다 같이 쓰는 공용 기록 — lib/avatar).
// 기록을 읽은 뒤에 차림이 정해지고, 몸이 오면 입힌다. 무늬 그림은 입을 때 받는다(받는 사이 다른 것을 고르면 늦게 온 그림은 버린다)

/** 뼈대 있는 몸을 가진 것(놀이의 아바타): 몸이 오면(이미 왔으면 바로) 알린다 */
export interface RigOwner {
  whenRig(cb: (rig: RigHandle) => void): void;
}

/** 받아 온 에셋 하나(그림이면 texture 가 있다) */
type FetchedAsset = { kind: "texture"; texture: THREE.Texture } | { kind: "model" };

/** 무늬 그림을 받아 주는 곳(놀이의 에셋 창구가 이 모양을 맞춘다) */
export interface PrintSource {
  fetch(key: string): Promise<FetchedAsset>;
}

/** 되돌리기는 이만큼까지 */
const UNDO_MAX = 30;

/** 옷장을 만들 때 */
interface WardrobeOptions {
  /** 기록에 차림이 없는 사람(처음 온 사람)에게 아무 차림이나 입혀 둔다 — 꾸미기 씬에서 완성만 눌러도 넘어가게 */
  dressNewcomer: boolean;
  /** 0 이상 1 미만 난수 */
  rand: () => number;
  /** 아직 받지 못한 것(지금 — 놀이를 깨면 줄어든다). 고를 수 없고, 아무 차림에도 들지 않는다 */
  locks: () => Locks;
}

/** 지금 차림과 갈아입기 */
export class Wardrobe {
  /** 지금 차림(기록을 읽기 전에는 처음 차림) */
  look: AvatarLook = { ...DEFAULT_LOOK };
  /** 기록을 읽고 차림이 정해졌다 */
  readonly ready: Promise<void>;
  private readonly history: string[] = [];
  private rig: RigHandle | null = null;
  /** 칸마다 지금 끼운 부품 키(같은 것을 다시 끼우지 않게) */
  private readonly wearing: Partial<Record<PartSlot, string>> = {};
  private loader: PrintSource | null = null;
  /** 무늬 그림 받기(이름마다 한 번 — 실패하면 빼서 다음에 다시) */
  private readonly prints = new Map<string, Promise<THREE.Texture>>();

  constructor(
    private readonly outfit: OutfitUniforms,
    avatar: RigOwner,
    private readonly profile: AvatarProfile,
    private readonly options: WardrobeOptions,
  ) {
    this.ready = profile.ready.then(() => {
      const saved = profile.record.look;
      if (saved) this.look = { ...saved };
      else if (options.dressNewcomer) {
        const locks = options.locks();
        this.look = randomLook(options.rand, locks);
        this.keep();
      }
    });
    void this.ready.then(() =>
      avatar.whenRig((rig) => {
        this.rig = rig;
        this.putOn();
      }),
    );
  }

  /** 에셋 받는 창구를 단다(무늬 그림을 받는다) */
  useLoader(loader: PrintSource) {
    this.loader = loader;
    this.applyClothes();
  }

  /** 지금 차림이 받아야 할 에셋 키(첫 화면에 같이 받는다) */
  assetKeys(): string[] {
    return lookAssetKeys(this.look);
  }

  /** 한 탭의 것을 고른다(되돌리기에 남고 기록에 둔다). 이미 입은 것이거나 아직 받지 못한 것이면 false */
  pick(tab: LookTab, value: string): boolean {
    if (this.look[tab] === value || this.options.locks().has(value)) return false;
    this.snap();
    this.look[tab] = value;
    this.keep();
    if (isPartTab(tab)) this.wearSlot(tab);
    else this.applyClothes();
    return true;
  }

  /** 아무 차림이나 */
  shuffle() {
    this.snap();
    const locks = this.options.locks();
    this.look = randomLook(this.options.rand, locks);
    this.keep();
    this.putOn();
  }

  /** 바로 앞 차림으로. 되돌릴 것이 없으면 false */
  undo(): boolean {
    const last = this.history.pop();
    if (last === undefined) return false;
    this.look = JSON.parse(last) as AvatarLook;
    this.keep();
    this.putOn();
    return true;
  }

  /** 되돌리기를 비운다(꾸미기 씬을 열 때마다 새로) */
  clearHistory() {
    this.history.length = 0;
  }

  /** 꾸미기 씬을 한 번 지났나(기록을 읽은 뒤에 본다) */
  get hasDressed(): boolean {
    return this.profile.record.dressed;
  }

  /** 꾸미기 씬을 지났다고 기록한다 */
  markDressed() {
    if (this.profile.record.dressed) return;
    this.profile.record.dressed = true;
    this.profile.commit();
  }

  /** 옷장을 열 때: 고를 수 있는 무늬 그림을 미리 받아 둔다(고르는 순간 바로 입게) */
  prefetchPrints(names: readonly string[]) {
    for (const name of names) this.withPrint(name, () => {});
  }

  // 옷과 소품을 지금 차림대로
  private putOn() {
    this.applyClothes();
    for (const slot of PART_SLOTS) this.wearSlot(slot);
  }

  private wearSlot(slot: PartSlot) {
    const rig = this.rig;
    if (!rig) return;
    const key = this.look[slot];
    if (this.wearing[slot] === key) return;
    this.wearing[slot] = key;
    if (key) rig.wear(key);
    else rig.strip(slot);
  }

  // 윗옷 무늬, 치마 무늬 또는 단색, 신발 색을 몸 셰이더 값으로
  private applyClothes() {
    const { top, bot, shoe } = this.look,
      u = this.outfit;
    u.uPrTon.value = 0;
    if (isPrint(top))
      this.withPrint(top, (texture) => {
        if (this.look.top !== top) return;
        u.uPrT.value = texture;
        u.uPrTon.value = 1;
      });
    u.uPrBon.value = 0;
    if (isPrint(bot))
      this.withPrint(bot, (texture) => {
        if (this.look.bot !== bot) return;
        u.uPrB.value = texture;
        u.uPrBon.value = 1;
      });
    const isSkirtColor = bot.startsWith("#");
    u.uSkOn.value = isSkirtColor ? 1 : 0;
    if (isSkirtColor) u.uSkC.value.set(bot);
    u.uShOn.value = shoe ? 1 : 0;
    if (shoe) u.uShC.value.set(shoe);
  }

  // 무늬 그림: 받은 것은 두고 쓴다. 몸에 감기게 거울처럼 되풀이한다
  private withPrint(name: string, apply: (texture: THREE.Texture) => void) {
    const loader = this.loader;
    if (!loader) return;
    let job = this.prints.get(name);
    if (!job) {
      const key = printKey(name);
      job = loader.fetch(key).then((asset) => {
        if (asset.kind !== "texture") throw new Error(`${key} 는 그림이 아니다`);
        const t = asset.texture;
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
        t.needsUpdate = true;
        return t;
      });
      this.prints.set(name, job);
    }
    job.then(apply).catch((err) => {
      console.error("avatar print", name, err);
      this.prints.delete(name);
    });
  }

  private snap() {
    const was = JSON.stringify(this.look);
    this.history.push(was);
    if (this.history.length > UNDO_MAX) this.history.shift();
  }

  private keep() {
    this.profile.record.look = { ...this.look };
    this.profile.commit();
  }
}
