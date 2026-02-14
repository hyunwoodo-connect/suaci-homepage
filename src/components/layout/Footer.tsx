import Link from "next/link";
import { SITE, SECTION_PADDING_X } from "@/constants/site";
import { FOOTER_LINK_GROUPS, FOOTER_LEGAL_LINKS } from "@/constants/navigation";

/**
 * 사이트 공통 푸터
 *
 * 구조:
 * - 상단: 브랜드 + 링크 그룹 (4컬럼 그리드)
 * - 하단: 카피라이트 + 법적 링크
 */
export default function Footer() {
  return (
    <footer className="bg-foreground text-white">
      {/* 상단 - 링크 그룹 */}
      <div className={`max-w-[1400px] mx-auto ${SECTION_PADDING_X} py-14 md:py-20`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          {/* 브랜드 */}
          <div className="md:col-span-1">
            <h3 className="text-2xl font-bold tracking-[0.3em] mb-4">
              {SITE.name}
            </h3>
            <p className="text-sm text-white/50 leading-relaxed">
              {SITE.tagline}
            </p>
          </div>

          {/* 링크 그룹들 */}
          {FOOTER_LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="text-xs tracking-[0.2em] font-medium mb-5 text-white/70">
                {group.title}
              </h4>
              <ul className="flex flex-col gap-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/40 hover:text-white transition-colors duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* 하단 - 카피라이트 & 법적 링크 */}
      <div className="border-t border-white/10">
        <div className={`max-w-[1400px] mx-auto ${SECTION_PADDING_X} py-6 flex flex-col md:flex-row items-center justify-between gap-4`}>
          <p className="text-xs text-white/30">{SITE.copyright}</p>
          <div className="flex items-center gap-6">
            {FOOTER_LEGAL_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
