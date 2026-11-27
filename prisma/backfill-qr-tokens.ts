import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";
import { fillMissingQrTokens } from "./qr-tokens";

// Разовое заполнение QR-токенов для уже существующих подтверждённых записей.
// Данные не удаляет. Запуск: npm run db:backfill-qr
async function main() {
  const prisma = getPrisma();
  const filled = await fillMissingQrTokens(prisma);
  console.log(`QR-токены заполнены: ${filled}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
