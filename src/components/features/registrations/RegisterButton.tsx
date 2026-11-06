"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import type { EventRegistrationState } from "@/lib/validators/registration";
import { cancelAction, registerAction } from "./actions";

// На странице события (серверной) :
//   const state = await getEventRegistrationState(event.id);
//   <RegisterButton state={state} />
export function RegisterButton({ state }: { state: EventRegistrationState }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => ReturnType<typeof registerAction>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.message);
    });

  const opensAt = state.opensAt
    ? new Date(state.opensAt).toLocaleString("ru-RU", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const main: { label: string; busy: string; disabled: boolean } | null = {
    CAN_REGISTER: { label: "Записаться", busy: "Записываем…", disabled: false },
    PRIORITY_REGISTER: { label: "Приоритетная запись", busy: "Записываем…", disabled: false },
    JOIN_WAITLIST: { label: "Встать в очередь", busy: "Добавляем…", disabled: false },
    NOT_OPEN_YET: { label: `Запись откроется ${opensAt}`, busy: "", disabled: true },
    FULL: { label: "Мест нет", busy: "", disabled: true },
    PAST: { label: "Прошло", busy: "", disabled: true },
    REGISTERED: null,
    WAITLISTED: null,
  }[state.state];

  const base =
    "w-full min-h-11 rounded-lg px-4 py-2 font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed";

  const mine = state.myRegistration;

  return (
    <div className="space-y-2">
      {main ? (
        <Button
          type="button"
          disabled={main.disabled || pending}
          onClick={() => run(() => registerAction(state.eventId))}
          className="min-h-11 w-full font-medium disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {pending ? main.busy : main.label}
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="min-h-11 rounded-lg bg-emerald-50 px-4 py-2 text-center font-medium text-emerald-700">
            {state.state === "REGISTERED" ? "Вы записаны" : "Вы в очереди"}
          </div>
          {mine && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => cancelAction(mine.id, state.eventId))}
              className={`${base} border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60`}
            >
              {pending ? "Отменяем…" : state.state === "REGISTERED" ? "Отменить запись" : "Выйти из очереди"}
            </button>
          )}
        </div>
      )}

      <p className="text-center text-sm text-gray-600">
        Свободно мест: {Math.max(0, state.seatsTotal - state.seatsTaken)} из {state.seatsTotal}
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
