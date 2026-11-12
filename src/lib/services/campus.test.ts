import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import QRCode from "qrcode";
import { ticketQROptions } from "@/lib/qr";
import { readQR } from "@/lib/qr-reader";
import { profileInputSchema } from "@/lib/validators/profile";
import { readStore, changeStore } from "./demo-store";
import {
  saveCampusEvent,
  changeEventStatus,
  registerStudent,
  cancelStudentRegistration,
  checkInParticipant,
  toggleStudentFavorite,
  updateCampusUser,
  isCampusUserBlocked,
  archiveAdminEvent,
  restoreAdminEvent,
  createAccount,
  signIn,
  sessionUser,
  revokeSession,
  updateStudentProfile,
  updateStudentGroup,
} from "./campus";
import { getEventById, getEvents } from "./events";
import { getCategories } from "./categories";
import { ServiceError } from "./errors";

const file = join(process.cwd(), "work", `qa-state-${randomUUID()}.json`);
process.env.CAMPUS_DATA_FILE = file;
const org = { id: "org-2", role: "ORGANIZER" as const };
const admin = { id: "admin-demo", role: "ADMIN" as const };
const student = { id: "student-demo", role: "STUDENT" as const };
const second = { id: "student-1", role: "STUDENT" as const };
beforeEach(() => {
  if (existsSync(file)) unlinkSync(file);
});
after(() => {
  if (existsSync(file)) unlinkSync(file);
  delete process.env.CAMPUS_DATA_FILE;
});
function makeEvent(minutes = 10, capacity = 1) {
  return saveCampusEvent(org, {
    title: "Проверка полного сценария AIU",
    description: "Тестовое событие для проверки записи и контроля входа.",
    location: "AIU, аудитория 204",
    startsAt: new Date(Date.now() + minutes * 60000).toISOString(),
    endsAt: new Date(Date.now() + (minutes + 120) * 60000).toISOString(),
    categoryId: "cat-tech",
    organizerId: org.id,
    capacity,
    status: "PUBLISHED",
  });
}
function published(minutes = 10, capacity = 1) {
  const event = makeEvent(minutes, capacity);
  changeEventStatus(admin, event.id, "approve");
  return event;
}

