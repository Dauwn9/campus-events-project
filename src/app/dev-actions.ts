"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/roles";
import { demoUsers } from "@/lib/mocks/demo-users";

type LoginState = { error?: string };

export async function setDevRole(role: Role) {
  const store = await cookies();
  store.set("dev-role", role, { path: "/" });
  redirect("/");
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const login = String(formData.get("login") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = demoUsers.find(
    (u) => u.login === login && u.password === password,
  );
  if (!user) return { error: "Неверный логин или пароль" };

  const store = await cookies();
  store.set("dev-role", user.role, { path: "/" });
  store.set("dev-user", user.id, { path: "/" });

  redirect(
    user.role === "ORGANIZER" ? "/organizer" : user.role === "ADMIN" ? "/admin" : "/",
  );
}

export async function logoutAction() {
  const store = await cookies();
  store.delete("dev-role");
  store.delete("dev-user");
  redirect("/");
}