"use client";

import { useActionState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { Event } from "@/lib/validators/event";

type State = { error?: string; values?: Record<string, string> };

// ISO (UTC) -> значение для поля datetime-local по времени Астаны (UTC+5)
function toLocalInput(iso?: string) {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

const fieldClass =
  "w-full rounded-control border border-border bg-white px-3 py-2 outline-none focus:border-primary";

export default function EventForm({
  action,
  event,
  categoryIds,
  submitLabel,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  event?: Event;
  categoryIds: string[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    action,
    {},
  );

  // после ошибки показываем то, что человек уже ввёл
  const v = (name: string, fallback?: string | number) =>
    state.values?.[name] ?? (fallback === undefined ? "" : String(fallback));

  return (
    <form action={formAction} className="max-w-2xl space-y-4">
      {state.error && (
        <p className="rounded-control bg-danger/10 px-4 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-sm font-medium">Название</span>
        <Input name="title" defaultValue={v("title", event?.title)} required />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Описание</span>
        <textarea
          name="description"
          rows={5}
          className={fieldClass}
          defaultValue={v("description", event?.description)}
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Место</span>
        <Input name="location" defaultValue={v("location", event?.location)} required />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Начало</span>
          <input
            type="datetime-local"
            name="startsAt"
            className={fieldClass}
            defaultValue={v("startsAt", toLocalInput(event?.startsAt))}
            required
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Окончание</span>
          <input
            type="datetime-local"
            name="endsAt"
            className={fieldClass}
            defaultValue={v("endsAt", toLocalInput(event?.endsAt))}
            required
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Мест</span>
          <input
            type="number"
            name="capacity"
            min={1}
            className={fieldClass}
            defaultValue={v("capacity", event?.capacity ?? 30)}
            required
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Категория</span>
          <select
            name="categoryId"
            className={fieldClass}
            defaultValue={v("categoryId", event?.categoryId)}
          >
            {categoryIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Статус</span>
          <select
            name="status"
            className={fieldClass}
            defaultValue={v("status", event?.status ?? "PUBLISHED")}
          >
            <option value="PUBLISHED">Опубликовано</option>
            <option value="DRAFT">Черновик</option>
            <option value="CANCELLED">Отменено</option>
            <option value="FINISHED">Завершено</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Ссылка на картинку (необязательно)</span>
        <Input
          name="imageUrl"
          type="url"
          placeholder="https://..."
          defaultValue={v("imageUrl", event?.imageUrl)}
        />
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Сохраняю…" : submitLabel}
      </Button>
    </form>
  );
}