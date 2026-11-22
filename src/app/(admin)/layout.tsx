import Link from "next/link";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { requireRole } from "@/lib/auth";
import { logoutAction } from "@/app/campus-actions";
import Icon from "@/components/ui/Icon";
import { USE_MOCKS } from "@/lib/services/errors";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireRole("ADMIN");
  const initials = admin.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="admin-app">
      <header className="admin-topbar">
        <Link href="/" className="admin-brand" aria-label="AIU Campus Events">
          <span className="admin-brand-mark">AIU</span>
          <span className="admin-brand-name">
            Campus Events
            <small>Администрирование</small>
          </span>
        </Link>
        <div className="admin-topbar-actions">
          {USE_MOCKS && <span className="admin-mode-badge">Демо-данные</span>}
          <Link href="/" className="admin-topbar-link">
            <span>Открыть афишу</span>
            <Icon name="arrow" size={14} />
          </Link>
          <div className="admin-user-chip">
            <span className="admin-user-avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="admin-user-details">
              <strong>{admin.name}</strong>
              <small>Администратор</small>
            </span>
          </div>
          <form action={logoutAction}>
            <button className="admin-logout" type="submit">
              Выйти
            </button>
          </form>
        </div>
      </header>
      <div className="admin-shell">
        <AdminSidebar />
        <main className="admin-content workspace" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
