import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { qrTokenFor, shortCodeFor, verifyQrToken } from "./tickets";

const previousSecret = process.env.QR_SECRET;
before(() => {
  process.env.QR_SECRET = "test-only-qr-secret";
});
after(() => {
  if (previousSecret === undefined) delete process.env.QR_SECRET;
  else process.env.QR_SECRET = previousSecret;
});

test("QR-токен содержит ID регистрации и корректную подпись HMAC-SHA256", () => {
  const id = "registration-123";
  const expected = createHmac("sha256", process.env.QR_SECRET!)
    .update(id)
    .digest("base64url");
  const token = qrTokenFor(id);

  assert.equal(token, `${id}.${expected}`);
  assert.equal(verifyQrToken(token), id);
});

test("подделанный или некорректно закодированный токен не проходит проверку", () => {
  const token = qrTokenFor("registration-123");
  const [id, signature] = token.split(".");
  const forgedSignature = `${signature.slice(0, -1)}${
    signature.endsWith("A") ? "B" : "A"
  }`;

  assert.equal(verifyQrToken(`${id}.${forgedSignature}`), null);
  assert.equal(verifyQrToken(`${id}.invalid`), null);
  assert.equal(verifyQrToken("invalid"), null);
});

test("короткий код стабилен и состоит из десяти символов", () => {
  const code = shortCodeFor("registration-123");

  assert.equal(shortCodeFor("registration-123"), code);
  assert.match(code, /^[A-F0-9]{10}$/);
});
