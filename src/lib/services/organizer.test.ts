import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { readStore } from "./demo-store";
import {
  saveCampusEvent,
  changeEventStatus,
  registerStudent,
  checkInParticipant,
  archiveAdminEvent,
  type Actor,
} from "./campus";
import { listEvents } from "./events";
import { getEventParticipants, getScannerEvents } from "./organizer";
import { ServiceError, type ServiceErrorCode } from "./errors";

const file = join(
  process.cwd(),
  "work",
  `organizer-state-${randomUUID()}.json`,
);
process.env.CAMPUS_DATA_FILE = file;

const owner: Actor = { id: "org-2", role: "ORGANIZER" };
const stranger: Actor = { id: "org-1", role: "ORGANIZER" };
const admin: Actor = { id: "admin-demo", role: "ADMIN" };
const student: Actor = { id: "student-demo", role: "STUDENT" };

beforeEach(() => {
  if (existsSync(file)) unlinkSync(file);
});
after(() => {
  if (existsSync(file)) unlinkSync(file);
  delete process.env.CAMPUS_DATA_FILE;
});

function serviceError(code: ServiceErrorCode) {
  return (error: unknown) =>
    error instanceof ServiceError && error.code === code;
}

/** Создаёт событие; без одобрения админом оно остаётся PENDING. */
function makeEvent(actor: Actor, minutes = 10, capacity = 5) {
  return saveCampusEvent(actor, {
    title: "Тестовое событие кабинета организатора",
    description: "Событие для проверки списка участников и сканера.",
    location: "AIU, аудитория 204",
    startsAt: new Date(Date.now() + minutes * 60000).toISOString(),
    endsAt: new Date(Date.now() + (minutes + 120) * 60000).toISOString(),
    categoryId: "cat-tech",
    organizerId: actor.id,
    capacity,
    status: "PUBLISHED",
  });
}

function published(actor: Actor, minutes = 10, capacity = 5) {
  const event = makeEvent(actor, minutes, capacity);
  changeEventStatus(admin, event.id, "approve");
  return event;
}

// ============================================================
// getEventParticipants
// ============================================================

test("getEventParticipants: владелец события видит участников", async () => {
  const event = published(owner, 10, 2);
  const registration = registerStudent(student, event.id);

  const result = await getEventParticipants(owner, event.id);

  assert.equal(result.event.id, event.id);
  assert.equal(result.participants.length, 1);
  const participant = result.participants[0];
  assert.equal(participant.id, registration.id);
  assert.equal(participant.name, "Айжан Садыкова");
  assert.equal(participant.status, "CONFIRMED");
  assert.equal(participant.checkedInAt, null);
  assert.equal(participant.shortCode, registration.shortCode);
});

test("getEventParticipants: чужой организатор получает FORBIDDEN", async () => {
  const event = published(owner);
  registerStudent(student, event.id);

  await assert.rejects(
    () => getEventParticipants(stranger, event.id),
    serviceError("FORBIDDEN"),
  );
});

test("getEventParticipants: несуществующее событие даёт NOT_FOUND", async () => {
  await assert.rejects(
    () => getEventParticipants(owner, "missing-event"),
    serviceError("NOT_FOUND"),
  );
});

// ============================================================
// getScannerEvents
// ============================================================

test("getScannerEvents: только опубликованные события организатора, ближайшие первыми", async () => {
  const late = published(owner, 300);
  const soon = published(owner, 10);
  const mid = published(owner, 60);
  const pending = makeEvent(owner, 20);
  const cancelled = published(owner, 30);
  changeEventStatus(owner, cancelled.id, "cancel");
  const foreign = published(stranger, 15);

  const result = await getScannerEvents(owner.id);
  const ids = result.map((item) => item.id);

  assert.equal(ids.includes(pending.id), false);
  assert.equal(ids.includes(cancelled.id), false);
  assert.equal(ids.includes(foreign.id), false);

  // Все возвращённые события — опубликованные и принадлежат организатору.
  const byId = new Map(readStore().events.map((event) => [event.id, event]));
  for (const item of result) {
    const stored = byId.get(item.id);
    assert.ok(stored);
    assert.equal(stored.organizerId, owner.id);
    assert.equal(stored.status, "PUBLISHED");
  }

  // Порядок наших событий: от ближайшего к дальнему.
  const mine = [soon.id, mid.id, late.id];
  assert.deepEqual(
    ids.filter((id) => mine.includes(id)),
    mine,
  );
});

test("getScannerEvents: считает записавшихся и уже отмеченных", async () => {
  const event = published(owner, 10, 2);
  const registration = registerStudent(student, event.id);

  const before = (await getScannerEvents(owner.id)).find(
    (item) => item.id === event.id,
  );
  assert.equal(before?.registeredCount, 1);
  assert.equal(before?.checked, 0);

  checkInParticipant(owner, event.id, registration.qrToken!);

  const after = (await getScannerEvents(owner.id)).find(
    (item) => item.id === event.id,
  );
  assert.equal(after?.checked, 1);
});

// ============================================================
// listEvents
// ============================================================

test("listEvents: в публичном списке нет PENDING и архивных событий", async () => {
  const live = published(owner, 20);
  const pending = makeEvent(owner, 25);
  const archived = published(owner, 30);
  archiveAdminEvent(admin, archived.id);

  const result = await listEvents({ page: 1, limit: 50 });
  const ids = result.items.map((item) => item.id);

  assert.equal(ids.includes(live.id), true);
  assert.equal(ids.includes(pending.id), false);
  assert.equal(ids.includes(archived.id), false);
  assert.ok(result.items.every((item) => item.status === "PUBLISHED"));
  assert.ok(result.items.every((item) => !item.archivedAt));
});

test("listEvents: пагинация отдаёт правильные page, limit и total", async () => {
  for (const minutes of [20, 40, 60]) published(owner, minutes);

  const all = await listEvents({ page: 1, limit: 50 });
  assert.ok(all.total >= 3);
  assert.equal(all.items.length, all.total);

  const first = await listEvents({ page: 1, limit: 2 });
  const second = await listEvents({ page: 2, limit: 2 });

  assert.equal(first.page, 1);
  assert.equal(first.limit, 2);
  assert.equal(first.total, all.total);
  assert.deepEqual(
    first.items.map((item) => item.id),
    all.items.slice(0, 2).map((item) => item.id),
  );

  assert.equal(second.page, 2);
  assert.equal(second.total, all.total);
  assert.deepEqual(
    second.items.map((item) => item.id),
    all.items.slice(2, 4).map((item) => item.id),
  );

  const beyond = await listEvents({
    page: Math.ceil(all.total / 2) + 1,
    limit: 2,
  });
  assert.equal(beyond.items.length, 0);
  assert.equal(beyond.total, all.total);
});