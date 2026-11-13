import assert from "node:assert/strict";
import test from "node:test";
import type { CampusAuditEntry } from "@/lib/services/demo-store";
import { filterAuditEntries } from "@/lib/audit-history";

function makeEntry(id: string, occurredAt: string): CampusAuditEntry {
  return {
    id,
    occurredAt,
    actorId: "admin",
    actorName: "Администратор",
    entityType: "EVENT",
    entityId: "event",
    entityLabel: "Событие",
    field: "title",
    oldValue: "До",
    newValue: "После",
  };
}

test("date range includes all audit entries on both selected calendar days in Astana", () => {
  const entries = [
    makeEntry("before", "2026-03-07T18:59:59.000Z"),
    makeEntry("start", "2026-03-07T19:00:00.000Z"),
    makeEntry("end", "2026-03-08T18:59:59.000Z"),
    makeEntry("after", "2026-03-08T19:00:00.000Z"),
  ];

  assert.deepEqual(
    filterAuditEntries(entries, { from: "2026-03-08", to: "2026-03-08" }).map((entry) => entry.id),
    ["start", "end"],
  );
});
