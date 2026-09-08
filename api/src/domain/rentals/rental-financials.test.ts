import { describe, expect, it } from "vitest";
import { calculateRentalFinancials } from "./rental-financials";

describe("calculateRentalFinancials", () => {
  it("calculates received and remaining amounts from confirmed payments", () => {
    const result = calculateRentalFinancials({
      finalAmountCents: 150000,
      payments: [
        { amountCents: 50000, status: "CONFIRMED" },
        { amountCents: 25000, status: "PENDING" },
        { amountCents: 20000, status: "CONFIRMED" },
      ],
    });

    expect(result.receivedAmountCents).toBe(70000);
    expect(result.remainingAmountCents).toBe(80000);
  });

  it("never returns a negative remaining amount when overpaid", () => {
    const result = calculateRentalFinancials({
      finalAmountCents: 100000,
      payments: [{ amountCents: 120000, status: "CONFIRMED" }],
    });

    expect(result.receivedAmountCents).toBe(120000);
    expect(result.remainingAmountCents).toBe(0);
  });
});
