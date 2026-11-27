"use client";

import { useActionState, useState, type FormEvent } from "react";
import {
  isProfileField,
  passwordChangeInputSchema,
  profileNameInputSchema,
  type ProfileField,
} from "@/lib/validators/profile";
import {
  changeProfilePasswordAction,
  updateProfileNameAction,
  type ProfileActionState,
} from "@/app/campus-actions";

type PasswordValues = {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
};

const emptyPasswords: PasswordValues = {
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
  initialValues: { name: string };
  email: string;
  group: string;
  school: string;
}) {
  const [name, setName] = useState(initialValues.name);
  const [passwords, setPasswords] = useState(emptyPasswords);
  const [nameErrors, setNameErrors] = useState<
    Partial<Record<ProfileField, string>>
  >({});
  const [passwordErrors, setPasswordErrors] = useState<
    Partial<Record<ProfileField, string>>
  >({});
  const [editedName, setEditedName] = useState(false);
  const [editedPasswords, setEditedPasswords] = useState<
    Partial<Record<ProfileField, boolean>>
  >({});

  const [nameState, nameAction, namePending] = useActionState(
    async (previousState: ProfileActionState, formData: FormData) => {
      const result = await updateProfileNameAction(previousState, formData);
      if (result.message) setName(String(formData.get("name") ?? "").trim());
      return result;
    },
    {},
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    async (previousState: ProfileActionState, formData: FormData) => {
      const result = await changeProfilePasswordAction(
        previousState,
        formData,
      );
      if (result.message) {
        setPasswords(emptyPasswords);
        setEditedPasswords({});
      }
      return result;
    },
    {},
  );

  function validateName(event: FormEvent<HTMLFormElement>) {
    const parsed = profileNameInputSchema.safeParse({
      name: new FormData(event.currentTarget).get("name"),
    });
    if (parsed.success) {
      setNameErrors({});
      setEditedName(false);
      return;
    }

    event.preventDefault();
    const issue = parsed.error.issues[0];
    setNameErrors({ name: issue.message });
  }

  function validatePassword(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const parsed = passwordChangeInputSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      password: formData.get("password"),
      passwordConfirmation: formData.get("passwordConfirmation"),
    });
    if (parsed.success) {
      setPasswordErrors({});
      setEditedPasswords({});
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
    setPasswordErrors(errors);
  }

  function fieldError(
    field: ProfileField,
    errors: Partial<Record<ProfileField, string>>,
    state: ProfileActionState,
    edited: boolean,
  ) {
    return errors[field] ?? (edited ? undefined : state.fieldErrors?.[field]);
  }

  function updatePassword(field: keyof PasswordValues, value: string) {
    setPasswords((current) => ({ ...current, [field]: value }));
    setEditedPasswords((current) => ({ ...current, [field]: true }));
    setPasswordErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  const nameError = fieldError("name", nameErrors, nameState, editedName);
  const currentPasswordError = fieldError(
    "currentPassword",
    passwordErrors,
    passwordState,
    Boolean(editedPasswords.currentPassword),
  );
  const newPasswordError = fieldError(
    "password",
    passwordErrors,
    passwordState,
    Boolean(editedPasswords.password),
  );
  const confirmationError = fieldError(
    "passwordConfirmation",
    passwordErrors,
    passwordState,
    Boolean(editedPasswords.passwordConfirmation),
  );

  return (
    <div className="action-form profile-form">
      <form action={nameAction} noValidate onSubmit={validateName}>
        <fieldset disabled={namePending}>
          <div className="profile-field">
            <label htmlFor="profile-name">Имя и фамилия</label>
            <input
              id="profile-name"
              name="name"
              value={name}
              required
              minLength={2}
              maxLength={50}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "profile-name-error" : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setEditedName(true);
                setNameErrors({});
              }}
            />
            {nameError && (
              <p id="profile-name-error" className="field-error" role="alert">
                {nameError}
              </p>
            )}
          </div>
          <button className="workspace-button">Сохранить имя</button>
        </fieldset>
        {namePending && (
          <p className="form-pending" role="status">
            Сохраняем…
          </p>
        )}
        {nameState.error && (
          <p className="form-error" role="alert">
            {nameState.error}
          </p>
        )}
        {nameState.message && (
          <p className="form-success" role="status">
            {nameState.message}
          </p>
        )}
      </form>

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

      <form action={passwordAction} noValidate onSubmit={validatePassword}>
        <fieldset disabled={passwordPending}>
          <div className="form-section">
            <h3>Изменить пароль</h3>
            <p>
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
              required
              maxLength={128}
              value={passwords.currentPassword}
              aria-invalid={Boolean(currentPasswordError)}
              aria-describedby={
                currentPasswordError
                  ? "profile-current-password-error"
                  : undefined
              }
              onChange={(event) =>
                updatePassword("currentPassword", event.target.value)
              }
            />
            {currentPasswordError && (
              <p
                id="profile-current-password-error"
                className="field-error"
                role="alert"
              >
                {currentPasswordError}
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
              required
              minLength={8}
              maxLength={128}
              value={passwords.password}
              aria-invalid={Boolean(newPasswordError)}
              aria-describedby={
                newPasswordError ? "profile-password-error" : undefined
              }
              onChange={(event) =>
                updatePassword("password", event.target.value)
              }
            />
            {newPasswordError && (
              <p id="profile-password-error" className="field-error" role="alert">
                {newPasswordError}
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
              required
              maxLength={128}
              value={passwords.passwordConfirmation}
              aria-invalid={Boolean(confirmationError)}
              aria-describedby={
                confirmationError
                  ? "profile-password-confirmation-error"
                  : undefined
              }
              onChange={(event) =>
                updatePassword("passwordConfirmation", event.target.value)
              }
            />
            {confirmationError && (
              <p
                id="profile-password-confirmation-error"
                className="field-error"
                role="alert"
              >
                {confirmationError}
              </p>
            )}
          </div>
          <button className="workspace-button">Сменить пароль</button>
        </fieldset>
        {passwordPending && (
          <p className="form-pending" role="status">
            Сохраняем…
          </p>
        )}
        {passwordState.error && (
          <p className="form-error" role="alert">
            {passwordState.error}
          </p>
        )}
        {passwordState.message && (
          <p className="form-success" role="status">
            {passwordState.message}
          </p>
        )}
      </form>
    </div>
  );
}
