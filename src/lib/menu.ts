import type { Role } from "./roles";

export const MENU: Record<Role, { label: string; href: string }[]> = {
  GUEST: [
    { label: "Афиша", href: "/" },
    { label: "Войти", href: "/login" },
  ],
  STUDENT: [
    { label: "Афиша", href: "/" },
    { label: "Избранное", href: "/favorites" },
    { label: "Мои регистрации", href: "/my-registrations" },
    { label: "Профиль", href: "/profile" },
  ],
  ORGANIZER: [
    { label: "Мои события", href: "/organizer" },
    { label: "Создать событие", href: "/organizer/new" },
    { label: "Сканер", href: "/organizer/scanner" },
  ],
  ADMIN: [
    { label: "Модерация", href: "/admin" },
    { label: "Пользователи", href: "/admin/users" },
  ],
};