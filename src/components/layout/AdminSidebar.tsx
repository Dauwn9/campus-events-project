"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";

const links = [
  { label: "Обзор", href: "/admin", icon: "grid" },
  { label: "Модерация", href: "/admin/moderation", icon: "eye" },
  { label: "Архив событий", href: "/admin/archive", icon: "calendar" },
  { label: "Категории", href: "/admin/categories", icon: "list" },
  { label: "Пользователи", href: "/admin/users", icon: "people" },
  { label: "История изменений", href: "/admin/history", icon: "clock" },
] as const;

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <p className="admin-sidebar-label">Рабочее пространство</p>
      <nav aria-label="Навигация администратора">
        {links.map((link) => {
          const active =
            link.href === "/admin"
              ? pathname === link.href
              : pathname?.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className="admin-sidebar-link"
              aria-current={active ? "page" : undefined}
            >
              <Icon name={link.icon} size={17} />
              <span>{link.label}</span>
              {active && <span className="admin-sidebar-indicator" />}
            </Link>
          );
        })}
      </nav>
      <div className="admin-sidebar-footer">
        <span className="admin-sidebar-footer-mark">AIU</span>
        <span>Campus Events</span>
      </div>
    </aside>
  );
}
