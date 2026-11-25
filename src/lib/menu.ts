import type { Role } from "./roles";
import { USE_MOCKS } from "./services/errors";

export const MENU: Record<Role, { label: string; href: string }[]> = {
  GUEST: [
    { label: "Афиша", href: "/" },
    { label: "Войти", href: "/login" },
  ],
  // Друзья и уведомления пока работают только на демо-данных.
  STUDENT: [
    { label: "Афиша", href: "/" },
    ...(USE_MOCKS ? [{ label: "Друзья", href: "/friends" }] : []),
    { label: "Избранное", href: "/favorites" },
    { label: "Мои регистрации", href: "/my-registrations" },
    ...(USE_MOCKS ? [{ label: "Уведомления", href: "/notifications" }] : []),
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