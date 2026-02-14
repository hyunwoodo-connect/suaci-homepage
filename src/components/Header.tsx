"use client";

import { useState } from "react";
import Link from "next/link";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="text-2xl md:text-3xl font-bold tracking-[0.3em] text-foreground">
            SUACI
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-10">
            <Link
              href="#"
              className="text-sm tracking-[0.15em] text-muted hover:text-foreground transition-colors duration-300"
            >
              SHOP
            </Link>
            <Link
              href="#"
              className="text-sm tracking-[0.15em] text-muted hover:text-foreground transition-colors duration-300"
            >
              BRAND
            </Link>
            <Link
              href="#"
              className="text-sm tracking-[0.15em] text-muted hover:text-foreground transition-colors duration-300"
            >
              COMMUNITY
            </Link>
          </nav>

          {/* Icons */}
          <div className="flex items-center gap-5">
            {/* Search */}
            <button className="hidden md:block text-foreground hover:text-muted transition-colors" aria-label="검색">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>

            {/* User */}
            <button className="hidden md:block text-foreground hover:text-muted transition-colors" aria-label="마이페이지">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>

            {/* Cart */}
            <button className="text-foreground hover:text-muted transition-colors relative" aria-label="장바구니">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span className="absolute -top-1 -right-1.5 bg-foreground text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                0
              </span>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden text-foreground"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="메뉴"
            >
              {menuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-white z-40">
          <nav className="flex flex-col px-6 py-10 gap-8">
            <Link
              href="#"
              onClick={() => setMenuOpen(false)}
              className="text-lg tracking-[0.2em] font-medium text-foreground hover:text-muted transition-colors"
            >
              SHOP
            </Link>
            <Link
              href="#"
              onClick={() => setMenuOpen(false)}
              className="text-lg tracking-[0.2em] font-medium text-foreground hover:text-muted transition-colors"
            >
              BRAND
            </Link>
            <Link
              href="#"
              onClick={() => setMenuOpen(false)}
              className="text-lg tracking-[0.2em] font-medium text-foreground hover:text-muted transition-colors"
            >
              COMMUNITY
            </Link>
            <div className="border-t border-border pt-8 flex flex-col gap-6">
              <Link
                href="#"
                onClick={() => setMenuOpen(false)}
                className="text-sm tracking-[0.15em] text-muted hover:text-foreground transition-colors"
              >
                LOGIN
              </Link>
              <Link
                href="#"
                onClick={() => setMenuOpen(false)}
                className="text-sm tracking-[0.15em] text-muted hover:text-foreground transition-colors"
              >
                JOIN US
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
