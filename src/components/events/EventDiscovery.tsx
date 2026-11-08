"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Event } from "@/lib/validators/event";
import type { Category } from "@/lib/validators/category";
import Icon from "@/components/ui/Icon";
import EventPoster from "./EventPoster";
import DateRangePicker from "./DateRangePicker";
import { datePart, getEventTheme } from "@/lib/event-design";

type Initial = { category?: string; q?: string; period?: string; from?: string; to?: string; page?: number };
const PAGE_SIZE = 6;

function isValidDate(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function eventDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Qyzylorda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default function EventDiscovery({ events, categories, now, initial = {} }: { events: Event[]; categories: Category[]; now: string; initial?: Initial }) {
  const [category, setCategoryRaw] = useState(initial.category && categories.some(item => item.id === initial.category) ? initial.category : "all");
  const [search, setSearchRaw] = useState(initial.q ?? "");
  const [period, setPeriodRaw] = useState(initial.period ?? "all");
  const [from, setFrom] = useState(isValidDate(initial.from) ? initial.from : "");
  const [to, setTo] = useState(isValidDate(initial.to) ? initial.to : "");
  const [page, setPage] = useState(initial.page ?? 1);
  const [view, setView] = useState("grid");
  const setCategory = (value: string) => { setCategoryRaw(value); setPage(1); };
  const setSearch = (value: string) => { setSearchRaw(value); setPage(1); };
  const setPeriod = (value: string) => { setPeriodRaw(value); setPage(1); };
  const setDateRange = (start: string, end: string) => { setFrom(start); setTo(end); setPage(1); };
  const today = new Date(now);
  const upcoming = events.filter(event => new Date(event.startsAt) >= today);
  const displayed = events.filter(event => {
    const query = search.trim().toLocaleLowerCase("ru");
    const matchesSearch = `${event.title} ${event.description} ${event.location}`.toLocaleLowerCase("ru").includes(query);
    const start = new Date(event.startsAt);
    const matchesPeriod = period === "all" || (period === "month" ? datePart(event.startsAt, { month: "numeric", year: "numeric" }) === datePart(now, { month: "numeric", year: "numeric" }) : start >= today && start.getTime() < today.getTime() + 7 * 86400000);
    const eventDate = eventDateKey(event.startsAt);
    const matchesRange = (!from || eventDate >= from) && (!to || eventDate <= to);
    return (category === "all" || event.categoryId === category) && matchesSearch && matchesPeriod && matchesRange;
  });
  const totalPages = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = displayed.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search.trim()) params.set("q", search.trim());
    if (period !== "all") params.set("period", period);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (currentPage > 1) params.set("page", String(currentPage));
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, [category, search, period, from, to, currentPage]);
  const reset = () => { setCategory("all"); setSearch(""); setPeriod("all"); setDateRange("", ""); };
  return <>
    <div className="page-eyebrow"><span><span className="live-dot" /> ТВОЙ КАМПУС. ТВОИ ВОЗМОЖНОСТИ.</span><span>УЧЕБНЫЙ ГОД 2026 / 27</span></div>
    <section className="campus-hero" aria-labelledby="hero-heading">
      <div className="hero-copy"><span className="hero-kicker"><span /> БОЛЬШЕ, ЧЕМ УЧЁБА</span><h1 id="hero-heading">Всё самое<br />интересное —<br /><em>рядом с тобой.</em></h1><p>Знакомься, пробуй новое и находи своих.<br />Студенческая жизнь AIU начинается здесь.</p><a href="#events" className="gold-button">Найти своё событие <Icon name="right" /></a><div className="hero-bottom"><span className="hero-mini-mark">AIU</span><span>Лекции, встречи и впечатления.<br /><strong>Один кампус. Много возможностей.</strong></span></div></div>
      <div className="hero-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/aiu-campus.webp" alt="Кампус Международного университета Астана" width="1000" height="750" fetchPriority="high" />
        <span className="photo-coordinate">ASTANA, KAZAKHSTAN <Icon name="arrow" size={16} /></span>
        <div className="photo-caption"><span className="photo-chip"><span className="live-dot" /> МЕСТО ВСТРЕЧИ — AIU</span><p>Твой университет.<br /><strong>Твоя история.</strong></p><a href="https://aiu.kz/life-at-aiu?lang=ru" target="_blank" rel="noopener noreferrer" aria-label="Жизнь в AIU на сайте университета"><Icon name="arrow" size={25} /></a></div>
      </div>
    </section>
    <div className="campus-strip"><div><Icon name="calendar" /><span><strong>{events.length}</strong> событий в афише</span></div><div><Icon name="spark" /><span><strong>{new Set(events.map(event => event.categoryId)).size}</strong> направления для тебя</span></div><div><Icon name="people" /><span>Новые знакомства <strong>каждый день</strong></span></div><a href="https://aiu.kz/?lang=ru" target="_blank" rel="noopener noreferrer">Открой AIU <Icon name="arrow" size={16} /></a></div>
    <section className="discovery-section" id="events" aria-labelledby="events-heading">
      <div className="section-heading"><div><span className="section-kicker">НЕ ПРОПУСТИ СВОЁ</span><h2 id="events-heading">Афиша кампуса<span>.</span></h2></div><span className="section-note">Встречаемся вне расписания</span></div>
      <div className="discovery-layout"><div className="event-content">
        <div className="filter-panel"><div className="search-row"><label className="event-search"><Icon name="search" size={19} /><span className="sr-only">Поиск событий</span><input type="search" placeholder="Что тебе интересно?" value={search} onChange={e => setSearch(e.target.value)} /></label><DateRangePicker from={from} to={to} period={period} now={now} onPeriodChange={setPeriod} onRangeChange={setDateRange} /></div><div className="category-filters" aria-label="Категории событий"><button type="button" onClick={() => setCategory("all")} aria-pressed={category === "all"} className={category === "all" ? "selected" : ""}>Все события <span>{events.length}</span></button>{categories.map(item => <button type="button" key={item.id} onClick={() => setCategory(item.id)} aria-pressed={category === item.id} className={category === item.id ? "selected" : ""}>{item.name}</button>)}</div></div>
        <div className="results-toolbar"><p role="status" aria-live="polite">Найдено событий: <strong>{displayed.length}</strong></p><div className="view-toggle" aria-label="Вид афиши"><button type="button" aria-label="Показать сеткой" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Icon name="grid" size={16} /></button><button type="button" aria-label="Показать списком" aria-pressed={view === "list"} onClick={() => setView("list")}><Icon name="list" size={18} /></button></div></div>
        {displayed.length ? <div className={`events-grid${view === "list" ? " events-list" : ""}`}>{pageItems.map(event => {
          const theme = getEventTheme(event.categoryId);
          const free = Math.max(0, event.capacity - event.registeredCount);
          const past = new Date(event.endsAt) < today;
          return <Link href={`/events/${event.id}`} key={event.id} className="event-card"><div className="card-visual"><EventPoster categoryId={event.categoryId} /><span className="card-date"><strong>{datePart(event.startsAt, { day: "2-digit" })}</strong><span>{datePart(event.startsAt, { month: "short" }).replace(".", "")}</span></span></div><div className="event-card-body"><div className="card-label-row"><span className={`category-label label-${theme.theme}`}>{categories.find(item => item.id === event.categoryId)?.name ?? "Мероприятие"}</span><span className="card-year">{past ? "Событие прошло" : datePart(event.startsAt, { year: "numeric" })}</span></div><h3>{event.title}</h3><p className="card-description">{event.description}</p><div className="event-meta"><span><Icon name="clock" size={14} />{datePart(event.startsAt, { hour: "2-digit", minute: "2-digit" })}</span><span><Icon name="pin" size={14} />{event.location}</span></div><div className="card-bottom"><span className={free ? "seats" : "seats seats-full"}><span />{past ? "Архив события" : free ? `${free} свободных мест` : "Мест нет"}</span><span className="card-open"><Icon name="arrow" size={18} /></span></div></div></Link>;
        })}</div> : <div className="events-empty"><Icon name="search" size={32} /><h3>{events.length ? "Пока ничего не нашлось" : "Скоро здесь появятся события"}</h3><p>Попробуй другую категорию, дату или название.</p><button type="button" onClick={reset}>Сбросить фильтры <Icon name="right" size={17} /></button></div>}{totalPages > 1 && <nav aria-label="Страницы афиши" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 24 }}><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>← Назад</button><span>Страница {currentPage} из {totalPages}</span><button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Вперёд →</button></nav>}
      </div><aside className="events-sidebar"><section className="agenda-panel"><div className="aside-heading"><span className="section-kicker">ПЛАНЫ НА КАМПУС</span><Icon name="calendar" size={19} /></div><h3>Скоро встречаемся</h3><div className="agenda-list">{upcoming.slice(0, 3).map(event => <Link href={`/events/${event.id}`} key={event.id} className="agenda-item"><span className="agenda-date"><strong>{datePart(event.startsAt, { day: "2-digit" })}</strong>{datePart(event.startsAt, { month: "short" }).replace(".", "")}</span><span><strong>{event.title}</strong><small>{datePart(event.startsAt, { hour: "2-digit", minute: "2-digit" })} · {categories.find(item => item.id === event.categoryId)?.name}</small></span><Icon name="chevron" size={15} /></Link>)}{!upcoming.length && <p className="aside-empty">Новые встречи скоро появятся в афише.</p>}</div><p className="agenda-footnote"><span className="live-dot" /> Сохрани дату. Приходи за впечатлениями.</p></section>
        <section className="aiu-promo"><span className="promo-star" aria-hidden="true">✳</span><span className="section-kicker">ЗНАКОМЬСЯ С УНИВЕРСИТЕТОМ</span><h3>Быть частью<br /><em>чего-то большего.</em></h3><p>Студенческие клубы, новые идеи и люди, с которыми всё возможно.</p><a href="https://aiu.kz/life-at-aiu?lang=ru" target="_blank" rel="noopener noreferrer">Жизнь в AIU <Icon name="arrow" size={18} /></a><span className="promo-watermark" aria-hidden="true">AIU</span></section>
        <div className="campus-note"><Icon name="pin" size={19} /><div><strong>Увидимся в кампусе</strong><p>Астана, пр. Кабанбай батыра, 8</p></div></div>
      </aside></div>
    </section>
    <section className="bottom-banner"><span className="banner-symbol" aria-hidden="true">✳</span><div><span className="section-kicker">ТВОЯ СТУДЕНЧЕСКАЯ ЖИЗНЬ</span><h2>Самое интересное случается вместе.</h2><p>Выбирай событие. Зови друзей. Создавай воспоминания.</p></div><a href="#events">Увидимся на событиях <Icon name="arrow" size={20} /></a></section>
  </>;
}
