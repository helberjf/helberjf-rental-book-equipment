export type PaymentStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export interface RentalFinancialInput {
  finalAmountCents: number;
  payments: Array<{
    amountCents: number;
    status: PaymentStatus;
  }>;
}

export interface RentalFinancialResult {
  finalAmountCents: number;
  receivedAmountCents: number;
  remainingAmountCents: number;
}

export const calculateRentalFinancials = (
  input: RentalFinancialInput,
): RentalFinancialResult => {
  const receivedAmountCents = input.payments
    .filter((payment) => payment.status === "CONFIRMED")
    .reduce((total, payment) => total + payment.amountCents, 0);

  return {
    finalAmountCents: input.finalAmountCents,
    receivedAmountCents,
    remainingAmountCents: Math.max(
      input.finalAmountCents - receivedAmountCents,
      0,
    ),
  };
};
