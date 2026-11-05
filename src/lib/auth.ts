import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROLES, type Role } from "./roles";
import { readStore } from "./services/demo-store";
import { sessionUser } from "./services/campus";

export async function getCurrentUser() {
  const store = await cookies();
  const session = store.get("campus-session")?.value;
  const signedIn = session ? sessionUser(session) : undefined;
  const value = store.get("dev-role")?.value;
  const role: Role =
    !session &&
    process.env.NEXT_PUBLIC_USE_MOCKS !== "false" &&
    ROLES.includes(value as Role)
      ? (value as Role)
      : "GUEST";
  const id =
    role === "STUDENT"
      ? "student-demo"
      : role === "ORGANIZER"
        ? "org-2"
        : role === "ADMIN"
          ? "admin-demo"
          : "";
  const user =
    signedIn ??
    (id ? readStore().users.find((u) => u.id === id && !u.blocked) : undefined);
  return user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as Role,
        group: user.group,
        school: user.school,
      }
    : {
        id: "",
        name: "Гость",
        email: "",
        role: "GUEST" as Role,
        group: "",
        school: "",
      };
}

export async function requireRole(role: Role) {
  const user = await getCurrentUser();
  if (user.role !== role) {
    redirect("/no-access");
  }
  return user;
}
