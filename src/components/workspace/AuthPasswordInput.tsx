"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";

type Props = {
  label: string;
  name: string;
  autoComplete: string;
  minLength: number;
  maxLength: number;
};

export default function AuthPasswordInput({
  label,
  name,
  autoComplete,
  minLength,
  maxLength,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      {label}
      <span className="auth-password-field">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon name={visible ? "eyeOff" : "eye"} size={18} />
        </button>
      </span>
    </label>
  );
}
