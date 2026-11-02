export type ServiceErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "ALREADY_REGISTERED"
  | "EVENT_FULL"
  | "EVENT_PAST"
  | "NOT_OPEN_YET"
  | "FORBIDDEN"
  | "ALREADY_EXISTS"
  | "CATEGORY_IN_USE"
  | "INTERNAL";

export class ServiceError extends Error {
  constructor(public code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
  }
}

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";