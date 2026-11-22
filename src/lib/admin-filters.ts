export type ModerationPeriod = "all" | "upcoming" | "past";
export type ModerationSort =
  | "date-asc"
  | "date-desc"
  | "registrations-desc"
  | "title-asc";

export type ModerationFilters = {
  query: string;
  categoryId: string;
  status: string;
  period: ModerationPeriod;
  sort: ModerationSort;
};

type ModerationEvent = {
  title: string;
  description?: string;
  location?: string;
  categoryId: string;
  status: string;
  startsAt: string;
  registeredCount: number;
};

export function filterModerationEvents<T extends ModerationEvent>(
  events: readonly T[],
  filters: ModerationFilters,
  now = Date.now(),
) {
  const query = filters.query.trim().toLocaleLowerCase("ru");
  return events
    .filter((event) => {
      const searchableText = [
        event.title,
        event.description ?? "",
        event.location ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("ru");
      const startsAt = Date.parse(event.startsAt);
      const matchesPeriod =
        filters.period === "all" ||
        (filters.period === "upcoming" && startsAt >= now) ||
        (filters.period === "past" && startsAt < now);

      return (
        (!query || searchableText.includes(query)) &&
        (filters.categoryId === "all" ||
          event.categoryId === filters.categoryId) &&
        (filters.status === "all" || event.status === filters.status) &&
        matchesPeriod
      );
    })
    .sort((left, right) => {
      if (filters.sort === "date-desc") {
        return Date.parse(right.startsAt) - Date.parse(left.startsAt);
      }
      if (filters.sort === "registrations-desc") {
        return right.registeredCount - left.registeredCount;
      }
      if (filters.sort === "title-asc") {
        return left.title.localeCompare(right.title, "ru");
      }
      return Date.parse(left.startsAt) - Date.parse(right.startsAt);
    });
}

export type BanTimeFilter =
  | "all"
  | "blocked"
  | "within-day"
  | "within-week"
  | "over-week"
  | "permanent";

type UserBlock = {
  blocked: boolean;
  blockedUntil: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function filterUsersByBanTime(
  user: UserBlock,
  filter: BanTimeFilter,
  now = Date.now(),
) {
  if (filter === "all") return true;
  if (filter === "blocked") return user.blocked;
  if (!user.blocked) return false;
  if (filter === "permanent") return user.blockedUntil === null;
  if (!user.blockedUntil) return false;

  const remaining = Date.parse(user.blockedUntil) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return false;
  if (filter === "within-day") return remaining <= DAY_MS;
  if (filter === "within-week")
    return remaining > DAY_MS && remaining <= 7 * DAY_MS;
  return remaining > 7 * DAY_MS;
}

export function formatBanRemaining(
  blocked: boolean,
  blockedUntil: string | null,
  now = Date.now(),
) {
  if (!blocked) return null;
  if (!blockedUntil) return "Без срока";

  const remaining = Date.parse(blockedUntil) - now;
  if (!Number.isFinite(remaining)) return "Не удалось определить";
  if (remaining <= 0) return "Срок истёк";

  const days = Math.floor(remaining / DAY_MS);
  const hours = Math.floor((remaining % DAY_MS) / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return `${days} д. ${hours} ч.`;
  if (hours > 0) return `${hours} ч. ${minutes} мин.`;
  return `${Math.max(1, minutes)} мин.`;
}
