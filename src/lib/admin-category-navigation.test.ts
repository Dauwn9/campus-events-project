import test from "node:test";
import assert from "node:assert/strict";
import { categoryErrorRedirectPath } from "./admin-category-navigation";

test("Сохраняет открытое окно создания при ошибке категории", () => {
  assert.equal(
    categoryErrorRedirectPath("ALREADY_EXISTS", "create", null),
    "/admin/categories?error=ALREADY_EXISTS&modal=create",
  );
});

test("Сохраняет выбранную категорию в окне редактирования при ошибке", () => {
  assert.equal(
    categoryErrorRedirectPath("ALREADY_EXISTS", "edit", "category & 1"),
    "/admin/categories?error=ALREADY_EXISTS&modal=edit&category=category+%26+1",
  );
});

test("Не открывает неизвестное окно или категорию из запроса", () => {
  assert.equal(
    categoryErrorRedirectPath("invalid", "unexpected", "category-1"),
    "/admin/categories?error=invalid",
  );
  assert.equal(
    categoryErrorRedirectPath("not-found", "edit", null),
    "/admin/categories?error=not-found",
  );
});
