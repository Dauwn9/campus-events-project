import type { PrismaClient } from "../src/generated/prisma/client";
import { qrTokenFor } from "../src/lib/services/tickets";

/**
 * Заполняет qrToken у подтверждённых записей, где его ещё нет
 * (например, у записей, созданных seed до появления QR-билетов).
 * Токен детерминированный: id записи + подпись HMAC с ключом QR_SECRET.
 */
export async function fillMissingQrTokens(prisma: PrismaClient) {
  if (!process.env.QR_SECRET) {
    console.warn(
      "QR_SECRET не задан: QR-токены не заполнены. Задайте QR_SECRET и запустите npm run db:backfill-qr.",
    );
    return 0;
  }
  const missing = await prisma.registration.findMany({
    where: { status: "CONFIRMED", qrToken: null },
    select: { id: true },
  });
  for (const { id } of missing) {
    await prisma.registration.update({
      where: { id },
      data: { qrToken: qrTokenFor(id) },
    });
  }
  return missing.length;
}
