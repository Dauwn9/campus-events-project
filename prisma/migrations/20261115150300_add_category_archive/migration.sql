ALTER TABLE "Category"
ADD COLUMN "slug" TEXT;

UPDATE "Category"
SET "slug" = "id";

ALTER TABLE "Category"
ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

ALTER TABLE "Category"
ADD COLUMN "archivedAt" TIMESTAMP(3);
