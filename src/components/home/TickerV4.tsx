const ITEMS = [
  "Held steady",
  "One press",
  "Portable calm",
  "50ml",
  "Daily ritual",
];

/**
 * Home v4 티커 — 잉크 띠 무한 마퀴. 디자인 타이포 요소로 EN 고정.
 */
export default function TickerV4() {
  return (
    <div className="tick" aria-hidden="true">
      <div className="tick__t">
        {[0, 1].map((half) =>
          ITEMS.map((item) => <span key={`${half}-${item}`}>{item}</span>),
        )}
      </div>
    </div>
  );
}
