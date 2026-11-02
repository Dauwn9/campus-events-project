import Link from "next/link";

const links = [
  { label: "Обзор", href: "/admin" },
  { label: "Модерация", href: "/admin/moderation" },
  { label: "Категории", href: "/admin/categories" },
  { label: "Пользователи", href: "/admin/users" },
];

export default function AdminSidebar() {
  return (
    <aside className="min-h-screen w-56 shrink-0 border-r border-border bg-surface p-4">
      <h2 className="mb-4 font-semibold">Админ-панель</h2>
      <nav aria-label="Навигация администратора" className="space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block rounded-control px-3 py-2 text-sm text-muted hover:bg-primary/10 hover:text-primary"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}