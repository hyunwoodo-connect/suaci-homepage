const KEY = "suaci_device";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** localStorage가 막힌 브라우저(사생활 보호 모드 등)에서 이 탭이 쓰는 값 */
let memory: string | null = null;

function readStored(): string | null {
  try {
    const value = localStorage.getItem(KEY);
    return value && UUID_V4.test(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * 이 기기의 익명 토큰(UUID v4). 백엔드는 `X-Device-Token`으로 받아 해시만 저장한다 — 내 거·리본·한도의 기준.
 * 한 번 만들면 그대로 쓴다. 저장이 막히면 탭이 살아 있는 동안 메모리 값을 쓴다.
 */
export function getDeviceToken(): string {
  if (memory) return memory;
  const stored = readStored();
  if (stored) {
    memory = stored;
    return stored;
  }
  const token = crypto.randomUUID();
  memory = token;
  try {
    localStorage.setItem(KEY, token);
  } catch {}
  return token;
}
