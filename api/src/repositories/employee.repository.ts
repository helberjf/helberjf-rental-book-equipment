import type { PrismaClient } from "@prisma/client";

export class EmployeeRepository {
  constructor(private readonly client: PrismaClient) {}

  async listActive(startAt?: Date, endAt?: Date) {
    const overlap = startAt && endAt ? { startAt: { lt: endAt }, endAt: { gt: startAt } } : { id: -1 };
    const employees = await this.client.employee.findMany({
      where: { active: true },
      include: {
        bookings: { where: overlap },
        assignments: { where: { rental: { ...overlap, status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } } } },
      },
      orderBy: { name: "asc" },
    });
    return employees.map(({ bookings, assignments, ...employee }) => ({ ...employee, available: !bookings.length && !assignments.length }));
  }
}
