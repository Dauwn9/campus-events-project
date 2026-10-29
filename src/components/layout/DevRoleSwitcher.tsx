"use client";

import { ROLES, type Role } from "@/lib/roles";
import { setDevRole } from "@/app/dev-actions";

export default function DevRoleSwitcher({ current }: { current: Role }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-card bg-text p-3 text-sm text-white shadow-modal">
      <div className="mb-2 opacity-70">Dev: роль</div>
      <div className="flex gap-2">
        {ROLES.map((role) => (
          <button
            key={role}
            onClick={() => setDevRole(role)}
            className={`rounded px-2 py-1 ${
              role === current ? "bg-primary" : "bg-white/10"
            }`}
          >
            {role}
          </button>
        ))}
      </div>
    </div>
  );
}