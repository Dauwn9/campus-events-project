export const ROLES = ["GUEST", "STUDENT", "ORGANIZER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];
export type AuthenticatedRole = Exclude<Role, "GUEST">;

export function toAppRole(role: string | null | undefined): Role {
  if (role === "USER") return "STUDENT";
  if (role === "STUDENT" || role === "ORGANIZER" || role === "ADMIN") {
    return role;
  }
  return "GUEST";
}