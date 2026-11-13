"use client";
import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/campus-actions";
export default function ActionForm({
  action,
  children,
  className = "",
  confirm,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  confirm?: string | ((form: FormData) => string | undefined);
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      onReset={(event) => event.preventDefault()}
      action={formAction}
      className={`action-form ${className}`}
      onSubmit={(event) => {
        const message =
          typeof confirm === "function"
            ? confirm(new FormData(event.currentTarget))
            : confirm;
        if (message && !window.confirm(message)) event.preventDefault();
      }}
    >
      <fieldset disabled={pending}>{children}</fieldset>
      {pending && (
        <p className="form-pending" role="status">
          Сохраняем…
        </p>
      )}
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="form-success" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
