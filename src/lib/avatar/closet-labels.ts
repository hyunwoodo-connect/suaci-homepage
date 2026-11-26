import type { LookTab } from "./outfit";

// 옷장에 쓰는 글자. 꾸미기 씬은 React 밖에서, 놀이마다(언어 묶음이 없는 이벤트 화면에서도) 그려지므로 글자를 사이트의 문구 묶음(messages)이 아니라
// 여기에 언어별로 둔다 — 여는 쪽이 제 화면의 언어로 골라 넘긴다. 영문은 브랜드 규칙대로 모두 소문자

/** 옷장 한 벌의 글자 */
export interface ClosetLabels {
  /** 닫혀 있을 때 화면 구석의 옷장 단추(읽는 이름) */
  wear: string;
  /** 되돌리기·아무거나 단추(읽는 이름), 완성 단추 */
  undo: string;
  shuffle: string;
  done: string;
  /** 무대 위 안내: 밀면 돌아간다 */
  turnTip: string;
  /** 아무것도 끼우지 않는 칸 · 원래 옷으로 두는 칸(읽는 이름) */
  none: string;
  original: string;
  /** 탭 이름 */
  tabs: Readonly<Record<LookTab, string>>;
  /** 칸의 읽는 이름(그림만 보이는 칸이라 화면 읽기 프로그램에 알린다): 무늬·색·부품 키 → 이름 */
  options: Readonly<Record<string, string>>;
}

/** 옷장 글자가 있는 언어 */
type ClosetLocale = "ko" | "en" | "ja";

const LABELS: Readonly<Record<ClosetLocale, ClosetLabels>> = {
  ko: {
    wear: "옷장",
    undo: "되돌리기",
    shuffle: "아무거나",
    done: "완성",
    turnTip: "밀어서 돌려 봐",
    none: "없음",
    original: "원래 옷",
    tabs: {
      top: "윗옷",
      bot: "치마",
      shoe: "신발",
      hair: "머리",
      face: "얼굴",
      ear: "귀",
      hand: "손",
      board: "보드",
    },
    options: {
      daisy: "데이지",
      ditsy: "잔꽃",
      stripe: "줄무늬",
      patch: "패치워크",
      rose: "장미",
      gingham: "깅엄",
      "#2b2e2d": "먹색",
      "#ff5a1f": "주황",
      "#ffd400": "노랑",
      "#1e8fff": "파랑",
      "#a9ff39": "라임",
      "#ff8fbd": "분홍",
      "#ff3d2e": "빨강",
      "#8a5cff": "보라",
      "#b5651d": "갈색",
      hair_bob: "단발",
      scarf: "스카프",
      glass_heart: "하트 선글라스",
      sunglass: "선글라스",
      earring: "귀걸이",
      bouquet: "꽃다발",
      bag: "가방",
      board: "스케이트보드",
    },
  },
  en: {
    wear: "closet",
    undo: "undo",
    shuffle: "surprise me",
    done: "done",
    turnTip: "drag to turn",
    none: "none",
    original: "original",
    tabs: {
      top: "top",
      bot: "skirt",
      shoe: "shoes",
      hair: "hair",
      face: "face",
      ear: "ears",
      hand: "hand",
      board: "board",
    },
    options: {
      daisy: "daisy",
      ditsy: "ditsy floral",
      stripe: "stripes",
      patch: "patchwork",
      rose: "roses",
      gingham: "gingham",
      "#2b2e2d": "ink",
      "#ff5a1f": "orange",
      "#ffd400": "yellow",
      "#1e8fff": "blue",
      "#a9ff39": "lime",
      "#ff8fbd": "pink",
      "#ff3d2e": "red",
      "#8a5cff": "purple",
      "#b5651d": "brown",
      hair_bob: "bob",
      scarf: "head scarf",
      glass_heart: "heart sunglasses",
      sunglass: "sunglasses",
      earring: "earrings",
      bouquet: "bouquet",
      bag: "bag",
      board: "skateboard",
    },
  },
  ja: {
    wear: "クローゼット",
    undo: "元に戻す",
    shuffle: "おまかせ",
    done: "完成",
    turnTip: "スワイプで回せます",
    none: "なし",
    original: "もとの服",
    tabs: {
      top: "トップス",
      bot: "スカート",
      shoe: "シューズ",
      hair: "ヘア",
      face: "フェイス",
      ear: "耳",
      hand: "手",
      board: "ボード",
    },
    options: {
      daisy: "デイジー",
      ditsy: "小花柄",
      stripe: "ストライプ",
      patch: "パッチワーク",
      rose: "ローズ",
      gingham: "ギンガム",
      "#2b2e2d": "ブラック",
      "#ff5a1f": "オレンジ",
      "#ffd400": "イエロー",
      "#1e8fff": "ブルー",
      "#a9ff39": "ライム",
      "#ff8fbd": "ピンク",
      "#ff3d2e": "レッド",
      "#8a5cff": "パープル",
      "#b5651d": "ブラウン",
      hair_bob: "ボブ",
      scarf: "スカーフ",
      glass_heart: "ハートサングラス",
      sunglass: "サングラス",
      earring: "イヤリング",
      bouquet: "ブーケ",
      bag: "バッグ",
      board: "スケートボード",
    },
  },
};

/** 그 언어의 옷장 글자. 글자가 없는 언어면 한국어(놀이는 한국어로 연다) */
export function closetLabels(locale: string): ClosetLabels {
  return Object.hasOwn(LABELS, locale) ? LABELS[locale as ClosetLocale] : LABELS.ko;
}
