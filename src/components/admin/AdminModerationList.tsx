"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { eventOperationAction } from "@/app/campus-actions";
import ActionForm from "@/components/workspace/ActionForm";
import EventPoster from "@/components/events/EventPoster";
import HistoryLinkButton from "@/components/admin/HistoryLinkButton";
import Icon from "@/components/ui/Icon";
import { Status } from "@/components/workspace/WorkspaceUI";
import { datePart } from "@/lib/event-design";
import { statusLabels } from "@/lib/status";
import {
  filterModerationEvents,
  type ModerationPeriod,
  type ModerationSort,
} from "@/lib/admin-filters";
import type { Category } from "@/lib/validators/category";
import type { Event } from "@/lib/validators/event";

type Props = {
  events: Event[];
  categories: Category[];
  organizers: { id: string; name: string }[];
  tab: "pending" | "history";
};

const moderationStatuses = {
  pending: [{ value: "PENDING", label: statusLabels.PENDING }],
  history: [
    { value: "PUBLISHED", label: statusLabels.PUBLISHED },
    { value: "REJECTED", label: statusLabels.REJECTED },
  ],
} as const;

export default function AdminModerationList({
  events,
  categories,
  organizers,
  tab,
}: Props) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState<ModerationPeriod>("all");
  const [sort, setSort] = useState<ModerationSort>("date-asc");
  const filtered = useMemo(
    () =>
      filterModerationEvents(
        events,
        { query, categoryId, status, period, sort },
      ),
    [events, query, categoryId, status, period, sort],
  );
  const hasFilters =
    query !== "" ||
    categoryId !== "all" ||
    status !== "all" ||
    period !== "all";

  function resetFilters() {
    setQuery("");
    setCategoryId("all");
    setStatus("all");
    setPeriod("all");
    setSort("date-asc");
  }

  return (
    <>
      <div className="table-filters moderation-filters">
        <label className="workspace-search">
          <Icon name="search" size={17} />
          <input
            aria-label="Поиск событий модерации"
            placeholder="Название, описание или место"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Категория события"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="all">Все категории</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Статус события"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">Все статусы</option>
          {moderationStatuses[tab].map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Период события"
          value={period}
          onChange={(event) =>
            setPeriod(event.target.value as ModerationPeriod)
          }
        >
          <option value="all">Любая дата</option>
          <option value="upcoming">Предстоящие</option>
          <option value="past">Прошедшие</option>
        </select>
        <select
          aria-label="Сортировка событий"
          value={sort}
          onChange={(event) => setSort(event.target.value as ModerationSort)}
        >
          <option value="date-asc">Сначала ближайшие</option>
          <option value="date-desc">Сначала поздние</option>
          <option value="registrations-desc">По числу записей</option>
          <option value="title-asc">По названию</option>
        </select>
      </div>
      <p className="moderation-results" aria-live="polite">
        Найдено событий: <strong>{filtered.length}</strong>
      </p>
      {filtered.length ? (
        <div className="moderation-list">
          {filtered.map((event) => (
            <article className="moderation-card workspace-panel" key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className="moderation-cover-link"
                aria-label={`Открыть событие ${event.title}`}
              >
                <div className="moderation-cover">
                  <EventPoster
                    categoryId={event.categoryId}
                    title={event.title}
                    imageUrl={event.imageUrl}
                  />
                  <Status value={event.status} />
                </div>
              </Link>
              <div className="moderation-body">
                <span className="section-kicker">
                  {categories.find((category) => category.id === event.categoryId)
                    ?.name ?? "Без категории"}{" "}
                  · {organizers.find((user) => user.id === event.organizerId)
                    ?.name ?? "Неизвестный организатор"}
                </span>
                <h2>
                  <Link href={`/events/${event.id}`}>{event.title}</Link>
                </h2>
                <p>{event.description}</p>
                <div className="moderation-meta">
                  <span>
                    {datePart(event.startsAt, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · Астана
                  </span>
                  <span>
                    {event.location} · {event.capacity} мест
                  </span>
                </div>
                {event.rejectionReason && (
                  <p className="form-error">
                    Причина отказа: {event.rejectionReason}
                  </p>
                )}
                <div className="moderation-actions">
                  <div className="moderation-primary-actions">
                    {event.status === "PENDING" && (
                      <>
                        <ActionForm
                          action={eventOperationAction.bind(
                            null,
                            event.id,
                            "approve",
                          )}
                        >
                          <button className="workspace-button">
                            Одобрить и опубликовать
                          </button>
                        </ActionForm>
                        <ActionForm
                          action={eventOperationAction.bind(
                            null,
                            event.id,
                            "reject",
                          )}
                        >
                          <label>
                            <span className="sr-only">
                              Причина отказа: {event.title}
                            </span>
                            <input
                              name="reason"
                              placeholder="Причина отказа"
                              required
                              minLength={5}
                              maxLength={1000}
                            />
                          </label>
                          <button className="workspace-button secondary danger">
                            Отклонить
                          </button>
                        </ActionForm>
                      </>
                    )}
                  </div>
                  <div className="moderation-secondary-actions">
                    <Link
                      className="workspace-button secondary"
                      href={`/events/${event.id}`}
                    >
                      Открыть событие
                      <Icon name="arrow" size={14} />
                    </Link>
                    <HistoryLinkButton
                      entityType="EVENT"
                      entityId={event.id}
                    />
                    <ActionForm
                      action={eventOperationAction.bind(
                        null,
                        event.id,
                        "archive",
                      )}
                      confirm="Переместить событие в архив? Его можно будет восстановить."
                    >
                      <button className="workspace-button secondary">
                        В архив
                      </button>
                    </ActionForm>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="workspace-empty compact">
          <h2>
            {hasFilters
              ? "Событий с такими условиями нет"
              : tab === "pending"
                ? "Всё проверено"
                : "История пока пуста"}
          </h2>
          <p>
            {hasFilters
              ? "Измените параметры фильтрации или сбросьте их."
              : "Новые события появятся здесь, когда организатор отправит их на модерацию."}
          </p>
          {hasFilters && (
            <button
              type="button"
              className="workspace-button secondary"
              onClick={resetFilters}
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      )}
    </>
  );
}
