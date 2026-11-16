import { randomUUID } from "node:crypto";
import {
  changeStore,
  readStore,
  type CampusFriendship,
} from "./demo-store";
import { assertRole, type Actor } from "./campus";
import { ServiceError } from "./errors";

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
  const store = readStore();
  assertRole(actor, ["STUDENT"], store);
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

export function sendFriendRequest(actor: Actor, recipientId: string) {
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

export function respondToFriendRequest(
  actor: Actor,
  friendshipId: string,
  accept: boolean,
) {
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

export function removeFriend(actor: Actor, otherUserId: string) {
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
