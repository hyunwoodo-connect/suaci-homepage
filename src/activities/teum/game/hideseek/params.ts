// 숨바꼭질 시험판의 주소 인자. 오너가 미리 보기(운영 빌드)에서 폰으로 바꿔 가며 보므로 debug.ts 와 달리 운영에서도 읽는다.
//   ?hide=1·2·3… 상자를 숨길 물건을 고르는 씨앗(같은 수면 같은 물건, 판마다 하나씩 더한다 — 없으면 놀이 난수) ·
//   ?level=0 맨 처음 판처럼(쉬운 패턴) · 1·2 그 뒤 판처럼(없으면 이 기기에서 처음 하는 판인지로 정한다) ·
//   ?look=1 멈춰서 둘러보기 · ?debug 끝 화면에 잰 값

/** 골라 본 숨길 물건 씨앗(1 부터). 없거나 잘못된 값이면 null */
export function hideSet(search: string = location.search): number | null {
  const raw = new URLSearchParams(search).get("hide");
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/** 골라 본 판 단계(0 맨 처음 판 · 1·2 그 뒤). 없거나 잘못된 값이면 null */
export function forcedLevel(search: string = location.search): number | null {
  const raw = new URLSearchParams(search).get("level");
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 2 ? n : null;
}

/** 멈춰서 둘러보기를 켰나(?look=1) */
export function isLookAround(search: string = location.search): boolean {
  return new URLSearchParams(search).get("look") === "1";
}

/** 끝 화면에 잰 값을 보이나(?debug) */
export function isStatsShown(search: string = location.search): boolean {
  return new URLSearchParams(search).has("debug");
}

/**
 * 빌드 표시(?debug 화면 구석): 커밋 앞 7자와 빌드 시각(한국 시간) — 지금 어느 빌드를 보고 있는지 서로 알 수 있게.
 * 값은 빌드할 때 next.config 가 넣는다(없으면 로컬 개발)
 */
export function buildStamp(
  commit: string | undefined = process.env.NEXT_PUBLIC_BUILD_COMMIT,
  builtAt: string | undefined = process.env.NEXT_PUBLIC_BUILD_TIME,
): string {
  const name = commit || "local";
  if (!builtAt) return name;
  const kstMs = Date.parse(builtAt) + 9 * 3600e3,
    kst = new Date(kstMs).toISOString(),
    day = kst.slice(5, 10),
    clock = kst.slice(11, 16);
  return `${name} · ${day} ${clock} KST`;
}
