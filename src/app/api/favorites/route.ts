import { apiError, requireApiRole } from "@/lib/api-response";
import {
  getMyFavorites,
  toggleFavorite,
} from "@/lib/services/favorites";
import { toggleFavoriteInputSchema } from "@/lib/validators/favorite";

export async function GET() {
  try {
    await requireApiRole("STUDENT");
    return Response.json(await getMyFavorites());
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiRole("STUDENT");
    const body = toggleFavoriteInputSchema.parse(await request.json());
    return Response.json(await toggleFavorite(body));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireApiRole("STUDENT");
    const body = toggleFavoriteInputSchema.parse(await request.json());
    const favorites = await getMyFavorites();
    if (!favorites.some((favorite) => favorite.eventId === body.eventId)) {
      return Response.json({ eventId: body.eventId, isFavorite: false });
    }
    return Response.json(await toggleFavorite(body.eventId));
  } catch (error) {
    return apiError(error);
  }
}
