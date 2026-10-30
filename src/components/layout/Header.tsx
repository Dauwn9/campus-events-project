import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { MENU } from "@/lib/menu";

export default async function Header() {
  const user = await getCurrentUser();
  return (
    <header className="flex items-center gap-6 border-b border-border bg-surface px-6 py-4">
      <span className="font-bold text-primary">Campus Events</span>
      {MENU[user.role].map((item) => (
        <Link key={item.href} href={item.href} className="hover:text-primary">
          {item.label}
        </Link>
      ))}
    </header>
  );
}