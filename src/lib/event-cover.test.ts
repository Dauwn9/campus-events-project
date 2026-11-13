import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeEventCover, EventCoverError } from "./event-cover";

test("encodes a valid local image as a data URL", async () => {
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const file = new File([pngBytes], "cover.png", { type: "image/png" });

  assert.equal(
    await encodeEventCover(file),
    `data:image/png;base64,${Buffer.from(pngBytes).toString("base64")}`,
  );
});

test("rejects empty, oversized, and unsupported image files", async () => {
  await assert.rejects(
    encodeEventCover(new File([], "empty.png")),
    EventCoverError,
  );
  await assert.rejects(
    encodeEventCover(
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png"),
    ),
    /4 МБ/,
  );
  await assert.rejects(
    encodeEventCover(new File([new Uint8Array([0, 1, 2])], "invalid.png")),
    /формате JPG, PNG или WebP/,
  );
});
