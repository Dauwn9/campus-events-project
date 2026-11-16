import Link from "next/link";
import {
  respondToFriendRequestAction,
  removeFriendAction,
  sendFriendRequestAction,
} from "@/app/social-actions";
import { getFriendsPageData } from "@/lib/services/social";
import { requireRole } from "@/lib/auth";
import { datePart } from "@/lib/event-design";
import { PageHeading, Empty, Status } from "@/components/workspace/WorkspaceUI";

const errors: Record<string, string> = {
  FORBIDDEN: "Это действие недоступно.",
  NOT_FOUND: "Студент или запрос не найден.",
  ALREADY_EXISTS: "Запрос или дружба с этим студентом уже существует.",
};

const successes: Record<string, string> = {
  "request-sent": "Запрос в друзья отправлен.",
  accepted: "Запрос принят. Теперь вы друзья.",
  declined: "Запрос отклонён.",
  removed: "Пользователь удалён из друзей.",
};

function FriendActions({
  friendshipId,
}: {
  friendshipId: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {["accept", "decline"].map((decision) => (
        <form action={respondToFriendRequestAction} key={decision}>
          <input type="hidden" name="friendshipId" value={friendshipId} />
          <input type="hidden" name="decision" value={decision} />
          <button
            className={
              decision === "accept"
                ? "workspace-button"
                : "workspace-button secondary"
            }
          >
            {decision === "accept" ? "Принять" : "Отклонить"}
          </button>
        </form>
      ))}
    </div>
  );
}

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const [student, query] = await Promise.all([requireRole("STUDENT"), searchParams]);
  const data = getFriendsPageData(student, query.q ?? "");

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="СТУДЕНЧЕСКОЕ СООБЩЕСТВО"
        title="Друзья"
        text="Добавляйте знакомых студентов и находите события, на которые они записались."
      />

      {query.error && (
        <p role="alert" className="form-error">
          {errors[query.error] ?? "Не удалось выполнить действие."}
        </p>
      )}
      {query.success && successes[query.success] && (
        <p role="status" className="form-success">
          {successes[query.success]}
        </p>
      )}

      <section className="workspace-panel space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Найти студента</h2>
          <p className="mt-1 text-sm text-muted">
            Ищите по имени, учебной группе или почте.
          </p>
        </div>
        <form action="/friends" className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="friend-search" className="sr-only">
            Поиск студента
          </label>
          <input
            id="friend-search"
            name="q"
            type="search"
            minLength={2}
            maxLength={80}
            defaultValue={query.q}
            placeholder="Например, Айжан или AIU-25"
            className="min-h-11 w-full rounded-control border border-border bg-white px-3 sm:max-w-md"
          />
          <button className="workspace-button">Найти</button>
        </form>
        {query.q && data.searchResults.length === 0 && (
          <p className="text-sm text-muted">Студенты не найдены.</p>
        )}
        {data.searchResults.length > 0 && (
          <ul className="divide-y divide-border">
            {data.searchResults.map((result) => (
              <li
                key={result.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">{result.name}</p>
                  <p className="text-sm text-muted">{result.group}</p>
                </div>
                {result.state === "NONE" ? (
                  <form action={sendFriendRequestAction}>
                    <input
                      type="hidden"
                      name="studentId"
                      value={result.id}
                    />
                    <button className="workspace-button secondary">
                      Добавить в друзья
                    </button>
                  </form>
                ) : (
                  <span className="text-sm text-muted">
                    {result.state === "FRIENDS"
                      ? "Уже в друзьях"
                      : result.state === "OUTGOING"
                        ? "Запрос отправлен"
                        : "Проверьте входящие запросы"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {query.q && query.q.trim().length < 2 && (
          <p className="text-sm text-muted">
            Для поиска введите не менее двух символов.
          </p>
        )}
      </section>

      {data.incoming.length > 0 && (
        <section className="workspace-panel space-y-3">
          <h2 className="text-lg font-semibold">
            Входящие запросы · {data.incoming.length}
          </h2>
          {data.incoming.map(({ id, user }) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3"
              key={id}
            >
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted">{user.group}</p>
              </div>
              <FriendActions friendshipId={id} />
            </div>
          ))}
        </section>
      )}

      <section className="workspace-panel space-y-3">
        <h2 className="text-lg font-semibold">Мои друзья · {data.friends.length}</h2>
        {data.friends.length === 0 ? (
          <Empty
            title="Пока нет друзей"
            text="Найдите знакомых студентов и отправьте им запрос в друзья."
          />
        ) : (
          <ul className="divide-y divide-border">
            {data.friends.map((friend) => (
              <li
                key={friend.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">{friend.name}</p>
                  <p className="text-sm text-muted">{friend.group}</p>
                </div>
                <form action={removeFriendAction}>
                  <input type="hidden" name="studentId" value={friend.id} />
                  <button className="workspace-button secondary">
                    Удалить из друзей
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">События друзей</h2>
          <p className="mt-1 text-sm text-muted">
            Предстоящие опубликованные события, на которые записались ваши друзья.
          </p>
        </div>
        {data.friendEvents.length === 0 ? (
          <div className="workspace-panel">
            <Empty
              title="Пока нет общих планов"
              text="Когда друзья запишутся на предстоящие события, они появятся здесь."
            />
          </div>
        ) : (
          <ul className="grid gap-3">
            {data.friendEvents.map(({ event, friends }) => (
              <li className="workspace-panel" key={event.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted">
                      Идут: {friends.map((friend) => friend.name).join(", ")}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">{event.title}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {datePart(event.startsAt, {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {event.location}
                    </p>
                  </div>
                  <Status value={event.status} />
                </div>
                <Link
                  href={`/events/${event.id}`}
                  className="workspace-button mt-4"
                >
                  Посмотреть и записаться
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.outgoing.length > 0 && (
        <section className="workspace-panel space-y-3">
          <h2 className="text-lg font-semibold">Ожидают ответа</h2>
          {data.outgoing.map(({ id, user }) => (
            <p className="text-sm text-muted" key={id}>
              {user.name} · запрос отправлен
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
