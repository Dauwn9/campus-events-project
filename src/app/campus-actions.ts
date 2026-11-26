"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { APIError } from "better-auth/api";
import { requireAnyRole, requireRole } from "@/lib/auth";
import { auth } from "@/lib/better-auth";
import { getPrisma } from "@/lib/prisma";
import {
  changeProfilePassword,
  updateProfileName,
} from "@/lib/profile";
import {
  registerStudent,
  cancelStudentRegistration,
  checkInParticipant,
} from "@/lib/services/campus";
import {
  archiveEvent,
  changeEvent,
  getEventById,
  restoreEvent,
  saveEvent,
} from "@/lib/services/events";
import { toggleFavorite } from "@/lib/services/favorites";
import { deleteCommentForUser } from "@/lib/services/comments";
import { ServiceError } from "@/lib/services/errors";
import { moderateEvent, updateAdminUser } from "@/lib/services/admin";
import { encodeEventCover, EventCoverError } from "@/lib/event-cover";
import {
  passwordChangeInputSchema,
  profileNameInputSchema,
  type ProfileField,
} from "@/lib/validators/profile";
import { studentGroupSchema } from "@/lib/validators/student-group";
import { passwordSchema } from "@/lib/validators/password";

export type ActionState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};
export type ProfileActionState = ActionState & {
  fieldErrors?: Partial<Record<ProfileField, string>>;
};
export type CheckInState = ActionState & {
  kind?: "success" | "duplicate";
  name?: string;
  at?: string;
  eventId?: string;
};
const text = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
function issueText(issue: z.core.$ZodIssue): string {
  if (issue.code === "custom") return issue.message;
  if (issue.code === "too_small")
    return issue.origin === "string"
      ? `Минимум символов: ${issue.minimum}`
      : `Не меньше ${issue.minimum}`;
  if (issue.code === "too_big")
    return issue.origin === "string"
      ? `Максимум символов: ${issue.maximum}`
      : `Не больше ${issue.maximum}`;
  if (issue.code === "invalid_type")
    return issue.expected === "number" ? "Введите число" : "Заполните поле";
  if (issue.code === "invalid_format") return "Неверный формат";
  return issue.message;
}
function errorState(error: unknown): ActionState {
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !(key in fieldErrors)) fieldErrors[key] = issueText(issue);
    }
    return {
      error: error.issues
        .map((i) => i.message)
        .slice(0, 3)
        .join(" · "),
      fieldErrors,
    };
  }
  if (error instanceof ServiceError) return { error: error.message };
  console.error(
    "Campus action failed",
    error instanceof Error ? error.message : "unknown",
  );
  return { error: "Не удалось сохранить изменения. Попробуйте ещё раз." };
}
function profileFieldErrors(
  error: z.ZodError,
): Partial<Record<ProfileField, string>> {
  const fieldErrors: Partial<Record<ProfileField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (
      (field === "name" ||
        field === "currentPassword" ||
        field === "password" ||
        field === "passwordConfirmation") &&
      !fieldErrors[field]
    ) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}
function refresh() {
  revalidatePath("/", "layout");
}
const localTime = (value: string) =>
  value
    ? new Date(
        `${value.length === 16 ? `${value}:00` : value}+05:00`,
      ).toISOString()
    : undefined;

