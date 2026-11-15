"use client";
import { useState } from "react";
import Link from "next/link";
import type { Event } from "@/lib/validators/event";
import { datePart } from "@/lib/event-design";
import { statusLabels } from "@/lib/status";
import Icon from "@/components/ui/Icon";
export default function EventTable({ events }: { events: Event[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = events.filter(
    (e) =>
      (status === "all" || e.status === status) &&
      e.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="workspace-panel">
      <div className="table-filters">
        <label className="workspace-search">
          <Icon name="search" size={17} />
          <input
            aria-label="Поиск моих событий"
            placeholder="Найти своё событие"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Статус события"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Все статусы</option>
          {Object.entries(statusLabels)
            .filter(([key]) => !["CONFIRMED", "WAITLIST"].includes(key))
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
      </div>
      <div className="workspace-table-wrap">
        <table className="workspace-table">
          <thead>
            <tr>
              <th>Событие</th>
              <th>Дата и время</th>
              <th>Участники</th>
              <th>Статус</th>
              <th>
                <span className="sr-only">Открыть</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => (
              <tr key={event.id}>
                <td data-label="Событие">
                  <Link className="table-title" href={`/organizer/${event.id}`}>
                    {event.title}
                  </Link>
                  <small>{event.location}</small>
                </td>
                <td data-label="Дата и время">
                  {datePart(event.startsAt, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  <small>
                    {datePart(event.startsAt, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · Астана
                  </small>
                </td>
                <td data-label="Участники">
                  <strong>{event.registeredCount}</strong> / {event.capacity}
                  <span className="capacity-meter">
                    <span
                      style={{
                        width: `${Math.min(100, (event.registeredCount / event.capacity) * 100)}%`,
                      }}
                    />
                  </span>
                </td>
                <td data-label="Статус">
                  <span
                    className={`status-tag status-${event.status.toLowerCase()}`}
                  >
                    {statusLabels[event.status]}
                  </span>
                </td>
                <td>
                  <Link
                    className="table-open"
                    href={`/organizer/${event.id}`}
                    aria-label={`Управлять: ${event.title}`}
                  >
                    <Icon name="arrow" size={18} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="workspace-empty compact">
          <h2>Событий с такими условиями нет</h2>
          <p>Измените фильтр или создайте своё первое событие.</p>
          <Link href="/organizer/new" className="workspace-button">
            Создать событие
          </Link>
        </div>
      )}
    </section>
  );
}
