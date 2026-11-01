import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Role,
  EventStatus,
  RegistrationStatus,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL не задана");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.comment.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.eventStaff.deleteMany();
  await prisma.eventPriorityMember.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const categories = await Promise.all([
    prisma.category.create({ data: { name: "IT" } }),
    prisma.category.create({ data: { name: "Спорт" } }),
    prisma.category.create({ data: { name: "Наука" } }),
    prisma.category.create({ data: { name: "Волонтерство" } }),
    prisma.category.create({ data: { name: "Карьера" } }),
    prisma.category.create({ data: { name: "Искусство" } }),
  ]);

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

  const student1 = await prisma.user.create({
    data: {
      name: "Айжан",
      email: "student1@campus.kz",
      role: Role.USER,
      emailVerified: true,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      name: "Ержан",
      email: "student2@campus.kz",
      role: Role.USER,
      emailVerified: true,
    },
  });

  const student3 = await prisma.user.create({
    data: {
      name: "Мадина",
      email: "student3@campus.kz",
      role: Role.USER,
      emailVerified: true,
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

  const now = new Date();

  const publishedEvent1 = await prisma.event.create({
    data: {
      title: "React Meetup",
      description: "Встреча студентов-разработчиков.",
      location: "Аудитория 301",
      startsAt: new Date(now.getTime() + 7 * 86400000),
      endsAt: new Date(now.getTime() + 7 * 86400000 + 7200000),
      capacity: 50,
      status: EventStatus.PUBLISHED,
      organizerId: organizer1.id,
      categoryId: categories[0].id,
    },
  });

  const publishedEvent2 = await prisma.event.create({
    data: {
      title: "AI Workshop",
      description: "Основы машинного обучения.",
      location: "IT Hub",
      startsAt: new Date(now.getTime() + 10 * 86400000),
      endsAt: new Date(now.getTime() + 10 * 86400000 + 7200000),
      capacity: 40,
      status: EventStatus.PUBLISHED,
      organizerId: organizer1.id,
      categoryId: categories[0].id,
    },
  });

  const publishedEvent3 = await prisma.event.create({
    data: {
      title: "Startup Day",
      description: "Презентация стартапов.",
      location: "Conference Hall",
      startsAt: new Date(now.getTime() + 14 * 86400000),
      endsAt: new Date(now.getTime() + 14 * 86400000 + 10800000),
      capacity: 100,
      status: EventStatus.PUBLISHED,
      organizerId: organizer2.id,
      categoryId: categories[4].id,
    },
  });

  const publishedEvent4 = await prisma.event.create({
    data: {
      title: "Volunteer Day",
      description: "Волонтёрская акция.",
      location: "Main Square",
      startsAt: new Date(now.getTime() + 5 * 86400000),
      endsAt: new Date(now.getTime() + 5 * 86400000 + 14400000),
      capacity: 70,
      status: EventStatus.PUBLISHED,
      organizerId: organizer2.id,
      categoryId: categories[3].id,
    },
  });

  const publishedEvent5 = await prisma.event.create({
    data: {
      title: "Science Forum",
      description: "Научная конференция.",
      location: "Корпус B",
      startsAt: new Date(now.getTime() + 20 * 86400000),
      endsAt: new Date(now.getTime() + 20 * 86400000 + 10800000),
      capacity: 120,
      status: EventStatus.PUBLISHED,
      organizerId: organizer1.id,
      categoryId: categories[2].id,
    },
  });

  await prisma.event.create({
    data: {
      title: "Python Intensive",
      description: "Событие ожидает проверки.",
      location: "Lab 1",
      startsAt: new Date(now.getTime() + 15 * 86400000),
      endsAt: new Date(now.getTime() + 15 * 86400000 + 7200000),
      capacity: 30,
      status: EventStatus.PENDING,
      organizerId: organizer1.id,
      categoryId: categories[0].id,
    },
  });

  await prisma.event.create({
    data: {
      title: "Cyber Security Day",
      description: "Событие ожидает проверки.",
      location: "Lab 2",
      startsAt: new Date(now.getTime() + 16 * 86400000),
      endsAt: new Date(now.getTime() + 16 * 86400000 + 7200000),
      capacity: 35,
      status: EventStatus.PENDING,
      organizerId: organizer2.id,
      categoryId: categories[0].id,
    },
  });

  await prisma.event.create({
    data: {
      title: "Rejected Event",
      description: "Отклонённое мероприятие.",
      location: "Unknown",
      startsAt: new Date(now.getTime() + 3 * 86400000),
      endsAt: new Date(now.getTime() + 3 * 86400000 + 7200000),
      capacity: 20,
      status: EventStatus.REJECTED,
      rejectionReason: "Недостаточно информации",
      organizerId: organizer2.id,
      categoryId: categories[5].id,
    },
  });

  await prisma.registration.createMany({
    data: [
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
      {
        userId: student5.id,
        eventId: publishedEvent3.id,
        status: RegistrationStatus.WAITLIST,
      },
    ],
  });

  await prisma.favorite.createMany({
    data: [
      {
        userId: student1.id,
        eventId: publishedEvent2.id,
      },
      {
        userId: student2.id,
        eventId: publishedEvent3.id,
      },
      {
        userId: student3.id,
        eventId: publishedEvent4.id,
      },
    ],
  });

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
    ],
  });

  console.log("Seed completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());