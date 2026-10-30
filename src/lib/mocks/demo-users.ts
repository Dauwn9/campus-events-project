import type { Role } from "@/lib/roles";

export type DemoUser = {
  id: string;
  name: string;
  login: string;
  password: string;
  role: Exclude<Role, "GUEST">;
};

export const demoUsers: DemoUser[] = [
  {
    id: "user-student",
    name: "Айдана Студентова",
    login: "student",
    password: "student123",
    role: "STUDENT",
  },
  {
    id: "user-organizer",
    name: "Нурлан Организаторов",
    login: "organizer",
    password: "organizer123",
    role: "ORGANIZER",
  },
  {
    id: "user-admin",
    name: "Админ Кампуса",
    login: "admin",
    password: "admin123",
    role: "ADMIN",
  },
];