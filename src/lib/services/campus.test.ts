import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
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
  updateStudentProfile,
  updateStudentGroup,
} from "./campus";
import { getEventById, getEvents, listEvents } from "./events";
import { getCategories } from "./categories";
import {
  getFriendsPageData,
  respondToFriendRequest,
  sendFriendRequest,
} from "./social";
import { getMyNotifications, markNotificationRead } from "./notifications";

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
async function makeEvent(minutes = 10, capacity = 1) {
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
async function published(minutes = 10, capacity = 1) {
  const event = await makeEvent(minutes, capacity);
  await changeEventStatus(admin, event.id, "approve");
  return event;
}

test("Сохраняет выбранную обложку в локальных данных события", async () => {
  const event = await makeEvent();
  const imageUrl = "data:image/png;base64,iVBORw0KGgo=";
  await saveCampusEvent(org, { ...event, imageUrl }, event.id);

  assert.equal(
    readStore().events.find((item) => item.id === event.id)?.imageUrl,
    imageUrl,
  );
});

test("Роли и принадлежность: студент не создаёт событие, организатор не меняет чужое, подмена роли не проходит", async () => {
  const event = await makeEvent();
  await assert.rejects(() => saveCampusEvent(student, event), /роли/);
  await assert.rejects(
    () =>
      changeEventStatus({ id: "org-1", role: "ORGANIZER" }, event.id, "cancel"),
    /другому/,
  );
  await assert.rejects(() => changeEventStatus(org, event.id, "approve"), /роли/);
  assert.throws(
    () =>
      updateCampusUser(
        { id: "student-demo", role: "STUDENT" },
        "student-1",
        "ADMIN",
        false,
      ),
    /роли/,
  );
});
test("Better Auth actor может работать с mock-событиями без пользователя в demo-store", async () => {
  const organizer = {
    id: "better-auth-organizer",
    name: "Новый организатор",
    role: "ORGANIZER" as const,
  };
  const event = await saveCampusEvent(organizer, {
    title: "Событие реального организатора",
    description: "Проверка работы пользователя Better Auth без mock-профиля.",
    location: "Аудитория 1",
    categoryId: "cat-tech",
    organizerId: organizer.id,
    startsAt: new Date(Date.now() + 10 * 60000).toISOString(),
    endsAt: new Date(Date.now() + 130 * 60000).toISOString(),
    capacity: 5,
    status: "PENDING",
  });
  await changeEventStatus(admin, event.id, "approve");

  const student = {
    id: "better-auth-student",
    name: "Новый студент",
    role: "STUDENT" as const,
  };
  assert.equal(registerStudent(student, event.id).status, "CONFIRMED");
  assert.equal((await toggleStudentFavorite(student, event.id)).isFavorite, true);
  assert.equal(
    readStore().users.some((user) => user.id === student.id),
    false,
  );
  assert.throws(
    () => registerStudent({ ...student, blocked: true }, event.id),
    /роли/,
  );

  const registration = readStore().registrations.find(
    (item) => item.userId === student.id && item.eventId === event.id,
  );
  assert.ok(registration);
  changeStore((store) => {
    store.registrations.find((item) => item.id === registration.id)!.checkedInAt =
      new Date().toISOString();
  });
  assert.equal(
    checkInParticipant(organizer, event.id, registration.shortCode).name,
    "Участник",
  );
});
test("Модерация: попытка прямой публикации остаётся PENDING, отказ требует причины, повторное решение запрещено", async () => {
  const event = await makeEvent();
  assert.equal(event.status, "PENDING");
  await assert.rejects(
    () => changeEventStatus(admin, event.id, "reject", "нет"),
    /причину/,
  );
  await changeEventStatus(admin, event.id, "reject", "Уточните программу и место");
  assert.equal(
    readStore().events.find((e) => e.id === event.id)?.rejectionReason,
    "Уточните программу и место",
  );
  await changeEventStatus(org, event.id, "submit");
  await changeEventStatus(admin, event.id, "approve");
  assert.equal(
    readStore().events.find((e) => e.id === event.id)?.status,
    "PUBLISHED",
  );
  await assert.rejects(
    () => changeEventStatus(admin, event.id, "approve"),
    /обработано/,
  );
});
test("История события фиксирует конкретное поле, автора и прежнее/новое значение", async () => {
  const event = await makeEvent();
  await saveCampusEvent(
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
  const event = await published(10, 2);
  const registration = registerStudent(student, event.id);
  await archiveAdminEvent(admin, event.id);

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
  await assert.rejects(
    () => saveCampusEvent(org, event, event.id),
    /находится в архиве/,
  );

  await restoreAdminEvent(admin, event.id);
  assert.equal((await getEventById(event.id))?.id, event.id);
  assert.ok(
    readStore().auditLog.some(
      (entry) => entry.entityId === event.id && entry.field === "archivedAt",
    ),
  );
});
test("Архивная категория не попадает в выбор категорий и не назначается событию", async () => {
  const event = await makeEvent();
  changeStore((store) => {
    store.categories.find((category) => category.id === event.categoryId)!.archivedAt =
      new Date().toISOString();
  });
  assert.equal(
    (await getCategories()).some((category) => category.id === event.categoryId),
    false,
  );
  await assert.rejects(() => saveCampusEvent(org, event, event.id), /категорию/);
});
test("Друзья: запрос нужно принять, друзья видят предстоящие события друг друга", async () => {
  const event = await published(30, 2);
  registerStudent(second, event.id);
  const request = sendFriendRequest(student, second.id);
  assert.equal(getFriendsPageData(student).outgoing.length, 1);
  assert.equal(
    getFriendsPageData(student).friendEvents.some(
      (item) => item.event.id === event.id,
    ),
    false,
  );
  respondToFriendRequest(second, request.id, true);

  const page = getFriendsPageData(student);
  assert.equal(page.friends.some((friend) => friend.id === second.id), true);
  assert.equal(
    page.friendEvents.some(
      (item) =>
        item.event.id === event.id &&
        item.friends.some((friend) => friend.id === second.id),
    ),
    true,
  );
  assert.throws(() => sendFriendRequest(student, student.id), /самого себя/);
  assert.throws(() => sendFriendRequest(student, second.id), /уже существует/);
  assert.throws(
    () => respondToFriendRequest(student, request.id, true),
    /не найден/,
  );
});
test("Отмена события сохраняет регистрации и создаёт личные уведомления", async () => {
  const event = await published(30, 2);
  const firstRegistration = registerStudent(student, event.id);
  const secondRegistration = registerStudent(second, event.id);

  await changeEventStatus(org, event.id, "cancel");

  for (const registration of [firstRegistration, secondRegistration]) {
    const saved = readStore().registrations.find(
      (item) => item.id === registration.id,
    );
    assert.equal(saved?.status, "CANCELLED");
    assert.equal(saved?.qrToken, null);
  }
  const notifications = getMyNotifications(student);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, "EVENT_CANCELLED");
  assert.equal(notifications[0].event?.status, "CANCELLED");
  markNotificationRead(student, notifications[0].id);
  assert.ok(getMyNotifications(student)[0].readAt);
  assert.throws(
    () => markNotificationRead(second, notifications[0].id),
    /не найдено/,
  );
  assert.equal(getMyNotifications(second)[0].kind, "EVENT_CANCELLED");
});
test("Важные изменения опубликованного события уведомляют записанных студентов", async () => {
  const event = await published(30, 2);
  registerStudent(student, event.id);
  await saveCampusEvent(
    org,
    { ...event, location: "Новый зал, корпус B" },
    event.id,
  );

  const notification = getMyNotifications(student)[0];
  assert.equal(notification.kind, "EVENT_UPDATED");
  assert.match(notification.message, /место/);
  assert.equal(notification.event?.location, "Новый зал, корпус B");
});
test("Вместимость: параллельные запросы не превышают лимит, отмена продвигает очередь", async () => {
  const event = await published();
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
test("QR: успешный вход, повтор без двойного посещения, чужое событие, неверный код и закрытое окно", async () => {
  const event = await published();
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
  const other = await published(200);
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
  const event = await published(10, 20);
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
test("Профиль, роли и блокировка сохраняются в демо-сервисе", async () => {
  const actor = second;
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
  assert.equal(updateStudentGroup(admin, actor.id, "IT-26").group, "IT-26");
  assert.throws(
    () => updateStudentGroup(admin, actor.id, "G".repeat(41)),
    /Учебная группа/,
  );
  assert.throws(
    () => updateStudentGroup(admin, "admin-demo", "IT-26"),
    /только студенту/,
  );
  const event = await published();
  assert.throws(
    () => updateCampusUser(admin, "admin-demo", "STUDENT", true),
    /закреплены/,
  );
  const roleUpdate = updateCampusUser(admin, actor.id, "ORGANIZER", true);
  assert.equal(roleUpdate.roleChanged, true);
  assert.throws(
    () => registerStudent({ ...actor, role: "ORGANIZER" }, event.id),
    /роли/,
  );
});
test("Срок блокировки ограничивает доступ и автоматически снимается по истечении", () => {
  updateCampusUser(admin, second.id, "STUDENT", true, "1d");
  const blockedUser = readStore().users.find((user) => user.id === second.id)!;
  assert.equal(isCampusUserBlocked(blockedUser), true);
  assert.ok(Date.parse(blockedUser.blockedUntil!) > Date.now());

  changeStore((store) => {
    store.users.find((user) => user.id === second.id)!.blockedUntil =
      new Date(Date.now() - 1000).toISOString();
  });
  const expiredUser = readStore().users.find((user) => user.id === second.id)!;
  assert.equal(isCampusUserBlocked(expiredUser), false);
  assert.ok(
    readStore().auditLog.some(
      (entry) =>
        entry.entityId === second.id && entry.field === "blockedUntil",
    ),
  );
});
test("Приоритетное окно учитывает активный статус и список организатора", async () => {
  const event = await published(120, 5);
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
test("Серверные проверки дат, вместимости и приоритетной записи", async () => {
  await assert.rejects(() => makeEvent(-10), /будущем/);
  const event = await published();
  registerStudent(student, event.id);
  await assert.rejects(
    () => changeEventStatus(org, event.id, "delete"),
    /Есть участники/,
  );
  changeStore((store) => {
    const target = store.events.find((e) => e.id === event.id)!;
    target.registrationOpensAt = new Date(Date.now() + 600000).toISOString();
  });
  assert.throws(() => registerStudent(second, event.id), /ещё не открылась/);
  await changeEventStatus(org, event.id, "cancel");
  assert.equal(
    readStore().registrations.find((r) => r.eventId === event.id)?.status,
    "CANCELLED",
  );
  assert.throws(() => registerStudent(second, event.id), /недоступно/);
});
test("Общий список API показывает только опубликованные события и делит на страницы", async () => {
  const pending = await makeEvent();
  const live = await published(20, 5);

  const all = await listEvents({ page: 1, limit: 50 });
  assert.equal(all.items.some((item) => item.id === pending.id), false);
  assert.equal(all.items.some((item) => item.id === live.id), true);
  assert.ok(all.items.every((item) => item.status === "PUBLISHED"));

  const firstPage = await listEvents({ page: 1, limit: 1 });
  assert.equal(firstPage.items.length, 1);
  assert.equal(firstPage.total, all.total);
  assert.equal(firstPage.limit, 1);
});