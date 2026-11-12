"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_ACTOR_OPTIONS,
  AUDIT_ENTITY_OPTIONS,
  type AuditHistoryFilters,
} from "@/lib/audit-history";

export default function HistoryFilters({
  initialFilters,
  totalCount,
  activeEntityLabel,
}: {
  initialFilters: AuditHistoryFilters;
  totalCount: number;
  activeEntityLabel?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [searchDraft, setSearchDraft] = useState(initialFilters.q ?? "");
  const [filters, setFilters] = useState<AuditHistoryFilters>(initialFilters);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilters((current) => ({ ...current, q: searchDraft.trim() || undefined }));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchDraft]);

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, String(value));
      }
    });
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [filters, pathname, router]);

  const handleSelect = (key: keyof AuditHistoryFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value === "all" ? undefined : value,
    }));
  };

  const resetFilters = () => {
    setSearchDraft("");
    setFilters({});
  };

  const hasActiveEntity = Boolean(initialFilters.entityId);

  return (
    <section className="workspace-panel" aria-label="Фильтры истории изменений">
      <div className="table-filters history-filters">
        <label className="workspace-search">
          <Icon name="search" size={17} />
          <input
            aria-label="Поиск по истории изменений"
            placeholder="Название события, имя, действие"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
        </label>
        <select
          aria-label="Тип сущности"
          value={filters.type ?? "all"}
          onChange={(event) => handleSelect("type", event.target.value)}
        >
          <option value="all">Все сущности</option>
          {AUDIT_ENTITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Тип действия"
          value={filters.action ?? "all"}
          onChange={(event) => handleSelect("action", event.target.value)}
        >
          {AUDIT_ACTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Кто выполнил действие"
          value={filters.actor ?? "all"}
          onChange={(event) => handleSelect("actor", event.target.value)}
        >
          {AUDIT_ACTOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="history-filter-row">
        <label className="history-date-field">
          <span>От</span>
          <input
            type="date"
            aria-label="Дата начала периода"
            value={filters.from ?? ""}
            onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value || undefined }))}
          />
        </label>
        <label className="history-date-field">
          <span>До</span>
          <input
            type="date"
            aria-label="Дата окончания периода"
            value={filters.to ?? ""}
            onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value || undefined }))}
          />
        </label>
        <button type="button" className="workspace-button secondary" onClick={resetFilters}>
          Сбросить фильтры
        </button>
        <span className="history-result-count">Найдено: {totalCount}</span>
      </div>

      {hasActiveEntity && (
        <div className="history-entity-pill" role="status" aria-live="polite">
          История: {activeEntityLabel ?? "сущность"}
          <button type="button" aria-label="Сбросить фильтр по сущности" onClick={resetFilters}>
            ✕
          </button>
        </div>
      )}
    </section>
  );
}
