import { z } from "zod";
import { apiError, requireApiRole } from "@/lib/api-response";
import {
  archiveCategory,
  makeCategorySlug,
  updateCategory,
} from "@/lib/services/categories";
import { ServiceError } from "@/lib/services/errors";

type Ctx = { params: Promise<{ id: string }> };

/** Переименовать категорию: { name }. */
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    await requireApiRole("ADMIN");
    const { id } = await params;
    const { name } = z.object({ name: z.string() }).parse(await request.json());
    const updated = await updateCategory(id, {
      name: name.trim(),
      slug: makeCategorySlug(name),
    });
    if (!updated) throw new ServiceError("NOT_FOUND", "Категория не найдена.");
    return Response.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Удалить категорию. Категория уходит в архив (её можно восстановить);
 * если в ней есть события, ответ — 409 CATEGORY_IN_USE.
 */
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    await requireApiRole("ADMIN");
    const { id } = await params;
    return Response.json(await archiveCategory(id));
  } catch (error) {
    return apiError(error);
  }
}
