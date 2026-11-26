import { createHmac, timingSafeEqual } from "node:crypto";

function getQrSecret() {
  const secret = process.env.QR_SECRET;
  if (!secret) throw new Error("QR_SECRET не задана");
  return secret;
}

function signatureFor(id: string) {
  return createHmac("sha256", getQrSecret()).update(id).digest("base64url");
}

export function qrTokenFor(registrationId: string) {
  return `${registrationId}.${signatureFor(registrationId)}`;
}

export function verifyQrToken(token: string): string | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const id = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) return null;

  const supplied = Buffer.from(signature, "base64url");
  const expected = Buffer.from(signatureFor(id), "base64url");
  if (
    supplied.length !== expected.length ||
    supplied.toString("base64url") !== signature ||
    !timingSafeEqual(supplied, expected)
  )
    return null;

  return id;
}

export function shortCodeFor(registrationId: string) {
  return createHmac("sha256", getQrSecret())
    .update(`short-code:${registrationId}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
}