export async function saveEventAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireRole("ORGANIZER");
  const editId = text(form, "id") || undefined;
  const previousEvent = editId ? await getEventById(editId) : null;
  if (
    Number(text(form, "priorityWindowHours") || 0) > 0 &&
    !text(form, "registrationOpensAt")
  )
    return {
      error: "Проверьте выделенные поля.",
      fieldErrors: {
        registrationOpensAt:
          "Укажите дату открытия записи — без неё приоритетное окно не работает",
      },
    };
  const removeCover = text(form, "removeCover") === "true";
  const coverEntry = form.get("coverFile");
  if (typeof coverEntry === "string" && coverEntry)
    return { error: "Выберите файл изображения для обложки." };

  let coverImageUrl: string | undefined;
  // Пустое поле файла приходит как File нулевого размера (иногда с именем
  // вроде "blob") — это значит «обложку не выбирали», а не ошибка.
  if (coverEntry && typeof coverEntry !== "string" && coverEntry.size > 0) {
    try {
      coverImageUrl = await encodeEventCover(coverEntry);
    } catch (error) {
      if (error instanceof EventCoverError) return { error: error.message };
      return errorState(error);
    }
  }

  let id: string;
  try {
    const event = await saveEvent(
      user,
      {
        title: text(form, "title"),
        description: text(form, "description"),
        location: text(form, "location"),
        categoryId: text(form, "categoryId"),
        organizerId: user.id,
        startsAt: localTime(text(form, "startsAt")) ?? "",
        endsAt: localTime(text(form, "endsAt")) ?? "",
        capacity: Number(text(form, "capacity")),
        status: text(form, "intent") === "draft" ? "DRAFT" : "PENDING",
        priorityWindowHours: Number(text(form, "priorityWindowHours") || 0),
        registrationOpensAt: localTime(text(form, "registrationOpensAt")),
        imageUrl: coverImageUrl ?? (removeCover ? undefined : previousEvent?.imageUrl),
      },
      editId,
    );
    id = event.id;
  } catch (error) {
    return errorState(error);
  }

  refresh();
  redirect(`/organizer/${id}?saved=1`);
}
export async function eventOperationAction(
  id: string,
  operation:
    | "submit"
    | "approve"
    | "reject"
    | "cancel"
    | "delete"
    | "archive"
    | "restore",
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsedOperation = z
    .enum([
      "submit",
      "approve",
      "reject",
      "cancel",
      "delete",
      "archive",
      "restore",
    ])
    .safeParse(operation);
  if (!parsedOperation.success) return errorState(parsedOperation.error);
  const validatedOperation = parsedOperation.data;
  const actor =
    validatedOperation === "approve" ||
    validatedOperation === "reject" ||
    validatedOperation === "archive" ||
    validatedOperation === "restore"
      ? await requireRole("ADMIN")
      : await requireAnyRole("ORGANIZER", "ADMIN");
  try {
    if (
      validatedOperation === "approve" ||
      validatedOperation === "reject"
    ) {
      await moderateEvent(
        actor,
        id,
        validatedOperation,
        text(form, "reason"),
      );
    } else if (validatedOperation === "archive") await archiveEvent(actor, id);
    else if (validatedOperation === "restore") await restoreEvent(actor, id);
    else await changeEvent(actor, id, validatedOperation);
    refresh();
    return { message: "Изменения сохранены." };
  } catch (error) {
    return errorState(error);
  }
}
export async function registerAction(
  id: string,
  _state: ActionState,
  _form: FormData,
): Promise<ActionState> {
  const user = await requireRole("STUDENT");
  try {
    const result = registerStudent(user, id);
    refresh();
    return {
      message:
        result.status === "WAITLIST"
          ? "Вы в листе ожидания. При освобождении места запись подтвердится автоматически."
          : "Вы записаны! QR-билет доступен в «Моих регистрациях».",
    };
  } catch (error) {
    return errorState(error);
  }
}
export async function cancelRegistrationAction(
  id: string,
  _state: ActionState,
  _form: FormData,
): Promise<ActionState> {
  const user = await requireRole("STUDENT");
  try {
    cancelStudentRegistration(user, id);
    refresh();
    return { message: "Регистрация отменена. Место освобождено." };
  } catch (error) {
    return errorState(error);
  }
}
export async function favoriteAction(
  id: string,
  _state: ActionState,
  _form: FormData,
): Promise<ActionState> {
  await requireRole("STUDENT");
  try {
    const result = await toggleFavorite(id);
    refresh();
    return {
      message: result.isFavorite
        ? "Событие добавлено в избранное."
        : "Событие убрано из избранного.",
    };
  } catch (error) {
    return errorState(error);
  }
}
export async function checkInAction(
  _state: CheckInState,
  form: FormData,
): Promise<CheckInState> {
  const actor = await requireAnyRole("ORGANIZER", "ADMIN");
  try {
    const result = checkInParticipant(
      actor,
      text(form, "eventId"),
      text(form, "code"),
    );
    refresh();
    return {
      eventId: text(form, "eventId"),
      kind: result.already ? "duplicate" : "success",
      name: result.name,
      at: result.at,
      message: result.already ? "Участник уже отмечен" : "Проход разрешён",
    };
  } catch (error) {
    return { ...errorState(error), eventId: text(form, "eventId") };
  }
}
export async function updateUserAction(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  try {
    const result = await updateAdminUser(actor, id, {
      role: text(form, "role"),
      blocked: form.get("blocked") === "on",
      banDuration: text(form, "banDuration"),
    });
    refresh();
    if (result.roleChanged) {
      const roleLabels = {
        STUDENT: "Студент",
        ORGANIZER: "Организатор",
        ADMIN: "Администратор",
      };
      return { message: `Роль изменена на «${roleLabels[result.role]}».` };
    }
    return { message: "Права пользователя сохранены." };
  } catch (error) {
    return errorState(error);
  }
}
export async function updateStudentGroupAction(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole("ADMIN");
  try {
    const targetId = z.string().min(1).max(128).parse(id);
    const groupValue = form.get("group");
    const group = studentGroupSchema.parse(
      typeof groupValue === "string" ? groupValue : "",
    );
    const prisma = getPrisma();
    const updated = await prisma.user.updateMany({
      where: { id: targetId, role: "STUDENT" },
      data: { group },
    });
    if (updated.count === 0) {
      const user = await prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!user) throw new ServiceError("NOT_FOUND", "Пользователь не найден.");
      throw new ServiceError(
        "FORBIDDEN",
        "Учебную группу можно изменить только студенту.",
      );
    }
    refresh();
    return { message: "Учебная группа сохранена." };
  } catch (error) {
    return errorState(error);
  }
}
export async function updateProfileNameAction(
  _state: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  await requireAnyRole("STUDENT", "ORGANIZER", "ADMIN");
  try {
    const { name } = profileNameInputSchema.parse({
      name: form.get("name"),
    });
    await updateProfileName(new Headers(await headers()), name);
    refresh();
    return { message: "Имя обновлено." };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: profileFieldErrors(error) };
    }
    return errorState(error);
  }
}
export async function changeProfilePasswordAction(
  _state: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  await requireAnyRole("STUDENT", "ORGANIZER", "ADMIN");
  try {
    const parsed = passwordChangeInputSchema.parse({
      currentPassword: String(form.get("currentPassword") ?? ""),
      password: String(form.get("password") ?? ""),
      passwordConfirmation: String(form.get("passwordConfirmation") ?? ""),
    });
    await changeProfilePassword(
      new Headers(await headers()),
      parsed.currentPassword,
      parsed.password,
    );
    refresh();
    return { message: "Пароль обновлён." };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: profileFieldErrors(error) };
    }
    if (error instanceof ServiceError && error.code === "UNAUTHORIZED") {
      return { fieldErrors: { currentPassword: error.message } };
    }
    return errorState(error);
  }
}
export async function deleteCommentAction(
  id: string,
  _state: ActionState,
  _form: FormData,
): Promise<ActionState> {
  const actor = await requireAnyRole("STUDENT", "ADMIN");
  try {
    await deleteCommentForUser(actor, id);
    refresh();
    return { message: "Комментарий удалён." };
  } catch (error) {
    return errorState(error);
  }
}
export async function loginAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  let destination = "/";
  try {
    const data = z
      .object({ email: z.email(), password: z.string().min(1).max(128) })
      .parse({
        email: text(form, "email"),
        password: String(form.get("password") ?? ""),
      });
    const result = await auth.api.signInEmail({
      body: data,
      headers: await headers(),
    });
    const user = await getPrisma().user.findUnique({
      where: { id: result.user.id },
      select: { role: true },
    });
    if (!user) throw new Error("Пользователь не найден после входа.");
    destination =
      user.role === "ADMIN"
        ? "/admin"
        : user.role === "ORGANIZER"
          ? "/organizer"
          : "/";
  } catch (error) {
    if (error instanceof APIError && error.statusCode === 401) {
      return {
        error: "Неверный email или пароль, либо аккаунт заблокирован.",
      };
    }
    return errorState(error);
  }
  refresh();
  redirect(destination);
}
export async function registerAccountAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const data = z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z.email().max(150).transform((email) => email.toLowerCase()),
        password: passwordSchema,
      })
      .parse({
        name: text(form, "name"),
        email: text(form, "email"),
        password: String(form.get("password") ?? ""),
      });
    if (data.password !== form.get("confirmPassword"))
      return { error: "Пароли не совпадают." };
    await auth.api.signUpEmail({
      body: data,
      headers: await headers(),
    });
  } catch (error) {
    if (
      error instanceof APIError &&
      error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
    ) {
      return { error: "Этот email уже зарегистрирован." };
    }
    return errorState(error);
  }
  refresh();
  redirect("/profile");
}
export async function logoutAction() {
  await auth.api.signOut({ headers: await headers() });
  refresh();
  redirect("/");
}
