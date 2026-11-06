"use client";

import { useState, useTransition } from "react";
import { cancelAction } from "./actions";

export function CancelButton({
  registrationId,
  eventId,
  label = "Отменить запись",
}: {
  registrationId: string;
  eventId: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await cancelAction(registrationId, eventId);
            if (!res.ok) setError(res.message);
          })
        }
        className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
      >
        {pending ? "Отменяем…" : label}
      </button>
      {error && (
        <span role="alert" className="ml-2 text-sm text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
