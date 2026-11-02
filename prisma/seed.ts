import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Role,
  PriorityStatus,
  EventStatus,
  RegistrationStatus,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL не задана");
}

// Сид очищает ВСЕ таблицы. Без явного разрешения запускаем его только на локальной базе.
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
if (!isLocal && process.env.ALLOW_REMOTE_SEED !== "true") {
  throw new Error(
    "Сид очищает все таблицы. Для не локальной базы задайте ALLOW_REMOTE_SEED=true",
  );
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// --- помощники для дат ---
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = new Date();
const inDays = (days: number) => new Date(now.getTime() + days * DAY);
const plusHours = (date: Date, hours: number) =>
  new Date(date.getTime() + hours * HOUR);

// Картинки-заглушки для обложек. Если используете next/image,
// добавьте picsum.photos в images.remotePatterns в next.config.ts.
const cover = (slug: string) => `https://picsum.photos/seed/${slug}/800/400`;

// Запись студента, который ПРИШЁЛ на прошедшее событие (отмечен на входе)
const attended = (
  userId: string,
  event: { id: string; startsAt: Date },
  checkedById: string,
) => ({
  userId,
  eventId: event.id,
  status: RegistrationStatus.CONFIRMED,
  createdAt: plusHours(event.startsAt, -3 * 24),
  checkedInAt: plusHours(event.startsAt, 0.25),
  checkedInById: checkedById,
});

async function main() {
  // --- очистка: сначала зависимые таблицы, потом основные ---
  await prisma.comment.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.eventStaff.deleteMany();
  await prisma.eventPriorityMember.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // --- категории ---
  const [catIT, catSport, catScience, catVolunteer, catCareer, catArt] =
    await Promise.all([
      prisma.category.create({ data: { name: "IT" } }),
      prisma.category.create({ data: { name: "Спорт" } }),
      prisma.category.create({ data: { name: "Наука" } }),
      prisma.category.create({ data: { name: "Волонтерство" } }),
      prisma.category.create({ data: { name: "Карьера" } }),
      prisma.category.create({ data: { name: "Искусство" } }),
    ]);

  // --- пользователи ---
  // Пароли здесь не задаются: войти под этими пользователями пока нельзя.
  // На этапе 4 учётки нужно создавать через Better Auth (согласовать с Дашей).
  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@campus.kz",
      role: Role.ADMIN,
      emailVerified: true,
    },
  });

  const organizer1 = await prisma.user.create({
    data: {
      name: "Алдияр",
      email: "organizer1@campus.kz",
      role: Role.ORGANIZER,
      emailVerified: true,
    },
  });

  const organizer2 = await prisma.user.create({
    data: {
      name: "Данияр",
      email: "organizer2@campus.kz",
      role: Role.ORGANIZER,
      emailVerified: true,
    },
  });

  // Айжан: уже «Активный» (3 посещения)
  const student1 = await prisma.user.create({
    data: {
      name: "Айжан",
      email: "student1@campus.kz",
      role: Role.USER,
      emailVerified: true,
      priorityStatus: PriorityStatus.ACTIVE,
      attendedCount: 3,
    },
  });

  // Ержан: 2 посещения, одно до статуса «Активный» (для демо этапа 6)
  const student2 = await prisma.user.create({
    data: {
      name: "Ержан",
      email: "student2@campus.kz",
      role: Role.USER,
      emailVerified: true,
      attendedCount: 2,
    },
  });

  // Мадина: 1 посещение и 1 неявка
  const student3 = await prisma.user.create({
    data: {
      name: "Мадина",
      email: "student3@campus.kz",
      role: Role.USER,
      emailVerified: true,
      attendedCount: 1,
      noShowCount: 1,
    },
  });

  const student4 = await prisma.user.create({
    data: {
      name: "Нуржан",
      email: "student4@campus.kz",
      role: Role.USER,
      emailVerified: true,
    },
  });

  const student5 = await prisma.user.create({
    data: {
      name: "Даурен",
      email: "student5@campus.kz",
      role: Role.USER,
      emailVerified: true,
    },
  });

  // --- прошедшие события (история посещений, «Прошло» в интерфейсе) ---
  const pastEvent1 = await prisma.event.create({
    data: {
      title: "Autumn Hackathon",
      description: "Прошедший хакатон — для истории посещений.",
      location: "IT Hub",
      coverUrl: cover("hackathon"),
      startsAt: inDays(-21),
      endsAt: plusHours(inDays(-21), 6),
      capacity: 60,
      status: EventStatus.PUBLISHED,
      organizerId: organizer1.id,
      categoryId: catIT.id,
    },
  });

  const pastEvent2 = await prisma.event.create({
    data: {
      title: "Career Fair",
      description: "Прошедшая ярмарка вакансий.",
      location: "Conference Hall",
      coverUrl: cover("career-fair"),
      startsAt: inDays(-14),
      endsAt: plusHours(inDays(-14), 5),
      capacity: 80,
      status: EventStatus.PUBLISHED,
      organizerId: organizer2.id,
      categoryId: catCareer.id,
    },
  });

  const pastEvent3 = await prisma.event.create({
    data: {
      title: "Open Lecture: Quantum Computing",
      description: "Прошедшая открытая лекция.",
      location: "Корпус B",
      coverUrl: cover("quantum"),
      startsAt: inDays(-7),
      endsAt: plusHours(inDays(-7), 2),
      capacity: 100,
      status: EventStatus.PUBLISHED,
      organizerId: organizer1.id,
      categoryId: catScience.id,
    },
  });

  // --- опубликованные будущие события ---
  const publishedEvent1 = await prisma.event.create({
    data: {
      title: "React Meetup",
      description: "Встреча студентов-разработчиков.",
      location: "Аудитория 301",
      coverUrl: cover("react-meetup"),
      startsAt: inDays(7),
      endsAt: plusHours(inDays(7), 2),
      capacity: 50,
      status: EventStatus.PUBLISHED,
      organizerId: organizer1.id,
      categoryId: catIT.id,
    },
  });

  const publishedEvent2 = await prisma.event.create({
    data: {
      title: "AI Workshop",
      description: "Основы машинного обучения.",
      location: "IT Hub",
      coverUrl: cover("ai-workshop"),
      startsAt: inDays(10),
      endsAt: plusHours(inDays(10), 2),
      capacity: 40,
      status: EventStatus.PUBLISHED,
      organizerId: organizer1.id,
      categoryId: catIT.id,
    },
  });

  const publishedEvent3 = await prisma.event.create({
    data: {
      title: "Startup Day",
      description: "Презентация стартапов.",
      location: "Conference Hall",
      coverUrl: cover("startup-day"),
      startsAt: inDays(14),
      endsAt: plusHours(inDays(14), 3),
      capacity: 100,
      status: EventStatus.PUBLISHED,
      organizerId: organizer2.id,
      categoryId: catCareer.id,
    },
  });

  const publishedEvent4 = await prisma.event.create({
    data: {
      title: "Volunteer Day",
      description: "Волонтёрская акция.",
      location: "Main Square",
      coverUrl: cover("volunteer-day"),
      startsAt: inDays(5),
      endsAt: plusHours(inDays(5), 4),
      capacity: 70,
      status: EventStatus.PUBLISHED,
      organizerId: organizer2.id,
      categoryId: catVolunteer.id,
    },
  });

  await prisma.event.create({
    data: {
      title: "Science Forum",
      description: "Научная конференция.",
      location: "Корпус B",
      coverUrl: cover("science-forum"),
      startsAt: inDays(20),
      endsAt: plusHours(inDays(20), 3),
      capacity: 120,
      status: EventStatus.PUBLISHED,
      organizerId: organizer1.id,
      categoryId: catScience.id,
    },
  });

  // Событие с 2 местами: для проверки лимита и листа ожидания
  const fullEvent = await prisma.event.create({
    data: {
      title: "Table Tennis Tournament",
      description: "Мало мест (2) — для проверки лимита и листа ожидания.",
      location: "Спортзал",
      coverUrl: cover("table-tennis"),
      startsAt: inDays(6),
      endsAt: plusHours(inDays(6), 3),
      capacity: 2,
      status: EventStatus.PUBLISHED,
      organizerId: organizer2.id,
      categoryId: catSport.id,
    },
  });

  // Событие с приоритетным окном: сейчас идут первые 24 часа записи
  // только для «Активных» и участников приоритетного списка организатора
  const priorityEvent = await prisma.event.create({
    data: {
      title: "Product Summit",
      description: "Запись открыта для «Активных» студентов, для остальных — позже.",
      location: "Conference Hall",
      coverUrl: cover("product-summit"),
      startsAt: inDays(12),
      endsAt: plusHours(inDays(12), 4),
      capacity: 80,
      status: EventStatus.PUBLISHED,
      registrationOpensAt: plusHours(now, -2),
      priorityWindowHours: 24,
      organizerId: organizer2.id,
      categoryId: catCareer.id,
    },
  });

  // --- события на модерации и отклонённое ---
  await prisma.event.create({
    data: {
      title: "Python Intensive",
      description: "Событие ожидает проверки.",
      location: "Lab 1",
      coverUrl: cover("python"),
      startsAt: inDays(15),
      endsAt: plusHours(inDays(15), 2),
      capacity: 30,
      status: EventStatus.PENDING,
      organizerId: organizer1.id,
      categoryId: catIT.id,
    },
  });

  await prisma.event.create({
    data: {
      title: "Cyber Security Day",
      description: "Событие ожидает проверки.",
      location: "Lab 2",
      coverUrl: cover("cyber-security"),
      startsAt: inDays(16),
      endsAt: plusHours(inDays(16), 2),
      capacity: 35,
      status: EventStatus.PENDING,
      organizerId: organizer2.id,
      categoryId: catIT.id,
    },
  });

  await prisma.event.create({
    data: {
      title: "Rejected Event",
      description: "Отклонённое мероприятие.",
      location: "Unknown",
      startsAt: inDays(3),
      endsAt: plusHours(inDays(3), 2),
      capacity: 20,
      status: EventStatus.REJECTED,
      rejectionReason: "Недостаточно информации",
      organizerId: organizer2.id,
      categoryId: catArt.id,
    },
  });

  // --- регистрации ---
  // qrToken у подтверждённых записей добавим на этапе 5,
  // когда появится общий генератор токенов (подпись HMAC).
  await prisma.registration.createMany({
    data: [
      // посещения прошедших событий
      attended(student1.id, pastEvent1, organizer1.id),
      attended(student1.id, pastEvent2, organizer2.id),
      attended(student1.id, pastEvent3, organizer1.id),
      attended(student2.id, pastEvent1, organizer1.id),
      attended(student2.id, pastEvent2, organizer2.id),
      attended(student3.id, pastEvent1, organizer1.id),
      // неявка: записалась и не пришла
      {
        userId: student3.id,
        eventId: pastEvent3.id,
        status: RegistrationStatus.CONFIRMED,
        createdAt: plusHours(pastEvent3.startsAt, -3 * 24),
      },
      // будущие события
      {
        userId: student1.id,
        eventId: publishedEvent1.id,
        status: RegistrationStatus.CONFIRMED,
      },
      {
        userId: student2.id,
        eventId: publishedEvent1.id,
        status: RegistrationStatus.CONFIRMED,
      },
      {
        userId: student3.id,
        eventId: publishedEvent2.id,
        status: RegistrationStatus.CONFIRMED,
      },
      {
        userId: student4.id,
        eventId: publishedEvent3.id,
        status: RegistrationStatus.CANCELLED,
      },
      // «Активный» студент записался в приоритетном окне
      {
        userId: student1.id,
        eventId: priorityEvent.id,
        status: RegistrationStatus.CONFIRMED,
      },
      // событие на 2 места: два подтверждённых и очередь из двух человек
      {
        userId: student1.id,
        eventId: fullEvent.id,
        status: RegistrationStatus.CONFIRMED,
      },
      {
        userId: student2.id,
        eventId: fullEvent.id,
        status: RegistrationStatus.CONFIRMED,
      },
      {
        userId: student4.id,
        eventId: fullEvent.id,
        status: RegistrationStatus.WAITLIST,
        createdAt: plusHours(now, -2),
      },
      {
        userId: student5.id,
        eventId: fullEvent.id,
        status: RegistrationStatus.WAITLIST,
        createdAt: plusHours(now, -1),
      },
    ],
  });

  // --- приоритетный список организатора и волонтёры-сканеры ---
  await prisma.eventPriorityMember.create({
    data: { eventId: priorityEvent.id, userId: student4.id },
  });

  await prisma.eventStaff.create({
    data: { eventId: publishedEvent1.id, userId: student3.id },
  });

  // --- избранное ---
  await prisma.favorite.createMany({
    data: [
      { userId: student1.id, eventId: publishedEvent2.id },
      { userId: student2.id, eventId: publishedEvent3.id },
      { userId: student3.id, eventId: publishedEvent4.id },
      { userId: student4.id, eventId: fullEvent.id },
    ],
  });

  // --- комментарии ---
  await prisma.comment.createMany({
    data: [
      {
        text: "Очень жду это мероприятие!",
        userId: student1.id,
        eventId: publishedEvent1.id,
      },
      {
        text: "Будет ли запись выступления?",
        userId: student2.id,
        eventId: publishedEvent1.id,
      },
      {
        text: "Сколько осталось мест?",
        userId: student3.id,
        eventId: publishedEvent2.id,
      },
      {
        text: "Отличный хакатон, спасибо организаторам!",
        userId: student1.id,
        eventId: pastEvent1.id,
      },
      {
        text: "Можно ли встать в очередь, если места закончились?",
        userId: student5.id,
        eventId: fullEvent.id,
      },
    ],
  });

  const [users, events, registrations] = await Promise.all([
    prisma.user.count(),
    prisma.event.count(),
    prisma.registration.count(),
  ]);
  console.log(
    `Seed completed: ${users} users, ${events} events, ${registrations} registrations (admin: ${admin.email})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());