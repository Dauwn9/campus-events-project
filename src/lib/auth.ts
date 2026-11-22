import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import {
  toAppRole,
  type AuthenticatedRole,
  type Role,
} from "@/lib/roles";

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  group: string;
  school: string;
};

const guest: CurrentUser = {
  id: "",
  name: "Гость",
  email: "",
  role: "GUEST",
  group: "",
  school: "",
};

export async function getCurrentUser(): Promise<CurrentUser> {
  const { auth } = await import("@/lib/better-auth");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return guest;

  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      group: true,
      school: true,
      blocked: true,
      blockedUntil: true,
    },
  });
  if (
    !user ||
    (user.blocked &&
      (!user.blockedUntil || user.blockedUntil.getTime() > Date.now()))
  ) {
    return guest;
  }

  const role = toAppRole(user.role);
  if (role === "GUEST") return guest;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    group: user.group ?? "",
    school: user.school ?? "",
  };
}

export async function requireRole(role: Role) {
  const user = await getCurrentUser();
  if (user.role === "GUEST") redirect("/login");
  if (user.role !== role) redirect("/no-access");
  return user;
}

export async function requireAnyRole(
  ...roles: AuthenticatedRole[]
): Promise<Omit<CurrentUser, "role"> & { role: AuthenticatedRole }> {
  const user = await getCurrentUser();
  const role = user.role;
  if (role === "GUEST") redirect("/login");
  if (!roles.includes(role)) redirect("/no-access");
  return { ...user, role };
}
