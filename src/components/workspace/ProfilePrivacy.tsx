"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import {
  updateProfilePrivacyAction,
  type ActionState,
} from "@/app/campus-actions";

export default function ProfilePrivacy({
  userId,
  initialPrivate,
}: {
  userId: string;
  initialPrivate: boolean;
}) {
  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateProfilePrivacyAction,
    {},
  );
  const profilePath = `/users/${userId}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        new URL(profilePath, window.location.origin).toString(),
      );
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="profile-privacy">
      {/* Без <form action>: React 19 сбрасывает такую форму после действия,
          и галочка визуально возвращалась бы в исходное положение. */}
      <div>
        <fieldset disabled={pending}>
          <label className="profile-privacy-toggle">
            <input
              type="checkbox"
              name="profilePrivate"
              checked={isPrivate}
              onChange={(event) => {
                const next = event.target.checked;
                setIsPrivate(next);
                const formData = new FormData();
                if (next) formData.set("profilePrivate", "on");
                startTransition(() => action(formData));
              }}
            />
            <span>Закрытый профиль</span>
          </label>
          <p className="profile-privacy-hint">
            {isPrivate
              ? "Другие пользователи видят только ваше имя."
              : "Другие пользователи видят ваше имя, группу, статус и предстоящие события."}
          </p>
        </fieldset>
        {state.error && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}
        {state.message && !pending && (
          <p className="form-success" role="status">
            {state.message}
          </p>
        )}
      </div>
      <div className="profile-privacy-links">
        <Link className="workspace-button secondary" href={profilePath}>
          Как меня видят другие
        </Link>
        <button type="button" className="workspace-button secondary" onClick={copyLink}>
          {copied === "done" ? "Ссылка скопирована" : "Скопировать ссылку"}
        </button>
        {copied === "failed" && (
          <p className="form-error" role="alert">
            Не удалось скопировать. Ссылка: {profilePath}
          </p>
        )}
      </div>
    </div>
  );
}
