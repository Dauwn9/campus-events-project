import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { MENU } from "@/lib/menu";
import HeaderNav from "./HeaderNav";
import Icon from "@/components/ui/Icon";
import { logoutAction } from "@/app/campus-actions";

export default async function Header() {
  const user = await getCurrentUser();
  const items = [{ label: "Афиша", href: "/" }, ...MENU[user.role].filter(item => item.href !== "/" && item.href !== "/login")];
  const roleNames = { GUEST: "Гость", STUDENT: "Студент", ORGANIZER: "Организатор", ADMIN: "Администратор" };
  return (
    <header className="site-header">
      <div className="university-bar"><div className="header-container"><span>ASTANA INTERNATIONAL UNIVERSITY</span><a href="https://aiu.kz/?lang=ru" target="_blank" rel="noopener noreferrer">Сайт университета <Icon name="arrow" size={13} /></a></div></div>
      <div className="header-container main-nav">
        <Link href="/" className="brand" aria-label="AIU Campus Events — главная">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/aiu-logo.svg" alt="AIU — Astana International University" width="156" height="48" />
          <span className="brand-divider" /><span className="brand-name">campus<span>events</span></span>
        </Link>
        <HeaderNav items={items} />
        <Link className="header-account" href={user.role === "GUEST" ? "/login" : user.role === "STUDENT" ? "/profile" : user.role === "ORGANIZER" ? "/organizer" : "/admin"}><Icon name="user" size={17} /><span>{user.role === "GUEST" ? "Войти" : roleNames[user.role]}</span><Icon name="chevron" size={14} /></Link>
        {user.role!=="GUEST"&&<form action={logoutAction}><button className="header-logout">Выйти</button></form>}
      </div>
    </header>
  );
}
