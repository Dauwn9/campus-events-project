"use client";

import ErrorState from "@/components/ui/ErrorState";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <ErrorState
        title="Не удалось загрузить профиль"
        text="Пожалуйста, попробуйте ещё раз позже."
        onRetry={reset}
      />
    </main>
  );
}
