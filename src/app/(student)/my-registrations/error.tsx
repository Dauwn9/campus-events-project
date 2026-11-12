"use client";

import ErrorState from "@/components/ui/ErrorState";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <ErrorState
        title="Не удалось загрузить ваши записи"
        text="Попробуйте обновить страницу или повторить запрос позже."
        onRetry={reset}
      />
    </main>
  );
}
