# CampusEvents

Афиша студенческих мероприятий: студенты находят события и записываются на них, организаторы создают события, админ их модерирует.

## Документация

- [План проекта и распределение задач](docs/PLAN.md)

- [Демо сайта](https://campus-events-project.vercel.app/)


This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Локальная настройка

Скопируйте `.env.example` в `.env` и задайте `DATABASE_URL`,
`BETTER_AUTH_SECRET` и `BETTER_AUTH_URL`. Этот общий файл читают и Next.js,
и Prisma CLI (`prisma7.config.ts` загружает его через `dotenv/config`).
Не храните `DATABASE_URL` только в `.env.local`: Prisma CLI его оттуда не
загрузит. `.env` игнорируется Git. Секрет можно сгенерировать командой
`openssl rand -base64 32`; не используйте значение из примера в production.

`NEXT_PUBLIC_USE_MOCKS` продолжает управлять демонстрационными сервисами
афиши и других ещё не переведённых на базу данных функций, но не влияет на
регистрацию, вход, сессии или роли.

## Демонстрационные моки

Моки для сервисов, не переведённых на базу данных, включены по умолчанию:

- `NEXT_PUBLIC_USE_MOCKS=true` — использовать тестовые данные вместо реальных сервисов.
- `NEXT_PUBLIC_MOCK_ERRORS=true` — случайно возвращать тестовую ошибку примерно в 20% запросов комментариев и статистики.

После изменения переменных окружения перезапустите dev-сервер. В демо доступны афиша и события, друзья и события друзей, уведомления об изменениях, комментарии, обзор администратора и управление категориями.

## Матрица доступа

Доступ проверяется на сервере через сессию Better Auth и роль пользователя; `proxy.ts` только перенаправляет пользователей без cookie и не заменяет авторизацию.

| Ресурс | Гость | Студент | Организатор | Администратор |
|---|---|---|---|---|
| Главная, афиша и опубликованные события | Просмотр | Просмотр | Просмотр | Просмотр |
| Скрытые события | Нет | Нет | Только свои | Просмотр и модерация |
| Вход и регистрация | Да | Да | Да | Да |
| Профиль и смена пароля | Нет | Только свой | Только свой | Только свой |
| Регистрации, билеты, избранное, друзья, уведомления | Нет | Только свои | Нет | Нет |
| Комментарии | Просмотр | Создание и удаление своих | Просмотр | Удаление любых |
| Кабинет организатора, создание/изменение событий | Нет | Нет | Только свои события | Нет; админские операции доступны через API/модерацию |
| Участники и QR-проверка | Нет | Нет | Только своего события | Да |
| Кабинет администратора, категории, блокировки и роли | Нет | Нет | Нет | Да |
| Назначение ролей | Нет | Нет | Нет | Да; нельзя изменить свою роль или понизить последнего администратора |

Публичный `GET /api/events` возвращает опубликованные события. Действия с регистрациями и персональными данными связывают пользователя с текущей сессией; идентификаторы владельца из тела запроса не используются для выдачи доступа. CSV участников содержит данные участников только для владельца события или администратора.

## Реальная база данных

Для работы с PostgreSQL задайте `DATABASE_URL`. Перед запуском приложения
примените подготовленные миграции:

```bash
npx prisma migrate deploy --config prisma7.config.ts
```

При `NEXT_PUBLIC_USE_MOCKS=false` комментарии, регистрации, друзья,
уведомления, история аудита и данные организатора читаются и записываются
через Prisma. Для ручной проверки комментариев запустите приложение с этим
флагом, войдите как студент, откройте опубликованное событие, оставьте
комментарий и обновите страницу: комментарий должен остаться в списке.

Для локального демо seed создаёт пользователей через Better Auth. Демо-аккаунты:
`student1@campus.kz`, `organizer1@campus.kz`, `admin@campus.kz`; пароль для всех —
`Campus2026!`. Seed очищает и заново заполняет таблицы: запускайте его только
на базе, данные которой можно удалить.

Для Vercel добавьте `DATABASE_URL`, `BETTER_AUTH_SECRET` и `BETTER_AUTH_URL`
в Environment Variables проекта и запустите новый деплой.

### Обложки афиш

Выберите фото на компьютере — JPG, PNG или WebP размером до 4 МБ. Обложки сохраняются вместе с локальными демо-данными в `.data/campus-demo.json`; Cloudinary не требуется. Папка `.data` не включается в Git. Такое хранение предназначено для локального запуска: на Vercel изменения локальных файлов не сохраняются постоянно.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
