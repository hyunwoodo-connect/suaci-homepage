import * as THREE from "three";

import type { AssetLoader } from "../../assets/load";
import type { OutfitUniforms } from "../look";
import type { Progress } from "../progress/progress";
import type { Avatar } from "./avatar";
import type { AvatarLook, LookTab } from "./outfit";
import { DEFAULT_LOOK, isPartTab, isPrint, lookAssetKeys, printKey, randomLook } from "./outfit";
import type { PartSlot } from "./parts";
import { PART_SLOTS } from "./parts";
import type { RigHandle } from "./rig";

// 옷장: 지금 차림을 몸에 입히고(옷은 몸 셰이더 값, 소품은 뼈에 끼우기) 기록에 둔다.
// 기록을 읽은 뒤에 차림이 정해지고, 몸이 오면 입힌다. 무늬 그림은 입을 때 받는다(받는 사이 다른 것을 고르면 늦게 온 그림은 버린다)

/** 되돌리기는 이만큼까지 */
const UNDO_MAX = 30;

/** 옷장을 만들 때 */
export interface WardrobeOptions {
  /** 기록에 차림이 없는 사람(처음 온 사람)에게 아무 차림이나 입혀 둔다 — 꾸미기 씬에서 완성만 눌러도 넘어가게 */
  dressNewcomer: boolean;
  /** 0 이상 1 미만 난수 */
  rand: () => number;
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
  private loader: AssetLoader | null = null;
  /** 무늬 그림 받기(이름마다 한 번 — 실패하면 빼서 다음에 다시) */
  private readonly prints = new Map<string, Promise<THREE.Texture>>();

  constructor(
    private readonly outfit: OutfitUniforms,
    avatar: Avatar,
    private readonly progress: Progress,
    private readonly options: WardrobeOptions,
  ) {
    this.ready = progress.ready.then(() => {
      const saved = progress.save.look;
      if (saved) this.look = { ...saved };
      else if (options.dressNewcomer) {
        this.look = randomLook(options.rand);
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
  useLoader(loader: AssetLoader) {
    this.loader = loader;
    this.applyClothes();
  }

  /** 지금 차림이 받아야 할 에셋 키(첫 화면에 같이 받는다) */
  assetKeys(): string[] {
    return lookAssetKeys(this.look);
  }

  /** 한 탭의 것을 고른다(되돌리기에 남고 기록에 둔다). 이미 입은 것이면 false */
  pick(tab: LookTab, value: string): boolean {
    if (this.look[tab] === value) return false;
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
    this.look = randomLook(this.options.rand);
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
    return this.progress.save.dressed;
  }

  /** 꾸미기 씬을 지났다고 기록한다 */
  markDressed() {
    if (this.progress.save.dressed) return;
    this.progress.save.dressed = true;
    this.progress.commit();
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
      console.error("teum print", name, err);
      this.prints.delete(name);
    });
  }

  private snap() {
    const was = JSON.stringify(this.look);
    this.history.push(was);
    if (this.history.length > UNDO_MAX) this.history.shift();
  }

  private keep() {
    this.progress.save.look = { ...this.look };
    this.progress.commit();
  }
}