test("Роли и принадлежность: студент не создаёт событие, организатор не меняет чужое, подмена роли не проходит", () => {
  const event = makeEvent();
  assert.throws(() => saveCampusEvent(student, event), /роли/);
  assert.throws(
    () =>
      changeEventStatus({ id: "org-1", role: "ORGANIZER" }, event.id, "cancel"),
    /другому/,
  );
  assert.throws(() => changeEventStatus(org, event.id, "approve"), /роли/);
  assert.throws(
    () =>
      updateCampusUser(
        { id: "student-demo", role: "ADMIN" },
        "student-1",
        "ADMIN",
        false,
      ),
    /роли/,
  );
});
test("Модерация: попытка прямой публикации остаётся PENDING, отказ требует причины, повторное решение запрещено", () => {
  const event = makeEvent();
  assert.equal(event.status, "PENDING");
  assert.throws(
    () => changeEventStatus(admin, event.id, "reject", "нет"),
    /причину/,
  );
  changeEventStatus(admin, event.id, "reject", "Уточните программу и место");
  assert.equal(
    readStore().events.find((e) => e.id === event.id)?.rejectionReason,
    "Уточните программу и место",
  );
  changeEventStatus(org, event.id, "submit");
  changeEventStatus(admin, event.id, "approve");
  assert.equal(
    readStore().events.find((e) => e.id === event.id)?.status,
    "PUBLISHED",
  );
  assert.throws(
    () => changeEventStatus(admin, event.id, "approve"),
    /обработано/,
  );
});
test("История события фиксирует конкретное поле, автора и прежнее/новое значение", () => {
  const event = makeEvent();
  saveCampusEvent(
    org,
    { ...event, title: "Обновлённое название события" },
    event.id,
  );
  const titleChange = readStore().auditLog.find(
    (entry) =>
      entry.entityId === event.id &&
      entry.field === "title" &&
      entry.oldValue === event.title,
  );
  assert.ok(titleChange);
  assert.equal(titleChange.newValue, "Обновлённое название события");
  assert.equal(titleChange.actorId, org.id);
  assert.equal(titleChange.actorName, "Центр студенческих инициатив");
});
test("Архив скрывает событие с афиши, сохраняет регистрации и позволяет восстановить", async () => {
  const event = published(10, 2);
  const registration = registerStudent(student, event.id);
  archiveAdminEvent(admin, event.id);

  assert.equal(await getEventById(event.id), null);
  assert.equal(
    (await getEvents({ status: "PUBLISHED" })).some(
      (item) => item.id === event.id,
    ),
    false,
  );
  assert.throws(() => registerStudent(second, event.id), /недоступно/);
  assert.ok(
    readStore().registrations.some((item) => item.id === registration.id),
  );
  assert.throws(
    () => saveCampusEvent(org, event, event.id),
    /находится в архиве/,
  );

  restoreAdminEvent(admin, event.id);
  assert.equal((await getEventById(event.id))?.id, event.id);
  assert.ok(
    readStore().auditLog.some(
      (entry) => entry.entityId === event.id && entry.field === "archivedAt",
    ),
  );
});
test("Архивная категория не попадает в выбор категорий и не назначается событию", async () => {
  const event = makeEvent();
  changeStore((store) => {
    store.categories.find((category) => category.id === event.categoryId)!.archivedAt =
      new Date().toISOString();
  });
  assert.equal(
    (await getCategories()).some((category) => category.id === event.categoryId),
    false,
  );
  assert.throws(() => saveCampusEvent(org, event, event.id), /категорию/);
});
test("Вместимость: параллельные запросы не превышают лимит, отмена продвигает очередь", async () => {
  const event = published();
  const results = await Promise.all(
    [student, second].map((actor) =>
      Promise.resolve().then(() => registerStudent(actor, event.id)),
    ),
  );
  assert.equal(results.filter((r) => r.status === "CONFIRMED").length, 1);
  assert.equal(results.filter((r) => r.status === "WAITLIST").length, 1);
  assert.equal(
    readStore().events.find((e) => e.id === event.id)?.registeredCount,
    1,
  );
  assert.throws(() => registerStudent(student, event.id), /уже записаны/);
  cancelStudentRegistration(student, results[0].id);
  assert.equal(
    readStore().registrations.find((r) => r.id === results[1].id)?.status,
    "CONFIRMED",
  );
  assert.equal(
    readStore().events.find((e) => e.id === event.id)?.registeredCount,
    1,
  );
  assert.throws(
    () => cancelStudentRegistration(student, results[1].id),
    /не найдена/,
  );
});
test("QR: успешный вход, повтор без двойного посещения, чужое событие, неверный код и закрытое окно", () => {
  const event = published();
  const registration = registerStudent(student, event.id);
  assert.equal(
    checkInParticipant(org, event.id, registration.qrToken!).already,
    false,
  );
  assert.equal(
    checkInParticipant(org, event.id, registration.shortCode).already,
    true,
  );
  assert.equal(
    readStore().registrations.filter(
      (r) => r.eventId === event.id && r.checkedInAt,
    ).length,
    1,
  );
  assert.throws(
    () => cancelStudentRegistration(student, registration.id),
    /уже отмечен/,
  );
  assert.throws(
    () =>
      checkInParticipant(
        { id: "org-1", role: "ORGANIZER" },
        event.id,
        registration.shortCode,
      ),
    /другому/,
  );
  assert.throws(
    () => checkInParticipant(org, event.id, registration.qrToken + "x"),
    /не найдена/,
  );
  const other = published(200);
  const otherReg = registerStudent(student, other.id);
  assert.throws(
    () => checkInParticipant(org, other.id, registration.shortCode),
    /не найдена/,
  );
  assert.throws(
    () => checkInParticipant(org, other.id, otherReg.shortCode),
    /час до начала/,
  );
});
test("20 случайных QR-билетов декодируются обратно в подписанные токены", async () => {
  const event = published(10, 20);
  const require = createRequire(import.meta.url);
  const { PNG } = require("pngjs");
  for (let index = 0; index < 20; index++) {
    const actor =
      index === 0
        ? student
        : { id: `student-${index}`, role: "STUDENT" as const };
    const registration = registerStudent(actor, event.id);
    const encoded = await QRCode.toBuffer(
      registration.qrToken!,
      ticketQROptions,
    );
    const png = PNG.sync.read(encoded);
    const decoded = readQR(
      new Uint8ClampedArray(png.data),
      png.width,
      png.height,
    );
    assert.equal(decoded, registration.qrToken);
    assert.equal(
      checkInParticipant(org, registration.eventId, decoded!).already,
      false,
    );
  }
  assert.equal(
    readStore().registrations.filter(
      (r) => r.eventId === event.id && r.checkedInAt,
    ).length,
    20,
  );
});
test("Профиль, избранное, роли и блокировка: изменения сохраняются, пароли не хранятся открытым текстом", () => {
  const account = createAccount({
    name: "Тестовый студент",
    email: "test@example.com",
    password: "Different2026!",
  });
  const actor = { ...account, role: "STUDENT" as const };
  assert.throws(
    () =>
      createAccount({
        name: "Дубликат",
        email: "test@example.com",
        password: "Different2026!",
      }),
    /уже зарегистрирован/,
  );
  const token = signIn("test@example.com", "Different2026!");
  assert.equal(sessionUser(token)?.id, actor.id);
  assert.ok(!readFileSync(file, "utf8").includes("Different2026!"));
  updateStudentProfile(actor, {
    name: "Новое имя",
  });
  assert.equal(
    readStore().users.find((u) => u.id === actor.id)?.name,
    "Новое имя",
  );
  changeStore((store) => {
    const user = store.users.find((item) => item.id === actor.id);
    assert.ok(user);
    user.group = "AIU-26";
    user.school = "Инженерная школа";
  });
  const forgedProfileInput = {
    name: "Новое имя",
    currentPassword: "",
    password: "",
    passwordConfirmation: "",
    group: "Чужая группа",
    school: "Чужая школа",
  };
  updateStudentProfile(actor, forgedProfileInput);
  const profileAfterForgedUpdate = readStore().users.find(
    (user) => user.id === actor.id,
  );
  assert.equal(profileAfterForgedUpdate?.group, "AIU-26");
  assert.equal(profileAfterForgedUpdate?.school, "Инженерная школа");
  const invalidPassword = profileInputSchema.safeParse({
    name: "Новое имя",
    currentPassword: "",
    password: "Different2027!",
    passwordConfirmation: "Different2027!",
  });
  assert.equal(invalidPassword.success, false);
  const mismatchedPassword = profileInputSchema.safeParse({
    name: "Новое имя",
    currentPassword: "Different2026!",
    password: "Different2027!",
    passwordConfirmation: "Different2028!",
  });
  assert.equal(mismatchedPassword.success, false);
  assert.throws(
    () =>
      updateStudentProfile(actor, {
        name: "Новое имя",
        currentPassword: "wrong",
        password: "Different2027!",
        passwordConfirmation: "Different2027!",
      }),
    (error) =>
      error instanceof ServiceError && error.code === "UNAUTHORIZED",
  );
  updateStudentProfile(actor, {
    name: "Новое имя",
    currentPassword: "Different2026!",
    password: "Different2027!",
    passwordConfirmation: "Different2027!",
  });
  assert.throws(
    () => signIn("test@example.com", "Different2026!"),
    (error) =>
      error instanceof ServiceError && error.code === "UNAUTHORIZED",
  );
  const updatedToken = signIn("test@example.com", "Different2027!");
  assert.equal(sessionUser(updatedToken)?.id, actor.id);
  revokeSession(updatedToken);
  assert.equal(updateStudentGroup(admin, actor.id, "IT-26").group, "IT-26");
  assert.throws(
    () => updateStudentGroup(admin, actor.id, "G".repeat(41)),
    /Учебная группа/,
  );
  assert.throws(
    () => updateStudentGroup(admin, "admin-demo", "IT-26"),
    /только студенту/,
  );
  const event = published();
  assert.equal(toggleStudentFavorite(actor, event.id).isFavorite, true);
  assert.equal(toggleStudentFavorite(actor, event.id).isFavorite, false);
  assert.throws(
    () => updateCampusUser(admin, "admin-demo", "STUDENT", true),
    /закреплены/,
  );
  const roleUpdate = updateCampusUser(admin, actor.id, "ORGANIZER", true);
  assert.equal(roleUpdate.roleChanged, true);
  assert.equal(sessionUser(token), undefined);
  assert.throws(() => registerStudent(actor, event.id), /роли/);
  assert.throws(
    () => signIn("test@example.com", "Different2026!"),
    /заблокирован/,
  );
  revokeSession(token);
  assert.equal(readStore().sessions.length, 0);
});
test("Срок блокировки ограничивает доступ и автоматически снимается по истечении", () => {
  const account = createAccount({
    name: "Тест блокировки",
    email: "ban-test@example.com",
    password: "Different2026!",
  });
  const token = signIn("ban-test@example.com", "Different2026!");
  updateCampusUser(admin, account.id, "STUDENT", true, "1d");
  const blockedUser = readStore().users.find((user) => user.id === account.id)!;
  assert.equal(isCampusUserBlocked(blockedUser), true);
  assert.ok(Date.parse(blockedUser.blockedUntil!) > Date.now());
  assert.equal(sessionUser(token), undefined);

  changeStore((store) => {
    store.users.find((user) => user.id === account.id)!.blockedUntil =
      new Date(Date.now() - 1000).toISOString();
  });
  const expiredUser = readStore().users.find((user) => user.id === account.id)!;
  assert.equal(isCampusUserBlocked(expiredUser), false);
  assert.equal(sessionUser(token)?.id, account.id);
  assert.ok(
    readStore().auditLog.some(
      (entry) =>
        entry.entityId === account.id && entry.field === "blockedUntil",
    ),
  );
});
test("Приоритетное окно учитывает активный статус и список организатора", () => {
  const event = published(120, 5);
  const plainStudent = { id: "student-99", role: "STUDENT" as const };
  changeStore((store) => {
    const target = store.events.find((item) => item.id === event.id)!;
    target.registrationOpensAt = new Date(Date.now() - 15 * 60000).toISOString();
    target.priorityWindowHours = 2;
    target.priorityMembers = ["student-1"];
    const demoUser = store.users.find((user) => user.id === student.id)!;
    demoUser.priorityStatus = "ACTIVE";
    const plainUser = store.users.find((user) => user.id === plainStudent.id)!;
    if (!plainUser) {
      store.users.push({
        id: plainStudent.id,
        name: "Простой студент",
        email: "plain-student@example.com",
        role: "STUDENT",
        group: "AIU-99",
        school: "AIU",
        priorityStatus: "STANDARD",
        blocked: false,
      });
    }
  });
  assert.equal(registerStudent(student, event.id).status, "CONFIRMED");
  assert.throws(() => registerStudent(plainStudent, event.id), /активных студентов/);
  changeStore((store) => {
    const normal = store.users.find((user) => user.id === plainStudent.id)!;
    normal.priorityStatus = "ACTIVE";
  });
  assert.equal(registerStudent(plainStudent, event.id).status, "CONFIRMED");
});
test("Серверные проверки дат, вместимости и приоритетной записи", () => {
  assert.throws(() => makeEvent(-10), /будущем/);
  const event = published();
  registerStudent(student, event.id);
  assert.throws(
    () => changeEventStatus(org, event.id, "delete"),
    /Есть участники/,
  );
  changeStore((store) => {
    const target = store.events.find((e) => e.id === event.id)!;
    target.registrationOpensAt = new Date(Date.now() + 600000).toISOString();
  });
  assert.throws(() => registerStudent(second, event.id), /ещё не открылась/);
  changeEventStatus(org, event.id, "cancel");
  assert.equal(
    readStore().registrations.find((r) => r.eventId === event.id)?.status,
    "CANCELLED",
  );
  assert.throws(() => registerStudent(second, event.id), /недоступно/);
});
