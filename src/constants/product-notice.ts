import type { Locale } from "@/i18n/routing";

import { BUSINESS } from "./site";

/**
 * 상품정보제공 고시 '화장품' 11개 항목(공정위 「전자상거래 등에서의 상품 등의 정보제공에 관한 고시」 Ⅲ.1 (18)) — 값은 여기 한 곳.
 * 근거·값 출처: suaci-docs `research/2026-11-09-product-info-notice-cosmetics.md`(항목·문안), 사내 안전·표시 문서(주의사항).
 * 항목 이름은 메시지 `home.product.notice.{key}`. 영어·일본어는 번역이고 한국어가 법적 기준(국내 판매).
 * 값을 아직 정하지 못한 칸은 `value: null` 과 사유(`pending`)를 둔다 — 고시 Ⅱ.3(줄 수 없는 정보는 사유를 적는다). 임의 값을 넣지 않는다.
 *   사용기한: 제조사 안정성 자료·입고 뒤(고시 Ⅱ.4 — 보유 재고 중 가장 빠른 날짜로 적어도 된다)
 *   사용방법: 포장 표시 문구 확정 뒤(진시우) — 같은 글이 제품 섹션 '사용법' 칸에도 보인다
 *   제조업자 상호·주소·제조국: 제조사 서면 확인 뒤(#305)
 * 출시(1/5) 전에 `pending` 이 하나도 없어야 한다.
 */

type Localized = Readonly<Record<Locale, string>>;

/** 고시 한 칸 — 값이 있거나, 없으면 그 사유 */
export interface ProductNoticeRow {
  key: ProductNoticeKey;
  value: Localized | null;
  /** 값이 없을 때 손님에게 보이는 사유(고시 Ⅱ.3) */
  pending?: Localized;
}

/** 고시 항목 순서(원문 순서) */
export const PRODUCT_NOTICE_KEYS = [
  "volume",
  "spec",
  "expiry",
  "usage",
  "maker",
  "origin",
  "ingredients",
  "functional",
  "caution",
  "quality",
  "contact",
] as const;

/** 고시 칸 이름 */
export type ProductNoticeKey = (typeof PRODUCT_NOTICE_KEYS)[number];

const AFTER_STOCK: Localized = {
  ko: "상품 입고 후 표시 예정",
  en: "to be listed once the product is in stock",
  ja: "入荷後に表示予定",
};

const AFTER_MAKER: Localized = {
  ko: "제조사 확인 후 표시 예정",
  en: "to be listed once confirmed by the manufacturer",
  ja: "製造元の確認後に表示予定",
};

const CONTACT = `${BUSINESS.phone} · ${BUSINESS.email}`;

