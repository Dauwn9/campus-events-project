"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import type { Event } from "@/lib/validators/event";
import type { Category } from "@/lib/validators/category";
import { saveEventAction } from "@/app/campus-actions";
import EventPoster from "@/components/events/EventPoster";
import Icon from "@/components/ui/Icon";
const localValue = (value?: string) =>
  value
    ? new Date(Date.parse(value) + 5 * 3600000).toISOString().slice(0, 16)
    : "";
export default function EventForm({
  categories,
  event,
}: {
  categories: Category[];
  event?: Event;
}) {
  const [state, action, pending] = useActionState(saveEventAction, {});
  const [values, setValues] = useState({
    title: event?.title ?? "",
    description: event?.description ?? "",
    location: event?.location ?? "",
    categoryId: event?.categoryId ?? categories[0]?.id ?? "",
    startsAt: localValue(event?.startsAt),
    endsAt: localValue(event?.endsAt),
    capacity: String(event?.capacity ?? 60),
    registrationOpensAt: localValue(event?.registrationOpensAt),
    priorityWindowHours: String(event?.priorityWindowHours ?? 0),
  });
  const field = (key: keyof typeof values) => ({
    name: key,
    value: values[key],
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => setValues({ ...values, [key]: e.target.value }),
  });
  return (
    <div className="workspace-columns event-editor">
      <form
        onReset={(event) => event.preventDefault()}
        action={action}
        className="workspace-panel editor-form"
      >
        <input type="hidden" name="id" value={event?.id ?? ""} />
        <fieldset disabled={pending}>
          <div className="panel-heading">
            <h2>Информация о событии</h2>
            <span>01 / 03</span>
          </div>
          <label>
            Название события
            <input
              {...field("title")}
              required
              minLength={3}
              maxLength={120}
              placeholder="Например, встреча AIU Design Club"
            />
          </label>
          <label>
            О чём это событие
            <textarea
              {...field("description")}
              required
              minLength={10}
              maxLength={2000}
              rows={5}
              placeholder="Программа, для кого встреча и что взять с собой"
            />
          </label>
          <div className="form-grid">
            <label>
              Направление
              <select {...field("categoryId")} required>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Количество мест
              <input
                {...field("capacity")}
                type="number"
                min={Math.max(1, event?.registeredCount ?? 1)}
                max={100000}
                required
              />
            </label>
          </div>
          <div className="panel-heading form-section">
            <h2>Время и место</h2>
            <span>02 / 03</span>
          </div>
          <div className="form-grid">
            <label>
              Начало · время Астаны
              <input {...field("startsAt")} type="datetime-local" required />
            </label>
            <label>
              Окончание · время Астаны
              <input {...field("endsAt")} type="datetime-local" required />
            </label>
          </div>
          <label>
            Место проведения
            <input
              {...field("location")}
              required
              minLength={2}
              maxLength={120}
              placeholder="Корпус, аудитория или площадка"
            />
          </label>
          <div className="panel-heading form-section">
            <h2>Настройки записи</h2>
            <span>03 / 03</span>
          </div>
          <div className="form-grid">
            <label>
              Когда открыть запись
              <input {...field("registrationOpensAt")} type="datetime-local" />
              <small>Необязательно. По умолчанию — после публикации.</small>
            </label>
            <label>
              Приоритетное окно, часов
              <input
                {...field("priorityWindowHours")}
                type="number"
                min={0}
                max={168}
              />
              <small>
                Для студентов с 3 подтверждёнными посещениями. Требует даты
                открытия записи.
              </small>
            </label>
          </div>
          {state.error && (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="workspace-button"
              type="submit"
              name="intent"
              value="submit"
            >
              {pending ? "Сохраняем…" : "Отправить на модерацию"}
              <Icon name="arrow" size={16} />
            </button>
            <button
              className="workspace-button secondary"
              type="submit"
              name="intent"
              value="draft"
            >
              Сохранить черновик
            </button>
          </div>
        </fieldset>
      </form>
      <aside className="editor-sidebar">
        <section className="workspace-panel">
          <span className="section-kicker">ТАК СОБЫТИЕ УВИДЯТ СТУДЕНТЫ</span>
          <div className="editor-preview">
            <EventPoster categoryId={values.categoryId} />
            <div>
              <span className="category-label">
                {categories.find((c) => c.id === values.categoryId)?.name}
              </span>
              <h3>{values.title || "Здесь будет название"}</h3>
              <p>
                {values.description ||
                  "Расскажите, почему стоит прийти именно на ваше событие."}
              </p>
              <span>
                <Icon name="pin" size={14} />
                {values.location || "Место проведения"}
              </span>
            </div>
          </div>
        </section>
        <section className="workspace-panel editor-tips">
          <Icon name="spark" size={25} />
          <h3>От идеи — к встрече</h3>
          <ol>
            <li>Заполните программу, дату и место.</li>
            <li>Отправьте событие администратору.</li>
            <li>После одобрения оно появится в афише.</li>
            <li>Следите за участниками и отмечайте вход.</li>
          </ol>
          <p>
            После редактирования опубликованное событие повторно проходит
            модерацию.
          </p>
          <Link className="workspace-back" href="/organizer">
            ← Мои события
          </Link>
        </section>
      </aside>
    </div>
  );
}
