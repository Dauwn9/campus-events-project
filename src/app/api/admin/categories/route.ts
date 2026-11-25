import { z } from "zod";
import { apiError, requireApiRole } from "@/lib/api-response";
import {
  createCategory,
  getAdminCategories,
  makeCategorySlug,
} from "@/lib/services/categories";
import { categoryInputSchema } from "@/lib/validators/category";

export async function GET() {
  try {
    await requireApiRole("ADMIN");
    return Response.json(await getAdminCategories());
  } catch (error) {
    return apiError(error);
  }
}

/** Создать категорию: { name }. Slug строится из названия. */
export async function POST(request: Request) {
  try {
    await requireApiRole("ADMIN");
    const { name } = z.object({ name: z.string() }).parse(await request.json());
    const input = categoryInputSchema.parse({
      name: name.trim(),
      slug: makeCategorySlug(name),
    });
    return Response.json(await createCategory(input), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
