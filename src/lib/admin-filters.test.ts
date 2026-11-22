import test from "node:test";
import assert from "node:assert/strict";
import {
  filterModerationEvents,
  filterUsersByBanTime,
  formatBanRemaining,
} from "./admin-filters";

const now = Date.parse("2026-11-22T12:00:00.000Z");
const events = [
  {
    id: "event-react",
    title: "React Meetup",
    categoryId: "it",
    status: "PENDING",
    startsAt: "2026-11-22T14:00:00.000Z",
    registeredCount: 4,
  },
  {
    id: "event-career",
    title: "Career Fair",
    categoryId: "career",
    status: "PUBLISHED",
    startsAt: "2026-11-20T14:00:00.000Z",
    registeredCount: 9,
  },
  {
    id: "event-ai",
    title: "AI Workshop",
    categoryId: "it",
    status: "PUBLISHED",
    startsAt: "2026-11-23T14:00:00.000Z",
    registeredCount: 2,
  },
];

test("Фильтрует события модерации по поиску, категории, статусу и периоду", () => {
  const result = filterModerationEvents(
    events,
    {
      query: "react",
      categoryId: "it",
      status: "PENDING",
      period: "upcoming",
      sort: "date-asc",
    },
    now,
  );

  assert.deepEqual(
    result.map((event) => event.id),
    ["event-react"],
  );
});

test("Сортирует события по числу регистраций", () => {
  const result = filterModerationEvents(
    events,
    {
      query: "",
      categoryId: "all",
      status: "all",
      period: "all",
      sort: "registrations-desc",
    },
    now,
  );

  assert.deepEqual(
    result.map((event) => event.id),
    ["event-career", "event-react", "event-ai"],
  );
});

test("Фильтрует блокировки по времени до разблокировки", () => {
  const users = [
    { blocked: true, blockedUntil: new Date(now + 12 * 60 * 60 * 1000).toISOString() },
    { blocked: true, blockedUntil: new Date(now + 3 * 86400000).toISOString() },
    { blocked: true, blockedUntil: new Date(now + 10 * 86400000).toISOString() },
    { blocked: true, blockedUntil: null },
    { blocked: false, blockedUntil: null },
  ];

  assert.deepEqual(
    users.filter((user) => filterUsersByBanTime(user, "within-day", now)),
    [users[0]],
  );
  assert.deepEqual(
    users.filter((user) => filterUsersByBanTime(user, "permanent", now)),
    [users[3]],
  );
});

test("Показывает оставшееся время, бессрочную и истёкшую блокировку", () => {
  assert.equal(
    formatBanRemaining(true, new Date(now + 26 * 60 * 60 * 1000).toISOString(), now),
    "1 д. 2 ч.",
  );
  assert.equal(formatBanRemaining(true, null, now), "Без срока");
  assert.equal(
    formatBanRemaining(true, new Date(now - 1000).toISOString(), now),
    "Срок истёк",
  );
  assert.equal(formatBanRemaining(false, null, now), null);
});
