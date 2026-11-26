import assert from "node:assert/strict";
import test from "node:test";
import { getComments } from "./comments";

test("getComments keeps using the demo store when mocks are enabled", async () => {
  const comments = await getComments("evt-1");
  assert.ok(Array.isArray(comments));
  assert.ok(comments.every((comment) => comment.eventId === "evt-1"));
});
