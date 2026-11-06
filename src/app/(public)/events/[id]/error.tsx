"use client";

import Link from "next/link";
import ErrorState from "@/components/ui/ErrorState";

export default function EventError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/" className="text-sm text-primary hover:underline">
        ← К афише
      </Link>
      <ErrorState
        title="Не удалось загрузить событие"
        text="Что-то пошло не так. Попробуйте ещё раз."
        onRetry={reset}
      />
    </div>
  );
}