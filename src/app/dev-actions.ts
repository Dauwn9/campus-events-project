"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/roles";

export async function setDevRole(role: Role) {
  const store = await cookies();
  store.set("dev-role", role, { path: "/" });
  redirect("/");
}