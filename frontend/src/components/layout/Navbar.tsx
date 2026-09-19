"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, BrainCircuit, ChevronDown, Map, Menu, Moon, Sun, X, Settings } from "lucide-react";

type NavItem = { href: string; label: string; description: string; icon: typeof Map };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: "Explore", items: [
    { href: "/map-explorer", label: "Map Explorer", description: "Live GIS telemetry and topology", icon: Map },
  ] },
  { label: "Intelligence", items: [
    { href: "/intelligence", label: "AI Intelligence", description: "Forecasting and root-cause analysis", icon: BrainCircuit },
    { href: "/analytics", label: "Analytics", description: "Grid performance and risk signals", icon: Activity },
  ] },
];

const UTILITY_LINKS = [
  { href: "/documentation", label: "Resources" },
  { href: "/about", label: "About" },
];

export function Navbar({ variant: _variant = "dark" }: { variant?: "light" | "dark" | "transparent" }) {
  void _variant;
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem("gridsense-theme") === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("gridsense-theme", next);
  };
  const isDark = theme === "dark";
  const isCurrent = (href: string) => pathname === href;

  return (
    <header className={`gs-nav fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? "gs-nav-scrolled" : ""}`}>
      <div className="mx-auto flex h-[76px] max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="gs-nav-brand group flex shrink-0 items-center gap-2.5" aria-label="GridSense home">
          <img src="/gridsense-mark.svg" alt="" className="h-9 w-9 rounded-[10px] shadow-[0_0_24px_rgba(34,211,238,.22)] transition-transform duration-300 group-hover:scale-105" />
          <span className="hidden leading-none sm:block"><span className="gs-display block text-[20px] uppercase tracking-[-.06em] text-gs-text-primary">GridSense</span><span className="mt-1 block font-mono text-[8px] font-bold uppercase tracking-[.16em] text-gs-text-muted">Grid intelligence</span></span>
        </Link>
        <nav className="hidden h-full items-center gap-1 xl:flex" aria-label="Main navigation">
          {NAV_GROUPS.map((group) => {
            const active = group.items.some((item) => isCurrent(item.href));
            const open = openGroup === group.label;
            return <div key={group.label} className="relative h-full">
              <button className={`gs-nav-trigger ${active ? "gs-nav-trigger-active" : ""}`} onClick={() => setOpenGroup(open ? null : group.label)} aria-expanded={open}>{group.label}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} /></button>
              {open && <div className="gs-mega-menu"><span className="gs-mega-kicker">{group.label} workspace</span>{group.items.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href} className={`gs-mega-item ${isCurrent(href) ? "gs-mega-item-active" : ""}`} onClick={() => setOpenGroup(null)}><span className="gs-mega-icon"><Icon className="h-4 w-4" strokeWidth={1.8} /></span><span><span className="block text-sm font-semibold text-gs-text-primary">{label}</span><span className="mt-0.5 block text-xs text-gs-text-secondary">{description}</span></span></Link>)}</div>}
            </div>;
          })}
          <span className="mx-2 h-4 w-px bg-gs-border" />
          {UTILITY_LINKS.map((item) => <Link key={item.href} href={item.href} className={`gs-nav-link ${isCurrent(item.href) ? "gs-nav-link-active" : ""}`}>{item.label}</Link>)}
        </nav>
        <div className="ml-auto hidden items-center gap-2 xl:flex"><span className="mr-2 flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[.12em] text-gs-text-secondary"><i className="gs-live-dot" />Network live</span><button onClick={toggleTheme} className="gs-nav-icon" aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}>{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button><Link href="/login" className="gs-nav-login">Operator login</Link><Link href="/admin" className="gs-nav-login inline-flex items-center gap-1"><Settings className="h-3.5 w-3.5" />Admin portal</Link></div>
        <button className="ml-auto grid h-10 w-10 place-items-center text-gs-text-primary xl:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">{mobileOpen ? <X /> : <Menu />}</button>
      </div>
      {mobileOpen && <div className="gs-mobile-menu xl:hidden"><div className="mx-auto grid max-w-[1480px] gap-4 px-4 py-5 sm:px-6">{NAV_GROUPS.map((group) => <div key={group.label}><p className="gs-mega-kicker mb-2">{group.label}</p>{group.items.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className="gs-mega-item"><span className="gs-mega-icon"><Icon className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-gs-text-primary">{label}</span><span className="block text-xs text-gs-text-secondary">{description}</span></span></Link>)}</div>)}<div className="grid grid-cols-2 gap-2 border-t border-gs-border pt-4">{UTILITY_LINKS.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="gs-nav-login text-center">{item.label}</Link>)}<button onClick={toggleTheme} className="gs-nav-login">{isDark ? "Light mode" : "Dark mode"}</button></div></div></div>}
    </header>
  );
}
