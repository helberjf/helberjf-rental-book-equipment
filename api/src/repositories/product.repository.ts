import type { PrismaClient } from "@prisma/client";

export class ProductRepository {
  constructor(private readonly client: PrismaClient) {}

  async listActive(startAt?: Date, endAt?: Date) {
    const products = await this.client.product.findMany({
      where: { active: true },
      include: {
        category: true,
        units: {
          where: { active: true },
          orderBy: { identifier: "asc" },
          include: {
            reservations: {
              where:
                startAt && endAt
                  ? {
                      status: "ACTIVE",
                      blockedFrom: { lt: endAt },
                      blockedUntil: { gt: startAt },
                    }
                  : { id: -1 },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category.name,
      quantity: product.quantity,
      trackIndividualUnits: product.trackIndividualUnits,
      defaultRateCents: product.defaultRateCents,
      units: product.units.map((unit) => ({
        id: unit.id,
        identifier: unit.identifier,
        status: unit.status,
        available:
          unit.status === "AVAILABLE" &&
          unit.reservations.length === 0,
      })),
    }));
  }
}
