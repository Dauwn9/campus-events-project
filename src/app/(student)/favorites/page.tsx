import { getMyFavorites } from "@/lib/services/favorites";
import { PageHeading, Empty } from "@/components/workspace/WorkspaceUI";
import StudentEventCard from "@/components/workspace/StudentEventCard";
import ActionForm from "@/components/workspace/ActionForm";
import { favoriteAction } from "@/app/campus-actions";
export default async function FavoritesPage() {
  const favorites = await getMyFavorites();
  return (
    <>
      <PageHeading
        eyebrow="ЛИЧНЫЙ КАБИНЕТ / ИЗБРАННОЕ"
        title="Планы, которые вдохновляют"
        text="События, к которым хочется вернуться. Добавляйте их на странице мероприятия."
      />
      {favorites.length ? (
        <div className="student-events-list">
          {favorites.map((f) => (
            <StudentEventCard key={f.eventId} event={f.event}>
              <ActionForm action={favoriteAction.bind(null, f.eventId)}>
                <button className="workspace-button secondary">
                  Убрать из избранного
                </button>
              </ActionForm>
            </StudentEventCard>
          ))}
        </div>
      ) : (
        <Empty
          title="Здесь будут ваши находки"
          text="Откройте событие в афише и нажмите «В избранное»."
          href="/"
          label="Найти событие"
        />
      )}
    </>
  );
}
