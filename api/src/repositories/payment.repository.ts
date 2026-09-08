import type { PrismaClient } from "@prisma/client";

export class PaymentRepository {
  constructor(private readonly client: PrismaClient) {}

  listByRental(rentalId: number) {
    return this.client.payment.findMany({
      where: { rentalId },
      orderBy: { paidAt: "desc" },
    });
  }
}
