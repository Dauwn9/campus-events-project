const MAX_EVENT_COVER_SIZE = 4 * 1024 * 1024;

type EventCoverFormat = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export class EventCoverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventCoverError";
  }
}

function detectImageFormat(bytes: Uint8Array): EventCoverFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mimeType: "image/jpeg" };

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return { mimeType: "image/png" };

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return { mimeType: "image/webp" };

  return null;
}

export async function encodeEventCover(file: File): Promise<string> {
  if (file.size === 0)
    throw new EventCoverError("Выберите непустой файл изображения.");
  if (file.size > MAX_EVENT_COVER_SIZE)
    throw new EventCoverError("Размер фото не должен превышать 4 МБ.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectImageFormat(bytes);
  if (!format)
    throw new EventCoverError("Загрузите изображение в формате JPG, PNG или WebP.");

  return `data:${format.mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}
