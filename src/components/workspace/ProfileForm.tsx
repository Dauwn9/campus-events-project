"use client";

import { useActionState, useState, type FormEvent } from "react";
import {
  isProfileField,
  profileInputSchema,
  type ProfileField,
} from "@/lib/validators/profile";
import {
  profileAction,
  type ProfileActionState,
} from "@/app/campus-actions";

type ProfileValues = {
  name: string;
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
};

const emptyPasswords = {
  currentPassword: "",
  password: "",
  passwordConfirmation: "",
};

export default function ProfileForm({
  initialValues,
  email,
  group,
  school,
}: {
  initialValues: Pick<ProfileValues, "name">;
  email: string;
  group: string;
  school: string;
}) {
  const [values, setValues] = useState<ProfileValues>({
    ...initialValues,
    ...emptyPasswords,
  });
  const [clientErrors, setClientErrors] = useState<
    Partial<Record<ProfileField, string>>
  >({});
  const [editedFields, setEditedFields] = useState<Set<ProfileField>>(
    () => new Set(),
  );
  const [state, formAction, pending] = useActionState(
    async (previousState: ProfileActionState, formData: FormData) => {
      const result = await profileAction(previousState, formData);
      if (result.message) {
        setValues((current) => ({ ...current, ...emptyPasswords }));
      }
      return result;
    },
    {},
  );

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const parsed = profileInputSchema.safeParse({
      name: formData.get("name"),
      currentPassword: formData.get("currentPassword"),
      password: formData.get("password"),
      passwordConfirmation: formData.get("passwordConfirmation"),
    });

    if (parsed.success) {
      setClientErrors({});
      setEditedFields(new Set());
      return;
    }

    event.preventDefault();
    const errors: Partial<Record<ProfileField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (isProfileField(field) && !errors[field]) {
        errors[field] = issue.message;
      }
    }
    setClientErrors(errors);
  }

  function fieldError(field: ProfileField) {
    return (
      clientErrors[field] ??
      (editedFields.has(field) ? undefined : state.fieldErrors?.[field])
    );
  }

  function updateValue(field: keyof ProfileValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setEditedFields((current) => new Set(current).add(field));
    setClientErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  return (
    <form
      action={formAction}
      className="action-form profile-form"
      noValidate
      onSubmit={validateBeforeSubmit}
    >
      <fieldset disabled={pending}>
        <div className="profile-field">
          <label htmlFor="profile-name">Имя и фамилия</label>
          <input
            id="profile-name"
            name="name"
            value={values.name}
            minLength={2}
            maxLength={80}
            aria-invalid={Boolean(fieldError("name"))}
            aria-describedby={
              fieldError("name") ? "profile-name-error" : undefined
            }
            onChange={(event) => updateValue("name", event.target.value)}
          />
          {fieldError("name") && (
            <p id="profile-name-error" className="field-error" role="alert">
              {fieldError("name")}
            </p>
          )}
        </div>

        <div className="profile-field">
          <label htmlFor="profile-email">Email</label>
          <input id="profile-email" value={email} disabled readOnly />
        </div>

        <div className="profile-field">
          <label htmlFor="profile-group">Учебная группа</label>
          <input
            id="profile-group"
            value={group || "Не указана — обратитесь к администратору"}
            disabled
            readOnly
          />
        </div>

        <div className="profile-field">
          <label htmlFor="profile-school">Высшая школа</label>
          <input id="profile-school" value={school} disabled readOnly />
        </div>

        <div className="form-section">
          <h3>Изменить пароль</h3>
          <p>
            Оставьте все поля пароля пустыми, чтобы сохранить текущий пароль.
            Новый пароль: 8–128 символов, минимум одна буква и одна цифра.
          </p>
        </div>

        <div className="profile-field">
          <label htmlFor="profile-current-password">Текущий пароль</label>
          <input
            id="profile-current-password"
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            maxLength={128}
            value={values.currentPassword}
            aria-invalid={Boolean(fieldError("currentPassword"))}
            aria-describedby={
              fieldError("currentPassword")
                ? "profile-current-password-error"
                : undefined
            }
            onChange={(event) =>
              updateValue("currentPassword", event.target.value)
            }
          />
          {fieldError("currentPassword") && (
            <p
              id="profile-current-password-error"
              className="field-error"
              role="alert"
            >
              {fieldError("currentPassword")}
            </p>
          )}
        </div>

        <div className="profile-field">
          <label htmlFor="profile-new-password">Новый пароль</label>
          <input
            id="profile-new-password"
            type="password"
            name="password"
            autoComplete="new-password"
            maxLength={128}
            value={values.password}
            aria-invalid={Boolean(fieldError("password"))}
            aria-describedby={
              fieldError("password") ? "profile-password-error" : undefined
            }
            onChange={(event) => updateValue("password", event.target.value)}
          />
          {fieldError("password") && (
            <p id="profile-password-error" className="field-error" role="alert">
              {fieldError("password")}
            </p>
          )}
        </div>

        <div className="profile-field">
          <label htmlFor="profile-password-confirmation">
            Повторите новый пароль
          </label>
          <input
            id="profile-password-confirmation"
            type="password"
            name="passwordConfirmation"
            autoComplete="new-password"
            maxLength={128}
            value={values.passwordConfirmation}
            aria-invalid={Boolean(fieldError("passwordConfirmation"))}
            aria-describedby={
              fieldError("passwordConfirmation")
                ? "profile-password-confirmation-error"
                : undefined
            }
            onChange={(event) =>
              updateValue("passwordConfirmation", event.target.value)
            }
          />
          {fieldError("passwordConfirmation") && (
            <p
              id="profile-password-confirmation-error"
              className="field-error"
              role="alert"
            >
              {fieldError("passwordConfirmation")}
            </p>
          )}
        </div>

        <button className="workspace-button">Сохранить профиль</button>
      </fieldset>
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
