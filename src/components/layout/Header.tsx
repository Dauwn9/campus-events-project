import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { MENU } from "@/lib/menu";
import { logoutAction } from "@/app/dev-actions";

export default async function Header() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-3">
        <Link href="/" className="mr-6 text-xl font-extrabold text-primary">
          Campus<span className="text-accent">Events</span>
        </Link>

        {MENU[user.role].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full px-4 py-2 text-sm font-medium text-muted transition hover:bg-primary/10 hover:text-primary"
          >
            {item.label}
          </Link>
        ))}

        {user.role !== "GUEST" && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted">{user.name}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-primary/10 hover:text-primary"
              >
                Выйти
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}