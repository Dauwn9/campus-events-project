import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Пароль должен содержать не менее 8 символов.")
  .max(128, "Пароль должен содержать не более 128 символов.")
  .refine(
    (password) => /\p{L}/u.test(password) && /\d/.test(password),
    "Добавьте в пароль хотя бы одну букву и одну цифру.",
  );
