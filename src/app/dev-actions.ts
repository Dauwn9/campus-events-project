"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROLES, type Role } from "@/lib/roles";

export async function setDevRole(role: Role) {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === "false" || !ROLES.includes(role)) throw new Error("Демо-роли отключены");
  const store = await cookies();
  store.delete("campus-session");
  store.set("dev-role", role, { path: "/" });
  redirect("/");
}
