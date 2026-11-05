"use client";

import { ROLES, type Role } from "@/lib/roles";
import { setDevRole } from "@/app/dev-actions";

export default function DevRoleSwitcher({ current }: { current: Role }) {
  return (
    <details className="dev-role-switcher">
      <summary>Демо · {current} · сменить роль</summary>
      <div className="role-options">
        {ROLES.map((role) => (
          <button
            key={role}
            type="button"
            aria-pressed={role === current}
            onClick={() => setDevRole(role)}
          >
            {role}
          </button>
        ))}
      </div>
    </details>
  );
}
