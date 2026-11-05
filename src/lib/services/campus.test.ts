import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import QRCode from "qrcode";
import { ticketQROptions } from "@/lib/qr";
import { readQR } from "@/lib/qr-reader";
import { readStore, changeStore } from "./demo-store";
import {
  saveCampusEvent,
  changeEventStatus,
  registerStudent,
  cancelStudentRegistration,
  checkInParticipant,
  toggleStudentFavorite,
  updateCampusUser,
  createAccount,
  signIn,
  sessionUser,
  revokeSession,
  updateStudentProfile,
} from "./campus";

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
    group: "IT-26",
    school: "AIU",
  });
  assert.equal(
    readStore().users.find((u) => u.id === actor.id)?.name,
    "Новое имя",
  );
  const event = published();
  assert.equal(toggleStudentFavorite(actor, event.id).isFavorite, true);
  assert.equal(toggleStudentFavorite(actor, event.id).isFavorite, false);
  assert.throws(
    () => updateCampusUser(admin, "admin-demo", "STUDENT", true),
    /закреплены/,
  );
  updateCampusUser(admin, actor.id, "STUDENT", true);
  assert.equal(sessionUser(token), undefined);
  assert.throws(() => registerStudent(actor, event.id), /роли/);
  assert.throws(
    () => signIn("test@example.com", "Different2026!"),
    /заблокирован/,
  );
  revokeSession(token);
  assert.equal(readStore().sessions.length, 0);
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
