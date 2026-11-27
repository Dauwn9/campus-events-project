import { changeStore, readStore } from "./demo-store";
import { ServiceError, USE_MOCKS } from "./errors";
import { getPrisma } from "@/lib/prisma";
import { toAppRole, type AuthenticatedRole, type Role } from "@/lib/roles";

export type ProfileViewer = { id: string; role: Role };

export type ProfileEvent = {
  id: string;
  title: string;
  startsAt: string;
  location: string;
};

export type PublicProfile = {
  id: string;
  name: string;
  role: AuthenticatedRole;
  isPrivate: boolean;
  isOwn: boolean;
  /** false — закрытый профиль, который смотрит не владелец и не админ. */
  canSeeDetails: boolean;
  group: string;
  isActive: boolean;
  attendedCount: number;
  /** Предстоящие события, на которые человек записан (для студента). */
  upcoming: ProfileEvent[];
  /** Опубликованные предстоящие события организатора. */
  organized: ProfileEvent[];
};

/**
 * Публичный профиль. Email не отдаётся никогда. В закрытом профиле другие
 * видят только имя и роль; сам пользователь и админ видят всё.
 */
export async function getPublicProfile(
  viewer: ProfileViewer,
  userId: string,
): Promise<PublicProfile | null> {
  if (!USE_MOCKS) {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        group: true,
        priorityStatus: true,
        attendedCount: true,
        profilePrivate: true,
      },
    });
    const role = user ? toAppRole(user.role) : "GUEST";
    if (!user || role === "GUEST") return null;
    const isOwn = viewer.id === user.id;
    const canSeeDetails =
      !user.profilePrivate || isOwn || viewer.role === "ADMIN";
    const base = {
      id: user.id,
      name: user.name,
      role,
      isPrivate: user.profilePrivate,
      isOwn,
      canSeeDetails,
    };
    if (!canSeeDetails)
      return { ...base, group: "", isActive: false, attendedCount: 0, upcoming: [], organized: [] };

    const now = new Date();
    const visibleEvent = { status: "PUBLISHED" as const, archivedAt: null, startsAt: { gt: now } };
    const [registrations, organized] = await Promise.all([
      prisma.registration.findMany({
        where: { userId: user.id, status: "CONFIRMED", event: visibleEvent },
        select: { event: { select: { id: true, title: true, startsAt: true, location: true } } },
        orderBy: { event: { startsAt: "asc" } },
        take: 20,
      }),
      prisma.event.findMany({
        where: { organizerId: user.id, ...visibleEvent },
        select: { id: true, title: true, startsAt: true, location: true },
        orderBy: { startsAt: "asc" },
        take: 20,
      }),
    ]);
    const toProfileEvent = (event: { id: string; title: string; startsAt: Date; location: string }) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      location: event.location,
    });
    return {
      ...base,
      group: user.group ?? "",
      isActive: user.priorityStatus === "ACTIVE",
      attendedCount: user.attendedCount,
      upcoming: registrations.map((registration) => toProfileEvent(registration.event)),
      organized: organized.map(toProfileEvent),
    };
  }

  const store = readStore();
  const user = store.users.find((item) => item.id === userId);
  if (!user) return null;
  const isPrivate = Boolean(user.profilePrivate);
  const isOwn = viewer.id === user.id;
  const canSeeDetails = !isPrivate || isOwn || viewer.role === "ADMIN";
  const base = { id: user.id, name: user.name, role: user.role, isPrivate, isOwn, canSeeDetails };
  if (!canSeeDetails)
    return { ...base, group: "", isActive: false, attendedCount: 0, upcoming: [], organized: [] };
  const now = new Date().toISOString();
  const visible = (eventId: string) =>
    store.events.find(
      (event) => event.id === eventId && event.status === "PUBLISHED" && !event.archivedAt && event.startsAt > now,
    );
  const toProfileEvent = (event: { id: string; title: string; startsAt: string; location: string }) => ({
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    location: event.location,
  });
  return {
    ...base,
    group: user.group,
    isActive: user.priorityStatus === "ACTIVE",
    attendedCount: store.registrations.filter((r) => r.userId === user.id && r.checkedInAt).length,
    upcoming: store.registrations
      .filter((r) => r.userId === user.id && r.status === "CONFIRMED")
      .flatMap((r) => {
        const event = visible(r.eventId);
        return event ? [toProfileEvent(event)] : [];
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    organized: store.events
      .filter((event) => event.organizerId === user.id && visible(event.id))
      .map(toProfileEvent)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  };
}

/** Текущая настройка приватности пользователя. */
export async function getProfilePrivacy(userId: string): Promise<boolean> {
  if (!USE_MOCKS) {
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { profilePrivate: true },
    });
    return Boolean(user?.profilePrivate);
  }
  return Boolean(readStore().users.find((user) => user.id === userId)?.profilePrivate);
}

/** Пользователь сам открывает или закрывает свой профиль. */
export async function setProfilePrivacy(userId: string, isPrivate: boolean) {
  if (!USE_MOCKS) {
    const updated = await getPrisma().user.update({
      where: { id: userId },
      data: { profilePrivate: isPrivate },
      select: { profilePrivate: true },
    });
    return { profilePrivate: updated.profilePrivate };
  }
  return changeStore((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user) throw new ServiceError("NOT_FOUND", "Пользователь не найден.");
    user.profilePrivate = isPrivate;
    return { profilePrivate: isPrivate };
  });
}
