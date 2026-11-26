import { randomUUID } from "node:crypto";
import {
  changeStore,
  readStore,
  type CampusFriendship,
} from "./demo-store";
import { assertRole, type Actor } from "./campus";
import { ServiceError, USE_MOCKS } from "./errors";
import { getPrisma } from "@/lib/prisma";
import { eventInclude, toEventDto } from "./event-prisma";

type FriendState = "NONE" | "OUTGOING" | "INCOMING" | "FRIENDS";

function friendshipBetween(
  friendships: CampusFriendship[],
  firstUserId: string,
  secondUserId: string,
) {
  return friendships.find(
    (friendship) =>
      (friendship.requesterId === firstUserId &&
        friendship.recipientId === secondUserId) ||
      (friendship.requesterId === secondUserId &&
        friendship.recipientId === firstUserId),
  );
}

function friendState(
  friendships: CampusFriendship[],
  actorId: string,
  otherUserId: string,
): FriendState {
  const friendship = friendshipBetween(friendships, actorId, otherUserId);
  if (!friendship) return "NONE";
  if (friendship.status === "ACCEPTED") return "FRIENDS";
  return friendship.requesterId === actorId ? "OUTGOING" : "INCOMING";
}

export function getFriendsPageData(actor: Actor, search = "") {
  if (USE_MOCKS) {
    const store = readStore();
    assertRole(actor, ["STUDENT"], store);
    return getMockFriendsPageData(actor, search, store);
  }
  assertRole(actor, ["STUDENT"]);
  return getPrismaFriendsPageData(actor, search);
}

