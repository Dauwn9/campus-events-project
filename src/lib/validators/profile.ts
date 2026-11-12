import { z } from "zod";

export const profileInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Имя должно содержать не менее 2 символов.")
      .max(80, "Имя должно содержать не более 80 символов."),
    currentPassword: z.string().max(128, "Пароль: не более 128 символов."),
    password: z.string().max(128, "Пароль: не более 128 символов."),
    passwordConfirmation: z
      .string()
      .max(128, "Пароль: не более 128 символов."),
  })
  .superRefine((profile, context) => {
    const hasCurrentPassword = profile.currentPassword.length > 0;
    const hasNewPassword = profile.password.length > 0;
    const hasConfirmation = profile.passwordConfirmation.length > 0;

    if (hasCurrentPassword && !hasNewPassword) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Укажите новый пароль, если вводите текущий пароль.",
      });
    }

    if (hasNewPassword && !hasCurrentPassword) {
      context.addIssue({
        code: "custom",
        path: ["currentPassword"],
        message: "Введите текущий пароль, чтобы изменить пароль.",
      });
    }

    if (hasConfirmation && !hasNewPassword) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Введите новый пароль для подтверждения.",
      });
    }

    if (hasNewPassword) {
      if (profile.password.length < 8) {
        context.addIssue({
          code: "custom",
          path: ["password"],
          message: "Новый пароль должен содержать не менее 8 символов.",
        });
      }

      if (!/\p{L}/u.test(profile.password) || !/\d/.test(profile.password)) {
        context.addIssue({
          code: "custom",
          path: ["password"],
          message: "Добавьте в пароль хотя бы одну букву и одну цифру.",
        });
      }

      if (
        hasCurrentPassword &&
        profile.password === profile.currentPassword
      ) {
        context.addIssue({
          code: "custom",
          path: ["password"],
          message: "Новый пароль должен отличаться от текущего.",
        });
      }

      if (!hasConfirmation) {
        context.addIssue({
          code: "custom",
          path: ["passwordConfirmation"],
          message: "Повторите новый пароль.",
        });
      } else if (profile.password !== profile.passwordConfirmation) {
        context.addIssue({
          code: "custom",
          path: ["passwordConfirmation"],
          message: "Пароли не совпадают.",
        });
      }
    }
  });

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type ProfileField = keyof ProfileInput;

export function isProfileField(value: unknown): value is ProfileField {
  return (
    value === "name" ||
    value === "currentPassword" ||
    value === "password" ||
    value === "passwordConfirmation"
  );
}
