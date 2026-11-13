"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Event } from "@/lib/validators/event";
import type { Category } from "@/lib/validators/category";
import { saveEventAction, type ActionState } from "@/app/campus-actions";
import EventPoster from "@/components/events/EventPoster";
import Icon from "@/components/ui/Icon";
const localValue = (value?: string) =>
  value
    ? new Date(Date.parse(value) + 5 * 3600000).toISOString().slice(0, 16)
    : "";

// Порядок полей на странице — по нему выбираем, куда ставить фокус.
const fieldOrder = [
  "title",
  "description",
  "categoryId",
  "capacity",
  "startsAt",
  "endsAt",
  "location",
  "registrationOpensAt",
  "priorityWindowHours",
];

type FieldErrors = Record<string, string>;

function validateClient(v: {
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  priorityWindowHours: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (v.startsAt && v.endsAt && Date.parse(v.endsAt) <= Date.parse(v.startsAt))
    errors.endsAt = "Окончание должно быть позже начала";
  if (Number(v.priorityWindowHours) > 0 && !v.registrationOpensAt)
    errors.registrationOpensAt =
      "Укажите дату открытия записи — без неё приоритетное окно не работает";
  return errors;
}

export default function EventForm({
  categories,
  event,
}: {
  categories: Category[];
  event?: Event;
}) {
  const [state, action, pending] = useActionState(saveEventAction, {});
  const formRef = useRef<HTMLFormElement>(null);
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

  // Ошибки с клиента (проверяем до отправки).
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  // Ошибки с сервера. Когда человек правит поле, ошибку этого поля прячем,
  // пока не придёт новый ответ сервера (тогда `state` станет другим объектом).
  const [clearedBy, setClearedBy] = useState<{
    state: ActionState | null;
    keys: string[];
  }>({ state: null, keys: [] });
  const cleared = clearedBy.state === state ? clearedBy.keys : [];

  const serverErrors: FieldErrors = Object.fromEntries(
    Object.entries(state.fieldErrors ?? {}).filter(
      ([key]) => fieldOrder.includes(key) && !cleared.includes(key),
    ),
  );
  const serverHadFieldErrors = Object.keys(state.fieldErrors ?? {}).some(
    (key) => fieldOrder.includes(key),
  );
  const errors: FieldErrors = { ...serverErrors, ...clientErrors };
  const hasFieldErrors = Object.keys(errors).length > 0;
  const summary = hasFieldErrors
    ? "Проверьте выделенные поля."
    : serverHadFieldErrors
      ? null
      : (state.error ?? null);

  function focusFirst(found: FieldErrors) {
    const first = fieldOrder.find((key) => found[key]);
    if (!first) return;
    (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus();
  }

  // После ответа сервера с ошибками — фокус на первое проблемное поле.
  useEffect(() => {
    if (state.fieldErrors) focusFirst(state.fieldErrors);
  }, [state]);

  const field = (key: keyof typeof values) => ({
    name: key,
    value: values[key],
    "aria-invalid": errors[key] ? (true as const) : undefined,
    "aria-describedby": errors[key] ? `error-${key}` : undefined,
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setValues({ ...values, [key]: e.target.value });
      if (clientErrors[key]) {
        const next = { ...clientErrors };
        delete next[key];
        setClientErrors(next);
      }
      if (!cleared.includes(key)) setClearedBy({ state, keys: [...cleared, key] });
    },
  });

  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={`error-${key}`} className="form-error field-error">
        {errors[key]}
      </p>
    ) : null;

  return (
    <div className="workspace-columns event-editor">
      <form
        ref={formRef}
        onReset={(event) => event.preventDefault()}
        onSubmit={(e) => {
          const found = validateClient(values);
          if (Object.keys(found).length) {
            e.preventDefault();
            setClientErrors(found);
            focusFirst(found);
          } else {
            setClientErrors({});
          }
        }}
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
            {fieldError("title")}
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
            {fieldError("description")}
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
              {fieldError("categoryId")}
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
              {fieldError("capacity")}
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
              {fieldError("startsAt")}
            </label>
            <label>
              Окончание · время Астаны
              <input {...field("endsAt")} type="datetime-local" required />
              {fieldError("endsAt")}
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
            {fieldError("location")}
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
              {fieldError("registrationOpensAt")}
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
              {fieldError("priorityWindowHours")}
            </label>
          </div>
          {summary && (
            <p className="form-error" role="alert">
              {summary}
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
