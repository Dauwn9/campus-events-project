-- Приватность профиля: закрытый профиль показывает другим только имя.
ALTER TABLE "User" ADD COLUMN "profilePrivate" BOOLEAN NOT NULL DEFAULT false;