function getMockFriendsPageData(
  actor: Actor,
  search: string,
  store: ReturnType<typeof readStore>,
) {
  const usersById = new Map(store.users.map((user) => [user.id, user]));
  const currentUserId = actor.id;
  const ownFriendships = store.friendships.filter(
    (friendship) =>
      friendship.requesterId === currentUserId ||
      friendship.recipientId === currentUserId,
  );
  const publicStudent = (id: string) => {
    const user = usersById.get(id);
    return user
      ? { id: user.id, name: user.name, group: user.group }
      : null;
  };
  const incoming = ownFriendships
    .filter(
      (friendship) =>
        friendship.status === "PENDING" &&
        friendship.recipientId === currentUserId,
    )
    .flatMap((friendship) => {
      const user = publicStudent(friendship.requesterId);
      return user ? [{ id: friendship.id, user }] : [];
    });
  const outgoing = ownFriendships
    .filter(
      (friendship) =>
        friendship.status === "PENDING" &&
        friendship.requesterId === currentUserId,
    )
    .flatMap((friendship) => {
      const user = publicStudent(friendship.recipientId);
      return user ? [{ id: friendship.id, user }] : [];
    });
  const friends = ownFriendships
    .filter((friendship) => friendship.status === "ACCEPTED")
    .flatMap((friendship) => {
      const userId =
        friendship.requesterId === currentUserId
          ? friendship.recipientId
          : friendship.requesterId;
      const user = publicStudent(userId);
      return user ? [{ ...user, friendshipId: friendship.id }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const friendIds = new Set(friends.map((friend) => friend.id));
  const eventsById = new Map<
    string,
    { event: (typeof store.events)[number]; friends: { id: string; name: string }[] }
  >();
  const now = Date.now();
  for (const registration of store.registrations) {
    if (
      !friendIds.has(registration.userId) ||
      registration.status !== "CONFIRMED"
    )
      continue;
    const event = store.events.find(
      (item) =>
        item.id === registration.eventId &&
        item.status === "PUBLISHED" &&
        !item.archivedAt &&
        Date.parse(item.startsAt) >= now,
    );
    if (!event) continue;
    const friend = usersById.get(registration.userId);
    if (!friend) continue;
    const entry = eventsById.get(event.id) ?? { event, friends: [] };
    entry.friends.push({ id: friend.id, name: friend.name });
    eventsById.set(event.id, entry);
  }
  const friendEvents = [...eventsById.values()].sort((a, b) =>
    a.event.startsAt.localeCompare(b.event.startsAt),
  );

  const query = search.trim().toLocaleLowerCase("ru");
  const searchResults =
    query.length < 2
      ? []
      : store.users
          .filter(
            (user) =>
              user.role === "STUDENT" &&
              user.id !== currentUserId &&
              `${user.name} ${user.email} ${user.group}`
                .toLocaleLowerCase("ru")
                .includes(query),
          )
          .slice(0, 20)
          .map((user) => ({
            id: user.id,
            name: user.name,
            group: user.group,
            state: friendState(store.friendships, currentUserId, user.id),
          }));

  return { incoming, outgoing, friends, friendEvents, searchResults };
}

async function getPrismaFriendsPageData(actor: Actor, search: string) {
  const prisma = getPrisma();
  const [friendships, query] = await Promise.all([
    prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: actor.id }, { recipientId: actor.id }],
      },
      include: {
        requester: { select: { id: true, name: true, group: true } },
        recipient: { select: { id: true, name: true, group: true } },
      },
    }),
    search.trim().length < 2
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: {
            role: "STUDENT",
            id: { not: actor.id },
            OR: [
              { name: { contains: search.trim(), mode: "insensitive" } },
              { email: { contains: search.trim(), mode: "insensitive" } },
              { group: { contains: search.trim(), mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true, group: true },
          take: 20,
          orderBy: { name: "asc" },
        }),
  ]);
  const incoming = friendships
    .filter((friendship) => friendship.status === "PENDING" && friendship.recipientId === actor.id)
    .map((friendship) => ({
      id: friendship.id,
      user: friendship.requester,
    }));
  const outgoing = friendships
    .filter((friendship) => friendship.status === "PENDING" && friendship.requesterId === actor.id)
    .map((friendship) => ({
      id: friendship.id,
      user: friendship.recipient,
    }));
  const friends = friendships
    .filter((friendship) => friendship.status === "ACCEPTED")
    .map((friendship) => ({
      ...(friendship.requesterId === actor.id
        ? friendship.recipient
        : friendship.requester),
      friendshipId: friendship.id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const friendIds = friends.map((friend) => friend.id);
  const registrations = friendIds.length
    ? await getPrisma().registration.findMany({
        where: {
          userId: { in: friendIds },
          status: "CONFIRMED",
          event: {
            status: "PUBLISHED",
            archivedAt: null,
            startsAt: { gte: new Date() },
          },
        },
        include: {
          user: { select: { id: true, name: true } },
          event: { include: eventInclude },
        },
        orderBy: { event: { startsAt: "asc" } },
      })
    : [];
  const eventMap = new Map<string, {
    event: ReturnType<typeof toEventDto>;
    friends: { id: string; name: string }[];
  }>();
  for (const registration of registrations) {
    const entry = eventMap.get(registration.eventId) ?? {
      event: toEventDto(registration.event),
      friends: [],
    };
    entry.friends.push(registration.user);
    eventMap.set(registration.eventId, entry);
  }
  const friendshipByPair = new Map(
    friendships.map((friendship) => [
      [friendship.requesterId, friendship.recipientId].sort().join(":"),
      friendship,
    ]),
  );
  const searchResults = query.map((user) => {
    const friendship = friendshipByPair.get([actor.id, user.id].sort().join(":"));
    return {
      ...user,
      state: !friendship
        ? "NONE" as const
        : friendship.status === "ACCEPTED"
          ? "FRIENDS" as const
          : friendship.requesterId === actor.id
            ? "OUTGOING" as const
            : "INCOMING" as const,
    };
  });
  return {
    incoming,
    outgoing,
    friends,
    friendEvents: [...eventMap.values()],
    searchResults,
  };
}

export function sendFriendRequest(actor: Actor, recipientId: string) {
  if (USE_MOCKS) {
    return changeStore((store) => {
      assertRole(actor, ["STUDENT"], store);
      if (actor.id === recipientId) {
        throw new ServiceError("FORBIDDEN", "Нельзя добавить в друзья самого себя.");
      }
      const recipient = store.users.find(
        (user) => user.id === recipientId && user.role === "STUDENT",
      );
      if (!recipient) {
        throw new ServiceError("NOT_FOUND", "Студент не найден.");
      }
      if (friendshipBetween(store.friendships, actor.id, recipientId)) {
        throw new ServiceError(
          "ALREADY_EXISTS",
          "Запрос или дружба с этим студентом уже существует.",
        );
      }
      const friendship: CampusFriendship = {
        id: randomUUID(),
        requesterId: actor.id,
        recipientId,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      };
      store.friendships.push(friendship);
      return friendship;
    });
  }

  assertRole(actor, ["STUDENT"]);
  if (actor.id === recipientId) {
    throw new ServiceError("FORBIDDEN", "Нельзя добавить в друзья самого себя.");
  }
  return (async () => {
    const prisma = getPrisma();
    const recipient = await prisma.user.findFirst({
      where: { id: recipientId, role: "STUDENT" },
      select: { id: true },
    });
    if (!recipient) throw new ServiceError("NOT_FOUND", "Студент не найден.");
    const pairKey = [actor.id, recipientId].sort().join(":");
    try {
      return await prisma.friendship.create({
        data: { requesterId: actor.id, recipientId, pairKey },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new ServiceError(
          "ALREADY_EXISTS",
          "Запрос или дружба с этим студентом уже существует.",
        );
      }
      throw error;
    }
  })();
}

export function respondToFriendRequest(
  actor: Actor,
  friendshipId: string,
  accept: boolean,
) {
  if (USE_MOCKS) {
    return changeStore((store) => {
      assertRole(actor, ["STUDENT"], store);
      const friendship = store.friendships.find(
        (item) =>
          item.id === friendshipId &&
          item.recipientId === actor.id &&
          item.status === "PENDING",
      );
      if (!friendship) {
        throw new ServiceError("NOT_FOUND", "Запрос в друзья не найден.");
      }
      if (accept) {
        friendship.status = "ACCEPTED";
        return friendship;
      }
      store.friendships = store.friendships.filter(
        (item) => item.id !== friendshipId,
      );
      return null;
    });
  }

  assertRole(actor, ["STUDENT"]);
  return (async () => {
    const prisma = getPrisma();
    const friendship = await prisma.friendship.findFirst({
      where: {
        id: friendshipId,
        recipientId: actor.id,
        status: "PENDING",
      },
    });
    if (!friendship)
      throw new ServiceError("NOT_FOUND", "Запрос в друзья не найден.");
    return accept
      ? prisma.friendship.update({
          where: { id: friendship.id },
          data: { status: "ACCEPTED" },
        })
      : prisma.friendship.delete({ where: { id: friendship.id } });
  })();
}

export function removeFriend(actor: Actor, otherUserId: string) {
  if (USE_MOCKS) {
    return changeStore((store) => {
      assertRole(actor, ["STUDENT"], store);
      const friendship = friendshipBetween(
        store.friendships,
        actor.id,
        otherUserId,
      );
      if (!friendship || friendship.status !== "ACCEPTED") {
        throw new ServiceError("NOT_FOUND", "Друг не найден.");
      }
      store.friendships = store.friendships.filter(
        (item) => item.id !== friendship.id,
      );
    });
  }

  assertRole(actor, ["STUDENT"]);
  return (async () => {
    const pairKey = [actor.id, otherUserId].sort().join(":");
    const friendship = await getPrisma().friendship.findFirst({
      where: { pairKey, status: "ACCEPTED" },
      select: { id: true },
    });
    if (!friendship) throw new ServiceError("NOT_FOUND", "Друг не найден.");
    await getPrisma().friendship.delete({ where: { id: friendship.id } });
  })();
}
