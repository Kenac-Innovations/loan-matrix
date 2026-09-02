import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_REPLACE_EXISTING_ELIGIBILITY,
  shouldBeginEligibilityReplacement,
} from "../loan-eligibility-upload-mode";

test("eligibility uploads append by default", () => {
  assert.equal(DEFAULT_REPLACE_EXISTING_ELIGIBILITY, false);
  assert.equal(
    shouldBeginEligibilityReplacement({
      replaceExisting: DEFAULT_REPLACE_EXISTING_ELIGIBILITY,
      isFirstSync: true,
      batchIndex: 0,
    }),
    false
  );
});

test("replacement deactivates existing eligibility only for the first batch of a new upload", () => {
  assert.equal(
    shouldBeginEligibilityReplacement({ replaceExisting: true, isFirstSync: true, batchIndex: 0 }),
    true
  );
  assert.equal(
    shouldBeginEligibilityReplacement({ replaceExisting: true, isFirstSync: true, batchIndex: 1 }),
    false
  );
  assert.equal(
    shouldBeginEligibilityReplacement({ replaceExisting: true, isFirstSync: false, batchIndex: 0 }),
    false
  );
});
