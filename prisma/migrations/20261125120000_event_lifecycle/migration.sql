-- Статусы жизненного цикла события: черновик, отмена, завершение.
ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'FINISHED';

-- Архив событий: скрывает из афиши, не удаляя регистрации.
ALTER TABLE "Event" ADD COLUMN "archivedAt" TIMESTAMP(3);
