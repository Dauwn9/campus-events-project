import Link from "next/link";
import type { Event } from "@/lib/validators/event";
import { datePart } from "@/lib/event-design";
import EventPoster from "@/components/events/EventPoster";
import Icon from "@/components/ui/Icon";
export default function StudentEventCard({
  event,
  children,
}: {
  event: Event;
  children?: React.ReactNode;
}) {
  return (
    <article className="student-event-card">
      <Link href={`/events/${event.id}`} className="student-card-cover">
        <EventPoster
          categoryId={event.categoryId}
          title={event.title}
          imageUrl={event.imageUrl}
        />
      </Link>
      <div className="student-card-body">
        <span className="section-kicker">
          {datePart(event.startsAt, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
        <Link href={`/events/${event.id}`}>
          <h2>{event.title}</h2>
        </Link>
        <p>{event.description}</p>
        <div className="student-card-meta">
          <span>
            <Icon name="clock" size={15} />
            {datePart(event.startsAt, { hour: "2-digit", minute: "2-digit" })} ·
            Астана
          </span>
          <span>
            <Icon name="pin" size={15} />
            {event.location}
          </span>
        </div>
        {children}
      </div>
    </article>
  );
}
