export function categoryErrorRedirectPath(
  error: string,
  modal: FormDataEntryValue | null,
  categoryId: FormDataEntryValue | null,
) {
  const params = new URLSearchParams({ error });

  if (modal === "create") {
    params.set("modal", "create");
  } else if (
    modal === "edit" &&
    typeof categoryId === "string" &&
    categoryId.length > 0
  ) {
    params.set("modal", "edit");
    params.set("category", categoryId);
  }

  return `/admin/categories?${params.toString()}`;
}
