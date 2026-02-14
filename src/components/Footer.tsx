import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-foreground text-white">
      {/* Upper Footer */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-14 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <h3 className="text-2xl font-bold tracking-[0.3em] mb-4">SUACI</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Your brand, your story.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-xs tracking-[0.2em] font-medium mb-5 text-white/70">
              SHOP
            </h4>
            <ul className="flex flex-col gap-3">
              <li>
                <Link href="#" className="text-sm text-white/40 hover:text-white transition-colors duration-300">
                  All Products
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-white/40 hover:text-white transition-colors duration-300">
                  Best Sellers
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-white/40 hover:text-white transition-colors duration-300">
                  New Arrivals
                </Link>
              </li>
            </ul>
          </div>

          {/* Brand */}
          <div>
            <h4 className="text-xs tracking-[0.2em] font-medium mb-5 text-white/70">
              BRAND
            </h4>
            <ul className="flex flex-col gap-3">
              <li>
                <Link href="#" className="text-sm text-white/40 hover:text-white transition-colors duration-300">
                  Brand Story
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-white/40 hover:text-white transition-colors duration-300">
                  Membership
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-xs tracking-[0.2em] font-medium mb-5 text-white/70">
              SUPPORT
            </h4>
            <ul className="flex flex-col gap-3">
              <li>
                <Link href="#" className="text-sm text-white/40 hover:text-white transition-colors duration-300">
                  Notice
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-white/40 hover:text-white transition-colors duration-300">
                  Q&A
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-white/40 hover:text-white transition-colors duration-300">
                  Review
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="border-t border-white/10">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            © 2025 SUACI. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-xs text-white/30 hover:text-white/60 transition-colors">
              이용약관
            </Link>
            <Link href="#" className="text-xs text-white/30 hover:text-white/60 transition-colors">
              개인정보처리방침
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
