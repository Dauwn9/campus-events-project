import { requireRole } from "@/lib/auth";
import { readStore } from "./demo-store";
import { toggleStudentFavorite } from "./campus";
export async function getMyFavorites() {
  const user = await requireRole("STUDENT");
  const store = readStore();
  return store.favorites
    .filter((f) => f.userId === user.id)
    .flatMap((f) => {
      const event = store.events.find(
        (e) =>
          e.id === f.eventId && ["PUBLISHED", "FINISHED"].includes(e.status),
      );
      return event ? [{ ...f, event }] : [];
    });
}
export async function getMyFavoriteIds() {
  return (await getMyFavorites()).map((f) => f.eventId);
}
export async function toggleFavorite(id: string) {
  return toggleStudentFavorite(await requireRole("STUDENT"), id);
}
