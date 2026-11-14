// 자리마다 고정된 난수: 번호(k)와 갈래(n)로 늘 같은 값을 낸다. 배치를 판마다 같게 두는 데 쓴다(시제품의 fr)

/** 번호 k, 갈래 n 의 고정 난수 — 0..1 */
export function fr(k: number, n: number): number {
  const phase = k * 12.9898 + n * 78.233;
  const x = Math.sin(phase) * 43758.5453;
  return x - Math.floor(x);
}
