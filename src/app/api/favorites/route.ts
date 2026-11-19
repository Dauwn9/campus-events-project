import { apiError, requireUser } from "@/lib/api-response";
import {
  getMyFavorites,
  toggleFavorite,
} from "@/lib/services/favorites";
import { toggleFavoriteInputSchema } from "@/lib/validators/favorite";

export async function GET() {
  try {
    await requireUser();
    return Response.json(await getMyFavorites());
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = toggleFavoriteInputSchema.parse(await request.json());
    return Response.json(await toggleFavorite(body));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireUser();
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
