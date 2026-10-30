export const ROLES = ["GUEST", "STUDENT", "ORGANIZER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];