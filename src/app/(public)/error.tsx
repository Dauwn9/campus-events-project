"use client";

import ErrorState from "@/components/ui/ErrorState";

export default function EventsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Не удалось загрузить афишу"
      text="Что-то пошло не так. Попробуйте ещё раз."
      onRetry={reset}
    />
  );
}