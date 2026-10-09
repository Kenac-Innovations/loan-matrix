import assert from "node:assert/strict";
import { PASSWORD_RULES, validateNewPassword } from "./password-policy";

function run() {
  // PASSWORD_RULES
  assert.deepEqual(
    PASSWORD_RULES.map((rule) => rule.id),
    ["length", "uppercase", "lowercase", "number", "special"]
  );
  const strong = "Abcdef1!";
  assert.equal(PASSWORD_RULES.every((rule) => rule.test(strong)), true);
  assert.equal(PASSWORD_RULES[0].test("Abcde1!"), false);
  assert.equal(PASSWORD_RULES[1].test("abcdef1!"), false);
  assert.equal(PASSWORD_RULES[2].test("ABCDEF1!"), false);
  assert.equal(PASSWORD_RULES[3].test("Abcdefg!"), false);
  assert.equal(PASSWORD_RULES[4].test("Abcdefg1"), false);

  // validateNewPassword: valid input
  assert.deepEqual(
    validateNewPassword({
      currentPassword: "OldPass1!",
      password: strong,
      repeatPassword: strong,
    }),
    { valid: true, errors: [] }
  );

  // missing current password
  assert.deepEqual(
    validateNewPassword({ currentPassword: "", password: strong, repeatPassword: strong }),
    { valid: false, errors: ["Enter your current password."] }
  );

  // missing new password
  assert.deepEqual(
    validateNewPassword({ currentPassword: "OldPass1!", password: "", repeatPassword: "" }),
    { valid: false, errors: ["Enter a new password."] }
  );

  // mismatch
  assert.deepEqual(
    validateNewPassword({
      currentPassword: "OldPass1!",
      password: strong,
      repeatPassword: "Abcdef1?",
    }),
    { valid: false, errors: ["Passwords don't match."] }
  );

  // failing rules: lists the summary sentence followed by failing labels
  assert.deepEqual(
    validateNewPassword({
      currentPassword: "OldPass1!",
      password: "abc",
      repeatPassword: "abc",
    }),
    {
      valid: false,
      errors: [
        "Password doesn't meet every requirement.",
        "8+ characters",
        "Uppercase letter",
        "Number",
        "Special character",
      ],
    }
  );

  // new equals current
  assert.deepEqual(
    validateNewPassword({
      currentPassword: strong,
      password: strong,
      repeatPassword: strong,
    }),
    {
      valid: false,
      errors: ["Choose a password that's different from your current one."],
    }
  );

  console.log("All tests passed!");
}

run();
