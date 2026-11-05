import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { mockEvents } from "@/lib/mocks/events";
import { mockCategories } from "@/lib/mocks/categories";
import type { Event } from "@/lib/validators/event";
import type { Category } from "@/lib/validators/category";
import type { Comment } from "@/lib/validators/comment";
import type { Registration } from "@/lib/validators/registration";
import type { Role } from "@/lib/roles";
import { USE_MOCKS, ServiceError } from "./errors";

export type CampusUser = {
  id: string;
  name: string;
  email: string;
  role: Exclude<Role, "GUEST">;
  group: string;
  school: string;
  blocked: boolean;
  passwordHash?: string;
};
export type CampusRegistration = Registration & { shortCode: string };
export type CampusStore = {
  version: 1;
  qrSecret: string;
  users: CampusUser[];
  events: Event[];
  categories: Category[];
  registrations: CampusRegistration[];
  favorites: { userId: string; eventId: string; createdAt: string }[];
  comments: Comment[];
  sessions: { hash: string; userId: string; expires: number }[];
};
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, stored = "") {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function qrToken(store: CampusStore, id: string) {
  return `${id}.${createHmac("sha256", store.qrSecret).update(id).digest("base64url")}`;
}
function seed(): CampusStore {
  const users: CampusUser[] = [
    {
      id: "student-demo",
      name: "Айжан Садыкова",
      email: "student@demo.aiu.kz",
      role: "STUDENT",
      group: "IT-23-1",
      school: "Высшая школа информационных технологий",
      blocked: false,
      passwordHash: hashPassword("Campus2026!"),
    },
    ...[1, 2, 3].map((n) => ({
      id: `org-${n}`,
      name: [
        "Студенческий совет",
        "Центр студенческих инициатив",
        "Карьерный центр",
      ][n - 1],
      email: `organizer${n}@demo.aiu.kz`,
      role: "ORGANIZER" as const,
      group: "",
      school: "AIU",
      blocked: false,
      ...(n === 2 ? { passwordHash: hashPassword("Campus2026!") } : {}),
    })),
    {
      id: "admin-demo",
      name: "Администратор AIU",
      email: "admin@demo.aiu.kz",
      role: "ADMIN",
      group: "",
      school: "AIU",
      blocked: false,
      passwordHash: hashPassword("Campus2026!"),
    },
  ];
  const names = [
    "Алихан",
    "Дана",
    "Тимур",
    "Амина",
    "Ержан",
    "Аружан",
    "Мирас",
    "Алина",
  ];
  const surnames = [
    "Омаров",
    "Ахметова",
    "Сериков",
    "Ким",
    "Алиева",
    "Нурланов",
    "Смагулов",
    "Пак",
  ];
  for (let n = 1; n <= 280; n++)
    users.push({
      id: `student-${n}`,
      name: `${names[n % names.length]} ${surnames[Math.floor(n / names.length) % surnames.length]}`,
      email: `student${n}@demo.aiu.kz`,
      role: "STUDENT",
      group: `AIU-${23 + (n % 3)}-${(n % 5) + 1}`,
      school: "AIU",
      blocked: false,
    });
  const store: CampusStore = {
    version: 1,
    qrSecret: randomBytes(32).toString("hex"),
    users,
    events: structuredClone(mockEvents),
    categories: structuredClone(mockCategories),
    registrations: [],
    favorites: [],
    comments: [],
    sessions: [],
  };
  store.events.find((e) => e.id === "evt-10")!.status = "PENDING";
  for (const event of store.events) {
    for (let n = 0; n < event.registeredCount; n++) {
      const id = `seed-${event.id}-${n}`;
      const checkedIn = event.status === "FINISHED" && n % 4 !== 0;
      store.registrations.push({
        id,
        userId: n === 0 ? "student-demo" : `student-${n}`,
        eventId: event.id,
        status: "CONFIRMED",
        createdAt: "2026-09-01T08:00:00.000Z",
        qrToken: qrToken(store, id),
        shortCode: randomBytes(5).toString("hex").toUpperCase(),
        checkedInAt: checkedIn ? event.startsAt : null,
        checkedInById: checkedIn ? event.organizerId : null,
      });
    }
  }
  store.favorites = ["evt-5", "evt-6", "evt-7"].map((eventId) => ({
    userId: "student-demo",
    eventId,
    createdAt: new Date().toISOString(),
  }));
  store.comments = [
    {
      id: "comment-1",
      eventId: "evt-4",
      userId: "student-2",
      userName: "Айжан",
      text: "Будет ли запись лекции после мероприятия?",
      createdAt: "2026-10-28T09:30:00.000Z",
    },
    {
      id: "comment-3",
      eventId: "evt-5",
      userId: "student-3",
      userName: "Ержан",
      text: "Нужно ли заранее подготовить резюме?",
      createdAt: "2026-10-30T14:15:00.000Z",
    },
  ];
  return store;
}
const initial = globalThis as typeof globalThis & {
  campusDemoSeed?: CampusStore;
};
function consistentState(store: CampusStore) {
  for (const event of store.events) {
    const registrations = store.registrations.filter(
      (r) => r.eventId === event.id,
    );
    if (event.status === "CANCELLED")
      for (const registration of registrations)
        if (!registration.checkedInAt) {
          registration.status = "CANCELLED";
          registration.qrToken = null;
        }
    event.registeredCount = registrations.filter(
      (r) => r.status === "CONFIRMED",
    ).length;
  }
  return store;
}
export function readStore(): CampusStore {
  if (!USE_MOCKS)
    throw new ServiceError(
      "INTERNAL",
      "Сначала подключите реальную базу данных. Этот режим использует локальное демо.",
    );
  const file =
    process.env.CAMPUS_DATA_FILE ??
    join(process.cwd(), ".data", "campus-demo.json");
  // Runtime data and session secrets are deliberately excluded from build tracing.
  if (existsSync(/* turbopackIgnore: true */ file))
    return consistentState(
      JSON.parse(
        readFileSync(/* turbopackIgnore: true */ file, "utf8"),
      ) as CampusStore,
    );
  initial.campusDemoSeed ??= seed();
  return consistentState(structuredClone(initial.campusDemoSeed));
}
/** Single-process local demo transaction: validation, capacity change and atomic disk write are synchronous. */
export function changeStore<T>(operation: (store: CampusStore) => T): T {
  const store = readStore();
  const result = operation(store);
  const file =
    process.env.CAMPUS_DATA_FILE ??
    join(process.cwd(), ".data", "campus-demo.json");
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(store), {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporary, file);
  return result;
}
