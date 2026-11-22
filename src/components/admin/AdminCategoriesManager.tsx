"use client";

import { useState } from "react";
import Link from "next/link";
import {
  archiveCategoryAction,
  createCategoryAction,
  updateCategoryAction,
} from "@/app/admin-actions";
import type { Category } from "@/lib/validators/category";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import HistoryLinkButton from "@/components/admin/HistoryLinkButton";

type AdminCategory = Category & { eventCount: number };

function eventCountLabel(count: number) {
  const plural = new Intl.PluralRules("ru").select(count);
  if (plural === "one") return "событие";
  if (plural === "few") return "события";
  return "событий";
}

export default function AdminCategoriesManager({
  categories,
  initialModal,
  errorMessage,
}: {
  categories: AdminCategory[];
  initialModal: string | null;
  errorMessage?: string;
}) {
  const [openModal, setOpenModal] = useState(initialModal);
  const [modalError, setModalError] = useState(errorMessage);

  const selectedCategory = openModal?.startsWith("edit:")
    ? categories.find((category) => category.id === openModal.slice(5))
    : undefined;
  const creating = openModal === "create";

  function openCreateModal() {
    setModalError(undefined);
    setOpenModal("create");
  }

  function openEditModal(categoryId: string) {
    setModalError(undefined);
    setOpenModal(`edit:${categoryId}`);
  }

  return (
    <>
      <section className="workspace-panel flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Управление категориями</h2>
          <p className="mt-1 text-sm text-muted">
            Создание и редактирование доступны в отдельных окнах.
          </p>
        </div>
        <Button
          type="button"
          className="workspace-button min-h-11 shrink-0"
          onClick={openCreateModal}
        >
          <Icon name="spark" size={16} />
          Новая категория
        </Button>
      </section>

      {categories.length === 0 ? (
        <section className="workspace-panel">
          <h2 className="font-semibold">Активных категорий пока нет</h2>
          <p className="mt-1 text-sm text-muted">
            Создайте категорию или восстановите её из архива.
          </p>
        </section>
      ) : (
        <section aria-labelledby="category-list-heading">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="category-list-heading" className="text-lg font-semibold">
                Активные категории
              </h2>
              <p className="mt-1 text-sm text-muted">
                Просматривайте события, редактируйте или перемещайте категорию в архив.
              </p>
            </div>
            <span className="shrink-0 text-sm text-muted">
              {categories.length} всего
            </span>
          </div>
          <ul className="grid gap-3">
            {categories.map((category, index) => (
              <li key={category.id}>
                <article className="group rounded-card border border-border bg-surface p-4 shadow-card transition hover:border-primary/25 hover:shadow-md sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <span className="grid size-11 shrink-0 place-items-center rounded-control bg-primary/5 font-semibold text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{category.name}</h3>
                      <Link
                        href={`/?category=${encodeURIComponent(category.id)}#events`}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <Icon name="people" size={14} />
                        {category.eventCount} {eventCountLabel(category.eventCount)}
                        <Icon name="arrow" size={13} />
                      </Link>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <HistoryLinkButton
                        entityType="CATEGORY"
                        entityId={category.id}
                      />
                      <Button
                        type="button"
                        className="workspace-button secondary min-h-11"
                        onClick={() => openEditModal(category.id)}
                      >
                        Редактировать
                      </Button>
                      <form action={archiveCategoryAction}>
                        <input type="hidden" name="id" value={category.id} />
                        <Button
                          type="submit"
                          className="workspace-button secondary danger min-h-11"
                          aria-label={`Архивировать категорию ${category.name}`}
                        >
                          В архив
                        </Button>
                      </form>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal
        open={creating || Boolean(selectedCategory)}
        onClose={() => setOpenModal(null)}
        title={creating ? "Новая категория" : "Редактировать категорию"}
      >
        {modalError && (
          <p
            role="alert"
            className="mb-4 rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {modalError}
          </p>
        )}
        {creating && (
          <form action={createCategoryAction} className="grid gap-4">
            <input type="hidden" name="modal" value="create" />
            <p className="text-sm text-muted">
              Добавьте направление, чтобы организаторам было проще классифицировать события.
            </p>
            <label htmlFor="new-category-name" className="text-sm font-medium">
              Название
            </label>
            <Input
              id="new-category-name"
              name="name"
              required
              minLength={2}
              maxLength={50}
              placeholder="Например, Волонтёрство"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                className="workspace-button secondary"
                onClick={() => setOpenModal(null)}
              >
                Отмена
              </Button>
              <Button type="submit" className="min-h-11">
                Добавить категорию
              </Button>
            </div>
          </form>
        )}
        {selectedCategory && (
          <form action={updateCategoryAction} className="grid gap-4">
            <input type="hidden" name="id" value={selectedCategory.id} />
            <input type="hidden" name="modal" value="edit" />
            <label
              htmlFor={`category-${selectedCategory.id}`}
              className="text-sm font-medium"
            >
              Название
            </label>
            <Input
              id={`category-${selectedCategory.id}`}
              name="name"
              required
              minLength={2}
              maxLength={50}
              defaultValue={selectedCategory.name}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                className="workspace-button secondary"
                onClick={() => setOpenModal(null)}
              >
                Отмена
              </Button>
              <Button type="submit" className="min-h-11">
                Сохранить
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
