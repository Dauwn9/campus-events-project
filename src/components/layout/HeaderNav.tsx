"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export default function HeaderNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return <nav className="header-nav" aria-label="Основная навигация">{items.map(item => {
    const active = item.href === "/" ? pathname === "/" || pathname.startsWith("/events/") : pathname === item.href || (item.href !== "/admin" && item.href !== "/organizer" && pathname.startsWith(`${item.href}/`));
    return <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>{item.label}</Link>;
  })}</nav>;
}
