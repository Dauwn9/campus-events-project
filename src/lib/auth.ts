import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROLES, type Role } from "./roles";
import { demoUsers } from "./mocks/demo-users";

export async function getCurrentUser() {
  const store = await cookies();
  const value = store.get("dev-role")?.value;
  const role: Role = ROLES.includes(value as Role) ? (value as Role) : "GUEST";

  // если человек вошёл по логину, берём его имя и id
  const userId = store.get("dev-user")?.value;
  const found = demoUsers.find((u) => u.id === userId && u.role === role);
  if (found) return { id: found.id, name: found.name, role };

  return { id: "dev-user", name: "Тестовый пользователь", role };
}

export async function requireRole(role: Role) {
  const user = await getCurrentUser();
  if (user.role !== role) {
    redirect("/no-access");
  }
  return user;
}