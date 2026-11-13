import { notFound } from "next/navigation";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { addCommentAction } from "@/app/admin-actions";
import { getCategoryById } from "@/lib/services/categories";
import { getComments } from "@/lib/services/comments";
import { getEventById } from "@/lib/services/events";
import EventPoster from "@/components/events/EventPoster";
import { datePart } from "@/lib/event-design";
import { getEventRegistrationState } from "@/lib/services/registrations";
import { getMyFavoriteIds } from "@/lib/services/favorites";
import { registerAction, favoriteAction, deleteCommentAction } from "@/app/campus-actions";
import ActionForm from "@/components/workspace/ActionForm";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ commentError?: string; commentStatus?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const event = await getEventById(id);
  if (!event) notFound();

  const [category, comments, user] = await Promise.all([
    getCategoryById(event.categoryId),
    getComments(id),
    getCurrentUser(),
  ]);
  const canComment = user.role === "STUDENT";
  if (!["PUBLISHED","FINISHED","CANCELLED"].includes(event.status) && user.role!=="ADMIN" && !(user.role==="ORGANIZER"&&user.id===event.organizerId)) notFound();
  const registration = user.role==="STUDENT" ? await getEventRegistrationState(id) : null;
  const isFavorite = user.role==="STUDENT" ? (await getMyFavoriteIds()).includes(id) : false;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/" className="text-sm text-primary hover:underline">
        ← К афише
      </Link>
      <article className="space-y-4">
        <div className="detail-cover"><EventPoster categoryId={event.categoryId} title={event.title} imageUrl={event.imageUrl} large /></div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold">{event.title}</h1>
          {category && <Badge>{category.name}</Badge>}
        </div>
        <p className="text-muted">{event.description}</p>
        <Card className="grid gap-3 sm:grid-cols-2">
          <p>
            <span className="font-medium">Когда: </span>
            {datePart(event.startsAt, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} (Астана)
          </p>
          <p>
            <span className="font-medium">Место: </span>
            {event.location}
          </p>
          <p>
            <span className="font-medium">Свободно мест: </span>
            {Math.max(0, event.capacity - event.registeredCount)}
          </p>
        </Card>
      </article>

      <section className="event-registration-panel" aria-label="Участие в событии">
        <div><h2>{registration?.state==="REGISTERED"?"Вы в списке участников":registration?.state==="WAITLISTED"?"Вы в листе ожидания":"Станьте частью события"}</h2><p>{event.status==="CANCELLED"?"Организатор отменил это событие.":registration?.state==="REGISTERED"?"Покажите QR-билет организатору на входе.":registration?.state==="WAITLISTED"?"При освобождении места запись подтвердится автоматически.":"Выбирайте встречи, которые сделают вашу студенческую жизнь ярче."}</p></div>
        <div className="registration-buttons">
          {user.role==="STUDENT"?<>
            {registration?.state==="REGISTERED"||registration?.state==="WAITLISTED"?<Link className="workspace-button" href="/my-registrations">Мои билеты →</Link>:registration?.state==="PAST"?<span className="status-tag">Запись закрыта</span>:registration?.state==="NOT_OPEN_YET"?<p className="form-info">Запись откроется {registration.opensAt&&datePart(registration.opensAt,{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})} (Астана).</p>:<ActionForm action={registerAction.bind(null,id)}><button className="workspace-button">{registration?.state==="PRIORITY_REGISTER"?"Приоритетная запись":registration?.state==="JOIN_WAITLIST"?"Встать в очередь":"Записаться"}</button></ActionForm>}
            {["PUBLISHED","FINISHED"].includes(event.status)&&<ActionForm action={favoriteAction.bind(null,id)}><button className="workspace-button secondary">{isFavorite?"Убрать из избранного":"В избранное"}</button></ActionForm>}
          </>:user.role==="GUEST"?<Link href="/login" className="workspace-button">Войти и записаться →</Link>:<Link href={user.role==="ADMIN"?"/admin/moderation":"/organizer"} className="workspace-button secondary">В рабочий кабинет →</Link>}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="comments-heading">
        <h2 id="comments-heading" className="text-2xl font-bold">
          Комментарии ({comments.length})
        </h2>
        {query.commentStatus === "added" && (
          <p role="status" className="text-sm text-green-700">
            Комментарий добавлен.
          </p>
        )}
        {query.commentError === "invalid" && (
          <p role="alert" className="text-sm text-red-700">
            Напишите комментарий длиной до 1000 символов.
          </p>
        )}
        {comments.length === 0 ? (
          <p className="text-muted">Пока нет комментариев. Будьте первым!</p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <Card key={comment.id} className="space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{comment.userName}</span>
                  <time className="text-sm text-muted" dateTime={comment.createdAt}>
                    {new Date(comment.createdAt).toLocaleString("ru-RU")}
                  </time>
                </div>
                <p className="whitespace-pre-wrap">{comment.text}</p>
                {(user.role==="ADMIN"||user.id===comment.userId)&&<ActionForm action={deleteCommentAction.bind(null,comment.id)} confirm="Удалить этот комментарий?"><button className="comment-delete">Удалить комментарий</button></ActionForm>}
              </Card>
            ))}
          </div>
        )}
        {canComment ? (
          <form action={addCommentAction} className="space-y-3">
            <input type="hidden" name="eventId" value={event.id} />
            <label htmlFor="comment-text" className="block font-medium">
              Ваш комментарий
            </label>
            <textarea
              id="comment-text"
              name="text"
              required
              maxLength={1000}
              rows={4}
              className="w-full rounded-control border border-border px-3 py-2 outline-none focus:border-primary"
              placeholder="Поделитесь впечатлениями или задайте вопрос"
            />
            <button
              type="submit"
              className="rounded-control bg-primary px-4 py-2 text-white hover:bg-primary-hover"
            >
              Отправить
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">
            <Link href="/login" className="text-primary hover:underline">
              Войдите как студент
            </Link>
            , чтобы оставить комментарий.
          </p>
        )}
      </section>
    </div>
  );
}
