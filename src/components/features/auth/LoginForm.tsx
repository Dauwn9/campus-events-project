"use client";

import { useActionState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { loginAction } from "@/app/dev-actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-control bg-danger/10 px-4 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-sm font-medium">Логин</span>
        <Input name="login" autoComplete="username" required />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Пароль</span>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Входим…" : "Войти"}
      </Button>
    </form>
  );
}