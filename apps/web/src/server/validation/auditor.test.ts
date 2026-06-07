import { describe, expect, it } from "vitest";

import { sopAcknowledgementListQuerySchema } from "./auditor";

describe("auditor validation", () => {
  it("accepts SOP acknowledgement filters", () => {
    expect(
      sopAcknowledgementListQuerySchema.parse({
        procedureId: "11111111-1111-4111-8111-111111111111",
        procedureVersionId: "22222222-2222-4222-8222-222222222222",
        userId: "33333333-3333-4333-8333-333333333333",
        status: "understood",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-08",
      }),
    ).toMatchObject({
      status: "understood",
      dateFrom: "2026-06-01",
    });
  });

  it("rejects unknown SOP acknowledgement status", () => {
    expect(() =>
      sopAcknowledgementListQuerySchema.parse({
        status: "approved",
      }),
    ).toThrow();
  });
});
