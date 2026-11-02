import { ServiceError } from "@/lib/services/errors";
import { getEventById } from "@/lib/services/events";
import { MOCK_USER_ID, delay, maybeFail } from "./_utils";
import type { Comment } from "@/lib/validators/comment";

const initialComments: Comment[] = [
  {
    id: "comment-1",
    eventId: "evt-4",
    userId: "user-2",
    userName: "Айжан",
    text: "Будет ли запись лекции после мероприятия?",
    createdAt: "2026-10-28T09:30:00.000Z",
  },
  {
    id: "comment-2",
    eventId: "evt-4",
    userId: MOCK_USER_ID,
    userName: "Тестовый студент",
    text: "Спасибо, зарегистрировался. Жду лекцию!",
    createdAt: "2026-10-29T11:00:00.000Z",
  },
  {
    id: "comment-3",
    eventId: "evt-5",
    userId: "user-3",
    userName: "Ержан",
    text: "Нужно ли заранее подготовить резюме?",
    createdAt: "2026-10-30T14:15:00.000Z",
  },
];

let comments = [...initialComments];

export async function getComments(eventId: string): Promise<Comment[]> {
  await delay();
  maybeFail();
  if (!(await getEventById(eventId))) {
    throw new ServiceError("NOT_FOUND", "Событие не найдено");
  }
  return comments
    .filter((comment) => comment.eventId === eventId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createComment(input: {
  eventId: string;
  userId: string;
  userName: string;
  text: string;
}): Promise<Comment> {
  await delay();
  maybeFail();
  if (!(await getEventById(input.eventId))) {
    throw new ServiceError("NOT_FOUND", "Событие не найдено");
  }
  const comment: Comment = {
    ...input,
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  comments = [...comments, comment];
  return comment;
}