/** 고시 값 — 바뀌면 이 표의 글자만 고친다 */
export const PRODUCT_NOTICE: Readonly<Record<ProductNoticeKey, ProductNoticeRow>> = {
  volume: { key: "volume", value: { ko: "100 ml", en: "100 ml", ja: "100 ml" } },
  // 피부 타입은 구분하지 않는다 — '모든 피부'는 자극 시험을 마치기 전에는 쓰지 않는다(사내 안전·표시 문서 C절)
  spec: {
    key: "spec",
    value: {
      ko: "제형: 씻어내지 않는 페이셜 세럼 미스트 · 향: 라임·바질 · 색상: 해당 없음(색조 제품 아님)",
      en: "type: leave-on facial serum mist · scent: lime & basil · shade: not applicable (not a color cosmetic)",
      ja: "タイプ：洗い流さないフェイシャルセラムミスト・香り：ライム・バジル・色：該当なし（色物ではありません）",
    },
  },
  expiry: { key: "expiry", value: null, pending: AFTER_STOCK },
  usage: {
    key: "usage",
    value: null,
    pending: {
      ko: "포장 표시 문구 확정 후 표시 예정",
      en: "to be listed once the package text is final",
      ja: "パッケージ表示の確定後に表示予定",
    },
  },
  // 주소는 사업자 표시와 같은 상수 — 사무실을 옮기면(#261) 한 곳만 바뀐다
  maker: {
    key: "maker",
    value: {
      ko: `화장품책임판매업자: ${BUSINESS.name} (화장품책임판매업 ${BUSINESS.cosmeticsNo}), ${BUSINESS.address}\n화장품제조업자: ${AFTER_MAKER.ko}`,
      en: `responsible seller: suaci (${BUSINESS.name}, cosmetics responsible seller ${BUSINESS.cosmeticsNo}), ${BUSINESS.address}\nmanufacturer: ${AFTER_MAKER.en}`,
      ja: `化粧品責任販売業者：スアシ（${BUSINESS.name}、化粧品責任販売業 ${BUSINESS.cosmeticsNo}）、${BUSINESS.address}\n化粧品製造業者：${AFTER_MAKER.ja}`,
    },
  },
  origin: { key: "origin", value: null, pending: AFTER_MAKER },
  ingredients: {
    key: "ingredients",
    value: {
      ko: "‘전성분’ 항목에 모두 적었어요.",
      en: "listed in full under ‘ingredients’.",
      ja: "「全成分」にすべて記載しています。",
    },
  },
  functional: {
    key: "functional",
    value: {
      ko: "해당 없음(일반 화장품)",
      en: "not applicable (general cosmetic)",
      ja: "該当なし（一般化粧品）",
    },
  },
  // 사내 안전·표시 문서의 공통 주의사항 문안 그대로 + 분사형 권장 추가 한 줄
  caution: {
    key: "caution",
    value: {
      ko: "1. 화장품 사용 시 또는 사용 후 직사광선에 의하여 사용 부위가 붉은 반점, 부어오름 또는 가려움증 등의 이상 증상이나 부작용이 있는 경우 전문의 등과 상담할 것\n2. 상처가 있는 부위 등에는 사용을 자제할 것\n3. 보관 및 취급 시의 주의사항: 가) 어린이의 손이 닿지 않는 곳에 보관할 것 나) 직사광선을 피해서 보관할 것\n4. 눈에 들어가지 않도록 눈을 감고 20~30cm 거리에서 분사할 것",
      en: "1. if redness, swelling, itching or other irritation appears on the area during or after use, including from direct sunlight, consult a dermatologist.\n2. avoid using on broken or wounded skin.\n3. storage: a) keep out of reach of children. b) keep away from direct sunlight.\n4. close your eyes and spray from 20–30 cm away so it doesn't get into your eyes.",
      ja: "1. 使用中または使用後に直射日光などで使用部位に赤み・腫れ・かゆみなどの異常や副作用が出た場合は、専門医などに相談してください。\n2. 傷のある部位などへの使用はお控えください。\n3. 保管・取り扱い上の注意：ア）お子さまの手の届かない所に保管してください。イ）直射日光を避けて保管してください。\n4. 目に入らないよう、目を閉じて20〜30cm離して吹きかけてください。",
    },
  },
  // 배송·교환·환불 안내(환불 정책 v2)와 같은 기간 — 둘이 어긋나면 약관 쪽을 기준으로 맞춘다
  quality: {
    key: "quality",
    value: {
      ko: "제품 하자(파손·누액·오배송·상품 설명과 다른 경우)는 받은 날부터 3개월(안 날부터 30일) 안에 교환 또는 환불해 드리며, 그 밖의 소비자 피해는 소비자분쟁해결기준(공정거래위원회 고시)에 따라 보상합니다.",
      en: "defects (damage, leaks, wrong item, or not as described) are exchanged or refunded within 3 months of delivery (30 days from when you notice). other consumer damage is compensated under the consumer dispute resolution standards (korea fair trade commission notice).",
      ja: "製品の不具合（破損・液漏れ・誤配送・説明と異なる場合）は、受け取った日から3か月（気づいた日から30日）以内に交換または返金し、その他の消費者被害は消費者紛争解決基準（韓国公正取引委員会告示）に基づき補償します。",
    },
  },
  contact: { key: "contact", value: { ko: CONTACT, en: CONTACT, ja: CONTACT } },
};

/** 이 언어로 보일 고시 표 — 값이 없으면 사유 글 */
export function productNoticeRows(
  locale: Locale,
): { key: ProductNoticeKey; text: string; isPending: boolean }[] {
  return PRODUCT_NOTICE_KEYS.map((key) => {
    const row = PRODUCT_NOTICE[key];
    const text = row.value?.[locale] ?? row.pending?.[locale] ?? "";
    return { key, text, isPending: row.value === null };
  });
}

/** 사용방법 글 — 정해지기 전에는 null(제품 섹션 '사용법' 칸을 숨긴다) */
export function usageText(locale: Locale): string | null {
  return PRODUCT_NOTICE.usage.value?.[locale] ?? null;
}
