"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import HistoryDatePicker from "@/components/admin/HistoryDatePicker";
import HistoryFilterSelect from "@/components/admin/HistoryFilterSelect";
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
  now,
}: {
  initialFilters: AuditHistoryFilters;
  totalCount: number;
  activeEntityLabel?: string | null;
  now: string;
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

  const hasActiveEntity = Boolean(filters.entityId);
  const countLabel = totalCount % 10 === 1 && totalCount % 100 !== 11
    ? "запись"
    : totalCount % 10 >= 2 && totalCount % 10 <= 4 && (totalCount % 100 < 12 || totalCount % 100 > 14)
      ? "записи"
      : "записей";

  return (
    <section className="workspace-panel history-filter-panel" aria-label="Фильтры истории изменений">
      <div className="history-filter-heading">
        <div className="history-filter-title">
          <span className="history-filter-icon"><Icon name="spark" size={17} /></span>
          <div>
            <span className="history-filter-eyebrow">ПОИСК ПО ЖУРНАЛУ</span>
            <h2>Настройте фильтры</h2>
          </div>
        </div>
        <span className="history-result-count" role="status" aria-live="polite">
          <strong>{totalCount}</strong> {countLabel}
        </span>
      </div>

      <div className="history-filter-controls">
        <label className="workspace-search">
          <Icon name="search" size={17} />
          <input
            aria-label="Поиск по истории изменений"
            placeholder="Название события, имя, действие"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
        </label>
        <HistoryFilterSelect
          label="Объект"
          value={filters.type ?? "all"}
          options={[{ value: "all", label: "Все сущности" }, ...AUDIT_ENTITY_OPTIONS]}
          onChange={(value) => handleSelect("type", value)}
        />
        <HistoryFilterSelect
          label="Действие"
          value={filters.action ?? "all"}
          options={AUDIT_ACTION_OPTIONS}
          onChange={(value) => handleSelect("action", value)}
        />
        <HistoryFilterSelect
          label="Участник"
          value={filters.actor ?? "all"}
          options={AUDIT_ACTOR_OPTIONS}
          onChange={(value) => handleSelect("actor", value)}
        />
      </div>

      <div className="history-filter-row">
        <HistoryDatePicker
          from={filters.from}
          to={filters.to}
          now={now}
          onRangeChange={(from, to) => setFilters((current) => ({
            ...current,
            from: from || undefined,
            to: to || undefined,
          }))}
        />
        <button type="button" className="workspace-button secondary history-reset" onClick={resetFilters}>
          Сбросить фильтры
        </button>
        {hasActiveEntity && (
          <div className="history-entity-pill" role="status" aria-live="polite">
            История: {activeEntityLabel ?? "сущность"}
            <button type="button" aria-label="Сбросить фильтр по сущности" onClick={resetFilters}>
              ✕
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
