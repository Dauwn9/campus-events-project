import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROLES, type Role } from "./roles";

export async function getCurrentUser() {
  const store = await cookies();
  const value = store.get("dev-role")?.value;
  const role: Role = ROLES.includes(value as Role) ? (value as Role) : "GUEST";
  return { id: "dev-user", name: "Тестовый пользователь", role };
}

export async function requireRole(role: Role) {
  const user = await getCurrentUser();
  if (user.role !== role) {
    redirect("/no-access");
  }
  return user;
}