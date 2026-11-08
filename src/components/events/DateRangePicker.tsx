"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";

type DateRangePickerProps = {
  from: string;
  to: string;
  period: string;
  now: string;
  onPeriodChange: (value: string) => void;
  onRangeChange: (from: string, to: string) => void;
};

const weekdays = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const periods = [
  { value: "all", label: "Все даты" },
  { value: "week", label: "7 дней" },
  { value: "month", label: "Этот месяц" },
];

function getDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Qyzylorda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" })
    .format(new Date(`${value}T12:00:00`))
    .replace(".", "");
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function DateRangePicker({
  from,
  to,
  period,
  now,
  onPeriodChange,
  onRangeChange,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = from || getDateKey(now);
    const date = new Date(`${initialDate}T12:00:00`);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthName = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(visibleMonth);
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selectedPeriod = periods.find(item => item.value === period);
  const label = from
    ? `${formatDate(from)}${to ? ` — ${formatDate(to)}` : " — выбери конец"}`
    : selectedPeriod?.label ?? "Выбрать даты";

  const selectDate = (value: string) => {
    onPeriodChange("all");
    if (!from || to || value < from) {
      onRangeChange(value, "");
      return;
    }
    onRangeChange(from, value);
    setOpen(false);
  };

  const selectPeriod = (value: string) => {
    onPeriodChange(value);
    onRangeChange("", "");
    setOpen(false);
  };

  return (
    <div className="date-filter" ref={pickerRef}>
      <button
        type="button"
        className="date-filter-trigger"
        onClick={() => setOpen(value => !value)}
        aria-label="Выбрать период событий"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Icon name="calendar" size={17} />
        <span>{label}</span>
        <Icon name="chevron" size={14} />
      </button>
      {open && (
        <div className="date-picker-popover" role="dialog" aria-label="Выбор периода событий">
          <div className="date-picker-presets" aria-label="Быстрый выбор периода">
            {periods.map(item => (
              <button
                type="button"
                key={item.value}
                className={period === item.value && !from ? "selected" : ""}
                aria-pressed={period === item.value && !from}
                onClick={() => selectPeriod(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="calendar-heading">
            <button
              type="button"
              aria-label="Предыдущий месяц"
              onClick={() => setVisibleMonth(new Date(year, month - 1, 1))}
            >
              <Icon name="chevron" size={16} />
            </button>
            <strong>{monthName}</strong>
            <button
              type="button"
              aria-label="Следующий месяц"
              onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}
            >
              <Icon name="chevron" size={16} />
            </button>
          </div>
          <div className="calendar-grid" role="group" aria-label={monthName}>
            {weekdays.map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
            {Array.from({ length: firstWeekday }, (_, index) => (
              <span className="calendar-day-spacer" key={`spacer-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const value = dateKey(year, month, day);
              const isStart = value === from;
              const isEnd = value === to;
              const inRange = Boolean(from && to && value > from && value < to);
              const isSelected = isStart || isEnd;
              return (
                <button
                  type="button"
                  key={value}
                  className={`calendar-day${isSelected ? " selected" : ""}${inRange ? " in-range" : ""}${isStart ? " range-start" : ""}${isEnd ? " range-end" : ""}`}
                  aria-label={new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`))}
                  aria-pressed={isSelected}
                  onClick={() => selectDate(value)}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <p className="calendar-hint">{from && !to ? "Теперь выбери последний день" : "Выбери начало периода"}</p>
        </div>
      )}
    </div>
  );
}
