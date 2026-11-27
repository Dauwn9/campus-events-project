import { z } from "zod";
import { passwordSchema } from "@/lib/validators/password";

export const profileNameInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Имя должно содержать не менее 2 символов.")
    .max(50, "Имя должно содержать не более 50 символов."),
});

const optionalPasswordFieldsSchema = z
  .object({
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
      const passwordResult = passwordSchema.safeParse(profile.password);
      if (!passwordResult.success) {
        context.addIssue({
          code: "custom",
          path: ["password"],
          message: passwordResult.error.issues[0].message,
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

export const passwordChangeInputSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Введите текущий пароль.")
      .max(128, "Пароль: не более 128 символов."),
    password: passwordSchema,
    passwordConfirmation: z
      .string()
      .min(1, "Повторите новый пароль.")
      .max(128, "Пароль: не более 128 символов."),
  })
  .superRefine((profile, context) => {
    if (profile.password === profile.currentPassword) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Новый пароль должен отличаться от текущего.",
      });
    }
    if (profile.password !== profile.passwordConfirmation) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirmation"],
        message: "Пароли не совпадают.",
      });
    }
  });

export const profileInputSchema = profileNameInputSchema.and(
  optionalPasswordFieldsSchema,
);

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type ProfileField = keyof ProfileInput;
export type PasswordChangeField = keyof z.infer<
  typeof passwordChangeInputSchema
>;

export function isProfileField(value: unknown): value is ProfileField {
  return (
    value === "name" ||
    value === "currentPassword" ||
    value === "password" ||
    value === "passwordConfirmation"
  );
}
