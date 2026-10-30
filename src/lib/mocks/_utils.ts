export const MOCK_USER_ID = "user-1";
 
export const delay = (min = 300, max = 600) =>
  new Promise<void>((r) => setTimeout(r, min + Math.random() * (max - min)));
 
/** Включить ошибки: NEXT_PUBLIC_MOCK_ERRORS=true (≈20% запросов падают). */
export function maybeFail() {
  if (process.env.NEXT_PUBLIC_MOCK_ERRORS === "true" && Math.random() < 0.2) {
    throw new Error("Тестовая ошибка мока");
  }
}
 
const H = 3600_000;
export const inHours = (h: number) => new Date(Date.now() + h * H).toISOString();