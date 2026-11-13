"use client";

import ErrorState from "@/components/ui/ErrorState";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <ErrorState
        title="Не удалось загрузить избранное"
        text="Проверьте соединение и попробуйте снова."
        onRetry={reset}
      />
    </main>
  );
}
