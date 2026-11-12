"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, requireRole } from "@/lib/auth";
import {
  saveCampusEvent,
  changeEventStatus,
  registerStudent,
  cancelStudentRegistration,
  toggleStudentFavorite,
  checkInParticipant,
  updateCampusUser,
  updateStudentGroup,
  updateStudentProfile,
  archiveAdminEvent,
  restoreAdminEvent,
  createAccount,
  signIn,
  startSession,
  revokeSession,
} from "@/lib/services/campus";
import { deleteComment } from "@/lib/services/comments";
import { ServiceError } from "@/lib/services/errors";
import {
  isProfileField,
  type ProfileField,
} from "@/lib/validators/profile";

export type ActionState = { error?: string; message?: string };
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
function errorState(error: unknown): ActionState {
  if (error instanceof z.ZodError)
    return {
      error: error.issues
        .map((i) => i.message)
        .slice(0, 3)
        .join(" · "),
    };
  if (error instanceof ServiceError) return { error: error.message };
  console.error(
    "Campus action failed",
    error instanceof Error ? error.message : "unknown",
  );
  return { error: "Не удалось сохранить изменения. Попробуйте ещё раз." };
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
  let id: string;
  try {
    const event = saveCampusEvent(
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
      },
      text(form, "id") || undefined,
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
  const actor = await getCurrentUser();
  try {
    const validatedOperation = z
      .enum([
        "submit",
        "approve",
        "reject",
        "cancel",
        "delete",
        "archive",
        "restore",
      ])
      .parse(operation);
    if (validatedOperation === "archive") archiveAdminEvent(actor, id);
    else if (validatedOperation === "restore") restoreAdminEvent(actor, id);
    else
      changeEventStatus(actor, id, validatedOperation, text(form, "reason"));
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
  const user = await requireRole("STUDENT");
  try {
    const result = toggleStudentFavorite(user, id);
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
  const actor = await getCurrentUser();
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
    const result = updateCampusUser(
      actor,
      id,
      text(form, "role"),
      form.get("blocked") === "on",
      text(form, "banDuration"),
    );
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
  const actor = await requireRole("ADMIN");
  try {
    updateStudentGroup(actor, id, String(form.get("group") ?? ""));
    refresh();
    return { message: "Учебная группа сохранена." };
  } catch (error) {
    return errorState(error);
  }
}
export async function profileAction(
  _state: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const actor = await requireRole("STUDENT");
  try {
    updateStudentProfile(actor, {
      name: text(form, "name"),
      currentPassword: String(form.get("currentPassword") ?? ""),
      password: String(form.get("password") ?? ""),
      passwordConfirmation: String(form.get("passwordConfirmation") ?? ""),
    });
    refresh();
    return { message: "Профиль сохранён." };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Partial<Record<ProfileField, string>> = {};
      for (const issue of error.issues) {
        const field = issue.path[0];
        if (isProfileField(field) && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      return { fieldErrors };
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
  try {
    await deleteComment(id);
    refresh();
    return { message: "Комментарий удалён." };
  } catch (error) {
    return errorState(error);
  }
}
async function setSession(token: string) {
  const jar = await cookies();
  jar.delete("dev-role");
  jar.set("campus-session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.CAMPUS_COOKIE_SECURE === "true",
    path: "/",
    maxAge: 7 * 86400,
  });
}
export async function loginAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const data = z
      .object({ email: z.email(), password: z.string().min(1).max(128) })
      .parse({
        email: text(form, "email"),
        password: String(form.get("password") ?? ""),
      });
    await setSession(signIn(data.email, data.password));
  } catch (error) {
    return errorState(error);
  }
  refresh();
  redirect("/");
}
export async function registerAccountAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const data = {
      name: text(form, "name"),
      email: text(form, "email"),
      password: String(form.get("password") ?? ""),
    };
    if (data.password !== form.get("confirmPassword"))
      return { error: "Пароли не совпадают." };
    const user = createAccount(data);
    await setSession(startSession(user.id));
  } catch (error) {
    return errorState(error);
  }
  refresh();
  redirect("/profile");
}
export async function logoutAction() {
  const jar = await cookies();
  const token = jar.get("campus-session")?.value;
  if (token) revokeSession(token);
  jar.delete("campus-session");
  jar.delete("dev-role");
  refresh();
  redirect("/");
}
