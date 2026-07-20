/**
 * Home v4 푸터 — 아웃라인 스트로크 워드마크 + Index/Contact 컬럼.
 * 링크 라벨은 디자인 타이포 요소로 EN 고정.
 */
export default function FooterV4() {
  return (
    <>
      <div className="cell ft-mark">suaci</div>
      <div className="cell ft-col ftc1">
        <h4>Index</h4>
        <a href="#product">Product</a>
        <a href="#moments">Moments</a>
        <a href="#story">Story</a>
        <a href="#order">Waitlist</a>
      </div>
      <div className="cell ft-col ftc2">
        <h4>Contact</h4>
        <a href="#">Instagram</a>
        <a href="#">Newsletter</a>
        <a href="mailto:hello@suaci.com">hello@suaci.com</a>
      </div>
      <div className="cell ft-bottom">
        <span>© 2026 SUACI — Calm your skin, wherever you are.</span>
        <span>Made for the middle of the day.</span>
      </div>
    </>
  );
}
