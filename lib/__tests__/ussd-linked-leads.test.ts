import assert from "node:assert/strict";
import test from "node:test";

test("linked lead lookup matches applications by application id and message metadata", async () => {
  const mod = await import("../ussd-linked-leads.ts");

  const lookup = mod.buildUssdLinkedLeadLookup(
    [
      {
        loanApplicationUssdId: 101,
        referenceNumber: "REF-101",
        messageId: "MSG-101",
      },
      {
        loanApplicationUssdId: 202,
        referenceNumber: "REF-202",
        messageId: "MSG-202",
      },
    ],
    [
      {
        id: "lead-1",
        stateMetadata: { applicationId: 101 },
        currentStage: { name: "Initiation" },
      },
      {
        id: "lead-2",
        stateMetadata: { messageId: "MSG-202" },
        currentStage: { name: "Approved" },
      },
    ]
  );

  assert.deepEqual(lookup.get(101), {
    leadId: "lead-1",
    currentStageName: "Initiation",
  });
  assert.deepEqual(lookup.get(202), {
    leadId: "lead-2",
    currentStageName: "Approved",
  });
});
