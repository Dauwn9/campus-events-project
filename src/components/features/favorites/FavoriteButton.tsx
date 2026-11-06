"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleFavoriteAction } from "./actions";

// Использование на серверной странице или карточке:
//   const favoriteIds = await getMyFavoriteIds();      // только для студента!
//   <FavoriteButton eventId={event.id} initial={favoriteIds.includes(event.id)} />
export function FavoriteButton({ eventId, initial }: { eventId: string; initial: boolean }) {
  const [active, setOptimistic] = useOptimistic(initial, (_prev, next: boolean) => next);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick(e: React.MouseEvent) {
    e.preventDefault(); // кнопка может лежать внутри ссылки-карточки
    e.stopPropagation();
    setError(null);
    startTransition(async () => {
      setOptimistic(!active); // сердечко меняется сразу; при ошибке вернётся само
      const res = await toggleFavoriteAction(eventId);
      if (!res.ok) setError(res.message);
    });
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={active ? "Убрать из избранного" : "Добавить в избранное"}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl shadow-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className={active ? "text-rose-500" : "text-gray-400"} aria-hidden>
          {active ? "♥" : "♡"}
        </span>
      </button>
      {error && (
        <span role="alert" className="mt-1 max-w-48 text-right text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
