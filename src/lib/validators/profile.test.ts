import assert from "node:assert/strict";
import test from "node:test";
import { passwordSchema } from "./password";
import {
  passwordChangeInputSchema,
  profileInputSchema,
} from "./profile";

test("profile names are trimmed and limited to 2–50 characters", () => {
  const valid = profileInputSchema.parse({
    name: "  Alex Doe  ",
    currentPassword: "",
    password: "",
    passwordConfirmation: "",
  });
  assert.equal(valid.name, "Alex Doe");

  assert.equal(
    profileInputSchema.safeParse({
      name: "A".repeat(51),
      currentPassword: "",
      password: "",
      passwordConfirmation: "",
    }).success,
    false,
  );
});

test("password changes require the registration password rules and confirmation", () => {
  assert.equal(passwordSchema.safeParse("password1").success, true);
  assert.equal(passwordSchema.safeParse("password").success, false);
  assert.equal(passwordSchema.safeParse("12345678").success, false);
  assert.equal(
    passwordChangeInputSchema.safeParse({
      currentPassword: "oldPass1",
      password: "newPass2",
      passwordConfirmation: "newPass2",
    }).success,
    true,
  );
  assert.equal(
    passwordChangeInputSchema.safeParse({
      currentPassword: "samePass1",
      password: "samePass1",
      passwordConfirmation: "samePass1",
    }).success,
    false,
  );

  const result = profileInputSchema.safeParse({
    name: "Alex Doe",
    currentPassword: "oldPass1",
    password: "newPass2",
    passwordConfirmation: "different2",
  });
  assert.equal(result.success, false);

  const reusedPassword = profileInputSchema.safeParse({
    name: "Alex Doe",
    currentPassword: "samePass1",
    password: "samePass1",
    passwordConfirmation: "samePass1",
  });
  assert.equal(reusedPassword.success, false);
});
