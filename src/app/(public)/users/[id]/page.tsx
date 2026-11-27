import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyRole } from "@/lib/auth";
import { getPublicProfile, type ProfileEvent } from "@/lib/services/users";
import { datePart } from "@/lib/event-design";

const roleLabels = {
  STUDENT: "Студент",
  ORGANIZER: "Организатор",
  ADMIN: "Администратор",
} as const;

function EventList({ title, events, empty }: { title: string; events: ProfileEvent[]; empty: string }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-xl font-bold">{title}</h2>
      {events.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="rounded-control border border-border p-3">
              <Link href={`/events/${event.id}`} className="font-medium text-primary hover:underline">
                {event.title}
              </Link>
              <p className="text-sm text-muted">
                {datePart(event.startsAt, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · {event.location}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [viewer, { id }] = await Promise.all([
    requireAnyRole("STUDENT", "ORGANIZER", "ADMIN"),
    params,
  ]);
  const profile = await getPublicProfile(viewer, id);
  if (!profile) notFound();

  const initials = profile.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/" className="text-sm text-primary hover:underline">
        ← К афише
      </Link>
      <article className="workspace-panel profile-public space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="profile-avatar" aria-hidden="true">{initials}</span>
          <div>
            <h1 className="text-3xl font-bold">{profile.name}</h1>
            <p className="text-muted">{roleLabels[profile.role]}</p>
          </div>
        </div>
        {profile.isOwn && (
          <p className="form-info">
            Так ваш профиль видят другие{profile.isPrivate ? " — сейчас он закрыт, видно только имя" : ""}.{" "}
            <Link href="/profile" className="text-primary hover:underline">Настройки профиля</Link>
          </p>
        )}
        {!profile.isOwn && profile.isPrivate && profile.canSeeDetails && (
          <p className="form-info">Профиль закрыт. Вы видите его полностью как администратор.</p>
        )}
        {!profile.canSeeDetails ? (
          <p className="text-muted">Профиль закрыт. Пользователь скрыл свои данные.</p>
        ) : (
          <dl className="grid gap-2 sm:grid-cols-3">
            {profile.role === "STUDENT" && (
              <>
                <div>
                  <dt className="text-sm text-muted">Учебная группа</dt>
                  <dd className="font-medium">{profile.group || "Не указана"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Статус</dt>
                  <dd>
                    <span className={`status-tag ${profile.isActive ? "status-active" : ""}`}>
                      {profile.isActive ? "Активный" : "Стандартный"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Посещений</dt>
                  <dd className="font-medium">{profile.attendedCount}</dd>
                </div>
              </>
            )}
          </dl>
        )}
      </article>

      {profile.canSeeDetails && profile.role === "STUDENT" && (
        <EventList title="Пойдёт на события" events={profile.upcoming} empty="Пока нет предстоящих записей." />
      )}
      {profile.canSeeDetails && profile.role === "ORGANIZER" && (
        <EventList title="Проводит события" events={profile.organized} empty="Пока нет опубликованных событий." />
      )}
    </div>
  );
}
