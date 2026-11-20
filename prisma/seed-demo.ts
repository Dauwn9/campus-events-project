import "dotenv/config";
import { EventStatus } from "../src/generated/prisma/enums";
import { getPrisma } from "../src/lib/prisma";
import { mockCategories } from "../src/lib/mocks/categories";
import { mockEvents } from "../src/lib/mocks/events";

const organizerEmail = "organizer1@campus.kz";
const anchorDate = new Date("2026-11-20T00:00:00.000Z");
const eventDayOffsets: Record<string, number> = {
  "evt-1": -21,
  "evt-2": -7,
  "evt-3": 3,
  "evt-4": 7,
  "evt-5": 14,
  "evt-6": 21,
  "evt-7": 28,
  "evt-8": 35,
  "evt-9": 42,
  "evt-10": 49,
  "evt-11": 56,
  "evt-12": 63,
};
const finishedEventIds = new Set(["evt-1", "evt-2"]);

function getEventDates(eventId: string, startsAt: string, endsAt: string) {
  const dayOffset = eventDayOffsets[eventId];
  if (dayOffset === undefined) {
    throw new Error(`Не задано смещение даты для демо-события ${eventId}.`);
  }

  const templateStart = new Date(startsAt);
  const templateEnd = new Date(endsAt);
  const start = new Date(anchorDate);
  start.setUTCDate(start.getUTCDate() + dayOffset);
  start.setUTCHours(
    templateStart.getUTCHours(),
    templateStart.getUTCMinutes(),
    templateStart.getUTCSeconds(),
    templateStart.getUTCMilliseconds(),
  );

  return {
    startsAt: start,
    endsAt: new Date(start.getTime() + templateEnd.getTime() - templateStart.getTime()),
  };
}

async function seedDemo() {
  const prisma = getPrisma();

  try {
    await prisma.$transaction(
      async (tx) => {
        const organizer = await tx.user.findUnique({
          where: { email: organizerEmail },
          select: { id: true, role: true },
        });

        if (!organizer || organizer.role !== "ORGANIZER") {
          throw new Error(
            `Seed остановлен: ${organizerEmail} не найден или его роль не ORGANIZER.`,
          );
        }

        const categoryIds = new Map<string, string>();
        for (const category of mockCategories) {
          const savedCategory = await tx.category.upsert({
            where: { slug: category.slug },
            create: {
              id: category.id,
              name: category.name,
              slug: category.slug,
            },
            update: { name: category.name },
          });
          categoryIds.set(category.id, savedCategory.id);
        }

        for (const event of mockEvents) {
          const categoryId = categoryIds.get(event.categoryId);
          if (!categoryId) {
            throw new Error(
              `Для события ${event.id} не найдена категория ${event.categoryId}.`,
            );
          }

          const dates = getEventDates(event.id, event.startsAt, event.endsAt);
          const eventData = {
            title: event.title,
            description: event.description,
            location: event.location,
            coverUrl: event.imageUrl ?? null,
            ...dates,
            capacity: event.capacity,
            status: finishedEventIds.has(event.id)
              ? EventStatus.FINISHED
              : EventStatus.PUBLISHED,
            rejectionReason: event.rejectionReason ?? null,
            registrationOpensAt: event.registrationOpensAt
              ? new Date(event.registrationOpensAt)
              : null,
            priorityWindowHours: event.priorityWindowHours ?? 0,
            organizerId: organizer.id,
            categoryId,
          };

          await tx.event.upsert({
            where: { id: event.id },
            create: { id: event.id, ...eventData },
            update: eventData,
          });
        }
      },
      { maxWait: 10000, timeout: 60000 },
    );

    console.info(
      `Seeded ${mockCategories.length} categories and ${mockEvents.length} events.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void seedDemo().catch((error: unknown) => {
  console.error("Demo seed failed:", error);
  process.exitCode = 1;
});
