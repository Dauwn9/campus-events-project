"use client";

import Button from "@/components/ui/Button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">
        <p>Не удалось загрузить избранное. {error.message}</p>
        <Button onClick={reset} className="mt-3 min-h-11">
          Повторить
        </Button>
      </div>
    </main>
  );
}
