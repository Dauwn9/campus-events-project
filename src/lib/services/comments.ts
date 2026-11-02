import * as mock from "@/lib/mocks/comments";
import { ServiceError, USE_MOCKS } from "./errors";
import type { Comment } from "@/lib/validators/comment";

const notReady = (): never => {
  throw new ServiceError("INTERNAL", "Реальный сервис комментариев ещё не подключён");
};

export async function getComments(eventId: string): Promise<Comment[]> {
  return USE_MOCKS ? mock.getComments(eventId) : notReady();
}

export async function createComment(input: {
  eventId: string;
  userId: string;
  userName: string;
  text: string;
}): Promise<Comment> {
  return USE_MOCKS ? mock.createComment(input) : notReady();
}
